package com.telcobright.api.erpv2.idempiere;

import com.telcobright.api.erp.idempiere.IdempiereProductService;
import com.telcobright.api.erpv2.ErpAdapter;
import com.telcobright.api.erpv2.dto.ProductDto;
import com.telcobright.api.erpv2.dto.ProductFilter;
import com.telcobright.api.erpv2.dto.ProductPage;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * iDempiere implementation of the ERP adapter. Active when
 * `erp.backend = idempiere` in application.yml (default).
 *
 * Slice 1 reuses the legacy {@link IdempiereProductService} which
 * predates this work. That service is direct JDBC and violates the
 * project rule against raw SQL against iDempiere. Replacing it with
 * proper BFF endpoints (`/product/list`, `/product/{id}` inside
 * `erp-api/ApiServlet.java`, using `MProduct` + `Query`) is tracked as
 * deferred work in ai-docs/erp-react-clone-design.md §8.5 (slice 2 —
 * Pricing + BFF migration).
 */
@Component
@ConditionalOnProperty(name = "erp.backend", havingValue = "idempiere", matchIfMissing = true)
public class IdempiereErpAdapter implements ErpAdapter {

    private final IdempiereProductService products;
    private final IdempiereDtoMapper mapper;

    public IdempiereErpAdapter(IdempiereProductService products, IdempiereDtoMapper mapper) {
        this.products = products;
        this.mapper = mapper;
    }

    @Override
    public ProductPage listProducts(ProductFilter filter) {
        ProductFilter f = filter == null
                ? new ProductFilter(null, null, null, null, null, null)
                : filter;
        IdempiereProductService.ListResult r = products.list(
                f.q(),
                f.safePage(),
                f.safePageSize(),
                f.sortField(),
                f.sortDir());

        List<ProductDto> dtos = new ArrayList<>(r.items().size());
        for (Map<String, Object> row : r.items()) {
            dtos.add(mapper.toProductDto(row));
        }
        return new ProductPage(dtos, r.total(), r.page(), r.size());
    }

    @Override
    public ProductDto getProduct(long id) {
        Map<String, Object> row = products.getById(id);
        return mapper.toProductDto(row);
    }
}
