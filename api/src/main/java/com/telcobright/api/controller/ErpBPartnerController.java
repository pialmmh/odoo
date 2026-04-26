package com.telcobright.api.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.telcobright.api.erp.idempiere.IdempiereProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thin Spring Boot proxy for the iDempiere Business Partner window.
 * Forwards reads to the in-iDempiere BFF at {@code :7079/erp-api/window/123/...}
 * and rewrites the response into a vendor-neutral camelCase shape that the
 * React UI consumes. Writes return 501 until the BFF write path lands.
 *
 * No SQL here. No mention of "iDempiere" leaks into response bodies.
 *
 *   GET  /api/erp/bpartners                — list
 *   GET  /api/erp/bpartners/{id}           — single
 *   GET  /api/erp/bpartners/_caps          — capability probe
 *   POST /api/erp/bpartners                — 501
 *   PATCH/PUT /api/erp/bpartners/{id}      — 501
 *   DELETE /api/erp/bpartners/{id}         — 501
 */
@RestController
@RequestMapping("/api/erp/bpartners")
public class ErpBPartnerController {

    private static final Logger log = LoggerFactory.getLogger(ErpBPartnerController.class);

    /** AD_Window_ID for the Business Partner window (constant across installs). */
    private static final int BPARTNER_WINDOW_ID = 123;
    /** Header tab index inside the window — the C_BPartner row tab. */
    private static final int HEADER_TAB_INDEX = 0;

    private final IdempiereProperties props;
    private final RestTemplate http = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();
    /** lowercase-DB-column → AD column name (e.g. "isactive" → "IsActive"). */
    private final Map<String, String> adColumnByLower = new HashMap<>();

    public ErpBPartnerController(IdempiereProperties props) {
        this.props = props;
    }

    @PostConstruct
    private void loadAdColumnNames() {
        try (InputStream is = new ClassPathResource("erp/idempiere/c_bpartner_window.json").getInputStream()) {
            JsonNode root = mapper.readTree(is);
            for (JsonNode tab : root.path("tabs")) {
                for (JsonNode f : tab.path("fields")) {
                    String col = f.path("columnName").asText(null);
                    if (col != null && !col.isEmpty()) {
                        adColumnByLower.put(col.toLowerCase(), col);
                    }
                }
            }
            log.info("Loaded {} AD column names for C_BPartner window", adColumnByLower.size());
        } catch (Exception e) {
            log.warn("Failed to load C_BPartner AD spec — falling back to underscore camelize", e);
        }
    }

    // ── Capability probe ─────────────────────────────────────────────────────
    @GetMapping("/_caps")
    public Map<String, Object> caps() {
        return Map.of(
                "reads", true,
                "writes", false,
                "writeReason", "feature_pending"
        );
    }

    // ── List ─────────────────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String dir) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        StringBuilder qs = new StringBuilder("?page=").append(Math.max(0, page))
                .append("&size=").append(safeSize);
        if (search != null && !search.isBlank()) {
            qs.append("&search=").append(URLEncoder.encode(search.trim(), StandardCharsets.UTF_8));
        }
        if (sort != null && !sort.isBlank()) {
            qs.append("&sort=").append(URLEncoder.encode(sort, StandardCharsets.UTF_8));
        }
        if (dir != null && !dir.isBlank()) {
            qs.append("&dir=").append(URLEncoder.encode(dir, StandardCharsets.UTF_8));
        }
        String url = props.getBffUrl()
                + "/window/" + BPARTNER_WINDOW_ID
                + "/tab/" + HEADER_TAB_INDEX
                + "/rows" + qs;
        try {
            JsonNode body = http.getForObject(url, JsonNode.class);
            if (body == null) return error("list", "empty response");

            ObjectNode out = mapper.createObjectNode();
            out.put("total", body.path("total").asLong(0));
            out.put("page", body.path("page").asInt(page));
            out.put("size", body.path("size").asInt(safeSize));
            var items = mapper.createArrayNode();
            JsonNode itemsNode = body.has("items") ? body.path("items") : body.path("rows");
            for (JsonNode r : itemsNode) {
                items.add(rowToListDto(r));
            }
            out.set("items", items);
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(out);
        } catch (HttpStatusCodeException e) {
            log.error("bpartners list upstream error: {} {}", e.getStatusCode(), e.getResponseBodyAsString());
            return error("list", "upstream " + e.getStatusCode().value());
        } catch (Exception e) {
            log.error("bpartners list failed", e);
            return error("list", e.getMessage());
        }
    }

    // ── Single row ───────────────────────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable long id) {
        String url = props.getBffUrl()
                + "/window/" + BPARTNER_WINDOW_ID
                + "/tab/" + HEADER_TAB_INDEX
                + "/row/" + id;
        try {
            JsonNode body = http.getForObject(url, JsonNode.class);
            if (body == null || body.isNull()) {
                return ResponseEntity.status(404).body(Map.of("error", "not_found", "id", id));
            }
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(rowToDetailDto(body));
        } catch (HttpStatusCodeException e) {
            if (e.getStatusCode().value() == 404) {
                return ResponseEntity.status(404).body(Map.of("error", "not_found", "id", id));
            }
            log.error("bpartners get upstream error: {} {}", e.getStatusCode(), e.getResponseBodyAsString());
            return error("get", "upstream " + e.getStatusCode().value());
        } catch (Exception e) {
            log.error("bpartners get failed", e);
            return error("get", e.getMessage());
        }
    }

    // ── Writes (placeholder until BFF write path lands) ──────────────────────
    @PostMapping
    public ResponseEntity<?> create(@RequestBody(required = false) Map<String, Object> body) {
        return notImplemented("create");
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        return notImplemented("update");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        return notImplemented("delete");
    }

    private ResponseEntity<?> notImplemented(String op) {
        return ResponseEntity.status(501).body(Map.of(
                "error", "not_implemented",
                "operation", op,
                "message", "Editing is not yet available."
        ));
    }

    private ResponseEntity<?> error(String op, String message) {
        return ResponseEntity.status(502).body(Map.of(
                "error", "upstream_error",
                "operation", op,
                "message", message != null ? message : "unknown"
        ));
    }

    // ── DTO mappers ──────────────────────────────────────────────────────────

    /** Compact shape for list rows — matches what {@code ErpBPartnerList.jsx} reads. */
    private ObjectNode rowToListDto(JsonNode r) {
        ObjectNode o = mapper.createObjectNode();
        o.put("id", r.path("c_bpartner_id").asLong(0));
        o.set("value", r.path("value"));
        o.set("name", r.path("name"));
        o.set("name2", r.path("name2"));
        o.set("description", r.path("description"));
        o.set("taxId", r.path("taxid"));
        o.set("naics", r.path("naics"));
        o.set("duns", r.path("duns"));
        o.put("isActive", boolish(r, "isactive"));
        o.put("isCustomer", boolish(r, "iscustomer"));
        o.put("isVendor", boolish(r, "isvendor"));
        o.put("isEmployee", boolish(r, "isemployee"));
        o.put("isSalesRep", boolish(r, "issalesrep"));
        o.put("isProspect", boolish(r, "isprospect"));
        o.put("isSummary", boolish(r, "issummary"));
        o.put("isOneTime", boolish(r, "isonetime"));
        copyId(o, r, "c_bp_group_id", "groupId");
        o.set("groupName", r.path("c_bp_group_id_display"));
        copyId(o, r, "ad_org_id", "orgId");
        o.set("orgName", r.path("ad_org_id_display"));
        return o;
    }

    /** Full shape for the edit page — every db-lowercase key translated back
     *  to its AD column name then camelized (so {@code isactive} → {@code IsActive}
     *  → {@code isActive}, matching what {@code ErpBPartnerDetail.jsx} reads).
     *  Resolved display strings are exposed under their conventional names. */
    private ObjectNode rowToDetailDto(JsonNode r) {
        ObjectNode out = mapper.createObjectNode();
        Map<String, JsonNode> displays = new LinkedHashMap<>();
        r.fields().forEachRemaining(e -> {
            String k = e.getKey();
            JsonNode v = e.getValue();
            if (k.endsWith("_display")) {
                displays.put(k, v);
                return;
            }
            String adName = adColumnByLower.get(k);
            String camel = adName != null ? camelFromAd(adName) : camelizeSnake(k);
            if (v.isTextual()) {
                String s = v.asText();
                if ("Y".equals(s) || "N".equals(s)) {
                    if (camel.startsWith("is") || camel.startsWith("has")) {
                        out.put(camel, "Y".equals(s));
                        return;
                    }
                }
            }
            out.set(camel, v);
        });
        // Pin the display strings the React detail page reads.
        out.set("groupName", displays.getOrDefault("c_bp_group_id_display", out.path("groupName")));
        out.set("orgName", displays.getOrDefault("ad_org_id_display", out.path("orgName")));
        out.set("clientName", displays.getOrDefault("ad_client_id_display", out.path("clientName")));
        out.set("languageName", displays.getOrDefault("ad_language_display", out.path("languageName")));
        out.set("priceListName", displays.getOrDefault("m_pricelist_id_display", out.path("priceListName")));
        out.set("poPriceListName", displays.getOrDefault("po_pricelist_id_display", out.path("poPriceListName")));
        out.set("paymentTermName", displays.getOrDefault("c_paymentterm_id_display", out.path("paymentTermName")));
        out.set("poPaymentTermName", displays.getOrDefault("po_paymentterm_id_display", out.path("poPaymentTermName")));
        out.set("salesRepName", displays.getOrDefault("salesrep_id_display", out.path("salesRepName")));
        out.set("dunningName", displays.getOrDefault("c_dunning_id_display", out.path("dunningName")));
        out.set("invoiceScheduleName", displays.getOrDefault("c_invoiceschedule_id_display", out.path("invoiceScheduleName")));
        return out;
    }

    private static void copyId(ObjectNode out, JsonNode src, String snake, String camel) {
        JsonNode v = src.path(snake);
        if (v.isMissingNode() || v.isNull()) {
            out.putNull(camel);
        } else {
            out.set(camel, v);
        }
    }

    private static boolean boolish(JsonNode r, String key) {
        JsonNode v = r.path(key);
        if (v.isBoolean()) return v.asBoolean();
        if (v.isTextual()) return "Y".equals(v.asText());
        return false;
    }

    static String camelizeSnake(String key) {
        if (key == null || key.isEmpty()) return key;
        String[] parts = key.split("_");
        StringBuilder sb = new StringBuilder(parts[0]);
        for (int i = 1; i < parts.length; i++) {
            String p = parts[i];
            if (p.isEmpty()) continue;
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.toString();
    }

    /** Convert an AD column name (e.g. "IsActive", "C_BPartner_ID") to camel case
     *  ("isActive", "cBPartnerId") that the React UI keys off. */
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
}
