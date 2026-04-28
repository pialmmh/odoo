package com.telcobright.api.erp;

import java.util.List;
import java.util.Map;

/**
 * Protocol-level ERP client abstraction. Domain services depend on this,
 * not on Odoo-specific classes. Alternate backends (SAP, Xero, …) slot in
 * by providing a different implementation.
 *
 * Method names mirror the CRUD + custom-method shape that every ERP we care
 * about exposes; concrete implementations translate them to whatever the
 * backend's transport is (XML-RPC, REST, SOAP, …).
 */
public interface ErpClient {

    List<Map<String, Object>> searchRead(
            String entity,
            List<Object> filter,
            List<String> fields,
            Integer limit,
            String order
    ) throws Exception;

    List<Map<String, Object>> read(
            String entity,
            List<Long> ids,
            List<String> fields
    ) throws Exception;

    Long create(String entity, Map<String, Object> values) throws Exception;

    void write(String entity, List<Long> ids, Map<String, Object> values) throws Exception;

    void unlink(String entity, List<Long> ids) throws Exception;

    Object callMethod(
            String entity,
            String method,
            List<Object> args,
            Map<String, Object> kwargs
    ) throws Exception;

    boolean isConnected();

    String providerName();
}
