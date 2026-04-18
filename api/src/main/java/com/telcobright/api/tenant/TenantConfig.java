package com.telcobright.api.tenant;

import java.util.Map;

/**
 * Full resolved config for a single tenant/profile, loaded from
 * config/tenants/{slug}/{profile}/profile-{profile}.yml.
 */
public record TenantConfig(
    Tenant tenant,
    Branding branding,
    KillBill killbill,
    Catalog catalog,
    Map<String, Object> products
) {
    public record Tenant(String name, String slug, String profile, String environment) {}

    public record Branding(String displayName, String shortName, String theme) {}

    public record KillBill(String url, String apiKey, String apiSecret,
                           String username, String password) {}

    public record Catalog(String url, String db, Integer partnerId) {}
}
