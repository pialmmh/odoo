package com.telcobright.api.controller;

import com.telcobright.api.odoo.OdooClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Generic proxy: forwards any Odoo model/method call via XML-RPC.
 *
 * React calls:  POST /api/odoo/{model}/{method}
 * Body:         { "args": [...], "kwargs": {...} }
 *
 * No per-model wrappers needed — adding a new Odoo model requires zero Java changes.
 */
@RestController
@RequestMapping("/api/odoo")
@CrossOrigin(origins = "*")
public class OdooProxyController {

    private static final Logger log = LoggerFactory.getLogger(OdooProxyController.class);

    private final OdooClient odoo;

    public OdooProxyController(OdooClient odoo) {
        this.odoo = odoo;
    }

    @PostMapping("/{model}/{method}")
    public ResponseEntity<?> proxy(
            @PathVariable String model,
            @PathVariable String method,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        try {
            Object[] args = toObjectArray(body != null ? body.get("args") : null);
            @SuppressWarnings("unchecked")
            Map<String, Object> kwargs = body != null ? (Map<String, Object>) body.get("kwargs") : null;

            Object result = odoo.call(model, method, args, kwargs);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Odoo RPC error: {}/{} — {}", model, method, e.getMessage());
            return ResponseEntity.status(502).body(Map.of(
                    "error", "odoo_rpc_error",
                    "message", e.getMessage() != null ? e.getMessage() : "Unknown error",
                    "model", model,
                    "method", method
            ));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of(
                "odoo_connected", odoo.isConnected(),
                "odoo_uid", odoo.getUid()
        ));
    }

    private Object[] toObjectArray(Object raw) {
        if (raw == null) return new Object[]{};
        if (raw instanceof List<?> list) return list.toArray();
        if (raw instanceof Object[] arr) return arr;
        return new Object[]{raw};
    }
}
