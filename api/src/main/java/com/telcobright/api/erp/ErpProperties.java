package com.telcobright.api.erp;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Top-level ERP configuration. `erp.provider` selects which backend the
 * {@link ErpClient} bean resolves to. Provider-specific nested blocks
 * (odoo, sap, …) live under the same prefix.
 */
@Component
@ConfigurationProperties(prefix = "erp")
public class ErpProperties {

    private String provider = "odoo";

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
