package com.telcobright.api.controller;

import com.telcobright.api.erp.idempiere.IdempiereProductService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Experimental ERP product endpoints — read-only.
 * Backed by direct iDempiere Postgres access until the REST plugin is installed.
 *
 *   GET /api/erp/products
 *   GET /api/erp/products/{id}
 */
@RestController
@RequestMapping("/api/erp/products")
public class ErpProductController {

    private static final Logger log = LoggerFactory.getLogger(ErpProductController.class);

    private final IdempiereProductService svc;

    public ErpProductController(IdempiereProductService svc) {
        this.svc = svc;
    }

    /** Public smoke endpoint — proves the iDempiere read path without auth. */
    @GetMapping("/_smoke")
    public ResponseEntity<?> smoke() {
        try {
            var r = svc.list(null, 0, 3, "value", "asc");
            return ResponseEntity.ok(Map.of("ok", true, "total", r.total(), "sample", r.items()));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("ok", false, "message", e.getMessage()));
        }
    }

    /** Public smoke for detail — same auth-bypass as /_smoke. */
    @GetMapping("/_smoke/{id}")
    public ResponseEntity<?> smokeOne(@PathVariable long id) {
        try {
            Map<String, Object> p = svc.getById(id);
            if (p == null) return ResponseEntity.status(404).body(Map.of("ok", false, "id", id));
            return ResponseEntity.ok(p);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("ok", false, "message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String dir) {
        try {
            int safeSize = Math.min(Math.max(size, 1), 200);
            return ResponseEntity.ok(svc.list(search, page, safeSize, sort, dir));
        } catch (Exception e) {
            return error("list products", e);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable long id) {
        try {
            Map<String, Object> p = svc.getById(id);
            if (p == null) {
                return ResponseEntity.status(404).body(Map.of("error", "not_found", "id", id));
            }
            return ResponseEntity.ok(p);
        } catch (Exception e) {
            return error("get product " + id, e);
        }
    }

    private ResponseEntity<?> error(String op, Exception e) {
        log.error("erp/products: {} failed — {}", op, e.getMessage(), e);
        return ResponseEntity.status(502).body(Map.of(
                "error", "erp_error",
                "operation", op,
                "message", e.getMessage() != null ? e.getMessage() : "Unknown error"
        ));
    }
}
