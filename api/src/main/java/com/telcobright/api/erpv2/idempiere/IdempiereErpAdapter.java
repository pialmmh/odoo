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

    @Override
    public ProductDto updateProduct(long id, Map<String, Object> patch, Long ifMatchUpdatedMs) {
        try {
            products.update(id, patch, ifMatchUpdatedMs);
        } catch (IdempiereProductService.StaleTokenException stale) {
            ProductDto current = mapper.toProductDto(products.getById(id));
            throw new ConcurrencyException(current, stale.getMessage());
        }
        Map<String, Object> row = products.getById(id);
        return mapper.toProductDto(row);
    }

    @Override
    public ProductDto createProduct(Map<String, Object> values) {
        try {
            long id = products.create(values);
            return mapper.toProductDto(products.getById(id));
        } catch (IdempiereProductService.ValidationException ve) {
            throw new ValidationException(ve.getMessage());
        }
    }

    @Override
    public ProductDto archiveProduct(long id, Long ifMatchUpdatedMs) {
        try {
            products.archive(id, ifMatchUpdatedMs);
        } catch (IdempiereProductService.StaleTokenException stale) {
            ProductDto current = mapper.toProductDto(products.getById(id));
            throw new ConcurrencyException(current, stale.getMessage());
        }
        return mapper.toProductDto(products.getById(id));
    }

    @Override public java.util.List<NamedRef> listCategories()    { return products.listLookup("M_Product_Category"); }
    @Override public java.util.List<NamedRef> listUoms()          { return products.listLookup("C_UOM"); }
    @Override public java.util.List<NamedRef> listTaxCategories() { return products.listLookup("C_TaxCategory"); }
    @Override public java.util.List<NamedRef> listProductTypes()  { return products.listProductTypes(); }

    @Override
    public PricePoint readPrice(long productId) {
        var p = products.readPrice(productId);
        return p == null ? null : new PricePoint(p.listPrice(), p.standardPrice(), p.priceListVersionId());
    }

    @Override
    public PricePoint writePrice(long productId, java.math.BigDecimal listPrice, java.math.BigDecimal standardPrice) {
        var p = products.writePrice(productId, listPrice, standardPrice);
        return new PricePoint(p.listPrice(), p.standardPrice(), p.priceListVersionId());
    }
}
