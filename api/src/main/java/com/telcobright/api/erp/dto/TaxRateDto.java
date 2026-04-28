package com.telcobright.api.erp.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A temporal tax-rate entry. ERP-neutral: callers should not need to know
 * whether this was backed by Odoo, SAP, or anything else.
 *
 * Scope hierarchy: if productId is set it applies to a specific product,
 * else if categoryId is set it applies to a category, else it is global.
 * Most-specific match wins at invoice time.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaxRateDto(
        Long id,
        String taxType,        // "vat" | "ait" | "sd" | "other"
        BigDecimal rate,       // percent, e.g. 15.00
        boolean deduction,     // true = withholding-style (AIT)
        Long categoryId,
        String categoryName,
        Long productId,
        String productName,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        boolean active,
        String gazetteRef,
        String reason,
        String changedBy,
        String notes,
        Long underlyingTaxId,   // FK to the base tax engine entry, if any
        String underlyingTaxName,
        Integer documentCount,
        Instant createdAt
) {}
