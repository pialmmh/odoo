package com.telcobright.api.erpv2.dto;

import java.util.List;

/** A page of products returned by the adapter. */
public record ProductPage(
        List<ProductDto> items,
        long total,
        int page,
        int pageSize
) {}
