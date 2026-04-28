/**
 * Odoo-specific ERP adapter implementations.
 *
 * Contains the concrete {@link com.telcobright.api.erp.ErpClient} for Odoo
 * plus every domain service implementation
 * (e.g. {@link com.telcobright.api.erp.service.TaxRateService}) that maps
 * ERP-neutral DTOs to Odoo models and back.
 *
 * Activated when {@code erp.provider=odoo} (currently the default).
 */
package com.telcobright.api.erp.odoo;
