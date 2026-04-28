package com.telcobright.api.erp.service;

import com.telcobright.api.erp.dto.BaseTaxDto;
import com.telcobright.api.erp.dto.TaxRateDto;
import com.telcobright.api.erp.dto.TaxRateUpsertRequest;

import java.util.List;

/**
 * Domain service for temporal tax rates. One implementation per ERP backend.
 */
public interface TaxRateService {

    List<TaxRateDto> list(int limit);

    TaxRateDto create(TaxRateUpsertRequest req);

    TaxRateDto update(long id, TaxRateUpsertRequest req);

    List<BaseTaxDto> listBaseTaxes();
}
