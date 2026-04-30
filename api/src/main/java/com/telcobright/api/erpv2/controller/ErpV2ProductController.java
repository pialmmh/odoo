package com.telcobright.api.erpv2.controller;

import com.telcobright.api.erpv2.ErpAdapter;
import com.telcobright.api.erpv2.dto.ProductDto;
import com.telcobright.api.erpv2.dto.ProductFilter;
import com.telcobright.api.erpv2.dto.ProductPage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Vendor-neutral product endpoints. Thin — all real work is in the
 * {@link ErpAdapter} bean wired by {@code erp.backend} config.
 *
 *   GET   /api/erp-v2/products            (list, paged, optional q + sort)
 *   GET   /api/erp-v2/products/{id}       (one product)
 *   PATCH /api/erp-v2/products/{id}       (slice 2a — equivalent fields only)
 */
@RestController
@RequestMapping("/api/erp-v2/products")
public class ErpV2ProductController {

    private static final Logger log = LoggerFactory.getLogger(ErpV2ProductController.class);

    private final ErpAdapter adapter;

    public ErpV2ProductController(ErpAdapter adapter) {
        this.adapter = adapter;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String sortField,
            @RequestParam(required = false) String sortDir) {
        try {
            ProductPage out = adapter.listProducts(
                    new ProductFilter(q, categoryId, page, pageSize, sortField, sortDir));
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            return error("list products", e);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable long id) {
        try {
            ProductDto p = adapter.getProduct(id);
            if (p == null) {
                return ResponseEntity.status(404).body(Map.of("error", "not_found", "id", id));
            }
            return ResponseEntity.ok(p);
        } catch (Exception e) {
            return error("get product " + id, e);
        }
    }

    /**
     * Partial update — slice 2a.
     *
     * Body shape:
     * <pre>
     * {
     *   "patch":  { "name": "...", "value": "...", "isActive": true, ... },
     *   "updatedMs": 1735000000000
     * }
     * </pre>
     *
     * Returns 200 with the fresh ProductDto on success, 409 with the
     * server's current ProductDto on stale-token, 400 if the body is
     * malformed, 502 on upstream errors.
     */
    @PatchMapping("/{id}")
    public ResponseEntity<?> patch(@PathVariable long id, @RequestBody Map<String, Object> body) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing_body"));
        }
        Object patchObj = body.get("patch");
        if (!(patchObj instanceof Map<?, ?> patchRaw)) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing_patch_object"));
        }
        Map<String, Object> patch = new HashMap<>();
        for (var e : patchRaw.entrySet()) {
            if (e.getKey() instanceof String k) patch.put(k, e.getValue());
        }
        Long ifMatch = null;
        Object tok = body.get("updatedMs");
        if (tok instanceof Number n) ifMatch = n.longValue();
        else if (tok instanceof String s) {
            try { ifMatch = Long.parseLong(s); } catch (NumberFormatException ignore) { /* leave null */ }
        }

        try {
            ProductDto out = adapter.updateProduct(id, patch, ifMatch);
            return ResponseEntity.ok(out);
        } catch (ErpAdapter.ConcurrencyException stale) {
            return ResponseEntity.status(409).body(Map.of(
                    "error",   "stale_token",
                    "message", stale.getMessage(),
                    "current", stale.current()));
        } catch (Exception e) {
            return error("patch product " + id, e);
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        if (body == null) return ResponseEntity.badRequest().body(Map.of("error", "missing_body"));
        try {
            ProductDto created = adapter.createProduct(body);
            return ResponseEntity.status(201).body(created);
        } catch (ErpAdapter.ValidationException ve) {
            return ResponseEntity.status(400).body(Map.of("error", "validation", "message", ve.getMessage()));
        } catch (Exception e) {
            return error("create product", e);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> archive(@PathVariable long id, @RequestParam(required = false) Long updatedMs) {
        try {
            ProductDto archived = adapter.archiveProduct(id, updatedMs);
            return ResponseEntity.ok(archived);
        } catch (ErpAdapter.ConcurrencyException stale) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "stale_token", "message", stale.getMessage(), "current", stale.current()));
        } catch (Exception e) {
            return error("archive product " + id, e);
        }
    }

    // ─── Lookups for m2o pickers ──────────────────────────────────────
    @GetMapping("/lookups/categories")
    public ResponseEntity<?> categories() {
        try { return ResponseEntity.ok(adapter.listCategories()); }
        catch (Exception e) { return error("list categories", e); }
    }
    @GetMapping("/lookups/uoms")
    public ResponseEntity<?> uoms() {
        try { return ResponseEntity.ok(adapter.listUoms()); }
        catch (Exception e) { return error("list uoms", e); }
    }
    @GetMapping("/lookups/tax-categories")
    public ResponseEntity<?> taxCategories() {
        try { return ResponseEntity.ok(adapter.listTaxCategories()); }
        catch (Exception e) { return error("list tax categories", e); }
    }
    @GetMapping("/lookups/product-types")
    public ResponseEntity<?> productTypes() {
        try { return ResponseEntity.ok(adapter.listProductTypes()); }
        catch (Exception e) { return error("list product types", e); }
    }

    // ─── Pricing (slice 2b) ───────────────────────────────────────────
    @GetMapping("/{id}/price")
    public ResponseEntity<?> readPrice(@PathVariable long id) {
        try { return ResponseEntity.ok(adapter.readPrice(id)); }
        catch (Exception e) { return error("read price " + id, e); }
    }

    @PutMapping("/{id}/price")
    public ResponseEntity<?> writePrice(@PathVariable long id, @RequestBody Map<String, Object> body) {
        if (body == null) return ResponseEntity.badRequest().body(Map.of("error", "missing_body"));
        BigDecimal listPrice     = asBig(body.get("listPrice"));
        BigDecimal standardPrice = asBig(body.get("standardPrice"));
        try { return ResponseEntity.ok(adapter.writePrice(id, listPrice, standardPrice)); }
        catch (Exception e) { return error("write price " + id, e); }
    }

    private BigDecimal asBig(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        try { return new BigDecimal(v.toString()); } catch (Exception ignore) { return null; }
    }

    private ResponseEntity<?> error(String op, Exception e) {
        log.error("erp-v2/products: {} failed — {}", op, e.getMessage(), e);
        return ResponseEntity.status(502).body(Map.of(
                "error", "erp_error",
                "operation", op,
                "message", e.getMessage() != null ? e.getMessage() : "Unknown error"));
    }
}
