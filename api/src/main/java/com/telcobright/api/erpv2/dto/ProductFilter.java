package com.telcobright.api.erpv2.dto;

/**
 * Search/pagination criteria for the product list. All fields optional;
 * the adapter applies sensible defaults (page=0, pageSize=50).
 *
 * Modern facets (multi-select category, sale_ok-only, etc.) come in
 * slice 4 — see ai-docs/erp-react-clone-design.md §8.5.
 */
public record ProductFilter(
        String q,
        Long categoryId,
        Integer page,
        Integer pageSize,
        String sortField,
        String sortDir
) {
    public int safePage()     { return page == null     ? 0  : Math.max(0, page); }
    public int safePageSize() { return pageSize == null ? 50 : Math.min(Math.max(pageSize, 1), 200); }
}
