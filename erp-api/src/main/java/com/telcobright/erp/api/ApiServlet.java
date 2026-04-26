package com.telcobright.erp.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.adempiere.util.ServerContext;
import org.compiere.model.GridField;
import org.compiere.model.GridFieldVO;
import org.compiere.model.GridTab;
import org.compiere.model.GridTabVO;
import org.compiere.model.GridWindow;
import org.compiere.model.GridWindowVO;
import org.compiere.model.MColumn;
import org.compiere.model.MLookup;
import org.compiere.model.MLookupFactory;
import org.compiere.model.MLookupInfo;
import org.compiere.model.MQuery;
import org.compiere.model.MTable;
import org.compiere.model.PO;
import org.compiere.model.POInfo;
import org.compiere.model.Query;
import org.compiere.util.CLogger;
import org.compiere.util.DB;
import org.compiere.util.DisplayType;
import org.compiere.util.Env;
import org.compiere.util.Trx;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Front controller for /erp-api/* endpoints.
 *
 *   GET  /erp-api/health
 *   GET  /erp-api/window/{wid}/spec
 *   GET  /erp-api/window/{wid}/tab/{i}/rows?search=&parentId=&page=&size=&sort=&dir=
 *   GET  /erp-api/window/{wid}/tab/{i}/row/{id}
 *   GET  /erp-api/lookup/{refId}?q=&parent=
 *
 * READS go through iDempiere's model classes — the same entry points the ZK
 * UI uses: {@link GridWindowVO} for window meta, {@link Query} for list rows,
 * {@link MTable}+{@link PO} for single rows, {@link MLookupFactory} for FK
 * display name resolution. No raw SQL against AD or tenant tables here.
 *
 * WRITES (PUT/POST) currently go through {@link PO#save()} with
 * {@code set_ValueNoCheck} — that fires Model Validators and sequence
 * allocation but skips column callouts. The proper write path
 * ({@code GridTab.setValue} → {@code dataSave}) is queued separately.
 * The orchestrix Spring Boot proxy gates access to writes (returns 501
 * for the BPartner POC).
 */
public class ApiServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private static final CLogger log = CLogger.getCLogger(ApiServlet.class);

    private static final Pattern P_SPEC =
            Pattern.compile("^/window/(\\d+)/spec$");
    private static final Pattern P_ROWS =
            Pattern.compile("^/window/(\\d+)/tab/(\\d+)/rows$");
    private static final Pattern P_ROW =
            Pattern.compile("^/window/(\\d+)/tab/(\\d+)/row/(\\d+)$");
    private static final Pattern P_ROW_BY_KEYS =
            Pattern.compile("^/window/(\\d+)/tab/(\\d+)/row$");
    private static final Pattern P_NEW_ROW =
            Pattern.compile("^/window/(\\d+)/tab/(\\d+)/row$");
    private static final Pattern P_LOOKUP =
            Pattern.compile("^/lookup/(\\d+)$");
    /** Per-field FK picker — resolves the right MLookup from the field's
     *  AD column metadata (Table Direct, Table, Search, List, AD_Val_Rule). */
    private static final Pattern P_FIELD_LOOKUP =
            Pattern.compile("^/window/(\\d+)/tab/(\\d+)/field/([A-Za-z0-9_]+)/lookup$");

    private final ObjectMapper mapper = new ObjectMapper();
    /** Per-request unique WindowNo so context entries written by GridTab
     *  for one request can't bleed into another. iDempiere keys ctx as
     *  {@code WindowNo|ColumnName}, so two concurrent requests sharing
     *  WindowNo would corrupt each other's defaults / display logic. */
    private final java.util.concurrent.atomic.AtomicInteger windowNoSeq =
            new java.util.concurrent.atomic.AtomicInteger(20000);
    private int nextWindowNo() {
        // iDempiere reserves low numbers for real ZK windows; start well above.
        int n = windowNoSeq.incrementAndGet();
        if (n > 99999) { windowNoSeq.set(20000); n = windowNoSeq.incrementAndGet(); }
        return n;
    }

    /** AD_Reference.Name by displayType — what ZK / Info windows / the AD
     *  spec call each ref. {@link DisplayType#getDescription} returns the
     *  Java identifier ("TableDir", "YesNo") which doesn't match AD_Reference;
     *  the React side keys on the AD spelling ("Table Direct", "Yes-No"),
     *  so we normalize here. */
    private static final Map<Integer, String> AD_REF_NAME = Map.ofEntries(
            Map.entry(10, "String"),
            Map.entry(11, "Integer"),
            Map.entry(12, "Amount"),
            Map.entry(13, "ID"),
            Map.entry(14, "Text"),
            Map.entry(15, "Date"),
            Map.entry(16, "DateTime"),
            Map.entry(17, "List"),
            Map.entry(18, "Table"),
            Map.entry(19, "Table Direct"),
            Map.entry(20, "Yes-No"),
            Map.entry(21, "Location (Address)"),
            Map.entry(22, "Number"),
            Map.entry(23, "Binary"),
            Map.entry(24, "Time"),
            Map.entry(25, "Account"),
            Map.entry(26, "RowID"),
            Map.entry(27, "Color"),
            Map.entry(28, "Button"),
            Map.entry(29, "Quantity"),
            Map.entry(30, "Search"),
            Map.entry(31, "Locator (WH)"),
            Map.entry(32, "Image"),
            Map.entry(33, "Assignment"),
            Map.entry(34, "Memo"),
            Map.entry(35, "PAttribute"),
            Map.entry(36, "Costs+Prices"),
            Map.entry(37, "FilePath"),
            Map.entry(38, "FileName"),
            Map.entry(39, "URL"),
            Map.entry(40, "Printer Format"),
            Map.entry(42, "Chart"),
            Map.entry(50, "Single Selection Grid"),
            Map.entry(51, "Multiple Selection Grid"),
            Map.entry(52, "Chosen Multiple Selection List"),
            Map.entry(53, "Chosen Multiple Selection Search"),
            Map.entry(54, "Chosen Multiple Selection Table"),
            Map.entry(55, "Image BLOB"),
            Map.entry(57, "Multiple Selection Tree")
    );

    private static String referenceName(int displayType) {
        String n = AD_REF_NAME.get(displayType);
        return n != null ? n : DisplayType.getDescription(displayType);
    }

    @Override
    public void init() {
        // postgres driver registration is unnecessary for the read path now
        // (iDempiere already manages its own pool via DB.*). Keep the call
        // for the legacy write health check below.
        try { Class.forName("org.postgresql.Driver"); } catch (Exception ignore) { }
    }

    // ─── HTTP dispatch ──────────────────────────────────────────────────────

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
            if ((m = P_ROW.matcher(path)).matches()) {
                int windowId = Integer.parseInt(m.group(1));
                int tabIndex = Integer.parseInt(m.group(2));
                long recordId = Long.parseLong(m.group(3));
                ObjectNode row = singleRow(windowId, tabIndex, recordId);
                if (row == null) { error(resp, 404, "not_found", "Row " + recordId + " not found"); return; }
                writeJson(resp, row);
                return;
            }
            if ((m = P_ROWS.matcher(path)).matches()) {
                int windowId = Integer.parseInt(m.group(1));
                int tabIndex = Integer.parseInt(m.group(2));
                int page = parseInt(req.getParameter("page"), 0);
                int size = clamp(parseInt(req.getParameter("size"), 50), 1, 200);
                String search = req.getParameter("search");
                Long parentId = parseLong(req.getParameter("parentId"));
                String sort = req.getParameter("sort");
                String dir = req.getParameter("dir");
                writeJson(resp, tabRows(windowId, tabIndex, search, parentId, page, size, sort, dir));
                return;
            }
            if ((m = P_LOOKUP.matcher(path)).matches()) {
                int refId = Integer.parseInt(m.group(1));
                String q = req.getParameter("q");
                writeJson(resp, lookupRows(refId, q));
                return;
            }
            if ((m = P_FIELD_LOOKUP.matcher(path)).matches()) {
                int windowId = Integer.parseInt(m.group(1));
                int tabIndex = Integer.parseInt(m.group(2));
                String columnName = m.group(3);
                String q = req.getParameter("q");
                writeJson(resp, fieldLookup(windowId, tabIndex, columnName, q));
                return;
            }
            error(resp, 404, "not_found", "Unknown path: " + path);
        } catch (IllegalArgumentException e) {
            error(resp, 400, "bad_request", e.getMessage());
        } catch (Exception e) {
            log.severe("erp-api GET " + path + " failed: " + e);
            error(resp, 500, "internal_error", e.getMessage());
        }
    }

    @Override
    protected void service(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // HttpServlet doesn't dispatch PATCH; treat it as PUT (idempotent partial update).
        if ("PATCH".equalsIgnoreCase(req.getMethod())) {
            doPut(req, resp);
            return;
        }
        super.service(req, resp);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String path = req.getPathInfo();
        if (path == null) path = "";
        try {
            Matcher m = P_NEW_ROW.matcher(path);
            if (!m.matches()) { error(resp, 404, "not_found", "Unknown path: " + path); return; }
            int windowId = Integer.parseInt(m.group(1));
            int tabIndex = Integer.parseInt(m.group(2));
            JsonNode body = mapper.readTree(req.getReader());
            JsonNode changes = body.path("changes");
            if (!changes.isObject()) {
                error(resp, 400, "bad_request", "Body must be {\"changes\":{...}}"); return;
            }
            Map<String, Object> changeMap = new LinkedHashMap<>();
            changes.fields().forEachRemaining(e -> changeMap.put(e.getKey(), jsonToJava(e.getValue())));
            resp.setStatus(HttpServletResponse.SC_CREATED);
            writeJson(resp, gridCreate(windowId, tabIndex, changeMap));
        } catch (PoSaveException e) {
            error(resp, 422, "save_failed", e.getMessage());
        } catch (Exception e) {
            log.severe("erp-api POST " + path + " failed: " + e);
            error(resp, 500, "internal_error", e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String path = req.getPathInfo();
        if (path == null) path = "";
        try {
            Matcher m = P_ROW.matcher(path);
            if (!m.matches()) { error(resp, 404, "not_found", "Unknown path: " + path); return; }
            int windowId = Integer.parseInt(m.group(1));
            int tabIndex = Integer.parseInt(m.group(2));
            long recordId = Long.parseLong(m.group(3));
            writeJson(resp, gridDelete(windowId, tabIndex, recordId));
        } catch (PoSaveException e) {
            error(resp, 422, "delete_failed", e.getMessage());
        } catch (Exception e) {
            log.severe("erp-api DELETE " + path + " failed: " + e);
            error(resp, 500, "internal_error", e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String path = req.getPathInfo();
        if (path == null) path = "";
        try {
            JsonNode body = mapper.readTree(req.getReader());
            JsonNode changes = body.path("changes");
            if (!changes.isObject()) { error(resp, 400, "bad_request", "Body must be {\"changes\":{...}}"); return; }
            Map<String, Object> changeMap = new LinkedHashMap<>();
            changes.fields().forEachRemaining(e -> changeMap.put(e.getKey(), jsonToJava(e.getValue())));

            Matcher m;
            if ((m = P_ROW.matcher(path)).matches()) {
                int windowId = Integer.parseInt(m.group(1));
                int tabIndex = Integer.parseInt(m.group(2));
                long recordId = Long.parseLong(m.group(3));
                writeJson(resp, gridSave(windowId, tabIndex, recordId, null, changeMap));
                return;
            }
            if ((m = P_ROW_BY_KEYS.matcher(path)).matches()) {
                int windowId = Integer.parseInt(m.group(1));
                int tabIndex = Integer.parseInt(m.group(2));
                JsonNode keys = body.path("keys");
                if (!keys.isObject() || keys.isEmpty()) {
                    error(resp, 400, "bad_request", "Body must include a non-empty \"keys\" object for composite rows"); return;
                }
                Map<String, Object> keyMap = new LinkedHashMap<>();
                keys.fields().forEachRemaining(e -> keyMap.put(e.getKey(), jsonToJava(e.getValue())));
                writeJson(resp, gridSave(windowId, tabIndex, 0L, keyMap, changeMap));
                return;
            }
            error(resp, 404, "not_found", "Unknown path: " + path);
        } catch (PoSaveException e) {
            error(resp, 422, "save_failed", e.getMessage());
        } catch (Exception e) {
            log.severe("erp-api PUT " + path + " failed: " + e);
            error(resp, 500, "internal_error", e.getMessage());
        }
    }

    // ─── READ ENDPOINTS — entry points the ZK UI uses ─────────────────────

    private ObjectNode healthBody() {
        ObjectNode n = mapper.createObjectNode();
        n.put("ok", true);
        n.put("bundle", "com.telcobright.erp.api");
        n.put("version", "1.0.0");
        n.put("timestamp", Instant.now().toString());
        return n;
    }

    /**
     * Window spec via {@link GridWindowVO#create(Properties, int, int)} — the
     * same call ZK's {@code AbstractADWindowContent} makes (line 333 of that
     * file). Walks {@code vo.Tabs} → {@code tabVO.getFields()} (lists of VO
     * objects already enriched with UserDef overrides and ASP filtering).
     * No raw SQL — the VO's internal SQL handles AD_Window/AD_Tab/AD_Field.
     */
    private ObjectNode windowSpec(int windowId) {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, 0, windowId);
            if (winVO == null) {
                throw new IllegalArgumentException("Unknown window id " + windowId);
            }
            ObjectNode root = mapper.createObjectNode();
            root.put("windowId", winVO.AD_Window_ID);
            root.put("name", winVO.Name);
            ArrayNode tabs = root.putArray("tabs");
            int seq = 0;
            for (GridTabVO tabVO : winVO.Tabs) {
                seq += 10;
                ObjectNode tab = tabs.addObject();
                tab.put("seqno", seq);
                tab.put("name", tabVO.Name);
                tab.put("tableName", tabVO.TableName);
                tab.put("tableLevel", tabVO.TabLevel);
                tab.put("isReadOnly", tabVO.IsReadOnly);
                tab.put("isSingleRow", tabVO.IsSingleRow);
                ArrayNode fields = tab.putArray("fields");
                for (GridFieldVO fv : tabVO.getFields()) {
                    ObjectNode f = fields.addObject();
                    f.put("seqno", fv.SeqNo);
                    f.put("label", fv.Header);
                    f.put("columnName", fv.ColumnName);
                    f.put("reference", referenceName(fv.displayType));
                    f.put("displayType", fv.displayType);
                    f.put("isMandatory", fv.IsMandatory);
                    f.put("isUpdateable", fv.IsUpdateable);
                    f.put("fieldLength", fv.DisplayLength);
                    f.put("defaultValue", emptyToNull(fv.DefaultValue));
                    f.put("callout", emptyToNull(fv.Callout));
                    f.putNull("valRuleId");
                    f.put("validationCode", emptyToNull(fv.ValidationCode));
                    f.put("isDisplayed", fv.IsDisplayed);
                    f.put("isDisplayedGrid", fv.IsDisplayedGrid);
                    f.put("seqNoGrid", fv.SeqNoGrid);
                    f.put("displayLogic", emptyToNull(fv.DisplayLogic));
                    f.put("readOnlyLogic", emptyToNull(fv.ReadOnlyLogic));
                    f.put("columnSpan", fv.ColumnSpan > 0 ? fv.ColumnSpan : 2);
                    f.put("isSameLine", fv.IsSameLine);
                    f.put("isIdentifier", fv.IsKey);
                    f.put("fieldGroup", emptyToNull(fv.FieldGroup));
                }
            }
            return root;
        } finally {
            restoreCtx(prevCtx);
        }
    }

    /**
     * Paginated list of rows for a tab via {@link Query} — the same model
     * class iDempiere's Info windows use under the hood. FK columns shown in
     * the grid get {@code <col>_display} attached, resolved through
     * {@link MLookupFactory#get(Properties, int, int, int, ...)} +
     * {@link MLookup#getDisplay(Object)} — exactly how ZK renders FK cells.
     */
    private ObjectNode tabRows(int windowId, int tabIndex, String search,
                               Long parentId, int page, int size,
                               String sortField, String sortDir) {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, 0, windowId);
            if (winVO == null) throw new IllegalArgumentException("Unknown window id " + windowId);
            if (tabIndex < 0 || tabIndex >= winVO.Tabs.size()) {
                throw new IllegalArgumentException("Tab " + tabIndex + " out of range for window " + windowId);
            }
            GridTabVO tabVO = winVO.Tabs.get(tabIndex);
            String tableName = tabVO.TableName;
            POInfo pi = POInfo.getPOInfo(ctx, tabVO.AD_Table_ID);
            if (pi == null) throw new IllegalStateException("POInfo missing for " + tableName);

            // Build where clause + params
            StringBuilder where = new StringBuilder();
            List<Object> params = new ArrayList<>();
            if (tabVO.WhereClause != null && !tabVO.WhereClause.isEmpty()) {
                where.append(tabVO.WhereClause);
            }
            if (parentId != null && tabVO.TabLevel > 0) {
                String parentCol = resolveParentLinkColumn(ctx, winVO, tabIndex);
                if (parentCol != null) {
                    if (where.length() > 0) where.append(" AND ");
                    where.append(parentCol).append("=?");
                    params.add(parentId);
                }
            }
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase().trim() + "%";
                StringBuilder sb = new StringBuilder("(");
                boolean first = true;
                for (String col : new String[]{"Value", "Name", "TaxID", "DocumentNo"}) {
                    if (pi.getColumnIndex(col) >= 0) {
                        if (!first) sb.append(" OR ");
                        sb.append("LOWER(COALESCE(").append(col).append("::text,'')) LIKE ?");
                        params.add(like);
                        first = false;
                    }
                }
                if (!first) {
                    sb.append(")");
                    if (where.length() > 0) where.append(" AND ");
                    where.append(sb);
                }
            }

            // Build the Query — same constructor signature ZK uses for ad-hoc reads
            Query q = new Query(ctx, tableName, where.toString(), null);
            if (!params.isEmpty()) q.setParameters(params.toArray());

            String orderBy = null;
            if (sortField != null && !sortField.isBlank()) {
                String safeField = sortField.replaceAll("[^A-Za-z0-9_]", "");
                String d = "desc".equalsIgnoreCase(sortDir) ? "DESC" : "ASC";
                orderBy = safeField + " " + d;
            } else if (tabVO.OrderByClause != null && !tabVO.OrderByClause.isEmpty()) {
                orderBy = tabVO.OrderByClause;
            }
            if (orderBy != null) q.setOrderBy(orderBy);

            long total = q.count();
            q.setPage(size, page);
            List<PO> rows = q.list();

            // Pre-build MLookup per FK column shown in grid — one lookup per
            // column, reused across rows (the lookup's data set is cached
            // internally by MLookupFactory).
            Map<String, MLookup> lookups = new HashMap<>();
            for (GridFieldVO fv : tabVO.getFields()) {
                if (fv.IsDisplayedGrid && DisplayType.isLookup(fv.displayType) && !fv.IsKey) {
                    try {
                        MLookup lk = MLookupFactory.get(ctx, 0, fv.AD_Column_ID, fv.displayType,
                                Env.getLanguage(ctx), fv.ColumnName,
                                fv.AD_Reference_Value_ID, fv.IsParent, fv.ValidationCode);
                        if (lk != null) lookups.put(fv.ColumnName, lk);
                    } catch (Exception e) { /* skip uncreatable lookup */ }
                }
            }

            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            for (PO po : rows) {
                ObjectNode row = items.addObject();
                for (int i = 0; i < pi.getColumnCount(); i++) {
                    String col = pi.getColumnName(i);
                    Object val = po.get_Value(i);
                    putColumn(row, col, val);
                    MLookup lk = lookups.get(col);
                    if (lk != null && val != null) {
                        try {
                            String disp = lk.getDisplay(val);
                            if (disp != null && !disp.isBlank() && !disp.startsWith("<")) {
                                row.put(col.toLowerCase() + "_display", disp);
                            }
                        } catch (Exception ignore) { /* FK display optional */ }
                    }
                }
            }
            out.put("windowId", windowId);
            out.put("tabIndex", tabIndex);
            out.put("tableName", tableName);
            out.put("page", page);
            out.put("size", size);
            out.put("total", total);
            return out;
        } finally {
            restoreCtx(prevCtx);
        }
    }

    /**
     * Single-row read via {@link MTable#get(Properties, int)}+
     * {@link MTable#getPO(int, String)} — the canonical model entry point
     * ZK uses to load a record into a {@code GridTab}. All FK columns get
     * a {@code <col>_display} sibling for the human-readable display name.
     */
    private ObjectNode singleRow(int windowId, int tabIndex, long recordId) {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, 0, windowId);
            if (winVO == null) throw new IllegalArgumentException("Unknown window id " + windowId);
            if (tabIndex < 0 || tabIndex >= winVO.Tabs.size()) {
                throw new IllegalArgumentException("Tab " + tabIndex + " out of range for window " + windowId);
            }
            GridTabVO tabVO = winVO.Tabs.get(tabIndex);
            MTable mt = MTable.get(ctx, tabVO.AD_Table_ID);
            if (mt == null) throw new IllegalStateException("MTable not found for id " + tabVO.AD_Table_ID);
            PO po = mt.getPO((int) recordId, null);
            if (po == null || po.get_ID() <= 0) return null;

            POInfo pi = POInfo.getPOInfo(ctx, tabVO.AD_Table_ID);
            Map<String, MLookup> lookups = new HashMap<>();
            for (GridFieldVO fv : tabVO.getFields()) {
                if (DisplayType.isLookup(fv.displayType) && !fv.IsKey) {
                    try {
                        MLookup lk = MLookupFactory.get(ctx, 0, fv.AD_Column_ID, fv.displayType,
                                Env.getLanguage(ctx), fv.ColumnName,
                                fv.AD_Reference_Value_ID, fv.IsParent, fv.ValidationCode);
                        if (lk != null) lookups.put(fv.ColumnName, lk);
                    } catch (Exception e) { /* skip */ }
                }
            }

            ObjectNode row = mapper.createObjectNode();
            for (int i = 0; i < pi.getColumnCount(); i++) {
                String col = pi.getColumnName(i);
                Object val = po.get_Value(i);
                putColumn(row, col, val);
                MLookup lk = lookups.get(col);
                if (lk != null && val != null) {
                    try {
                        String disp = lk.getDisplay(val);
                        if (disp != null && !disp.isBlank() && !disp.startsWith("<")) {
                            row.put(col.toLowerCase() + "_display", disp);
                        }
                    } catch (Exception ignore) { }
                }
            }
            return row;
        } finally {
            restoreCtx(prevCtx);
        }
    }

    /**
     * AD_Reference dropdown rows via {@link MLookupFactory#getLookupInfo}.
     * The returned {@link MLookupInfo} carries the canonical SQL ZK uses for
     * the same dropdown — we execute it via {@link DB#prepareStatement}.
     * Capped at 50 rows for the POC; pagination + parent filtering is a
     * follow-up when the React side grows a typeahead picker.
     */
    private ObjectNode lookupRows(int adReferenceId, String q) {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            MLookupInfo info;
            try {
                info = MLookupFactory.getLookupInfo(ctx, 0, 0, DisplayType.Table,
                        Env.getLanguage(ctx), null, adReferenceId, false, null);
            } catch (Exception e) {
                throw new IllegalArgumentException("Could not resolve AD_Reference " + adReferenceId + ": " + e.getMessage());
            }
            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            if (info == null || info.Query == null) {
                out.put("note", "no lookup info for ref " + adReferenceId);
                return out;
            }
            // Filter by display name if q given. The MLookupInfo SQL has a
            // standard column order: Key, Value, DisplayName(s)…
            String sql = info.Query;
            if (q != null && !q.isBlank()) {
                String safe = q.replace("'", "''").trim();
                String filter = " UPPER(" + info.DisplayColumn + ") LIKE UPPER('%" + safe + "%') ";
                int orderIdx = sql.toUpperCase().lastIndexOf(" ORDER BY ");
                if (orderIdx >= 0) {
                    String head = sql.substring(0, orderIdx);
                    String tail = sql.substring(orderIdx);
                    sql = head + (head.toUpperCase().contains(" WHERE ") ? " AND " : " WHERE ") + filter + tail;
                } else {
                    sql = sql + (sql.toUpperCase().contains(" WHERE ") ? " AND " : " WHERE ") + filter;
                }
            }
            try (PreparedStatement st = DB.prepareStatement(sql, null)) {
                ResultSet rs = st.executeQuery();
                int count = 0;
                while (rs.next() && count < 50) {
                    ObjectNode item = items.addObject();
                    int colCount = rs.getMetaData().getColumnCount();
                    if (colCount >= 1) item.put("id", rs.getInt(1));
                    if (colCount >= 2) item.put("value", rs.getString(2));
                    if (colCount >= 3) item.put("name", rs.getString(3));
                    count++;
                }
                rs.close();
            } catch (Exception e) {
                throw new IllegalStateException("Lookup query failed: " + e.getMessage(), e);
            }
            return out;
        } finally {
            restoreCtx(prevCtx);
        }
    }

    // ─── WRITE PATH (legacy — proxy returns 501 for new entities) ────────

    private ObjectNode savePo(int windowId, int tabIndex, long recordId,
                              Map<String, Object> keys, Map<String, Object> changes) throws Exception {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        String trxName = Trx.createTrxName("erp-api-save");
        Trx trx = Trx.get(trxName, true);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, 0, windowId);
            GridTabVO tabVO = winVO.Tabs.get(tabIndex);
            MTable mt = MTable.get(ctx, tabVO.AD_Table_ID);
            if (mt == null) throw new IllegalStateException("MTable not found for id " + tabVO.AD_Table_ID);
            PO po;
            if (keys != null && !keys.isEmpty()) {
                po = loadPoByKeys(ctx, mt, tabVO.TableName, keys, trxName);
            } else {
                po = mt.getPO((int) recordId, trxName);
            }
            if (po == null || po.get_ID() < 0) {
                throw new PoSaveException("Row not found: " + tabVO.TableName +
                        (keys != null ? " keys=" + keys : "[" + recordId + "]"));
            }
            POInfo pi = POInfo.getPOInfo(ctx, tabVO.AD_Table_ID);
            for (Map.Entry<String, Object> e : changes.entrySet()) {
                int idx = po.get_ColumnIndex(e.getKey());
                if (idx < 0) throw new PoSaveException("Unknown column on " + tabVO.TableName + ": " + e.getKey());
                Class<?> cls = pi != null ? pi.getColumnClass(idx) : Object.class;
                Object coerced = coerceTo(cls, e.getValue());
                if (!po.set_ValueNoCheck(e.getKey(), coerced)) {
                    throw new PoSaveException("set_Value rejected " + e.getKey() +
                            " (column read-only or value invalid?)");
                }
            }
            if (!po.save()) {
                org.compiere.util.ValueNamePair last = CLogger.retrieveError();
                throw new PoSaveException(last != null ? last.getName() : "PO.save() returned false");
            }
            trx.commit(true);
            int singleId = po.get_ID();
            if (singleId > 0) {
                ObjectNode out = singleRow(windowId, tabIndex, singleId);
                if (out != null) return out;
            }
            return mapper.createObjectNode().put("ok", true);
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    private ObjectNode createPo(int windowId, int tabIndex, Map<String, Object> changes) throws Exception {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        String trxName = Trx.createTrxName("erp-api-create");
        Trx trx = Trx.get(trxName, true);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, 0, windowId);
            GridTabVO tabVO = winVO.Tabs.get(tabIndex);
            MTable mt = MTable.get(ctx, tabVO.AD_Table_ID);
            if (mt == null) throw new IllegalStateException("MTable not found for id " + tabVO.AD_Table_ID);
            PO po = mt.getPO(0, trxName);
            if (po == null) throw new PoSaveException("Could not instantiate PO for " + tabVO.TableName);
            POInfo pi = POInfo.getPOInfo(ctx, tabVO.AD_Table_ID);
            for (Map.Entry<String, Object> e : changes.entrySet()) {
                int idx = po.get_ColumnIndex(e.getKey());
                if (idx < 0) throw new PoSaveException("Unknown column on " + tabVO.TableName + ": " + e.getKey());
                Class<?> cls = pi != null ? pi.getColumnClass(idx) : Object.class;
                Object coerced = coerceTo(cls, e.getValue());
                if (!po.set_ValueNoCheck(e.getKey(), coerced)) {
                    throw new PoSaveException("set_Value rejected " + e.getKey() + " on new row");
                }
            }
            if (!po.save()) {
                org.compiere.util.ValueNamePair last = CLogger.retrieveError();
                throw new PoSaveException(last != null ? last.getName() : "PO.save() returned false");
            }
            trx.commit(true);
            int newId = po.get_ID();
            if (newId > 0) {
                ObjectNode out = singleRow(windowId, tabIndex, newId);
                if (out != null) return out;
            }
            return mapper.createObjectNode().put("ok", true);
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** Per-field picker rows. Resolves the field's actual lookup definition
     *  (Table Direct uses parent table's Identifier columns; Table uses the
     *  configured AD_Reference_Value_ID; List uses the AD_Reference list;
     *  Search behaves like Table). Honours AD_Val_Rule and IsParent flags. */
    private ObjectNode fieldLookup(int windowId, int tabIndex, String columnName, String q) throws Exception {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, windowId);
            GridTabVO tabVO = winVO.Tabs.get(tabIndex);
            GridFieldVO fv = null;
            for (GridFieldVO f : tabVO.getFields()) {
                if (columnName.equalsIgnoreCase(f.ColumnName)) { fv = f; break; }
            }
            if (fv == null) throw new IllegalArgumentException("Unknown column on tab: " + columnName);
            int dt = fv.displayType;
            MLookup lookup = MLookupFactory.get(ctx, windowNo, fv.AD_Column_ID, dt,
                    Env.getLanguage(ctx), fv.ColumnName, fv.AD_Reference_Value_ID,
                    fv.IsParent, fv.ValidationCode);
            if (lookup == null) throw new IllegalStateException("No lookup for column " + columnName);
            MLookupInfo info = lookup.getLookupInfo();
            if (info == null || info.Query == null) {
                ObjectNode empty = mapper.createObjectNode();
                empty.set("items", mapper.createArrayNode());
                return empty;
            }
            // Filter by display name if q given. MLookupInfo SQL has a standard
            // column order: Key, Value, DisplayName(s), IsActive — same as
            // lookupRows. Inject WHERE clause before ORDER BY.
            String sql = info.Query;
            if (q != null && !q.isBlank()) {
                String safe = q.replace("'", "''").trim();
                String filter = " UPPER(" + info.DisplayColumn + ") LIKE UPPER('%" + safe + "%') ";
                int orderIdx = sql.toUpperCase().lastIndexOf(" ORDER BY ");
                if (orderIdx >= 0) {
                    String head = sql.substring(0, orderIdx);
                    String tail = sql.substring(orderIdx);
                    sql = head + (head.toUpperCase().contains(" WHERE ") ? " AND " : " WHERE ") + filter + tail;
                } else {
                    sql = sql + (sql.toUpperCase().contains(" WHERE ") ? " AND " : " WHERE ") + filter;
                }
            }
            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            try (PreparedStatement st = DB.prepareStatement(sql, null);
                 ResultSet rs = st.executeQuery()) {
                int count = 0;
                while (rs.next() && count < 200) {
                    ObjectNode r = items.addObject();
                    int cc = rs.getMetaData().getColumnCount();
                    if (cc >= 1) r.put("id", rs.getInt(1));
                    if (cc >= 2) r.put("value", rs.getString(2));
                    if (cc >= 3) r.put("name", rs.getString(3));
                    count++;
                }
            }
            return out;
        } finally {
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    // ─── GridTab-based writes — full-fidelity (callouts + validators + workflow) ───
    //
    // GridTab dispatches column callouts on setValue() and runs ModelValidators
    // on dataSave(). PO.save()+set_ValueNoCheck (the legacy savePo above) hits
    // validators but skips callouts — that's why callouts felt missing on the
    // experimental Product page. These methods are the production write path.

    /** Update existing row through GridTab. {@code recordId} is used for
     *  single-PK tables; {@code keys} (column→value) for composite PKs. */
    private ObjectNode gridSave(int windowId, int tabIndex, long recordId,
                                Map<String, Object> keys, Map<String, Object> changes) throws Exception {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        String trxName = Trx.createTrxName("erp-api-gsave");
        Trx trx = Trx.get(trxName, true);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, windowId);
            GridWindow win = new GridWindow(winVO, true);
            GridTab tab = win.getTab(tabIndex);
            if (tab == null) throw new PoSaveException("Tab " + tabIndex + " not found in window " + windowId);
            tab.initTab(false);

            MQuery q;
            if (keys != null && !keys.isEmpty()) {
                q = new MQuery(tab.getTableName());
                for (Map.Entry<String, Object> e : keys.entrySet()) {
                    Object v = e.getValue();
                    // Numeric values must go through the int-typed factory below
                    // since MQuery.addRestriction quotes Object values as strings;
                    // for composite-PK rows we hand-build a typed restriction.
                    if (v instanceof Number n) {
                        q.addRestriction(sanitizeColumn(e.getKey()) + "=" + n.longValue());
                    } else {
                        q.addRestriction(sanitizeColumn(e.getKey()), MQuery.EQUAL, v == null ? null : v.toString());
                    }
                }
            } else {
                String key = tab.getKeyColumnName();
                if (key == null || key.isEmpty()) {
                    throw new PoSaveException("Tab " + tabIndex + " has no single-PK column; pass composite keys");
                }
                // getEqualQuery serialises the int unquoted — required for numeric ID columns
                q = MQuery.getEqualQuery(key, (int) recordId);
            }
            tab.setQuery(q);
            tab.query(false);
            if (tab.getRowCount() == 0) {
                throw new PoSaveException("Row not found: " + tab.getTableName() +
                        (keys != null ? " keys=" + keys : "[" + recordId + "]"));
            }
            tab.navigate(0);

            applyChangesAndSave(tab, changes, false);
            trx.commit(true);

            int singleId = tab.getRecord_ID();
            if (singleId > 0) {
                ObjectNode out = singleRow(windowId, tabIndex, singleId);
                if (out != null) return out;
            }
            return mapper.createObjectNode().put("ok", true);
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** Create a new row through GridTab. Defaults are populated by GridTab.dataNew;
     *  callouts fire on each setValue; validators + sequences fire on dataSave. */
    private ObjectNode gridCreate(int windowId, int tabIndex, Map<String, Object> changes) throws Exception {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        String trxName = Trx.createTrxName("erp-api-gcreate");
        Trx trx = Trx.get(trxName, true);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, windowId);
            GridWindow win = new GridWindow(winVO, true);
            GridTab tab = win.getTab(tabIndex);
            if (tab == null) throw new PoSaveException("Tab " + tabIndex + " not found in window " + windowId);
            tab.initTab(false);
            // Initialise an empty result set so dataNew has somewhere to insert.
            MQuery noMatch = new MQuery(tab.getTableName());
            noMatch.addRestriction("1=2");
            tab.setQuery(noMatch);
            tab.query(false);
            if (!tab.dataNew(false)) {
                throw new PoSaveException("dataNew rejected — defaults init failed");
            }

            applyChangesAndSave(tab, changes, true);
            trx.commit(true);

            int newId = tab.getRecord_ID();
            if (newId > 0) {
                ObjectNode out = singleRow(windowId, tabIndex, newId);
                if (out != null) return out;
            }
            return mapper.createObjectNode().put("ok", true);
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** Delete a row through GridTab. Fires the same beforeDelete/afterDelete
     *  ModelValidator hooks the ZK UI fires on Trash. */
    private ObjectNode gridDelete(int windowId, int tabIndex, long recordId) throws Exception {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        String trxName = Trx.createTrxName("erp-api-gdel");
        Trx trx = Trx.get(trxName, true);
        try {
            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, windowId);
            GridWindow win = new GridWindow(winVO, true);
            GridTab tab = win.getTab(tabIndex);
            if (tab == null) throw new PoSaveException("Tab " + tabIndex + " not found in window " + windowId);
            tab.initTab(false);

            String key = tab.getKeyColumnName();
            if (key == null || key.isEmpty()) {
                throw new PoSaveException("Composite-PK delete not supported via single-id endpoint");
            }
            MQuery q = MQuery.getEqualQuery(key, (int) recordId);
            tab.setQuery(q);
            tab.query(false);
            if (tab.getRowCount() == 0) {
                throw new PoSaveException("Row not found: " + tab.getTableName() + "[" + recordId + "]");
            }
            tab.navigate(0);

            if (!tab.dataDelete()) {
                String err = retrieveLastError("dataDelete returned false");
                throw new PoSaveException(err);
            }
            trx.commit(true);
            return mapper.createObjectNode().put("ok", true).put("deleted", recordId);
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** Apply each change via GridTab.setValue (fires callouts), then dataSave
     *  (fires ModelValidators, sequence allocation, doc workflow). Throws on
     *  the first rejected setValue or a save failure. */
    private void applyChangesAndSave(GridTab tab, Map<String, Object> changes, boolean isNew) {
        for (Map.Entry<String, Object> e : changes.entrySet()) {
            GridField fld = tab.getField(e.getKey());
            if (fld == null) {
                throw new PoSaveException("Unknown column on " + tab.getTableName() + ": " + e.getKey());
            }
            Object coerced = coerceTo(fld.getDisplayType(), e.getValue());
            String err = tab.setValue(fld, coerced);
            if (err != null && !err.isEmpty() && !"NoError".equals(err)) {
                throw new PoSaveException("setValue " + e.getKey() + ": " + err);
            }
        }
        boolean ok = tab.dataSave(true);
        if (!ok) {
            throw new PoSaveException(retrieveLastError(
                    isNew ? "dataSave (create) rejected" : "dataSave (update) rejected"));
        }
    }

    private static String retrieveLastError(String dflt) {
        org.compiere.util.ValueNamePair last = CLogger.retrieveError();
        if (last != null && last.getName() != null && !last.getName().isEmpty()) {
            return last.getName();
        }
        return dflt;
    }

    private static String sanitizeColumn(String s) {
        return s == null ? "" : s.replaceAll("[^A-Za-z0-9_]", "");
    }

    /** Coerce raw JSON value to the type the GridField expects, by AD displayType.
     *  Mirrors {@link #coerceTo(Class, Object)} but keyed on displayType (since
     *  GridField exposes that, not the Java class). */
    private Object coerceTo(int displayType, Object v) {
        if (v == null) return null;
        if (DisplayType.isID(displayType) || DisplayType.Integer == displayType) {
            if (v instanceof Number n) return n.intValue();
            return Integer.parseInt(v.toString());
        }
        if (DisplayType.isNumeric(displayType)) {
            if (v instanceof java.math.BigDecimal bd) return bd;
            if (v instanceof Number n) return new java.math.BigDecimal(n.toString());
            return new java.math.BigDecimal(v.toString());
        }
        if (DisplayType.YesNo == displayType) {
            if (v instanceof Boolean b) return b;
            String s = v.toString();
            return Boolean.valueOf(s) || "Y".equalsIgnoreCase(s);
        }
        if (DisplayType.isDate(displayType)) {
            if (v instanceof java.sql.Timestamp t) return t;
            String s = v.toString();
            try { return Timestamp.from(Instant.parse(s)); } catch (Exception ignore) {}
            try { return Timestamp.valueOf(java.time.LocalDate.parse(s).atStartOfDay()); } catch (Exception ignore) {}
            return v;
        }
        return v.toString();
    }

    private PO loadPoByKeys(Properties ctx, MTable mt, String tableName, Map<String, Object> keys, String trxName) {
        StringBuilder where = new StringBuilder();
        List<Object> params = new ArrayList<>();
        for (Map.Entry<String, Object> e : keys.entrySet()) {
            String safeCol = e.getKey().replaceAll("[^A-Za-z0-9_]", "");
            if (where.length() > 0) where.append(" AND ");
            where.append(safeCol).append("=?");
            params.add(e.getValue());
        }
        List<PO> hits = new Query(ctx, tableName, where.toString(), trxName)
                .setParameters(params.toArray()).list();
        return hits.isEmpty() ? null : hits.get(0);
    }

    // ─── HELPERS ────────────────────────────────────────────────────────────

    /**
     * Bootstrap a request context. Hard-coded GardenWorld super-admin —
     * client 11, org *, user 100 (SuperUser), role 102. When Keycloak JWT
     * validation lands, this resolves the calling user's iDempiere role.
     * Documented as a known POC gap in the BFF handoff.
     */
    private Properties newRequestContext() {
        Properties ctx = new Properties();
        Env.setContext(ctx, "#AD_Client_ID", 11);
        Env.setContext(ctx, "#AD_Org_ID", 0);
        Env.setContext(ctx, "#AD_User_ID", 100);
        Env.setContext(ctx, "#AD_Role_ID", 102);
        Env.setContext(ctx, "#Date", new Timestamp(System.currentTimeMillis()));
        Env.setContext(ctx, "#AD_Language", "en_US");
        return ctx;
    }

    private void restoreCtx(Properties prevCtx) {
        if (prevCtx != null) ServerContext.setCurrentInstance(prevCtx);
        else ServerContext.dispose();
    }

    /**
     * Resolve the column on the current (child) tab that links to its
     * parent tab's PK. Honours {@code Parent_Column_ID} from AD when set,
     * else falls back to the convention {@code <ParentTable>_ID}.
     */
    private String resolveParentLinkColumn(Properties ctx, GridWindowVO winVO, int tabIndex) {
        GridTabVO tabVO = winVO.Tabs.get(tabIndex);
        if (tabVO.Parent_Column_ID > 0) {
            try {
                MColumn pcol = MColumn.get(ctx, tabVO.Parent_Column_ID);
                if (pcol != null) return pcol.getColumnName();
            } catch (Exception ignore) { }
        }
        // Walk up to the closest tab with a smaller TabLevel
        for (int i = tabIndex - 1; i >= 0; i--) {
            if (winVO.Tabs.get(i).TabLevel < tabVO.TabLevel) {
                return winVO.Tabs.get(i).TableName + "_ID";
            }
        }
        return null;
    }

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
            // Y/N → boolean for flag-style columns
            if ((s.equals("Y") || s.equals("N")) && (key.startsWith("is") || key.startsWith("has"))) {
                row.put(key, "Y".equals(s));
            } else {
                row.put(key, s);
            }
        } else {
            row.put(key, val.toString());
        }
    }

    private static String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
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

    private static Long parseLong(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Long.parseLong(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static int clamp(int v, int lo, int hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    private static Object jsonToJava(JsonNode n) {
        if (n == null || n.isNull()) return null;
        if (n.isBoolean()) return n.booleanValue();
        if (n.isIntegralNumber()) return n.longValue();
        if (n.isFloatingPointNumber()) return n.doubleValue();
        if (n.isTextual()) return n.textValue();
        return n.toString();
    }

    /**
     * Coerce JSON-decoded values to the type PO expects for that column. PO
     * compares old vs new with {@code Object.equals}; if types differ the
     * column never gets marked dirty and {@code save()} silently no-ops.
     */
    private Object coerceTo(Class<?> cls, Object v) {
        if (v == null) return null;
        if (cls == java.math.BigDecimal.class) {
            if (v instanceof java.math.BigDecimal bd) return bd;
            if (v instanceof Number n) return java.math.BigDecimal.valueOf(n.doubleValue());
            if (v instanceof String s && !s.isBlank()) return new java.math.BigDecimal(s.trim());
            return null;
        }
        if (cls == Integer.class) {
            if (v instanceof Integer i) return i;
            if (v instanceof Number n) return n.intValue();
            if (v instanceof String s && !s.isBlank()) return Integer.parseInt(s.trim());
            return null;
        }
        if (cls == Long.class) {
            if (v instanceof Long l) return l;
            if (v instanceof Number n) return n.longValue();
            if (v instanceof String s && !s.isBlank()) return Long.parseLong(s.trim());
            return null;
        }
        if (cls == Boolean.class) {
            if (v instanceof Boolean b) return b;
            if (v instanceof String s) return "Y".equalsIgnoreCase(s) || "true".equalsIgnoreCase(s);
            return Boolean.FALSE;
        }
        if (cls == String.class) {
            if (v instanceof String s) return s.isEmpty() ? null : s;
            return v.toString();
        }
        if (cls == Timestamp.class) {
            if (v instanceof Timestamp ts) return ts;
            if (v instanceof String s && !s.isBlank()) {
                String t = s.length() == 10 ? s + " 00:00:00" : s.replace('T', ' ').replace("Z", "");
                return Timestamp.valueOf(t);
            }
            return null;
        }
        return v;
    }

    private static class PoSaveException extends RuntimeException {
        PoSaveException(String m) { super(m); }
    }
}
