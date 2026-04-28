package com.telcobright.api.erpv2;

import com.telcobright.api.erpv2.dto.ProductDto;
import com.telcobright.api.erpv2.dto.ProductFilter;
import com.telcobright.api.erpv2.dto.ProductPage;

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
 * Slice 1 surfaces only product reads. Save / create / delete and the
 * remaining domains (warehouses, BPartners, charges, inventory ops)
 * land in subsequent slices, see ai-docs/erp-react-clone-design.md §8.5.
 */
public interface ErpAdapter {

    /** A page of products matching the filter. */
    ProductPage listProducts(ProductFilter filter);

    /** A single product by id, or null if not found / not visible to caller. */
    ProductDto getProduct(long id);
}
