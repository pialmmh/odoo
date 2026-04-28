package com.telcobright.api.erpv2.idempiere;

import com.telcobright.api.erpv2.dto.ProductDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Translates iDempiere-shaped maps (camelCase but iDempiere-flavoured —
 * `productCategoryId` / `productCategoryName`, etc.) into the canonical
 * vendor-neutral DTOs used by `/api/erp-v2/**`.
 *
 * Slice 1 covers read paths only. listPrice / standardPrice are
 * intentionally null — see ai-docs/erp-react-clone-design.md §8.5
 * deferred-work tracker (slice 2 — pricing widening).
 */
@Component
public class IdempiereDtoMapper {

    public ProductDto toProductDto(Map<String, Object> row) {
        if (row == null) return null;
        return new ProductDto(
                asLong(row.get("id"), row.get("mProductId")),
                asString(row.get("name")),
                asString(row.get("value")),
                asString(row.get("sku")),
                asString(row.get("description")),
                asString(row.get("upc")),

                asString(row.get("productTypeCode"), row.get("productType")),
                asString(row.get("productTypeLabel"), row.get("productType")),
                asBool(row.get("isActive")),
                asBool(row.get("isStocked")),
                asBool(row.get("isSold")),
                asBool(row.get("isPurchased")),

                asLong(row.get("productCategoryId"), row.get("mProductCategoryId")),
                asString(row.get("productCategoryName")),
                asLong(row.get("uomId"), row.get("cUomId")),
                asString(row.get("uomName")),
                asLong(row.get("orgId"), row.get("adOrgId")),
                asString(row.get("orgName")),

                // Sales — pricing deferred to slice 2
                /* listPrice */ null,
                asString(row.get("salesDescription"), row.get("salesnote")),
                asLong(row.get("taxCategoryId"), row.get("cTaxCategoryId")),
                asString(row.get("taxCategoryName")),
                asLong(row.get("salesRepId"), row.get("salesrepId")),
                asString(row.get("salesRepName")),

                // Purchase — pricing deferred to slice 2
                /* standardPrice */ null,
                asString(row.get("purchaseDescription"), row.get("purchasenote"))
        );
    }

    // ── helpers ─────────────────────────────────────────────────────

    private static String asString(Object... candidates) {
        for (Object c : candidates) {
            if (c == null) continue;
            String s = c.toString().trim();
            if (!s.isEmpty()) return s;
        }
        return null;
    }

    private static Long asLong(Object... candidates) {
        for (Object c : candidates) {
            if (c == null) continue;
            if (c instanceof Number n) return n.longValue();
            try { return Long.parseLong(c.toString().trim()); }
            catch (NumberFormatException ignore) { /* fall through */ }
        }
        return null;
    }

    private static Boolean asBool(Object v) {
        if (v == null) return null;
        if (v instanceof Boolean b) return b;
        if (v instanceof String s) return "Y".equalsIgnoreCase(s) || "true".equalsIgnoreCase(s);
        return null;
    }

    @SuppressWarnings("unused")
    private static BigDecimal asBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal b) return b;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try { return new BigDecimal(v.toString()); }
        catch (NumberFormatException ignore) { return null; }
    }
}
