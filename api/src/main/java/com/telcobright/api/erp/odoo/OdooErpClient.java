package com.telcobright.api.erp.odoo;

import com.telcobright.api.erp.ErpClient;
import com.telcobright.api.odoo.OdooClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Odoo implementation of {@link ErpClient}. Wraps the XML-RPC
 * {@link OdooClient} and translates the generic CRUD vocabulary into
 * Odoo's execute_kw model/method semantics.
 *
 * "entity" maps to Odoo model name (e.g. "product.tax.rate").
 */
@Component
@ConditionalOnProperty(prefix = "erp", name = "provider", havingValue = "odoo", matchIfMissing = true)
public class OdooErpClient implements ErpClient {

    private final OdooClient odoo;

    public OdooErpClient(OdooClient odoo) {
        this.odoo = odoo;
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> searchRead(
            String entity, List<Object> filter, List<String> fields,
            Integer limit, String order
    ) throws Exception {
        Object[] args = new Object[]{ filter != null ? filter : Collections.emptyList() };
        Map<String, Object> kwargs = new HashMap<>();
        if (fields != null && !fields.isEmpty()) kwargs.put("fields", fields);
        if (limit != null) kwargs.put("limit", limit);
        if (order != null && !order.isBlank()) kwargs.put("order", order);

        Object result = odoo.call(entity, "search_read", args, kwargs);
        return coerceList(result);
    }

    @Override
    public List<Map<String, Object>> read(String entity, List<Long> ids, List<String> fields) throws Exception {
        Object[] args = new Object[]{ ids };
        Map<String, Object> kwargs = new HashMap<>();
        if (fields != null && !fields.isEmpty()) kwargs.put("fields", fields);
        Object result = odoo.call(entity, "read", args, kwargs);
        return coerceList(result);
    }

    @Override
    public Long create(String entity, Map<String, Object> values) throws Exception {
        Object result = odoo.call(entity, "create", new Object[]{ values });
        return toLong(result);
    }

    @Override
    public void write(String entity, List<Long> ids, Map<String, Object> values) throws Exception {
        odoo.call(entity, "write", new Object[]{ ids, values });
    }

    @Override
    public void unlink(String entity, List<Long> ids) throws Exception {
        odoo.call(entity, "unlink", new Object[]{ ids });
    }

    @Override
    public Object callMethod(String entity, String method, List<Object> args, Map<String, Object> kwargs) throws Exception {
        Object[] a = args != null ? args.toArray() : new Object[]{};
        return odoo.call(entity, method, a, kwargs);
    }

    @Override
    public boolean isConnected() {
        return odoo.isConnected();
    }

    @Override
    public String providerName() {
        return "odoo";
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> coerceList(Object result) {
        if (result == null) return Collections.emptyList();
        if (result instanceof Object[] arr) {
            List<Map<String, Object>> out = new ArrayList<>(arr.length);
            for (Object row : arr) {
                if (row instanceof Map<?, ?> m) out.add((Map<String, Object>) m);
            }
            return out;
        }
        if (result instanceof List<?> list) {
            List<Map<String, Object>> out = new ArrayList<>(list.size());
            for (Object row : list) {
                if (row instanceof Map<?, ?> m) out.add((Map<String, Object>) m);
            }
            return out;
        }
        return Collections.emptyList();
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        if (o instanceof Boolean b) return b ? 1L : null;
        throw new IllegalStateException("Unexpected id type from Odoo: " + o.getClass());
    }
}
