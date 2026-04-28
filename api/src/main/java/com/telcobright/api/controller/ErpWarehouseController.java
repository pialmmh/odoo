package com.telcobright.api.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.telcobright.api.erp.idempiere.IdempiereProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

/**
 * Spring Boot proxy for warehouse + business-partner read endpoints used by
 * the inventory dialogs and the warehouse pages. Forwards to the in-iDempiere
 * BFF, which resolves data through the iDempiere model classes (no SQL).
 *
 *   GET /api/erp/warehouses                    — list warehouses
 *   GET /api/erp/warehouses/{id}/locators      — locators with on-hand rollup
 *   GET /api/erp/warehouses/{id}/stock         — product-by-locator breakdown
 *   GET /api/erp/bpartners/list?role=vendor    — picker-shaped BP list
 */
@RestController
@RequestMapping("/api/erp")
public class ErpWarehouseController {

    private static final Logger log = LoggerFactory.getLogger(ErpWarehouseController.class);

    private final IdempiereProperties props;
    private final RestTemplate http = new RestTemplate();

    public ErpWarehouseController(IdempiereProperties props) {
        this.props = props;
    }

    @GetMapping("/warehouses")
    public ResponseEntity<?> list() {
        return forward("/warehouse/list", null);
    }

    @GetMapping("/warehouses/{id}/locators")
    public ResponseEntity<?> locators(@PathVariable int id) {
        return forward("/warehouse/" + id + "/locators", null);
    }

    @GetMapping("/warehouses/{id}/stock")
    public ResponseEntity<?> stock(@PathVariable int id) {
        return forward("/warehouse/" + id + "/stock", null);
    }

    @GetMapping("/bpartners/list")
    public ResponseEntity<?> bpartners(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String q) {
        UriComponentsBuilder b = UriComponentsBuilder.fromUriString("/bpartner/list");
        if (role != null) b.queryParam("role", role);
        if (q != null) b.queryParam("q", q);
        return forward(b.build().toUriString(), null);
    }

    @GetMapping("/charges/list")
    public ResponseEntity<?> charges() {
        return forward("/charge/list", null);
    }

    private ResponseEntity<?> forward(String pathAndQuery, Object body) {
        String url = props.getBffUrl() + pathAndQuery;
        try {
            ResponseEntity<JsonNode> resp = http.exchange(url, HttpMethod.GET,
                    body == null ? null : new HttpEntity<>(body), JsonNode.class);
            return ResponseEntity.status(resp.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON).body(resp.getBody());
        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            log.warn("erp-api {} {}: {}", pathAndQuery, status, e.getMessage());
            return ResponseEntity.status(status >= 400 && status < 600 ? status : 502).body(Map.of(
                    "error", "upstream_error",
                    "operation", pathAndQuery,
                    "message", e.getMessage()));
        } catch (Exception e) {
            log.error("erp-api {} failed", pathAndQuery, e);
            return ResponseEntity.status(502).body(Map.of(
                    "error", "upstream_error",
                    "operation", pathAndQuery,
                    "message", e.getMessage()));
        }
    }
}
