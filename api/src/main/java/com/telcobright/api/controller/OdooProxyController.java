package com.telcobright.api.controller;

import com.telcobright.api.config.OdooProperties;
import com.telcobright.api.odoo.OdooClient;
import com.telcobright.api.tenant.TenantResolver;
import com.telcobright.api.tenant.TenantResolver.TenantAccessDeniedException;
import jakarta.servlet.http.HttpServletRequest;
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
 * Header:       X-Tenant-Slug: <tenant>   (optional; routes to tenant DB)
 *
 * No per-model wrappers needed — adding a new Odoo model requires zero Java changes.
 */
@RestController
@RequestMapping("/api/odoo")
@CrossOrigin(origins = "*")
public class OdooProxyController {

    private static final Logger log = LoggerFactory.getLogger(OdooProxyController.class);

    private final OdooClient odoo;
    private final OdooProperties props;
    private final TenantResolver tenants;

    public OdooProxyController(OdooClient odoo, OdooProperties props, TenantResolver tenants) {
        this.odoo = odoo;
        this.props = props;
        this.tenants = tenants;
    }

    @PostMapping("/{model}/{method}")
    public ResponseEntity<?> proxy(
            @PathVariable String model,
            @PathVariable String method,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest req
    ) {
        String db;
        // Platform-wide models (rbac.*, platform.*, infra.*, artifact.*, kb.*, ...)
        // live only in the default DB. The tenant header is ignored for these
        // so /btcl/... pages can still load RBAC config, tenant registry, etc.
        if (props.isPlatformModel(model)) {
            db = props.getDb();
        } else {
            try {
                db = tenants.resolveDb(req);
            } catch (TenantAccessDeniedException e) {
                return ResponseEntity.status(403).body(Map.of("error", "tenant_forbidden", "message", e.getMessage()));
            }
        }

        try {
            Object[] args = toObjectArray(body != null ? body.get("args") : null);
            @SuppressWarnings("unchecked")
            Map<String, Object> kwargs = body != null ? (Map<String, Object>) body.get("kwargs") : null;

            Object result = odoo.call(db, model, method, args, kwargs);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Odoo RPC error: db={} {}/{} — {}", db, model, method, e.getMessage());
            return ResponseEntity.status(502).body(Map.of(
                    "error", "odoo_rpc_error",
                    "message", e.getMessage() != null ? e.getMessage() : "Unknown error",
                    "db", db,
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
