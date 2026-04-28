package com.telcobright.erp.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.adempiere.util.ServerContext;
import org.compiere.acct.Doc;
import org.compiere.model.GridField;
import org.compiere.model.GridFieldVO;
import org.compiere.model.GridTab;
import org.compiere.model.GridTabVO;
import org.compiere.model.GridWindow;
import org.compiere.model.GridWindowVO;
import org.compiere.model.MAcctSchema;
import org.compiere.model.MColumn;
import org.compiere.model.MDocType;
import org.compiere.model.MInOut;
import org.compiere.model.MInOutLine;
import org.compiere.model.MInventory;
import org.compiere.model.MLocator;
import org.compiere.model.MLookup;
import org.compiere.model.MMovement;
import org.compiere.model.MMovementLine;
import org.compiere.model.MStorageOnHand;
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
    /** Stock adjustment shortcut — posts a one-line Physical Inventory doc
     *  through the same Window 168 / GridTab path the ZK UI uses, then
     *  completes it via {@code MInventory.processIt("CO")} so M_Storage,
     *  M_Transaction, and Fact_Acct rows are written by the standard
     *  posting engine (we never write those tables directly). */
    private static final Pattern P_INVENTORY_ADJUST =
            Pattern.compile("^/inventory/adjust$");
    /** Material Receipt — Vendor IN (M_InOut, IsSOTrx=N). Adds stock at a
     *  locator with optional vendor + bill-of-lading info; the standard
     *  Doc_InOut posting engine writes M_Storage / M_Transaction / Fact_Acct. */
    private static final Pattern P_INVENTORY_RECEIVE =
            Pattern.compile("^/inventory/receive$");
    /** Internal Movement — moves stock between two locators, optionally
     *  across warehouses (M_Movement / M_MovementLine). */
    private static final Pattern P_INVENTORY_MOVE =
            Pattern.compile("^/inventory/move$");
    /** Internal Use Inventory — consume / scrap / write-off (M_Inventory,
     *  DocSubTypeInv=IU). Reduces on-hand without a customer shipment. */
    private static final Pattern P_INVENTORY_ISSUE =
            Pattern.compile("^/inventory/issue$");
    /** GET — list warehouses for the calling client (no SQL; uses the
     *  iDempiere {@link Query} model API). */
    private static final Pattern P_WAREHOUSE_LIST =
            Pattern.compile("^/warehouse/list$");
    /** GET — locators in a warehouse with on-hand rollup. */
    private static final Pattern P_WAREHOUSE_LOCATORS =
            Pattern.compile("^/warehouse/(\\d+)/locators$");
    /** GET — product-level stock breakdown for one warehouse. */
    private static final Pattern P_WAREHOUSE_STOCK =
            Pattern.compile("^/warehouse/(\\d+)/stock$");
    /** GET — list business partners for a picker. ?role=vendor|customer */
    private static final Pattern P_BPARTNER_LIST =
            Pattern.compile("^/bpartner/list$");
    /** GET — list active charges (cost categories) for the Issue picker. */
    private static final Pattern P_CHARGE_LIST =
            Pattern.compile("^/charge/list$");
    private static final int W_PHYS_INVENTORY = 168;
    private static final int W_MATERIAL_RECEIPT = 184;
    private static final int W_MATERIAL_MOVEMENT = 170;

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
            if (P_WAREHOUSE_LIST.matcher(path).matches()) {
                writeJson(resp, warehouseList());
                return;
            }
            if ((m = P_WAREHOUSE_LOCATORS.matcher(path)).matches()) {
                int warehouseId = Integer.parseInt(m.group(1));
                writeJson(resp, warehouseLocators(warehouseId));
                return;
            }
            if ((m = P_WAREHOUSE_STOCK.matcher(path)).matches()) {
                int warehouseId = Integer.parseInt(m.group(1));
                writeJson(resp, warehouseStock(warehouseId));
                return;
            }
            if (P_BPARTNER_LIST.matcher(path).matches()) {
                String role = req.getParameter("role");  // "vendor" | "customer" | null
                String q = req.getParameter("q");
                writeJson(resp, bpartnerList(role, q));
                return;
            }
            if (P_CHARGE_LIST.matcher(path).matches()) {
                writeJson(resp, chargeList());
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
            if (P_INVENTORY_ADJUST.matcher(path).matches()) {
                JsonNode body = mapper.readTree(req.getReader());
                int productId = body.path("productId").asInt();
                int locatorId = body.path("locatorId").asInt();
                String qtyText = body.path("newQty").asText("");
                if (productId <= 0 || locatorId <= 0 || qtyText.isEmpty()) {
                    error(resp, 400, "bad_request", "productId, locatorId, newQty required"); return;
                }
                java.math.BigDecimal newQty;
                try { newQty = new java.math.BigDecimal(qtyText); }
                catch (NumberFormatException e) { error(resp, 400, "bad_request", "newQty must be numeric"); return; }
                String description = body.hasNonNull("description") ? body.get("description").asText() : null;
                writeJson(resp, inventoryAdjust(productId, locatorId, newQty, description));
                return;
            }
            if (P_INVENTORY_RECEIVE.matcher(path).matches()) {
                JsonNode body = mapper.readTree(req.getReader());
                int productId = body.path("productId").asInt();
                int locatorId = body.path("locatorId").asInt();
                int bpartnerId = body.path("bpartnerId").asInt();
                String qtyText = body.path("qty").asText("");
                if (productId <= 0 || locatorId <= 0 || bpartnerId <= 0 || qtyText.isEmpty()) {
                    error(resp, 400, "bad_request", "productId, locatorId, bpartnerId, qty required"); return;
                }
                java.math.BigDecimal qty;
                try { qty = new java.math.BigDecimal(qtyText); }
                catch (NumberFormatException e) { error(resp, 400, "bad_request", "qty must be numeric"); return; }
                String description = body.hasNonNull("description") ? body.get("description").asText() : null;
                writeJson(resp, inventoryReceive(productId, locatorId, bpartnerId, qty, description));
                return;
            }
            if (P_INVENTORY_MOVE.matcher(path).matches()) {
                JsonNode body = mapper.readTree(req.getReader());
                int productId = body.path("productId").asInt();
                int fromLocatorId = body.path("fromLocatorId").asInt();
                int toLocatorId = body.path("toLocatorId").asInt();
                String qtyText = body.path("qty").asText("");
                if (productId <= 0 || fromLocatorId <= 0 || toLocatorId <= 0 || qtyText.isEmpty()) {
                    error(resp, 400, "bad_request", "productId, fromLocatorId, toLocatorId, qty required"); return;
                }
                if (fromLocatorId == toLocatorId) {
                    error(resp, 400, "bad_request", "fromLocatorId and toLocatorId must differ"); return;
                }
                java.math.BigDecimal qty;
                try { qty = new java.math.BigDecimal(qtyText); }
                catch (NumberFormatException e) { error(resp, 400, "bad_request", "qty must be numeric"); return; }
                String description = body.hasNonNull("description") ? body.get("description").asText() : null;
                writeJson(resp, inventoryMove(productId, fromLocatorId, toLocatorId, qty, description));
                return;
            }
            if (P_INVENTORY_ISSUE.matcher(path).matches()) {
                JsonNode body = mapper.readTree(req.getReader());
                int productId = body.path("productId").asInt();
                int locatorId = body.path("locatorId").asInt();
                int chargeId = body.path("chargeId").asInt();
                String qtyText = body.path("qty").asText("");
                if (productId <= 0 || locatorId <= 0 || qtyText.isEmpty()) {
                    error(resp, 400, "bad_request", "productId, locatorId, qty required"); return;
                }
                java.math.BigDecimal qty;
                try { qty = new java.math.BigDecimal(qtyText); }
                catch (NumberFormatException e) { error(resp, 400, "bad_request", "qty must be numeric"); return; }
                String description = body.hasNonNull("description") ? body.get("description").asText() : null;
                writeJson(resp, inventoryIssue(productId, locatorId, chargeId, qty, description));
                return;
            }
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
                    // MLookupFactory's SELECT shape is well-defined:
                    //   Table/Table Direct/Search: col1 = numeric id, col2 = NULL, col3 = display
                    //   List                    : col1 = NULL,        col2 = value code, col3 = display
                    // The lookup key is whichever of col1/col2 is non-null.
                    Object col1 = cc >= 1 ? rs.getObject(1) : null;
                    String col2 = cc >= 2 ? rs.getString(2) : null;
                    String col3 = cc >= 3 ? rs.getString(3) : null;
                    if (col1 != null) {
                        if (col1 instanceof Number n) r.put("id", n.intValue());
                        else r.put("id", col1.toString());
                    } else if (col2 != null) {
                        r.put("id", col2);
                    }
                    if (col2 != null) r.put("value", col2);
                    if (col3 != null) r.put("name", col3);
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

    /** Stock adjustment via Window 168 (Physical Inventory).
     *
     *  Posts a single-line Physical Inventory document (InventoryType=D,
     *  "Difference") through the same GridTab path ZK uses, then calls
     *  {@code MInventory.processIt("CO")} to complete it. Completion is
     *  what triggers {@code Doc_Inventory} → {@code M_Storage} update,
     *  {@code M_Transaction} write, and {@code Fact_Acct} posting against
     *  the Inventory-Adjustment / Inventory-Asset accounts wired on the
     *  product's category. We never touch those tables directly.
     *
     *  Header tab and line tab share one {@link GridWindow} + WindowNo so
     *  the line tab can resolve {@code M_Inventory_ID} from context after
     *  the header save. {@link MLocator#get} resolves the warehouse from
     *  the user-picked locator (no SQL).
     *
     *  QtyBook auto-fills via the {@code M_InventoryLine} callout when we
     *  setValue M_Locator_ID + M_Product_ID; we only have to set QtyCount
     *  to the user's new on-hand. */
    private ObjectNode inventoryAdjust(int productId, int locatorId,
                                       java.math.BigDecimal newQty,
                                       String description) throws Exception {
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        String trxName = Trx.createTrxName("erp-api-invadj");
        Trx trx = Trx.get(trxName, true);
        try {
            MLocator loc = MLocator.get(ctx, locatorId);
            if (loc == null || loc.getM_Locator_ID() == 0) {
                throw new PoSaveException("Locator " + locatorId + " not found");
            }
            int warehouseId = loc.getM_Warehouse_ID();
            // Warehouse owns the Org for inventory docs — propagate it explicitly,
            // since headless GridTab dataNew leaves AD_Org_ID at the context
            // default (0 = '*' / all orgs) and M_Inventory requires a real org.
            int orgId = loc.getAD_Org_ID();

            // Resolve the doc type for "Physical Inventory" (DocBaseType=MMI,
            // DocSubTypeInv=PI). MMI is shared with Internal Use and Cost
            // Adjustment subtypes, so we filter explicitly — picking the
            // wrong subtype causes processIt to fail with "Document
            // inventory subtype not configured".
            int docTypeId = 0;
            for (MDocType dt : MDocType.getOfDocBaseType(ctx, MDocType.DOCBASETYPE_MaterialPhysicalInventory)) {
                if (MDocType.DOCSUBTYPEINV_PhysicalInventory.equals(dt.getDocSubTypeInv())) {
                    docTypeId = dt.getC_DocType_ID();
                    break;
                }
            }
            if (docTypeId == 0) {
                throw new PoSaveException("No Physical Inventory doc type (DocSubTypeInv=PI) configured for this client");
            }

            // ── Header (M_Inventory) — created via PO, autocommitted ────────
            // The header has no callouts that matter for our flow; using
            // MInventory directly bypasses headless GridTab.dataNew quirks
            // (saveCheck rejects on the PK column for reasons that don't
            // surface in the BPartner path). PO.save still fires Model
            // Validators, sequence allocation (DocumentNo), and column
            // defaults — all the header actually needs.
            //
            // We pass {@code null} as the trxName so the header is
            // autocommitted: the line tab's beforeSave does
            // {@code new MInventory(ctx, M_Inventory_ID, null)} via
            // {@link MInventoryLine#getParent} and won't see uncommitted
            // rows otherwise.
            MInventory inv = new MInventory(ctx, 0, null);
            inv.setAD_Org_ID(orgId);
            inv.setM_Warehouse_ID(warehouseId);
            inv.setC_DocType_ID(docTypeId);
            inv.setMovementDate(new Timestamp(System.currentTimeMillis()));
            if (description != null && !description.isEmpty()) {
                inv.setDescription(description);
            }
            inv.saveEx();
            int headerId = inv.get_ID();
            if (headerId <= 0) {
                throw new PoSaveException("Header save returned no ID");
            }

            // Set up the GridWindow and seed line-tab context with the new
            // header ID so the line tab's parent-driven defaults work.
            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, W_PHYS_INVENTORY);
            GridWindow win = new GridWindow(winVO, true);
            Env.setContext(ctx, windowNo, "M_Inventory_ID", headerId);
            Env.setContext(ctx, windowNo, "AD_Org_ID", orgId);
            Env.setContext(ctx, windowNo, "M_Warehouse_ID", warehouseId);

            // ── Line tab (M_InventoryLine) ──────────────────────────────────
            GridTab line = win.getTab(1);
            if (line == null) throw new PoSaveException("Window 168 tab 1 missing");
            line.initTab(false);
            line.query(false);  // no existing lines yet
            if (!line.dataNew(false)) {
                throw new PoSaveException(retrieveLastError("dataNew (line) rejected"));
            }
            // Setting Locator first lets the locator/product callout chain
            // populate AD_Org_ID and (after Product) QtyBook from M_Storage.
            // QtyBook = current on-hand for (locator, product, ASI=0). The
            // M_InventoryLine callout that auto-fills this in the ZK UI does
            // not fire reliably in headless GridTab, so we read it directly
            // via the model layer (no SQL). Variance posted = QtyCount-QtyBook.
            java.math.BigDecimal qtyBook = MStorageOnHand.getQtyOnHandForLocator(
                    productId, locatorId, 0, null);
            if (qtyBook == null) qtyBook = java.math.BigDecimal.ZERO;

            Map<String, Object> lineChanges = new LinkedHashMap<>();
            lineChanges.put("AD_Org_ID", orgId);
            // Parent FK — set explicitly because the line tab's default
            // (@M_Inventory_ID@ from windowNo context) doesn't always
            // resolve in headless / freshly-instantiated GridWindow flows.
            lineChanges.put("M_Inventory_ID", headerId);
            lineChanges.put("M_Locator_ID", locatorId);
            lineChanges.put("M_Product_ID", productId);
            lineChanges.put("M_AttributeSetInstance_ID", 0);
            lineChanges.put("InventoryType", "D");  // "D" = Difference (variance posting)
            lineChanges.put("QtyBook", qtyBook);
            lineChanges.put("QtyCount", newQty);
            applyChangesAndSave(line, lineChanges, true);

            // ── Complete the document ───────────────────────────────────────
            inv.setDocAction(MInventory.DOCACTION_Complete);
            if (!inv.processIt(MInventory.DOCACTION_Complete)) {
                String pmsg = inv.getProcessMsg();
                throw new PoSaveException("processIt(CO): " + (pmsg != null ? pmsg : "unknown"));
            }
            inv.saveEx();
            trx.commit(true);

            // Post to Fact_Acct synchronously (the iDempiere default is
            // deferred posting → Posted=False until a background scheduler
            // runs; that's confusing for SMB users. postImmediate runs the
            // standard Doc.posting engine with a fresh trx.)
            String postErr = postSync(MInventory.Table_ID, headerId, ctx);

            ObjectNode out = mapper.createObjectNode();
            out.put("ok", true);
            out.put("inventoryId", headerId);
            out.put("documentNo", inv.getDocumentNo());
            out.put("docStatus", inv.getDocStatus());
            if (postErr != null) out.put("postWarning", postErr);
            return out;
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** Material Receipt — Vendor IN (M_InOut, IsSOTrx=N, DocBaseType=MMR).
     *  Header via {@link MInOut} PO (autocommit so the line tab's
     *  {@code MInOutLine.getParent()} can see it). Line via GridTab so
     *  callouts on M_Locator_ID / M_Product_ID populate UOM, ASI, etc.
     *  After processIt(CO) the standard Doc_InOut posting engine writes
     *  M_Storage / M_Transaction / Fact_Acct.
     *  No raw SQL: MLocator.get / MDocType.getOfDocBaseType / GridTab. */
    private ObjectNode inventoryReceive(int productId, int locatorId, int bpartnerId,
                                        java.math.BigDecimal qty, String description) throws Exception {
        if (qty == null || qty.signum() <= 0) {
            throw new PoSaveException("qty must be > 0 for a receipt");
        }
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        String trxName = Trx.createTrxName("erp-api-recv");
        Trx trx = Trx.get(trxName, true);
        try {
            MLocator loc = MLocator.get(ctx, locatorId);
            if (loc == null || loc.getM_Locator_ID() == 0) {
                throw new PoSaveException("Locator " + locatorId + " not found");
            }
            int warehouseId = loc.getM_Warehouse_ID();
            int orgId = loc.getAD_Org_ID();

            int docTypeId = 0;
            for (MDocType dt : MDocType.getOfDocBaseType(ctx, MDocType.DOCBASETYPE_MaterialReceipt)) {
                // The first MMR doc type for the client is fine — receipt
                // doc types don't have meaningful subtypes for vendor IN.
                docTypeId = dt.getC_DocType_ID();
                break;
            }
            if (docTypeId == 0) {
                throw new PoSaveException("No Material Receipt doc type (MMR) configured for this client");
            }

            // ── Header (M_InOut) — autocommitted PO ────────────────────────
            // Resolve the BP's primary ship-to location — required (NOT NULL)
            // on M_InOut. iDempiere's MBPartner exposes this directly.
            org.compiere.model.MBPartner bp = new org.compiere.model.MBPartner(ctx, bpartnerId, null);
            int bpLocationId = bp.getPrimaryC_BPartner_Location_ID();
            if (bpLocationId <= 0) {
                throw new PoSaveException("Vendor #" + bpartnerId + " has no active location configured");
            }
            MInOut io = new MInOut(ctx, 0, null);
            io.setAD_Org_ID(orgId);
            io.setIsSOTrx(false);                      // vendor IN
            io.setC_DocType_ID(docTypeId);
            io.setC_BPartner_ID(bpartnerId);
            io.setC_BPartner_Location_ID(bpLocationId);
            io.setM_Warehouse_ID(warehouseId);
            io.setMovementType(MInOut.MOVEMENTTYPE_VendorReceipts);
            io.setMovementDate(new Timestamp(System.currentTimeMillis()));
            io.setDateAcct(new Timestamp(System.currentTimeMillis()));
            if (description != null && !description.isEmpty()) io.setDescription(description);
            io.saveEx();
            int headerId = io.get_ID();
            if (headerId <= 0) throw new PoSaveException("Receipt header save returned no ID");

            // ── Line (M_InOutLine) via GridTab so the locator/product
            //    callouts fill UOM, ASI, default movement qty, etc. ────────
            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, W_MATERIAL_RECEIPT);
            GridWindow win = new GridWindow(winVO, true);
            Env.setContext(ctx, windowNo, "M_InOut_ID", headerId);
            Env.setContext(ctx, windowNo, "AD_Org_ID", orgId);
            Env.setContext(ctx, windowNo, "M_Warehouse_ID", warehouseId);
            Env.setContext(ctx, windowNo, "C_BPartner_ID", bpartnerId);
            Env.setContext(ctx, windowNo, "IsSOTrx", "N");

            GridTab line = win.getTab(1);
            if (line == null) throw new PoSaveException("Window 184 tab 1 missing");
            line.initTab(false);
            line.query(false);
            if (!line.dataNew(false)) {
                throw new PoSaveException(retrieveLastError("dataNew (line) rejected"));
            }
            // Resolve the product's UOM up front — the line callout that
            // would default it from M_Product_ID doesn't always fire reliably
            // in the headless GridTab path, and FillMandatory(C_UOM_ID)
            // rejects the save when missing. MProduct.get is from the model
            // layer (no SQL).
            org.compiere.model.MProduct prod = org.compiere.model.MProduct.get(ctx, productId);
            int uomId = prod != null ? prod.getC_UOM_ID() : 0;
            Map<String, Object> lineChanges = new LinkedHashMap<>();
            lineChanges.put("AD_Org_ID", orgId);
            lineChanges.put("M_InOut_ID", headerId);
            lineChanges.put("M_Locator_ID", locatorId);
            lineChanges.put("M_Product_ID", productId);
            lineChanges.put("M_AttributeSetInstance_ID", 0);
            if (uomId > 0) lineChanges.put("C_UOM_ID", uomId);
            lineChanges.put("QtyEntered", qty);
            lineChanges.put("MovementQty", qty);
            applyChangesAndSave(line, lineChanges, true);

            // ── Complete + post ────────────────────────────────────────────
            io.setDocAction(MInOut.DOCACTION_Complete);
            if (!io.processIt(MInOut.DOCACTION_Complete)) {
                String pmsg = io.getProcessMsg();
                throw new PoSaveException("processIt(CO): " + (pmsg != null ? pmsg : "unknown"));
            }
            io.saveEx();
            trx.commit(true);
            String postErr = postSync(MInOut.Table_ID, headerId, ctx);

            ObjectNode out = mapper.createObjectNode();
            out.put("ok", true);
            out.put("inoutId", headerId);
            out.put("documentNo", io.getDocumentNo());
            out.put("docStatus", io.getDocStatus());
            if (postErr != null) out.put("postWarning", postErr);
            return out;
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** Internal Movement — moves stock between locators (M_Movement /
     *  M_MovementLine). Header via PO autocommit, line via GridTab so the
     *  product / from-locator callouts default UOM and movement qty. */
    private ObjectNode inventoryMove(int productId, int fromLocatorId, int toLocatorId,
                                     java.math.BigDecimal qty, String description) throws Exception {
        if (qty == null || qty.signum() <= 0) {
            throw new PoSaveException("qty must be > 0 for a movement");
        }
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        String trxName = Trx.createTrxName("erp-api-move");
        Trx trx = Trx.get(trxName, true);
        try {
            MLocator from = MLocator.get(ctx, fromLocatorId);
            MLocator to = MLocator.get(ctx, toLocatorId);
            if (from == null || from.getM_Locator_ID() == 0)
                throw new PoSaveException("From-locator " + fromLocatorId + " not found");
            if (to == null || to.getM_Locator_ID() == 0)
                throw new PoSaveException("To-locator " + toLocatorId + " not found");
            int orgId = from.getAD_Org_ID();

            int docTypeId = 0;
            for (MDocType dt : MDocType.getOfDocBaseType(ctx, MDocType.DOCBASETYPE_MaterialMovement)) {
                docTypeId = dt.getC_DocType_ID();
                break;
            }
            if (docTypeId == 0) {
                throw new PoSaveException("No Material Movement doc type (MMM) configured for this client");
            }

            MMovement mv = new MMovement(ctx, 0, null);
            mv.setAD_Org_ID(orgId);
            mv.setC_DocType_ID(docTypeId);
            mv.setMovementDate(new Timestamp(System.currentTimeMillis()));
            if (description != null && !description.isEmpty()) mv.setDescription(description);
            mv.saveEx();
            int headerId = mv.get_ID();
            if (headerId <= 0) throw new PoSaveException("Movement header save returned no ID");

            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, W_MATERIAL_MOVEMENT);
            GridWindow win = new GridWindow(winVO, true);
            Env.setContext(ctx, windowNo, "M_Movement_ID", headerId);
            Env.setContext(ctx, windowNo, "AD_Org_ID", orgId);

            GridTab line = win.getTab(1);
            if (line == null) throw new PoSaveException("Window 170 tab 1 missing");
            line.initTab(false);
            line.query(false);
            if (!line.dataNew(false)) {
                throw new PoSaveException(retrieveLastError("dataNew (line) rejected"));
            }
            org.compiere.model.MProduct prod = org.compiere.model.MProduct.get(ctx, productId);
            int uomId = prod != null ? prod.getC_UOM_ID() : 0;
            Map<String, Object> lineChanges = new LinkedHashMap<>();
            lineChanges.put("AD_Org_ID", orgId);
            lineChanges.put("M_Movement_ID", headerId);
            lineChanges.put("M_Locator_ID", fromLocatorId);
            lineChanges.put("M_LocatorTo_ID", toLocatorId);
            lineChanges.put("M_Product_ID", productId);
            lineChanges.put("M_AttributeSetInstance_ID", 0);
            if (uomId > 0) lineChanges.put("C_UOM_ID", uomId);
            lineChanges.put("MovementQty", qty);
            applyChangesAndSave(line, lineChanges, true);

            mv.setDocAction(MMovement.DOCACTION_Complete);
            if (!mv.processIt(MMovement.DOCACTION_Complete)) {
                String pmsg = mv.getProcessMsg();
                throw new PoSaveException("processIt(CO): " + (pmsg != null ? pmsg : "unknown"));
            }
            mv.saveEx();
            trx.commit(true);
            String postErr = postSync(MMovement.Table_ID, headerId, ctx);

            ObjectNode out = mapper.createObjectNode();
            out.put("ok", true);
            out.put("movementId", headerId);
            out.put("documentNo", mv.getDocumentNo());
            out.put("docStatus", mv.getDocStatus());
            if (postErr != null) out.put("postWarning", postErr);
            return out;
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** Internal Use Inventory — consume / scrap / write-off (M_Inventory
     *  with DocSubTypeInv=IU). Reduces on-hand by {@code qty} at the
     *  selected locator without a customer shipment. The line's QtyInternalUse
     *  drives the Doc_Inventory posting engine. */
    private ObjectNode inventoryIssue(int productId, int locatorId, int chargeId,
                                      java.math.BigDecimal qty, String description) throws Exception {
        if (qty == null || qty.signum() <= 0) {
            throw new PoSaveException("qty must be > 0 for an issue / scrap");
        }
        Properties ctx = newRequestContext();
        Properties prevCtx = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        int windowNo = nextWindowNo();
        String trxName = Trx.createTrxName("erp-api-issue");
        Trx trx = Trx.get(trxName, true);
        try {
            MLocator loc = MLocator.get(ctx, locatorId);
            if (loc == null || loc.getM_Locator_ID() == 0) {
                throw new PoSaveException("Locator " + locatorId + " not found");
            }
            int warehouseId = loc.getM_Warehouse_ID();
            int orgId = loc.getAD_Org_ID();

            int docTypeId = 0;
            for (MDocType dt : MDocType.getOfDocBaseType(ctx, MDocType.DOCBASETYPE_MaterialPhysicalInventory)) {
                if (MDocType.DOCSUBTYPEINV_InternalUseInventory.equals(dt.getDocSubTypeInv())) {
                    docTypeId = dt.getC_DocType_ID();
                    break;
                }
            }
            if (docTypeId == 0) {
                throw new PoSaveException("No Internal Use Inventory doc type (DocSubTypeInv=IU) configured for this client");
            }

            MInventory inv = new MInventory(ctx, 0, null);
            inv.setAD_Org_ID(orgId);
            inv.setM_Warehouse_ID(warehouseId);
            inv.setC_DocType_ID(docTypeId);
            inv.setMovementDate(new Timestamp(System.currentTimeMillis()));
            if (description != null && !description.isEmpty()) inv.setDescription(description);
            inv.saveEx();
            int headerId = inv.get_ID();
            if (headerId <= 0) throw new PoSaveException("Issue header save returned no ID");

            GridWindowVO winVO = GridWindowVO.create(ctx, windowNo, W_PHYS_INVENTORY);
            GridWindow win = new GridWindow(winVO, true);
            Env.setContext(ctx, windowNo, "M_Inventory_ID", headerId);
            Env.setContext(ctx, windowNo, "AD_Org_ID", orgId);
            Env.setContext(ctx, windowNo, "M_Warehouse_ID", warehouseId);

            GridTab line = win.getTab(1);
            if (line == null) throw new PoSaveException("Window 168 tab 1 missing");
            line.initTab(false);
            line.query(false);
            if (!line.dataNew(false)) {
                throw new PoSaveException(retrieveLastError("dataNew (line) rejected"));
            }
            Map<String, Object> lineChanges = new LinkedHashMap<>();
            lineChanges.put("AD_Org_ID", orgId);
            lineChanges.put("M_Inventory_ID", headerId);
            lineChanges.put("M_Locator_ID", locatorId);
            lineChanges.put("M_Product_ID", productId);
            lineChanges.put("M_AttributeSetInstance_ID", 0);
            // InventoryType "C" = Charge / Internal Use ("I" is rejected by
            // the InventoryType ref list — only C and D are valid). When
            // InventoryType=C, MInventoryLine.beforeSave requires a
            // C_Charge_ID (the account the consumed stock gets posted to).
            // If the caller didn't pick one, fall back to the first active
            // charge for the client — convenient for SMB defaults.
            lineChanges.put("InventoryType", "C");
            lineChanges.put("QtyInternalUse", qty);
            int resolvedChargeId = chargeId;
            if (resolvedChargeId <= 0) {
                List<PO> charges = new Query(ctx,
                        org.compiere.model.MCharge.Table_Name,
                        "AD_Client_ID=? AND IsActive='Y'", null)
                        .setParameters(Env.getAD_Client_ID(ctx))
                        .setOrderBy("Name")
                        .setPageSize(1)
                        .list();
                if (!charges.isEmpty()) {
                    resolvedChargeId = ((org.compiere.model.MCharge) charges.get(0)).getC_Charge_ID();
                }
            }
            if (resolvedChargeId <= 0) {
                throw new PoSaveException("Internal Use Inventory requires a Charge — none configured for this client; pass chargeId or create one in iDempiere first");
            }
            lineChanges.put("C_Charge_ID", resolvedChargeId);
            applyChangesAndSave(line, lineChanges, true);

            inv.setDocAction(MInventory.DOCACTION_Complete);
            if (!inv.processIt(MInventory.DOCACTION_Complete)) {
                String pmsg = inv.getProcessMsg();
                throw new PoSaveException("processIt(CO): " + (pmsg != null ? pmsg : "unknown"));
            }
            inv.saveEx();
            trx.commit(true);
            String postErr = postSync(MInventory.Table_ID, headerId, ctx);

            ObjectNode out = mapper.createObjectNode();
            out.put("ok", true);
            out.put("inventoryId", headerId);
            out.put("documentNo", inv.getDocumentNo());
            out.put("docStatus", inv.getDocStatus());
            if (postErr != null) out.put("postWarning", postErr);
            return out;
        } finally {
            try { trx.close(); } catch (Exception ignore) { }
            try { Env.clearWinContext(ctx, windowNo); } catch (Exception ignore) { }
            restoreCtx(prevCtx);
        }
    }

    /** GET /warehouse/list — list active M_Warehouse rows for the client.
     *  Uses the iDempiere {@link Query} model API (not raw SQL); the WHERE
     *  is a parameterised iDempiere idiom that {@code Query} translates
     *  to a JDBC PreparedStatement under the hood. */
    private ObjectNode warehouseList() {
        Properties ctx = newRequestContext();
        Properties prev = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            List<PO> rows = new Query(ctx,
                    org.compiere.model.MWarehouse.Table_Name,
                    "AD_Client_ID=? AND IsActive='Y'", null)
                    .setParameters(Env.getAD_Client_ID(ctx))
                    .setOrderBy("Value")
                    .list();
            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            for (PO po : rows) {
                org.compiere.model.MWarehouse wh = (org.compiere.model.MWarehouse) po;
                ObjectNode r = items.addObject();
                r.put("id", wh.getM_Warehouse_ID());
                r.put("value", wh.getValue());
                r.put("name", wh.getName());
                r.put("description", wh.getDescription());
                r.put("isInTransit", wh.isInTransit());
                r.put("orgId", wh.getAD_Org_ID());
            }
            return out;
        } finally { restoreCtx(prev); }
    }

    /** GET /warehouse/{id}/locators — locators in a warehouse with on-hand
     *  rollup (sum of {@code M_StorageOnHand.QtyOnHand} across all products
     *  at that locator). Two iDempiere {@link Query} calls — one for
     *  locators, one for storage rows — joined client-side. */
    private ObjectNode warehouseLocators(int warehouseId) {
        Properties ctx = newRequestContext();
        Properties prev = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            List<PO> locs = new Query(ctx, org.compiere.model.MLocator.Table_Name,
                    "M_Warehouse_ID=? AND IsActive='Y'", null)
                    .setParameters(warehouseId)
                    .setOrderBy("Value")
                    .list();
            // Pull all storage rows for this warehouse's locators in one go.
            List<PO> storage = new Query(ctx, MStorageOnHand.Table_Name,
                    "M_Locator_ID IN (SELECT M_Locator_ID FROM M_Locator WHERE M_Warehouse_ID=?)",
                    null)
                    .setParameters(warehouseId)
                    .list();
            Map<Integer, java.math.BigDecimal> rollup = new HashMap<>();
            Map<Integer, Integer> productCount = new HashMap<>();
            for (PO po : storage) {
                MStorageOnHand soh = (MStorageOnHand) po;
                int lid = soh.getM_Locator_ID();
                java.math.BigDecimal q = soh.getQtyOnHand();
                if (q == null) q = java.math.BigDecimal.ZERO;
                rollup.merge(lid, q, java.math.BigDecimal::add);
                productCount.merge(lid, q.signum() != 0 ? 1 : 0, Integer::sum);
            }
            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            for (PO po : locs) {
                org.compiere.model.MLocator l = (org.compiere.model.MLocator) po;
                ObjectNode r = items.addObject();
                r.put("id", l.getM_Locator_ID());
                r.put("value", l.getValue());
                r.put("x", l.getX());
                r.put("y", l.getY());
                r.put("z", l.getZ());
                r.put("isDefault", l.isDefault());
                java.math.BigDecimal q = rollup.getOrDefault(l.getM_Locator_ID(), java.math.BigDecimal.ZERO);
                r.put("qtyOnHand", q.doubleValue());
                r.put("productCount", productCount.getOrDefault(l.getM_Locator_ID(), 0));
            }
            return out;
        } finally { restoreCtx(prev); }
    }

    /** GET /warehouse/{id}/stock — product-level stock breakdown. Returns
     *  one row per (product, locator) with on-hand / reserved / ordered. */
    private ObjectNode warehouseStock(int warehouseId) {
        Properties ctx = newRequestContext();
        Properties prev = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            List<PO> storage = new Query(ctx, MStorageOnHand.Table_Name,
                    "M_Locator_ID IN (SELECT M_Locator_ID FROM M_Locator WHERE M_Warehouse_ID=?)",
                    null)
                    .setParameters(warehouseId)
                    .setOrderBy("M_Product_ID, M_Locator_ID")
                    .list();
            // Map of locatorId → display ("X-Y-Z") via MLocator.get
            Map<Integer, String> locName = new HashMap<>();
            // Map of productId → (name, value) via MProduct
            Map<Integer, String[]> prodInfo = new HashMap<>();
            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            for (PO po : storage) {
                MStorageOnHand soh = (MStorageOnHand) po;
                java.math.BigDecimal q = soh.getQtyOnHand();
                if (q == null || q.signum() == 0) continue;
                ObjectNode r = items.addObject();
                int locId = soh.getM_Locator_ID();
                String ln = locName.computeIfAbsent(locId, k -> {
                    org.compiere.model.MLocator l = org.compiere.model.MLocator.get(ctx, k);
                    return l == null ? ("#" + k)
                            : (l.getValue() != null && !l.getValue().isEmpty() ? l.getValue()
                                    : (l.getX() + "-" + l.getY() + "-" + l.getZ()));
                });
                int productId = soh.getM_Product_ID();
                String[] pi = prodInfo.computeIfAbsent(productId, k -> {
                    org.compiere.model.MProduct p = org.compiere.model.MProduct.get(ctx, k);
                    return p == null ? new String[] { "#" + k, "" }
                            : new String[] { p.getName(), p.getValue() == null ? "" : p.getValue() };
                });
                r.put("productId", productId);
                r.put("productName", pi[0]);
                r.put("productValue", pi[1]);
                r.put("locatorId", locId);
                r.put("locatorValue", ln);
                r.put("qtyOnHand", q.doubleValue());
            }
            return out;
        } finally { restoreCtx(prev); }
    }

    /** GET /bpartner/list?role=vendor|customer&q=... — picker-shaped list
     *  of business partners. Filters on {@code IsVendor='Y'} or
     *  {@code IsCustomer='Y'} when role is given; q matches Name or Value. */
    private ObjectNode bpartnerList(String role, String q) {
        Properties ctx = newRequestContext();
        Properties prev = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            StringBuilder where = new StringBuilder("AD_Client_ID=? AND IsActive='Y'");
            List<Object> params = new ArrayList<>();
            params.add(Env.getAD_Client_ID(ctx));
            if ("vendor".equalsIgnoreCase(role)) where.append(" AND IsVendor='Y'");
            else if ("customer".equalsIgnoreCase(role)) where.append(" AND IsCustomer='Y'");
            if (q != null && !q.isBlank()) {
                where.append(" AND (UPPER(Name) LIKE ? OR UPPER(Value) LIKE ?)");
                String like = "%" + q.trim().toUpperCase() + "%";
                params.add(like);
                params.add(like);
            }
            List<PO> rows = new Query(ctx,
                    org.compiere.model.MBPartner.Table_Name, where.toString(), null)
                    .setParameters(params.toArray())
                    .setOrderBy("Name")
                    .setPageSize(100)
                    .list();
            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            for (PO po : rows) {
                org.compiere.model.MBPartner bp = (org.compiere.model.MBPartner) po;
                ObjectNode r = items.addObject();
                r.put("id", bp.getC_BPartner_ID());
                r.put("value", bp.getValue());
                r.put("name", bp.getName());
                r.put("isVendor", bp.isVendor());
                r.put("isCustomer", bp.isCustomer());
            }
            return out;
        } finally { restoreCtx(prev); }
    }

    /** GET /charge/list — picker-shaped active charges for the client. */
    private ObjectNode chargeList() {
        Properties ctx = newRequestContext();
        Properties prev = ServerContext.getCurrentInstance();
        ServerContext.setCurrentInstance(ctx);
        try {
            List<PO> rows = new Query(ctx, org.compiere.model.MCharge.Table_Name,
                    "AD_Client_ID=? AND IsActive='Y'", null)
                    .setParameters(Env.getAD_Client_ID(ctx))
                    .setOrderBy("Name")
                    .list();
            ObjectNode out = mapper.createObjectNode();
            ArrayNode items = out.putArray("items");
            for (PO po : rows) {
                org.compiere.model.MCharge c = (org.compiere.model.MCharge) po;
                ObjectNode r = items.addObject();
                r.put("id", c.getC_Charge_ID());
                r.put("name", c.getName());
                r.put("description", c.getDescription());
            }
            return out;
        } finally { restoreCtx(prev); }
    }

    /** Run {@link Doc#postImmediate} so {@code Fact_Acct} is written
     *  synchronously (iDempiere defaults to deferred posting via the
     *  background AcctScheduler — confusing for SMB users who expect
     *  Posted=Y immediately on completion). Returns null on success or
     *  the iDempiere error message — never throws, since a posting
     *  failure shouldn't roll back an already-committed completed doc. */
    private String postSync(int adTableId, int recordId, Properties ctx) {
        try {
            int clientId = Env.getAD_Client_ID(ctx);
            MAcctSchema[] ass = MAcctSchema.getClientAcctSchema(ctx, clientId);
            if (ass == null || ass.length == 0) return "no accounting schema for client";
            return Doc.postImmediate(ass, adTableId, recordId, true, null);
        } catch (Exception e) {
            return e.getMessage();
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
