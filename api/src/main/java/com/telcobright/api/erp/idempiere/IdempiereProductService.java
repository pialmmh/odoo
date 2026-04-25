package com.telcobright.api.erp.idempiere;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.sql.*;
import java.util.*;

/**
 * Read-only access to iDempiere's M_Product window via direct JDBC.
 * Pure DriverManager pattern — same approach as GaleraService — no pool.
 *
 * Why direct JDBC and not iDempiere REST: the trekglobal REST plugin is
 * not installed in the local iDempiere runtime (see docs). Once it is,
 * writes/callouts will route through it; reads can stay direct for speed.
 */
@Service
public class IdempiereProductService {

    private static final Logger log = LoggerFactory.getLogger(IdempiereProductService.class);

    private final IdempiereProperties props;
    /** lowercase-DB-column → AD column name (e.g. "isactive" → "IsActive"). */
    private final Map<String, String> adColumnByLower = new HashMap<>();

    public IdempiereProductService(IdempiereProperties props) {
        this.props = props;
    }

    @PostConstruct
    private void loadAdColumnNames() {
        try (InputStream is = new ClassPathResource("erp/idempiere/m_product_window.json").getInputStream()) {
            JsonNode root = new ObjectMapper().readTree(is);
            for (JsonNode tab : root.path("tabs")) {
                for (JsonNode f : tab.path("fields")) {
                    String col = f.path("columnName").asText(null);
                    if (col != null && !col.isEmpty()) {
                        adColumnByLower.put(col.toLowerCase(), col);
                    }
                }
            }
            log.info("Loaded {} AD column names for M_Product window", adColumnByLower.size());
        } catch (Exception e) {
            log.warn("Failed to load M_Product AD spec — falling back to underscore camelize", e);
        }
    }

    /**
     * Convert an AD column name into idiomatic JS camelCase.
     * Splits on underscores AND case boundaries (so all-caps abbreviations
     * like "ID" or "UOM" become "Id"/"Uom" rather than dragging into the
     * preceding word).
     *
     *   IsActive            → isActive
     *   M_Product_ID        → mProductId
     *   C_UOM_ID            → cUomId
     *   IsBOMPriceOverride  → isBomPriceOverride
     *   ImageURL            → imageUrl
     */
    static String camelFromAd(String adName) {
        if (adName == null || adName.isEmpty()) return adName;
        String[] parts = adName.split("_|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])");
        StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (String p : parts) {
            if (p.isEmpty()) continue;
            String low = p.toLowerCase();
            if (first) {
                sb.append(low);
                first = false;
            } else {
                sb.append(Character.toUpperCase(low.charAt(0))).append(low.substring(1));
            }
        }
        return sb.toString();
    }

    private Connection open() throws SQLException {
        return DriverManager.getConnection(props.getJdbcUrl(), props.getUsername(), props.getPassword());
    }

    private String clientIdInClause() {
        List<Integer> ids = props.clientIdList();
        if (ids.isEmpty()) return "(0)";
        StringBuilder sb = new StringBuilder("(");
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(ids.get(i));
        }
        sb.append(")");
        return sb.toString();
    }

    // ─── List ──────────────────────────────────────────────────────────────
    /**
     * Returns a page of products. Matches the AD list-page columns where
     * IsDisplayedGrid='Y' is meaningful — kept curated for v1 (8 cols).
     */
    public ListResult list(String search, int page, int size, String sortField, String sortDir) {
        String s = props.getSchema();
        String order = resolveSort(sortField, sortDir);
        String where = "p.ad_client_id IN " + clientIdInClause();
        if (search != null && !search.isBlank()) {
            where += " AND (LOWER(p.value) LIKE ? OR LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ?)";
        }
        String selectSql =
                "SELECT p.m_product_id, p.value, p.name, p.description, p.sku, " +
                "       p.producttype, p.isactive, p.isstocked, p.issold, p.ispurchased, " +
                "       p.m_product_category_id, pc.name AS category_name, " +
                "       p.c_uom_id, u.name AS uom_name, " +
                "       p.ad_org_id, o.name AS org_name " +
                "FROM " + s + ".m_product p " +
                "LEFT JOIN " + s + ".m_product_category pc ON pc.m_product_category_id = p.m_product_category_id " +
                "LEFT JOIN " + s + ".c_uom u ON u.c_uom_id = p.c_uom_id " +
                "LEFT JOIN " + s + ".ad_org o ON o.ad_org_id = p.ad_org_id " +
                "WHERE " + where + " " +
                "ORDER BY " + order + " " +
                "LIMIT ? OFFSET ?";
        String countSql = "SELECT COUNT(*) FROM " + s + ".m_product p WHERE " + where;
        List<Map<String, Object>> rows = new ArrayList<>();
        long total;
        int offset = Math.max(0, page) * Math.max(1, size);
        try (Connection c = open()) {
            try (PreparedStatement st = c.prepareStatement(selectSql)) {
                int i = 1;
                if (search != null && !search.isBlank()) {
                    String like = "%" + search.toLowerCase().trim() + "%";
                    st.setString(i++, like);
                    st.setString(i++, like);
                    st.setString(i++, like);
                }
                st.setInt(i++, Math.max(1, size));
                st.setInt(i, offset);
                try (ResultSet rs = st.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("id", rs.getLong("m_product_id"));
                        row.put("value", rs.getString("value"));
                        row.put("name", rs.getString("name"));
                        row.put("description", rs.getString("description"));
                        row.put("sku", rs.getString("sku"));
                        row.put("productType", productTypeLabel(rs.getString("producttype")));
                        row.put("productTypeCode", rs.getString("producttype"));
                        row.put("isActive", "Y".equals(rs.getString("isactive")));
                        row.put("isStocked", "Y".equals(rs.getString("isstocked")));
                        row.put("isSold", "Y".equals(rs.getString("issold")));
                        row.put("isPurchased", "Y".equals(rs.getString("ispurchased")));
                        row.put("productCategoryId", rs.getLong("m_product_category_id"));
                        row.put("productCategoryName", rs.getString("category_name"));
                        row.put("uomId", rs.getLong("c_uom_id"));
                        row.put("uomName", rs.getString("uom_name"));
                        row.put("orgId", rs.getLong("ad_org_id"));
                        row.put("orgName", rs.getString("org_name"));
                        rows.add(row);
                    }
                }
            }
            try (PreparedStatement st = c.prepareStatement(countSql)) {
                if (search != null && !search.isBlank()) {
                    String like = "%" + search.toLowerCase().trim() + "%";
                    st.setString(1, like);
                    st.setString(2, like);
                    st.setString(3, like);
                }
                try (ResultSet rs = st.executeQuery()) {
                    rs.next();
                    total = rs.getLong(1);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("idempiere list failed: " + e.getMessage(), e);
        }
        return new ListResult(rows, total, page, size);
    }

    private String resolveSort(String field, String dir) {
        Set<String> allowed = Set.of("value", "name", "sku", "producttype", "isactive");
        String f = field == null ? "value" : field.toLowerCase();
        if (!allowed.contains(f)) f = "value";
        String d = "desc".equalsIgnoreCase(dir) ? "DESC" : "ASC";
        return "p." + f + " " + d;
    }

    private String productTypeLabel(String code) {
        if (code == null) return null;
        return switch (code) {
            case "I" -> "Item";
            case "S" -> "Service";
            case "R" -> "Resource";
            case "E" -> "Expense type";
            case "O" -> "Online";
            case "A" -> "Asset";
            default -> code;
        };
    }

    // ─── Detail ────────────────────────────────────────────────────────────
    /**
     * Returns the M_Product header row with FK display values resolved.
     * Camel-cased keys, no iDempiere column names leak to the UI.
     */
    public Map<String, Object> getById(long id) {
        String s = props.getSchema();
        String sql =
                "SELECT p.*, " +
                "       pc.name AS _cat_name, " +
                "       u.name  AS _uom_name, " +
                "       o.name  AS _org_name, " +
                "       cl.name AS _client_name, " +
                "       tc.name AS _taxcat_name, " +
                "       fc.name AS _freight_name, " +
                "       sr.name AS _salesrep_name, " +
                "       pt.name AS _parttype_name, " +
                "       atts.name AS _attset_name, " +
                "       loc.value AS _locator_value, " +
                "       rr.name AS _revrec_name, " +
                "       mt.name AS _mailtmpl_name, " +
                "       et.name AS _expense_name, " +
                "       res.name AS _resource_name " +
                "FROM " + s + ".m_product p " +
                "LEFT JOIN " + s + ".m_product_category pc ON pc.m_product_category_id = p.m_product_category_id " +
                "LEFT JOIN " + s + ".c_uom u ON u.c_uom_id = p.c_uom_id " +
                "LEFT JOIN " + s + ".ad_org o ON o.ad_org_id = p.ad_org_id " +
                "LEFT JOIN " + s + ".ad_client cl ON cl.ad_client_id = p.ad_client_id " +
                "LEFT JOIN " + s + ".c_taxcategory tc ON tc.c_taxcategory_id = p.c_taxcategory_id " +
                "LEFT JOIN " + s + ".m_freightcategory fc ON fc.m_freightcategory_id = p.m_freightcategory_id " +
                "LEFT JOIN " + s + ".ad_user sr ON sr.ad_user_id = p.salesrep_id " +
                "LEFT JOIN " + s + ".m_parttype pt ON pt.m_parttype_id = p.m_parttype_id " +
                "LEFT JOIN " + s + ".m_attributeset atts ON atts.m_attributeset_id = p.m_attributeset_id " +
                "LEFT JOIN " + s + ".m_locator loc ON loc.m_locator_id = p.m_locator_id " +
                "LEFT JOIN " + s + ".c_revenuerecognition rr ON rr.c_revenuerecognition_id = p.c_revenuerecognition_id " +
                "LEFT JOIN " + s + ".r_mailtext mt ON mt.r_mailtext_id = p.r_mailtext_id " +
                "LEFT JOIN " + s + ".s_expensetype et ON et.s_expensetype_id = p.s_expensetype_id " +
                "LEFT JOIN " + s + ".s_resource res ON res.s_resource_id = p.s_resource_id " +
                "WHERE p.m_product_id = ? AND p.ad_client_id IN " + clientIdInClause();
        try (Connection c = open();
             PreparedStatement st = c.prepareStatement(sql)) {
            st.setLong(1, id);
            try (ResultSet rs = st.executeQuery()) {
                if (!rs.next()) return null;
                ResultSetMetaData md = rs.getMetaData();
                Map<String, Object> base = new LinkedHashMap<>();
                for (int i = 1; i <= md.getColumnCount(); i++) {
                    String col = md.getColumnLabel(i).toLowerCase();
                    Object val = rs.getObject(i);
                    base.put(col, normalize(val));
                }
                // Camel-case the keys (AD-aware) + attach lookup display names.
                Map<String, Object> out = camelize(base);
                // Boolean-ify Y/N flags using AD spec — the heuristic in camelize() can't
                // see the column type, so any AD column starting with Is/Has/Discontinued
                // that holds 'Y'/'N' is converted here.
                for (var key : new ArrayList<>(out.keySet())) {
                    Object v = out.get(key);
                    if (v instanceof String yn && (yn.equals("Y") || yn.equals("N"))) {
                        if (key.startsWith("is") || key.startsWith("has") || key.equals("discontinued")) {
                            out.put(key, "Y".equals(yn));
                        }
                    }
                }
                out.put("productCategoryName", base.get("_cat_name"));
                out.put("uomName", base.get("_uom_name"));
                out.put("orgName", base.get("_org_name"));
                out.put("clientName", base.get("_client_name"));
                out.put("taxCategoryName", base.get("_taxcat_name"));
                out.put("freightCategoryName", base.get("_freight_name"));
                out.put("salesRepName", base.get("_salesrep_name"));
                out.put("partTypeName", base.get("_parttype_name"));
                out.put("attributeSetName", base.get("_attset_name"));
                out.put("locatorValue", base.get("_locator_value"));
                out.put("revenueRecognitionName", base.get("_revrec_name"));
                out.put("mailTextName", base.get("_mailtmpl_name"));
                out.put("expenseTypeName", base.get("_expense_name"));
                out.put("resourceName", base.get("_resource_name"));
                out.put("productTypeLabel", productTypeLabel((String) out.get("productType")));
                // Drop the temp underscore keys
                out.keySet().removeIf(k -> k.startsWith("_"));
                return out;
            }
        } catch (SQLException e) {
            throw new RuntimeException("idempiere get product failed: " + e.getMessage(), e);
        }
    }

    private Object normalize(Object v) {
        if (v == null) return null;
        if (v instanceof java.sql.Timestamp ts) return ts.toInstant().toString();
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        return v;
    }

    private Map<String, Object> camelize(Map<String, Object> in) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (var e : in.entrySet()) {
            String key = e.getKey();
            if (key.startsWith("_")) {
                out.put(key, e.getValue());
                continue;
            }
            String adName = adColumnByLower.get(key);
            String camel = adName != null ? camelFromAd(adName) : underscoreCamel(key);
            out.put(camel, e.getValue());
        }
        return out;
    }

    private static String underscoreCamel(String key) {
        String[] parts = key.split("_");
        StringBuilder sb = new StringBuilder(parts[0]);
        for (int i = 1; i < parts.length; i++) {
            String p = parts[i];
            if (p.isEmpty()) continue;
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.toString();
    }

    public record ListResult(List<Map<String, Object>> items, long total, int page, int size) {}
}
