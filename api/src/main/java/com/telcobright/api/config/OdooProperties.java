package com.telcobright.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "odoo")
public class OdooProperties {
    private String url = "http://127.0.0.1:7169";
    /** Default DB used when no tenant context is supplied (back-compat for non-tenant routes). */
    private String db = "odoo_billing";
    /** Prefix applied to the tenant slug to derive a per-tenant DB name. */
    private String dbPrefix = "odoo_";
    /** When true, accept tenant DB names that don't yet exist by failing through (controller maps to 502). */
    private boolean strictTenant = false;
    private String username = "admin";
    private String password = "admin";

    /**
     * Models matching any of these prefixes are platform-wide (live only in
     * the default DB) and bypass tenant routing. Match is dot-prefix:
     * "rbac." matches "rbac.role", "rbac.permission", etc.
     *
     * Defaults cover the existing platform-only addons:
     *   rbac_management, platform_config, infra_management, artifact_management,
     *   kb_integration, document store.
     */
    private java.util.List<String> platformModelPrefixes = new java.util.ArrayList<>(java.util.List.of(
            "rbac.",
            "platform.",
            "infra.",
            "artifact.",
            "kb.",
            "doc.",
            "product.tax.rate",
            "product.rate.history"
    ));

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getDb() { return db; }
    public void setDb(String db) { this.db = db; }
    public String getDbPrefix() { return dbPrefix; }
    public void setDbPrefix(String dbPrefix) { this.dbPrefix = dbPrefix; }
    public boolean isStrictTenant() { return strictTenant; }
    public void setStrictTenant(boolean strictTenant) { this.strictTenant = strictTenant; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public java.util.List<String> getPlatformModelPrefixes() { return platformModelPrefixes; }
    public void setPlatformModelPrefixes(java.util.List<String> platformModelPrefixes) {
        this.platformModelPrefixes = platformModelPrefixes;
    }

    public String dbFor(String tenantSlug) {
        if (tenantSlug == null || tenantSlug.isBlank()) return db;
        return dbPrefix + tenantSlug;
    }

    /** True when the model lives in the default DB regardless of incoming tenant header. */
    public boolean isPlatformModel(String model) {
        if (model == null) return false;
        for (String pref : platformModelPrefixes) {
            if (model.equals(pref) || model.startsWith(pref)) return true;
        }
        return false;
    }
}
