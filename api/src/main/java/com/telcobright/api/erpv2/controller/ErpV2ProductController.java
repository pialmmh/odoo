package com.telcobright.api.erpv2.controller;

import com.telcobright.api.erpv2.ErpAdapter;
import com.telcobright.api.erpv2.dto.ProductDto;
import com.telcobright.api.erpv2.dto.ProductFilter;
import com.telcobright.api.erpv2.dto.ProductPage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Vendor-neutral product endpoints. Thin — all real work is in the
 * {@link ErpAdapter} bean wired by {@code erp.backend} config.
 *
 *   GET /api/erp-v2/products            (list, paged, optional q + sort)
 *   GET /api/erp-v2/products/{id}       (one product)
 *
 * Slice 1 is read-only. Save / create land in slice 2 — see
 * ai-docs/erp-react-clone-design.md §8.5 deferred-work tracker.
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

    private ResponseEntity<?> error(String op, Exception e) {
        log.error("erp-v2/products: {} failed — {}", op, e.getMessage(), e);
        return ResponseEntity.status(502).body(Map.of(
                "error", "erp_error",
                "operation", op,
                "message", e.getMessage() != null ? e.getMessage() : "Unknown error"));
    }
}
