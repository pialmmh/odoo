package com.telcobright.api.erp.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Write payload for tax rates. Any nullable reference field left null means
 * "not scoped at this level" — e.g. productId null + categoryId set → applies
 * to the whole category.
 */
public record TaxRateUpsertRequest(
        String taxType,
        BigDecimal rate,
        Boolean deduction,
        Long categoryId,
        Long productId,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String gazetteRef,
        String reason,
        String notes,
        Long underlyingTaxId
) {}
