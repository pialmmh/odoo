package com.telcobright.api.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.telcobright.api.erp.idempiere.IdempiereProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Spring Boot proxy for ERP inventory operations. Forwards write actions to
 * the in-iDempiere BFF — which posts the appropriate document through the
 * GridTab path and completes it via {@code processIt("CO")}, letting the
 * standard posting engine write {@code M_Storage}, {@code M_Transaction},
 * and {@code Fact_Acct}. The BFF also runs {@code Doc.postImmediate} so
 * accounting posts synchronously (no Posted=False cliff).
 *
 *   POST /api/erp/inventory/adjust    — Physical Inventory variance (PI)
 *   POST /api/erp/inventory/receive   — Material Receipt (MMR, vendor IN)
 *   POST /api/erp/inventory/move      — Internal Movement (MMM)
 *   POST /api/erp/inventory/issue     — Internal Use Inventory (IU)
 */
@RestController
@RequestMapping("/api/erp/inventory")
public class ErpInventoryController {

    private static final Logger log = LoggerFactory.getLogger(ErpInventoryController.class);

    private final IdempiereProperties props;
    private final RestTemplate http = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    public ErpInventoryController(IdempiereProperties props) {
        this.props = props;
    }

    @PostMapping("/adjust")
    public ResponseEntity<?> adjust(@RequestBody Map<String, Object> body) {
        return forward("adjust", body);
    }

    @PostMapping("/receive")
    public ResponseEntity<?> receive(@RequestBody Map<String, Object> body) {
        return forward("receive", body);
    }

    @PostMapping("/move")
    public ResponseEntity<?> move(@RequestBody Map<String, Object> body) {
        return forward("move", body);
    }

    @PostMapping("/issue")
    public ResponseEntity<?> issue(@RequestBody Map<String, Object> body) {
        return forward("issue", body);
    }

    /** Forward to the BFF and translate iDempiere validation failures (HTTP
     *  422) into a stable error envelope the React layer can show verbatim
     *  — the React app stays "as dumb as the ZK client" and never tries to
     *  pre-validate; iDempiere is the validator. */
    private ResponseEntity<?> forward(String op, Map<String, Object> body) {
        String url = props.getBffUrl() + "/inventory/" + op;
        try {
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<JsonNode> resp = http.exchange(url, HttpMethod.POST,
                    new HttpEntity<>(body, h), JsonNode.class);
            return ResponseEntity.status(resp.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON).body(resp.getBody());
        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            String message = e.getMessage();
            try {
                JsonNode err = mapper.readTree(e.getResponseBodyAsString());
                if (err.has("message")) message = err.path("message").asText(message);
            } catch (Exception ignore) { }
            log.warn("inventory {} upstream {}: {}", op, status, message);
            if (status == 422) {
                return ResponseEntity.status(422).body(Map.of(
                        "error", "validation_failed",
                        "operation", op,
                        "message", message));
            }
            return ResponseEntity.status(status >= 400 && status < 600 ? status : 502).body(Map.of(
                    "error", "upstream_error",
                    "operation", op,
                    "message", message));
        } catch (Exception e) {
            log.error("inventory {} failed", op, e);
            return ResponseEntity.status(502).body(Map.of(
                    "error", "upstream_error",
                    "operation", op,
                    "message", e.getMessage()));
        }
    }
}
