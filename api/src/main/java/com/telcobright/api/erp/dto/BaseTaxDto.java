package com.telcobright.api.erp.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;

/**
 * A tax defined in the underlying accounting engine's own tax table.
 * Used as a lookup/reference when authoring a {@link TaxRateDto} so the
 * temporal rate can hang off a known base tax.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BaseTaxDto(
        Long id,
        String name,
        BigDecimal amount,
        String amountType,   // "percent" | "fixed" | …
        String description
) {}
