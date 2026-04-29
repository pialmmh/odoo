package com.telcobright.api.erpv2.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;

/**
 * Vendor-neutral product. Read-only in slice 1; pricing fields are
 * intentionally null/zero until the pricing widening lands in slice 2.
 *
 * Field-set source: the resolved arch of `product.template`'s form view
 * (helper discovery at data/clone-discovery/product/), intersected with
 * what iDempiere's `MProduct` exposes. Variants, tags, the custom
 * Kill Bill notebook tab, and per-product tax m2m are deliberately
 * dropped — see ai-docs/erp-react-clone-design.md §8.5 for the
 * deferred / dropped tracker.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductDto(
        // ── Identity ────────────────────────────────────────────────
        Long id,
        String name,
        String value,           // "Internal Reference" in the UI
        String sku,
        String description,
        String upc,             // barcode

        // ── Type / flags ────────────────────────────────────────────
        String productType,        // raw code: I/S/R/E/O/A
        String productTypeLabel,   // user-facing: "Item", "Service", …
        Boolean isActive,
        Boolean isStocked,
        Boolean isSold,
        Boolean isPurchased,

        // ── Category / UoM / org ────────────────────────────────────
        Long categoryId,
        String categoryName,
        Long uomId,
        String uomName,
        Long orgId,
        String orgName,

        // ── Sales (Sales tab) ───────────────────────────────────────
        BigDecimal listPrice,        // slice 1: null — pricing in slice 2
        String salesDescription,
        Long taxCategoryId,
        String taxCategoryName,      // user-facing: "Tax Class"
        Long salesRepId,
        String salesRepName,

        // ── Purchase (Purchase tab) ─────────────────────────────────
        BigDecimal standardPrice,    // slice 1: null — pricing in slice 2
        String purchaseDescription,

        // ── Attributes & Variants (Slice 3 — read-only stub) ────────
        // Detail values + per-line combinations land in a future slice.
        Long attributeSetId,
        String attributeSetName
) {}

