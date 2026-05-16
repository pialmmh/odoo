package com.telcobright.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "odoo")
public class OdooProperties {
    private String url = "http://127.0.0.1:7170";
    /** Default DB used when no tenant context is supplied (back-compat for non-tenant routes). */
    private String db = "platform_staging";
    /** Prefix applied to the tenant slug to derive a per-tenant DB name (only used in PER_DB mode). */
    private String dbPrefix = "odoo_";
    /**
     * Tenant resolution strategy:
     *   SINGLE — every tenant resolves to {@link #db}. Tenant separation lives at the app layer
     *            via Odoo's company_id (multi-company). This is the default for v19 because the
     *            v17→v19 in-place migration of per-tenant DBs is fragile (totp_last_counter
     *            schema drift, json-column issues). To restore the per-tenant-DB topology, flip
     *            this to PER_DB and use the SQL template at
     *            odoo-backend-19/db-templates/pristine-tenant-v19.sql to spawn fresh DBs.
     *   PER_DB — per-tenant DB; dbFor(slug) returns dbPrefix + slug. Each DB must already exist.
     */
    public enum TenantMode { SINGLE, PER_DB }
    private TenantMode tenantMode = TenantMode.SINGLE;
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
    public TenantMode getTenantMode() { return tenantMode; }
    public void setTenantMode(TenantMode tenantMode) { this.tenantMode = tenantMode; }
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

    /**
     * Resolve the Odoo DB name to use for the given tenant slug.
     *
     * In SINGLE mode (the default), every request — including tenant-scoped ones — lands on
     * {@link #db}. Tenant data isolation is the app's responsibility via Odoo's company_id.
     *
     * In PER_DB mode, the slug is suffixed onto {@link #dbPrefix}. Empty/null slugs always
     * fall back to {@link #db} regardless of mode.
     */
    public String dbFor(String tenantSlug) {
        if (tenantSlug == null || tenantSlug.isBlank()) return db;
        if (tenantMode == TenantMode.SINGLE) return db;
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
