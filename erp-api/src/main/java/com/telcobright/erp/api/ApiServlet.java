package com.telcobright.erp.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Front controller for /erp-api/* endpoints.
 *
 *   GET /erp-api/health
 *   GET /erp-api/window/{adWindowId}/spec
 *   GET /erp-api/window/{adWindowId}/tab/{tabIndex}/rows
 *
 * Reads only for the trial. Connects directly to iDempiere's Postgres so
 * the bundle resolves without a Require-Bundle on org.adempiere.base.
 * Writes (PATCH/save/action) will land in a follow-up via GridTab and at
 * that point we'll switch to {@code DB.getConnectionRO()} from iDempiere's
 * own pool.
 */
public class ApiServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;

    private static final Pattern P_SPEC =
            Pattern.compile("^/window/(\\d+)/spec$");
    private static final Pattern P_ROWS =
            Pattern.compile("^/window/(\\d+)/tab/(\\d+)/rows$");

    private static final String JDBC_URL =
            "jdbc:postgresql://127.0.0.1:5433/idempiere";
    private static final String DB_USER = "adempiere";
    private static final String DB_PASS = "adempiere";

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void init() {
        // Force-register the postgres driver — DriverManager service-loader
        // doesn't always find drivers cleanly across OSGi classloaders.
        try { Class.forName("org.postgresql.Driver"); } catch (Exception ignore) { }
    }

    private Connection openConn() throws SQLException {
        return DriverManager.getConnection(JDBC_URL, DB_USER, DB_PASS);
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String path = req.getPathInfo();
        if (path == null) path = "";
        try {
            if ("/health".equals(path)) {
                writeJson(resp, healthBody());
                return;
            }
            Matcher m;
            if ((m = P_SPEC.matcher(path)).matches()) {
                int windowId = Integer.parseInt(m.group(1));
                writeJson(resp, windowSpec(windowId));
                return;
            }
            if ((m = P_ROWS.matcher(path)).matches()) {
                int windowId = Integer.parseInt(m.group(1));
                int tabIndex = Integer.parseInt(m.group(2));
                int page = parseInt(req.getParameter("page"), 0);
                int size = clamp(parseInt(req.getParameter("size"), 50), 1, 200);
                String search = req.getParameter("search");
                Long parentId = parseLong(req.getParameter("parentId"));
                writeJson(resp, tabRows(windowId, tabIndex, search, parentId, page, size));
                return;
            }
            error(resp, 404, "not_found", "Unknown path: " + path);
        } catch (Exception e) {
            log("erp-api: " + path + " failed", e);
            error(resp, 500, "internal_error", e.getMessage());
        }
    }

    // ─── Endpoints ──────────────────────────────────────────────────────────

    private ObjectNode healthBody() {
        ObjectNode n = mapper.createObjectNode();
        n.put("ok", true);
        n.put("bundle", "com.telcobright.erp.api");
        n.put("version", "1.0.0");
        n.put("timestamp", Instant.now().toString());
        try (Connection c = openConn()) {
            n.put("dbReachable", c != null && !c.isClosed());
        } catch (Exception e) {
            n.put("dbReachable", false);
            n.put("dbError", e.getMessage());
        }
        return n;
    }

    /**
     * Builds the AD spec for a window: tabs and their fields, the same
     * shape we baked into m_product_window.json. Generic over windowId.
     */
    private ObjectNode windowSpec(int windowId) throws SQLException {
        ObjectNode root = mapper.createObjectNode();
        try (Connection c = openConn()) {
            // Window header
            try (PreparedStatement st = c.prepareStatement(
                    "SELECT name FROM adempiere.ad_window WHERE ad_window_id = ?")) {
                st.setInt(1, windowId);
                try (ResultSet rs = st.executeQuery()) {
                    if (!rs.next()) throw new SQLException("Unknown window id " + windowId);
                    root.put("windowId", windowId);
                    root.put("name", rs.getString("name"));
                }
            }
            // Tabs
            ArrayNode tabs = root.putArray("tabs");
            String tabSql =
                    "SELECT t.ad_tab_id, t.seqno, t.name, t.tablevel, t.isreadonly, t.issinglerow, " +
                    "       tbl.tablename " +
                    "FROM adempiere.ad_tab t " +
                    "JOIN adempiere.ad_table tbl ON tbl.ad_table_id = t.ad_table_id " +
                    "WHERE t.ad_window_id = ? AND t.isactive = 'Y' " +
                    "ORDER BY t.seqno";
            try (PreparedStatement st = c.prepareStatement(tabSql)) {
                st.setInt(1, windowId);
                try (ResultSet rs = st.executeQuery()) {
                    while (rs.next()) {
                        ObjectNode tab = tabs.addObject();
                        int tabId = rs.getInt("ad_tab_id");
                        tab.put("seqno", rs.getInt("seqno"));
                        tab.put("name", rs.getString("name"));
                        tab.put("tableName", rs.getString("tablename"));
                        tab.put("tableLevel", rs.getInt("tablevel"));
                        tab.put("isReadOnly", "Y".equals(rs.getString("isreadonly")));
                        tab.put("isSingleRow", "Y".equals(rs.getString("issinglerow")));
                        tab.set("fields", fieldsForTab(c, tabId));
                    }
                }
            }
        }
        return root;
    }

    private ArrayNode fieldsForTab(Connection c, int tabId) throws SQLException {
        ArrayNode out = mapper.createArrayNode();
        String sql =
                "SELECT f.seqno, f.name AS label, c.columnname, r.name AS reference, " +
                "       c.ismandatory, c.isupdateable, c.fieldlength, c.defaultvalue, c.callout, " +
                "       c.ad_val_rule_id, f.isdisplayed, f.isdisplayedgrid, f.seqnogrid, " +
                "       f.displaylogic, f.readonlylogic, f.columnspan, f.issameline, " +
                "       c.isidentifier, c.isselectioncolumn " +
                "FROM adempiere.ad_field f " +
                "JOIN adempiere.ad_column c ON c.ad_column_id = f.ad_column_id " +
                "JOIN adempiere.ad_reference r ON r.ad_reference_id = c.ad_reference_id " +
                "WHERE f.ad_tab_id = ? AND f.isactive = 'Y' " +
                "ORDER BY f.seqno";
        try (PreparedStatement st = c.prepareStatement(sql)) {
            st.setInt(1, tabId);
            try (ResultSet rs = st.executeQuery()) {
                while (rs.next()) {
                    ObjectNode f = out.addObject();
                    f.put("seqno", rs.getInt("seqno"));
                    f.put("label", rs.getString("label"));
                    f.put("columnName", rs.getString("columnname"));
                    f.put("reference", rs.getString("reference"));
                    f.put("isMandatory", "Y".equals(rs.getString("ismandatory")));
                    f.put("isUpdateable", "Y".equals(rs.getString("isupdateable")));
                    f.put("fieldLength", rs.getInt("fieldlength"));
                    f.put("defaultValue", rs.getString("defaultvalue"));
                    f.put("callout", rs.getString("callout"));
                    int valRule = rs.getInt("ad_val_rule_id");
                    if (rs.wasNull()) f.putNull("valRuleId"); else f.put("valRuleId", valRule);
                    f.put("isDisplayed", "Y".equals(rs.getString("isdisplayed")));
                    f.put("isDisplayedGrid", "Y".equals(rs.getString("isdisplayedgrid")));
                    f.put("seqNoGrid", rs.getInt("seqnogrid"));
                    f.put("displayLogic", rs.getString("displaylogic"));
                    f.put("readOnlyLogic", rs.getString("readonlylogic"));
                    f.put("columnSpan", rs.getInt("columnspan"));
                    f.put("isSameLine", "Y".equals(rs.getString("issameline")));
                    f.put("isIdentifier", "Y".equals(rs.getString("isidentifier")));
                    f.put("isSelectionColumn", "Y".equals(rs.getString("isselectioncolumn")));
                }
            }
        }
        return out;
    }

    /**
     * Lists rows for a given tab. Supports parent-link filtering for child
     * tabs via the AD parent_column_id (falls back to {@code <ParentTable>_ID}).
     * FK display resolution and AD_Val_Rule enforcement come later when the
     * write path arrives via GridTab.
     */
    private ObjectNode tabRows(int windowId, int tabIndex, String search,
                               Long parentId, int page, int size) throws SQLException {
        ObjectNode out = mapper.createObjectNode();
        try (Connection c = openConn()) {
            String tableName;
            int adTableId;
            String parentColumn = null;
            try (PreparedStatement st = c.prepareStatement(
                    "SELECT t.ad_tab_id, t.ad_table_id, tbl.tablename, " +
                    "       (SELECT pc.columnname FROM adempiere.ad_column pc WHERE pc.ad_column_id = t.parent_column_id) AS parent_col " +
                    "FROM adempiere.ad_tab t " +
                    "JOIN adempiere.ad_table tbl ON tbl.ad_table_id = t.ad_table_id " +
                    "WHERE t.ad_window_id = ? AND t.isactive = 'Y' ORDER BY t.seqno OFFSET ? FETCH FIRST 1 ROWS ONLY")) {
                st.setInt(1, windowId);
                st.setInt(2, tabIndex);
                try (ResultSet rs = st.executeQuery()) {
                    if (!rs.next()) throw new SQLException("Tab " + tabIndex + " not found in window " + windowId);
                    tableName = rs.getString("tablename");
                    adTableId = rs.getInt("ad_table_id");
                    parentColumn = rs.getString("parent_col");
                }
            }
            String safeTable = tableName.replaceAll("[^A-Za-z0-9_]", "");

            // Order column: prefer <Table>_ID, fall back to AD IsKey columns,
            // fall back to "1" (first column). Composite-key tables (like
            // M_Product_Acct, M_Product_PO) don't have a single PK.
            String orderCol = "1";
            try (PreparedStatement st = c.prepareStatement(
                    "SELECT columnname FROM adempiere.ad_column WHERE ad_table_id = ? AND iskey = 'Y' ORDER BY ad_column_id")) {
                st.setInt(1, adTableId);
                try (ResultSet rs = st.executeQuery()) {
                    StringBuilder sb = new StringBuilder();
                    while (rs.next()) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(rs.getString("columnname").replaceAll("[^A-Za-z0-9_]", ""));
                    }
                    if (sb.length() > 0) orderCol = sb.toString();
                }
            }

            // Default child-link convention if AD didn't name one: <ParentTable>_ID.
            // For Product window, every child has M_Product_ID.
            if (parentColumn == null && parentId != null) parentColumn = "M_Product_ID";
            String safeParentCol = parentColumn == null ? null
                    : parentColumn.replaceAll("[^A-Za-z0-9_]", "");

            StringBuilder whereSb = new StringBuilder("ad_client_id IN (0, 11)");
            if (parentId != null && safeParentCol != null) {
                whereSb.append(" AND ").append(safeParentCol).append(" = ?");
            }
            boolean hasSearch = search != null && !search.isBlank();
            String like = hasSearch ? "%" + search.toLowerCase().trim() + "%" : null;
            if (hasSearch) {
                whereSb.append(" AND (LOWER(COALESCE(value::text,'')) LIKE ? OR LOWER(COALESCE(name::text,'')) LIKE ?)");
            }
            String where = whereSb.toString();
            String selectSql = "SELECT * FROM adempiere." + safeTable +
                    " WHERE " + where + " ORDER BY " + orderCol + " LIMIT ? OFFSET ?";
            String countSql = "SELECT COUNT(*) FROM adempiere." + safeTable + " WHERE " + where;

            ArrayNode items = out.putArray("items");
            try (PreparedStatement st = c.prepareStatement(selectSql)) {
                int i = 1;
                if (parentId != null && safeParentCol != null) st.setLong(i++, parentId);
                if (hasSearch) { st.setString(i++, like); st.setString(i++, like); }
                st.setInt(i++, size);
                st.setInt(i, page * size);
                try (ResultSet rs = st.executeQuery()) {
                    ResultSetMetaData md = rs.getMetaData();
                    while (rs.next()) {
                        ObjectNode row = items.addObject();
                        for (int col = 1; col <= md.getColumnCount(); col++) {
                            putColumn(row, md.getColumnLabel(col), rs.getObject(col));
                        }
                    }
                }
            }
            long total;
            try (PreparedStatement st = c.prepareStatement(countSql)) {
                int i = 1;
                if (parentId != null && safeParentCol != null) st.setLong(i++, parentId);
                if (hasSearch) { st.setString(i++, like); st.setString(i, like); }
                try (ResultSet rs = st.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            out.put("windowId", windowId);
            out.put("tabIndex", tabIndex);
            out.put("tableName", tableName);
            if (parentColumn != null) out.put("parentColumn", parentColumn);
            out.put("page", page);
            out.put("size", size);
            out.put("total", total);
        }
        return out;
    }

    private static Long parseLong(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Long.parseLong(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private void putColumn(ObjectNode row, String label, Object val) {
        String key = label.toLowerCase();
        if (val == null) { row.putNull(key); return; }
        if (val instanceof Number n) {
            if (val instanceof Integer || val instanceof Long || val instanceof Short || val instanceof Byte)
                row.put(key, n.longValue());
            else row.put(key, n.doubleValue());
        } else if (val instanceof Boolean b) {
            row.put(key, b);
        } else if (val instanceof Timestamp ts) {
            row.put(key, ts.toInstant().toString());
        } else if (val instanceof java.sql.Date d) {
            row.put(key, d.toLocalDate().toString());
        } else if (val instanceof String s) {
            // Y/N → boolean for convenience on flag-like cols
            if ((s.equals("Y") || s.equals("N")) && (key.startsWith("is") || key.startsWith("has"))) {
                row.put(key, "Y".equals(s));
            } else {
                row.put(key, s);
            }
        } else {
            row.put(key, val.toString());
        }
    }

    private void writeJson(HttpServletResponse resp, Object body) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("application/json; charset=utf-8");
        resp.setHeader("Cache-Control", "no-store");
        try (PrintWriter w = resp.getWriter()) {
            mapper.writeValue(w, body);
        }
    }

    private void error(HttpServletResponse resp, int status, String code, String message) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json; charset=utf-8");
        ObjectNode n = mapper.createObjectNode();
        n.put("ok", false);
        n.put("error", code);
        if (message != null) n.put("message", message);
        try (PrintWriter w = resp.getWriter()) {
            mapper.writeValue(w, n);
        }
    }

    private static int parseInt(String s, int dflt) {
        if (s == null || s.isBlank()) return dflt;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return dflt; }
    }

    private static int clamp(int v, int lo, int hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }
}
