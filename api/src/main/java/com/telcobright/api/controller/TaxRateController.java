package com.telcobright.api.controller;

import com.telcobright.api.erp.dto.BaseTaxDto;
import com.telcobright.api.erp.dto.TaxRateDto;
import com.telcobright.api.erp.dto.TaxRateUpsertRequest;
import com.telcobright.api.erp.service.TaxRateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * ERP-neutral tax rate endpoints. The UI talks only to this controller;
 * which ERP is wired in underneath is invisible.
 */
@RestController
@RequestMapping("/api/catalog/tax-rates")
public class TaxRateController {

    private static final Logger log = LoggerFactory.getLogger(TaxRateController.class);

    private final TaxRateService service;

    public TaxRateController(TaxRateService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "200") int limit) {
        try {
            List<TaxRateDto> rates = service.list(limit);
            return ResponseEntity.ok(rates);
        } catch (Exception e) {
            return error("list tax rates", e);
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody TaxRateUpsertRequest req) {
        try {
            return ResponseEntity.ok(service.create(req));
        } catch (Exception e) {
            return error("create tax rate", e);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody TaxRateUpsertRequest req) {
        try {
            return ResponseEntity.ok(service.update(id, req));
        } catch (Exception e) {
            return error("update tax rate " + id, e);
        }
    }

    @GetMapping("/base-taxes")
    public ResponseEntity<?> baseTaxes() {
        try {
            List<BaseTaxDto> taxes = service.listBaseTaxes();
            return ResponseEntity.ok(taxes);
        } catch (Exception e) {
            return error("list base taxes", e);
        }
    }

    private ResponseEntity<?> error(String op, Exception e) {
        log.error("tax-rates: {} failed — {}", op, e.getMessage(), e);
        return ResponseEntity.status(502).body(Map.of(
                "error", "erp_error",
                "operation", op,
                "message", e.getMessage() != null ? e.getMessage() : "Unknown error"
        ));
    }
}
