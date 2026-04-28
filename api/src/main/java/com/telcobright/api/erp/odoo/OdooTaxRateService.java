package com.telcobright.api.erp.odoo;

import com.telcobright.api.erp.ErpClient;
import com.telcobright.api.erp.dto.BaseTaxDto;
import com.telcobright.api.erp.dto.TaxRateDto;
import com.telcobright.api.erp.dto.TaxRateUpsertRequest;
import com.telcobright.api.erp.service.TaxRateService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Odoo-backed {@link TaxRateService}. Maps between the ERP-neutral DTOs and
 * the Odoo models product.tax.rate and account.tax. The rest of the
 * application must not see these model names.
 */
@Service
@ConditionalOnProperty(prefix = "erp", name = "provider", havingValue = "odoo", matchIfMissing = true)
public class OdooTaxRateService implements TaxRateService {

    private static final String ENT_TAX_RATE = "product.tax.rate";
    private static final String ENT_BASE_TAX = "account.tax";

    private static final List<String> TAX_RATE_FIELDS = List.of(
            "id", "tax_type", "rate", "is_deduction",
            "categ_id", "product_tmpl_id",
            "effective_date", "end_date", "is_active",
            "gazette_ref", "reason", "changed_by", "notes",
            "odoo_tax_id", "document_count", "create_date"
    );

    private static final List<String> BASE_TAX_FIELDS = List.of(
            "id", "name", "amount", "amount_type", "description"
    );

    private final ErpClient erp;

    public OdooTaxRateService(ErpClient erp) {
        this.erp = erp;
    }

    @Override
    public List<TaxRateDto> list(int limit) {
        try {
            List<Map<String, Object>> rows = erp.searchRead(
                    ENT_TAX_RATE,
                    Collections.emptyList(),
                    TAX_RATE_FIELDS,
                    limit,
                    "effective_date desc, id desc"
            );
            List<TaxRateDto> out = new ArrayList<>(rows.size());
            for (Map<String, Object> row : rows) out.add(toDto(row));
            return out;
        } catch (Exception e) {
            throw new RuntimeException("Failed to list tax rates: " + e.getMessage(), e);
        }
    }

    @Override
    public TaxRateDto create(TaxRateUpsertRequest req) {
        try {
            Long id = erp.create(ENT_TAX_RATE, toErpValues(req));
            return readOne(id);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create tax rate: " + e.getMessage(), e);
        }
    }

    @Override
    public TaxRateDto update(long id, TaxRateUpsertRequest req) {
        try {
            erp.write(ENT_TAX_RATE, List.of(id), toErpValues(req));
            return readOne(id);
        } catch (Exception e) {
            throw new RuntimeException("Failed to update tax rate " + id + ": " + e.getMessage(), e);
        }
    }

    @Override
    public List<BaseTaxDto> listBaseTaxes() {
        try {
            List<Object> filter = List.of(List.of("type_tax_use", "=", "sale"));
            List<Map<String, Object>> rows = erp.searchRead(
                    ENT_BASE_TAX, filter, BASE_TAX_FIELDS, null, null
            );
            List<BaseTaxDto> out = new ArrayList<>(rows.size());
            for (Map<String, Object> r : rows) {
                out.add(new BaseTaxDto(
                        asLong(r.get("id")),
                        asString(r.get("name")),
                        asBigDecimal(r.get("amount")),
                        asString(r.get("amount_type")),
                        asString(r.get("description"))
                ));
            }
            return out;
        } catch (Exception e) {
            throw new RuntimeException("Failed to list base taxes: " + e.getMessage(), e);
        }
    }

    // ─── Mapping helpers ───

    private TaxRateDto readOne(long id) throws Exception {
        List<Map<String, Object>> rows = erp.read(ENT_TAX_RATE, List.of(id), TAX_RATE_FIELDS);
        if (rows.isEmpty()) throw new RuntimeException("Tax rate " + id + " not found after write");
        return toDto(rows.get(0));
    }

    private static TaxRateDto toDto(Map<String, Object> r) {
        Long catId = many2oneId(r.get("categ_id"));
        String catName = many2oneName(r.get("categ_id"));
        Long prodId = many2oneId(r.get("product_tmpl_id"));
        String prodName = many2oneName(r.get("product_tmpl_id"));
        Long baseTaxId = many2oneId(r.get("odoo_tax_id"));
        String baseTaxName = many2oneName(r.get("odoo_tax_id"));

        return new TaxRateDto(
                asLong(r.get("id")),
                asString(r.get("tax_type")),
                asBigDecimal(r.get("rate")),
                asBool(r.get("is_deduction")),
                catId, catName,
                prodId, prodName,
                asDate(r.get("effective_date")),
                asDate(r.get("end_date")),
                asBool(r.get("is_active")),
                asString(r.get("gazette_ref")),
                asString(r.get("reason")),
                asString(r.get("changed_by")),
                asString(r.get("notes")),
                baseTaxId, baseTaxName,
                asInt(r.get("document_count")),
                asInstant(r.get("create_date"))
        );
    }

    private static Map<String, Object> toErpValues(TaxRateUpsertRequest req) {
        Map<String, Object> v = new LinkedHashMap<>();
        if (req.taxType() != null) v.put("tax_type", req.taxType());
        if (req.rate() != null) v.put("rate", req.rate());
        if (req.deduction() != null) v.put("is_deduction", req.deduction());
        v.put("categ_id", req.categoryId() != null ? req.categoryId() : false);
        v.put("product_tmpl_id", req.productId() != null ? req.productId() : false);
        if (req.effectiveFrom() != null) v.put("effective_date", req.effectiveFrom().toString());
        v.put("end_date", req.effectiveTo() != null ? req.effectiveTo().toString() : false);
        if (req.gazetteRef() != null) v.put("gazette_ref", req.gazetteRef());
        if (req.reason() != null) v.put("reason", req.reason());
        if (req.notes() != null) v.put("notes", req.notes());
        v.put("odoo_tax_id", req.underlyingTaxId() != null ? req.underlyingTaxId() : false);
        return v;
    }

    // ─── Odoo value coercion ───
    // Many Odoo fields come back as `false` when unset. Many2one fields come
    // back as [id, display_name]. Dates come back as "YYYY-MM-DD" strings.

    private static Long many2oneId(Object v) {
        if (v instanceof List<?> list && !list.isEmpty()) return asLong(list.get(0));
        if (v instanceof Object[] arr && arr.length > 0) return asLong(arr[0]);
        return null;
    }

    private static String many2oneName(Object v) {
        if (v instanceof List<?> list && list.size() >= 2) return asString(list.get(1));
        if (v instanceof Object[] arr && arr.length >= 2) return asString(arr[1]);
        return null;
    }

    private static Long asLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        if (v instanceof Boolean) return null;
        if (v instanceof String s && !s.isBlank()) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private static Integer asInt(Object v) {
        Long l = asLong(v);
        return l == null ? null : l.intValue();
    }

    private static String asString(Object v) {
        if (v == null) return null;
        if (v instanceof Boolean b) return b ? null : null;
        return v.toString();
    }

    private static boolean asBool(Object v) {
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.intValue() != 0;
        return false;
    }

    private static BigDecimal asBigDecimal(Object v) {
        if (v == null || v instanceof Boolean) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        if (v instanceof String s && !s.isBlank()) {
            try { return new BigDecimal(s); } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private static LocalDate asDate(Object v) {
        if (v == null || v instanceof Boolean) return null;
        String s = v.toString();
        if (s.isBlank()) return null;
        try { return LocalDate.parse(s); } catch (Exception ignored) { return null; }
    }

    private static final DateTimeFormatter ODOO_DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static Instant asInstant(Object v) {
        if (v == null || v instanceof Boolean) return null;
        String s = v.toString();
        if (s.isBlank()) return null;
        try {
            return ODOO_DT.parse(s, java.time.LocalDateTime::from).toInstant(ZoneOffset.UTC);
        } catch (Exception ignored) {
            try { return Instant.parse(s); } catch (Exception ignored2) { return null; }
        }
    }
}
