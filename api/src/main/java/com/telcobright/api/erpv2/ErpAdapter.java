package com.telcobright.api.erpv2;

import com.telcobright.api.erpv2.dto.ProductDto;
import com.telcobright.api.erpv2.dto.ProductFilter;
import com.telcobright.api.erpv2.dto.ProductPage;

import java.util.Map;

/**
 * Vendor-neutral ERP read/write surface.
 *
 * One bean of this type is active at runtime, selected by the
 * `erp.backend` config property. Implementations live under sibling
 * packages (`idempiere`, `odoo`, `erpnext`) and are gated with
 * `@ConditionalOnProperty(name = "erp.backend", havingValue = "...")`.
 *
 * Methods speak domain terms — no `MProduct`, no `product.template`,
 * no `Item Master`. The adapter implementation is responsible for the
 * vendor-side translation.
 *
 * Slice 1 surfaced reads only. Slice 2a adds {@link #updateProduct} and
 * the per-user favourite endpoints. Pricing widening, m2o picker writes,
 * and tax-category save still live in subsequent slices —
 * see ai-docs/foss-buster/odoo/product/bff-plan.md.
 */
public interface ErpAdapter {

    /** A page of products matching the filter. */
    ProductPage listProducts(ProductFilter filter);

    /** A single product by id, or null if not found / not visible to caller. */
    ProductDto getProduct(long id);

    /**
     * Patch a product with the supplied field set. Only fields whose
     * mapping is `equivalent` per ai-docs/foss-buster/odoo/product/
     * DB-Mapping are accepted in slice 2a; any other key in {@code patch}
     * is ignored.
     *
     * @param id              product id (M_Product.M_Product_ID)
     * @param patch           field-name → new value (snake-or-camel
     *                        names matching ProductDto fields). Null
     *                        values are written as null.
     * @param ifMatchUpdatedMs concurrency token from the prior GET. May be
     *                        null to bypass the check (server-side
     *                        decides; current impl rejects null).
     * @return the updated product as the caller should now render it.
     * @throws ConcurrencyException if the server's Updated has advanced
     *                              past {@code ifMatchUpdatedMs}.
     */
    ProductDto updateProduct(long id, Map<String, Object> patch, Long ifMatchUpdatedMs);

    /** Thrown by {@link #updateProduct} when the if-match token is stale. */
    class ConcurrencyException extends RuntimeException {
        private final ProductDto current;
        public ConcurrencyException(ProductDto current, String message) {
            super(message);
            this.current = current;
        }
        public ProductDto current() { return current; }
    }

    /** Thrown by {@link #createProduct} when input is invalid. */
    class ValidationException extends RuntimeException {
        public ValidationException(String message) { super(message); }
    }

    /**
     * Create a new product. Required keys in {@code values}: {@code name},
     * {@code value}. Optional: anything else in the field whitelist
     * (sku, description, upc, isActive, isStocked, isSold, isPurchased,
     * productCategoryId, taxCategoryId, uomId, productTypeCode, orgId).
     */
    ProductDto createProduct(Map<String, Object> values);

    /**
     * Soft-delete by setting IsActive=N. Concurrency contract identical to
     * {@link #updateProduct}: pass the {@code updatedMs} token from the
     * prior GET.
     */
    ProductDto archiveProduct(long id, Long ifMatchUpdatedMs);

    // ─── Lookups for m2o pickers (slice 2b/2c) ─────────────────────────
    /** All product categories visible to the caller. */
    java.util.List<NamedRef> listCategories();
    /** All units of measure (UoM). */
    java.util.List<NamedRef> listUoms();
    /** All tax categories. */
    java.util.List<NamedRef> listTaxCategories();
    /** Product type selection options (vendor-neutral; iDempiere=I/S/R/E/O/A). */
    java.util.List<NamedRef> listProductTypes();

    /** Generic "{id, name}" pair used for picker options. */
    record NamedRef(Long id, String name) {}

    // ─── Pricing (slice 2b) ────────────────────────────────────────────
    /**
     * Read the active sales/standard price for a product on the tenant's
     * default sales pricelist. Returns nulls if no row exists yet.
     */
    PricePoint readPrice(long productId);

    /**
     * Upsert the active sales/standard price.
     */
    PricePoint writePrice(long productId, java.math.BigDecimal listPrice,
                          java.math.BigDecimal standardPrice);

    record PricePoint(java.math.BigDecimal listPrice, java.math.BigDecimal standardPrice,
                      Long priceListVersionId) {}
}
