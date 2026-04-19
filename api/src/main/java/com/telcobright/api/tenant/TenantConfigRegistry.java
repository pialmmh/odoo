package com.telcobright.api.tenant;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Loads config/tenants/{slug}/{profile}/profile-{profile}.yml for every
 * enabled tenant listed under orchestrix.tenants in application.yml.
 *
 * Exposes a slug → TenantConfig map for the rest of the app (KB client,
 * catalog client, REST endpoints) to consume.
 */
@Component
public class TenantConfigRegistry {

    private static final Logger log = LoggerFactory.getLogger(TenantConfigRegistry.class);

    private final TenantsBootstrap bootstrap;
    private final Environment env;
    private final Map<String, TenantConfig> byslug = new LinkedHashMap<>();

    public TenantConfigRegistry(TenantsBootstrap bootstrap, Environment env) {
        this.bootstrap = bootstrap;
        this.env = env;
    }

    @PostConstruct
    void load() {
        String operator = bootstrap.getOperator();
        if (operator == null || operator.isBlank()) {
            throw new IllegalStateException("orchestrix.operator must be set in application.yml");
        }
        for (TenantsBootstrap.Entry e : bootstrap.getTenants()) {
            if (!e.isEnabled()) {
                log.info("Tenant '{}' disabled — skipping", e.getName());
                continue;
            }
            String path = "config/operators/" + operator
                        + "/tenants/" + e.getName() + "/" + e.getProfile()
                        + "/profile-" + e.getProfile() + ".yml";
            try (InputStream in = new ClassPathResource(path).getInputStream()) {
                Map<String, Object> raw = new Yaml().load(in);
                TenantConfig cfg = parse(raw);
                byslug.put(cfg.tenant().slug(), cfg);
                log.info("Loaded tenant '{}' profile '{}' from {}",
                    cfg.tenant().slug(), cfg.tenant().profile(), path);
            } catch (Exception ex) {
                log.error("Failed to load tenant config at {}: {}", path, ex.getMessage(), ex);
                throw new IllegalStateException("Cannot start: tenant config missing for "
                    + e.getName() + ":" + e.getProfile(), ex);
            }
        }
        log.info("TenantConfigRegistry initialised with {} tenant(s): {}",
            byslug.size(), byslug.keySet());
    }

    public TenantConfig get(String slug) { return byslug.get(slug); }

    public Map<String, TenantConfig> all() { return Collections.unmodifiableMap(byslug); }

    public boolean isEnabled(String slug) { return slug != null && byslug.containsKey(slug); }

    // ── parsing ──────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private TenantConfig parse(Map<String, Object> root) {
        Map<String, Object> tenant   = asMap(root.get("tenant"));
        Map<String, Object> branding = asMap(root.get("branding"));
        Map<String, Object> kb       = asMap(root.get("killbill"));
        Map<String, Object> cat      = asMap(root.get("catalog"));
        Map<String, Object> products = asMap(root.get("products"));

        return new TenantConfig(
            new TenantConfig.Tenant(
                str(tenant, "name"),
                str(tenant, "slug"),
                str(tenant, "profile"),
                str(tenant, "environment")
            ),
            new TenantConfig.Branding(
                str(branding, "display-name"),
                str(branding, "short-name"),
                str(branding, "theme")
            ),
            new TenantConfig.KillBill(
                resolve(str(kb, "url")),
                resolve(str(kb, "api-key")),
                resolve(str(kb, "api-secret")),
                resolve(str(kb, "username")),
                resolve(str(kb, "password"))
            ),
            new TenantConfig.Catalog(
                resolve(str(cat, "url")),
                resolve(str(cat, "db")),
                intOr(cat, "partner-id", null)
            ),
            products == null ? Map.of() : Map.copyOf(products)
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object o) {
        return (o instanceof Map) ? (Map<String, Object>) o : Map.of();
    }

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? null : v.toString();
    }

    private Integer intOr(Map<String, Object> m, String k, Integer fallback) {
        Object v = m.get(k);
        if (v == null) return fallback;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(v.toString()); } catch (NumberFormatException e) { return fallback; }
    }

    /** Expand ${VAR} and ${VAR:default} using Spring's Environment. */
    private String resolve(String raw) {
        return raw == null ? null : env.resolvePlaceholders(raw);
    }
}
