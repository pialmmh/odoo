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

    // ─── Update (slice 2a — equivalent fields only) ───────────────────────
    /**
     * Patch an M_Product row with the whitelisted equivalent-mapping
     * fields. Direct JDBC matches the existing read pattern in this file
     * — proper GridTab-routed writes are deferred (see global memory
     * "No custom SQL against iDempiere": rule applies to *new* entities;
     * M_Product predates this work).
     *
     * Concurrency: if {@code ifMatchUpdatedMs} is non-null and the row's
     * current Updated is newer, throws {@link StaleTokenException} so
     * the caller can surface a 409 with the fresh row.
     *
     * @param patchCamel keys are camelCase names from {@link com.telcobright.api.erpv2.dto.ProductDto}
     */
    public void update(long id, Map<String, Object> patchCamel, Long ifMatchUpdatedMs) {
        String s = props.getSchema();

        // Whitelist: ProductDto camel field → AD column name.
        // Slice 2a covers only fields whose iDempiere mapping is `equivalent`
        // per ai-docs/foss-buster/odoo/product/workbook.xlsx (DB-Mapping).
        // Sales / purchase description don't have dedicated columns on
        // M_Product in this schema (verified via information_schema); they
        // stay read-only until a proper docs schema is added.
        Map<String, String> col = new LinkedHashMap<>();
        col.put("name",               "Name");
        col.put("value",              "Value");
        col.put("sku",                "SKU");
        col.put("description",        "Description");
        col.put("upc",                "UPC");
        col.put("isActive",           "IsActive");
        col.put("isStocked",          "IsStocked");
        col.put("isSold",             "IsSold");
        col.put("isPurchased",        "IsPurchased");
        // m2o foreign keys (slice 2c)
        col.put("productCategoryId",  "M_Product_Category_ID");
        col.put("uomId",              "C_UOM_ID");
        col.put("taxCategoryId",      "C_TaxCategory_ID");
        // selection (slice 2d) — value is the iDempiere code I/S/R/E/O/A
        col.put("productTypeCode",    "ProductType");

        // Build the SET clause from intersection.
        List<String> setSql = new ArrayList<>();
        List<Object> setVals = new ArrayList<>();
        for (var e : patchCamel.entrySet()) {
            String adCol = col.get(e.getKey());
            if (adCol == null) continue; // silently drop unknown / non-whitelisted keys
            setSql.add(adCol + " = ?");
            setVals.add(coerceForCol(adCol, e.getValue()));
        }
        if (setSql.isEmpty()) {
            log.info("update(M_Product#{}): no whitelisted fields in patch — no-op", id);
            return;
        }
        // Always bump Updated/UpdatedBy ourselves (no callout/triggers from JDBC).
        setSql.add("Updated = CURRENT_TIMESTAMP");
        // UpdatedBy: 100 (System) — slice 2a doesn't yet thread the iDempiere user id.
        setSql.add("UpdatedBy = 100");

        try (Connection c = open()) {
            c.setAutoCommit(false);
            // 1) Concurrency check: read current Updated under FOR UPDATE.
            Long currentMs = null;
            String checkSql = "SELECT Updated FROM " + s + ".m_product WHERE m_product_id = ? AND ad_client_id IN " + clientIdInClause() + " FOR UPDATE";
            try (PreparedStatement ps = c.prepareStatement(checkSql)) {
                ps.setLong(1, id);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        c.rollback();
                        throw new NotFoundException("product " + id + " not found");
                    }
                    java.sql.Timestamp ts = rs.getTimestamp(1);
                    currentMs = ts == null ? null : ts.getTime();
                }
            }
            if (ifMatchUpdatedMs != null && currentMs != null && currentMs > ifMatchUpdatedMs) {
                c.rollback();
                throw new StaleTokenException(
                    "product " + id + " has been updated since you loaded it",
                    currentMs);
            }
            // 2) UPDATE.
            String updateSql = "UPDATE " + s + ".m_product SET " + String.join(", ", setSql)
                    + " WHERE m_product_id = ? AND ad_client_id IN " + clientIdInClause();
            try (PreparedStatement ps = c.prepareStatement(updateSql)) {
                int i = 1;
                for (Object v : setVals) ps.setObject(i++, v);
                ps.setLong(i, id);
                int n = ps.executeUpdate();
                if (n != 1) {
                    c.rollback();
                    throw new RuntimeException("update affected " + n + " rows (expected 1)");
                }
            }
            c.commit();
        } catch (SQLException e) {
            throw new RuntimeException("idempiere update product failed: " + e.getMessage(), e);
        }
    }

    /** Coerce a JSON-decoded value to what JDBC expects for the column. */
    private Object coerceForCol(String adCol, Object v) {
        if (v == null) return null;
        // Y/N flags: anything starting with Is/Has + boolean-ish input → "Y"/"N".
        if (adCol.startsWith("Is") || adCol.startsWith("Has")) {
            if (v instanceof Boolean b) return b ? "Y" : "N";
            String sv = v.toString();
            if ("true".equalsIgnoreCase(sv) || "Y".equalsIgnoreCase(sv)) return "Y";
            if ("false".equalsIgnoreCase(sv) || "N".equalsIgnoreCase(sv)) return "N";
            return v;
        }
        return v;
    }

    public static class StaleTokenException extends RuntimeException {
        private final long currentMs;
        public StaleTokenException(String msg, long currentMs) {
            super(msg);
            this.currentMs = currentMs;
        }
        public long currentMs() { return currentMs; }
    }

    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String msg) { super(msg); }
    }

    public static class ValidationException extends RuntimeException {
        public ValidationException(String msg) { super(msg); }
    }

    // ─── Lookups for m2o pickers ──────────────────────────────────────────
    /**
     * Generic AD lookup: read (id, name) from a table by convention
     * &lt;table&gt;_ID is the PK and Name is the display column. Scoped to
     * the configured AD_Client (or system, ad_client_id=0).
     */
    public List<com.telcobright.api.erpv2.ErpAdapter.NamedRef> listLookup(String tableName) {
        String s = props.getSchema();
        String tbl = tableName.toLowerCase();
        // Tables with no AD_Client_ID (system-wide) — only C_UOM here.
        boolean systemScope = "c_uom".equals(tbl);
        String where = systemScope
                ? "isactive = 'Y'"
                : "isactive = 'Y' AND (ad_client_id = 0 OR ad_client_id IN " + clientIdInClause() + ")";
        String sql = "SELECT " + tbl + "_id AS id, name FROM " + s + "." + tbl
                + " WHERE " + where + " ORDER BY name";
        List<com.telcobright.api.erpv2.ErpAdapter.NamedRef> out = new ArrayList<>();
        try (Connection c = open();
             PreparedStatement st = c.prepareStatement(sql);
             ResultSet rs = st.executeQuery()) {
            while (rs.next()) {
                out.add(new com.telcobright.api.erpv2.ErpAdapter.NamedRef(rs.getLong(1), rs.getString(2)));
            }
        } catch (SQLException e) {
            throw new RuntimeException("idempiere lookup " + tableName + " failed: " + e.getMessage(), e);
        }
        return out;
    }

    /** Static product-type list — iDempiere's enum encoded as NamedRef. */
    public List<com.telcobright.api.erpv2.ErpAdapter.NamedRef> listProductTypes() {
        // (id, name) where id is the enum code as a long-shaped surrogate.
        // We carry the human-readable name; the UI sends back the code via
        // a separate productTypeCode field on patch/create.
        return List.of(
            new com.telcobright.api.erpv2.ErpAdapter.NamedRef(1L, "Item"),
            new com.telcobright.api.erpv2.ErpAdapter.NamedRef(2L, "Service"),
            new com.telcobright.api.erpv2.ErpAdapter.NamedRef(3L, "Resource"),
            new com.telcobright.api.erpv2.ErpAdapter.NamedRef(4L, "Expense type"),
            new com.telcobright.api.erpv2.ErpAdapter.NamedRef(5L, "Online"),
            new com.telcobright.api.erpv2.ErpAdapter.NamedRef(6L, "Asset"));
    }

    // ─── Pricing (slice 2b) ───────────────────────────────────────────────
    public record PriceRow(java.math.BigDecimal listPrice, java.math.BigDecimal standardPrice, Long priceListVersionId) {}

    /** Find the active (latest validFrom &lt;= today) version of the tenant's
     *  default sales pricelist. Returns null if none. */
    private Long resolveActivePriceListVersion(Connection c) throws SQLException {
        String s = props.getSchema();
        String sql = "SELECT plv.m_pricelist_version_id " +
                "FROM " + s + ".m_pricelist pl " +
                "JOIN " + s + ".m_pricelist_version plv ON plv.m_pricelist_id = pl.m_pricelist_id " +
                "WHERE pl.ad_client_id IN " + clientIdInClause() +
                "  AND pl.issopricelist = 'Y' " +
                "  AND pl.isactive = 'Y' " +
                "  AND plv.isactive = 'Y' " +
                "  AND plv.validfrom <= CURRENT_DATE " +
                "ORDER BY plv.validfrom DESC LIMIT 1";
        try (PreparedStatement st = c.prepareStatement(sql);
             ResultSet rs = st.executeQuery()) {
            return rs.next() ? rs.getLong(1) : null;
        }
    }

    public PriceRow readPrice(long productId) {
        try (Connection c = open()) {
            Long plv = resolveActivePriceListVersion(c);
            if (plv == null) return null;
            String s = props.getSchema();
            try (PreparedStatement st = c.prepareStatement(
                    "SELECT pricelist, pricestd FROM " + s + ".m_productprice " +
                    "WHERE m_pricelist_version_id = ? AND m_product_id = ?")) {
                st.setLong(1, plv);
                st.setLong(2, productId);
                try (ResultSet rs = st.executeQuery()) {
                    if (!rs.next()) return new PriceRow(null, null, plv);
                    return new PriceRow(rs.getBigDecimal(1), rs.getBigDecimal(2), plv);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("readPrice failed: " + e.getMessage(), e);
        }
    }

    public PriceRow writePrice(long productId, java.math.BigDecimal listPrice, java.math.BigDecimal standardPrice) {
        try (Connection c = open()) {
            c.setAutoCommit(false);
            Long plv = resolveActivePriceListVersion(c);
            if (plv == null) {
                c.rollback();
                throw new RuntimeException("No active sales pricelist version for tenant");
            }
            String s = props.getSchema();
            // Try update first
            int n;
            try (PreparedStatement st = c.prepareStatement(
                    "UPDATE " + s + ".m_productprice " +
                    "SET pricelist = COALESCE(?, pricelist), " +
                    "    pricestd = COALESCE(?, pricestd), " +
                    "    pricelimit = COALESCE(pricelimit, 0), " +
                    "    updated = CURRENT_TIMESTAMP, updatedby = 100 " +
                    "WHERE m_pricelist_version_id = ? AND m_product_id = ?")) {
                if (listPrice == null)     st.setNull(1, java.sql.Types.NUMERIC); else st.setBigDecimal(1, listPrice);
                if (standardPrice == null) st.setNull(2, java.sql.Types.NUMERIC); else st.setBigDecimal(2, standardPrice);
                st.setLong(3, plv);
                st.setLong(4, productId);
                n = st.executeUpdate();
            }
            if (n == 0) {
                // Insert. M_ProductPrice has its own primary key M_ProductPrice_ID
                // which is NOT NULL but has no DB default — allocate via AD_Sequence
                // the same way create() does for M_Product.
                int adClientId = props.clientIdList().isEmpty() ? 0 : props.clientIdList().get(0);
                long newPpId;
                try (PreparedStatement seq = c.prepareStatement(
                        "UPDATE " + s + ".ad_sequence SET currentnext = currentnext + 1 " +
                        "WHERE name = 'M_ProductPrice' AND ad_client_id = 0 RETURNING currentnext - 1")) {
                    try (ResultSet rs = seq.executeQuery()) {
                        if (!rs.next()) throw new RuntimeException("AD_Sequence row for M_ProductPrice not found");
                        newPpId = rs.getLong(1);
                    }
                }
                try (PreparedStatement st = c.prepareStatement(
                        "INSERT INTO " + s + ".m_productprice (" +
                        "  m_productprice_id, m_pricelist_version_id, m_product_id, pricelist, pricestd, pricelimit, " +
                        "  ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby" +
                        ") VALUES (?, ?, ?, COALESCE(?,0), COALESCE(?,0), 0, ?, 0, 'Y', " +
                        "  CURRENT_TIMESTAMP, 100, CURRENT_TIMESTAMP, 100)")) {
                    st.setLong(1, newPpId);
                    st.setLong(2, plv);
                    st.setLong(3, productId);
                    if (listPrice == null)     st.setNull(4, java.sql.Types.NUMERIC); else st.setBigDecimal(4, listPrice);
                    if (standardPrice == null) st.setNull(5, java.sql.Types.NUMERIC); else st.setBigDecimal(5, standardPrice);
                    st.setInt(6, adClientId);
                    st.executeUpdate();
                }
            }
            c.commit();
            return readPrice(productId);
        } catch (SQLException e) {
            throw new RuntimeException("writePrice failed: " + e.getMessage(), e);
        }
    }

    // ─── Create (slice 2a-CRUD) ───────────────────────────────────────────
    /**
     * Insert a new M_Product row. Required (validated): {@code name},
     * {@code value}. All other NOT-NULL columns get sensible per-tenant
     * defaults (category, UoM, tax-category, org, productType=I) — the user
     * can refine them via the existing PATCH path once the m2o pickers land
     * in slice 2b.
     *
     * @param valuesCamel input map keyed by camelCase ProductDto field names
     * @return the new M_Product_ID
     */
    public long create(Map<String, Object> valuesCamel) {
        // ─── Validation ───────────────────────────────────────────────────
        String name  = strOrNull(valuesCamel.get("name"));
        String value = strOrNull(valuesCamel.get("value"));
        if (name == null)  throw new ValidationException("name is required");
        if (value == null) throw new ValidationException("value is required");

        // ─── Resolve required FKs ─────────────────────────────────────────
        // For slice 2a we hard-code defaults proven to work in the tenant's
        // demo data (GardenWorld). Slice 2b adds m2o pickers that override.
        Long mProductCategoryId = asLong(valuesCamel.get("productCategoryId"), 107L);
        Long cTaxCategoryId     = asLong(valuesCamel.get("taxCategoryId"),     107L);
        Long cUomId             = asLong(valuesCamel.get("uomId"),             100L);
        String productType      = strOrNull(valuesCamel.get("productTypeCode"));
        if (productType == null) productType = "I";
        Long adOrgId            = asLong(valuesCamel.get("orgId"),               0L);

        // Optional flags
        boolean isActive    = boolOr(valuesCamel.get("isActive"),    true);
        boolean isStocked   = boolOr(valuesCamel.get("isStocked"),   true);
        boolean isSold      = boolOr(valuesCamel.get("isSold"),      true);
        boolean isPurchased = boolOr(valuesCamel.get("isPurchased"), true);

        // Optional text
        String sku         = strOrNull(valuesCamel.get("sku"));
        String description = strOrNull(valuesCamel.get("description"));
        String upc         = strOrNull(valuesCamel.get("upc"));

        // Tenant scope — first AD_Client from props (configured per env).
        List<Integer> clients = props.clientIdList();
        if (clients.isEmpty()) throw new RuntimeException("no AD_Client configured for tenant");
        int adClientId = clients.get(0);

        String s = props.getSchema();
        try (Connection c = open()) {
            c.setAutoCommit(false);

            // 1) Allocate next id from AD_Sequence
            long newId;
            try (PreparedStatement st = c.prepareStatement(
                    "UPDATE " + s + ".ad_sequence SET currentnext = currentnext + 1 " +
                    "WHERE name = 'M_Product' AND ad_client_id = 0 RETURNING currentnext - 1")) {
                try (ResultSet rs = st.executeQuery()) {
                    if (!rs.next()) {
                        c.rollback();
                        throw new RuntimeException("AD_Sequence row for M_Product not found");
                    }
                    newId = rs.getLong(1);
                }
            }

            // 2) INSERT — list every NOT-NULL column with a value or default.
            String insertSql =
                    "INSERT INTO " + s + ".m_product (" +
                    "  m_product_id, ad_client_id, ad_org_id, " +
                    "  name, value, sku, description, upc, " +
                    "  m_product_category_id, c_taxcategory_id, c_uom_id, " +
                    "  producttype, " +
                    "  isactive, isstocked, issold, ispurchased, isselfservice, " +
                    "  isbom, isbompriceoverride, isdropship, isexcludeautodelivery, " +
                    "  isinvoiceprintdetails, iskanban, ismanufactured, " +
                    "  isownbox, ispicklistprintdetails, issummary, isverified, " +
                    "  iswebstorefeatured, isautoproduce, " +
                    "  lowlevel, unitsperpack, " +
                    "  created, createdby, updated, updatedby" +
                    ") VALUES (" +
                    "  ?, ?, ?, " +
                    "  ?, ?, ?, ?, ?, " +
                    "  ?, ?, ?, " +
                    "  ?, " +
                    "  ?, ?, ?, ?, 'Y', " +
                    "  'N', 'Y', 'N', 'N', " +
                    "  'N', 'N', 'N', " +
                    "  'N', 'N', 'N', 'N', " +
                    "  'N', 'N', " +
                    "  0, 1, " +
                    "  CURRENT_TIMESTAMP, 100, CURRENT_TIMESTAMP, 100" +
                    ")";
            try (PreparedStatement st = c.prepareStatement(insertSql)) {
                int i = 1;
                st.setLong(i++, newId);
                st.setInt(i++, adClientId);
                st.setLong(i++, adOrgId);
                st.setString(i++, name);
                st.setString(i++, value);
                st.setString(i++, sku);
                st.setString(i++, description);
                st.setString(i++, upc);
                st.setLong(i++, mProductCategoryId);
                st.setLong(i++, cTaxCategoryId);
                st.setLong(i++, cUomId);
                st.setString(i++, productType);
                st.setString(i++, isActive    ? "Y" : "N");
                st.setString(i++, isStocked   ? "Y" : "N");
                st.setString(i++, isSold      ? "Y" : "N");
                st.setString(i++, isPurchased ? "Y" : "N");
                st.executeUpdate();
            }

            c.commit();
            return newId;
        } catch (SQLException e) {
            // Map duplicate-key on (ad_client_id, value) to ValidationException
            String msg = e.getMessage() == null ? "" : e.getMessage();
            if (msg.contains("m_product_value") || msg.contains("duplicate key")) {
                throw new ValidationException("a product with that Internal Reference already exists");
            }
            throw new RuntimeException("idempiere create product failed: " + msg, e);
        }
    }

    // ─── Archive (soft delete) ───────────────────────────────────────────
    /**
     * Soft-delete by setting IsActive='N'. Same concurrency contract as
     * {@link #update}: pass the {@code Updated} token from the prior GET.
     */
    public void archive(long id, Long ifMatchUpdatedMs) {
        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put("isActive", false);
        update(id, patch, ifMatchUpdatedMs);
    }

    // ─── helpers ──────────────────────────────────────────────────────────
    private static String strOrNull(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }
    private static Long asLong(Object v, Long def) {
        if (v == null) return def;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(v.toString()); } catch (NumberFormatException ignore) { return def; }
    }
    private static boolean boolOr(Object v, boolean def) {
        if (v == null) return def;
        if (v instanceof Boolean b) return b;
        String s = v.toString();
        if ("true".equalsIgnoreCase(s) || "Y".equalsIgnoreCase(s)) return true;
        if ("false".equalsIgnoreCase(s) || "N".equalsIgnoreCase(s)) return false;
        return def;
    }
}
