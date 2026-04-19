package com.telcobright.api.tenant;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Bootstrap list from application.yml:
 *
 *   orchestrix:
 *     tenants:
 *       - name: btcl
 *         enabled: true
 *         profile: dev
 *
 * Only tenant name + active profile live here. The full config lives in
 * config/tenants/{name}/{profile}/profile-{profile}.yml (loaded by
 * TenantConfigRegistry at startup).
 */
@Component
@ConfigurationProperties(prefix = "orchestrix")
public class TenantsBootstrap {
    private String operator;
    private List<Entry> tenants = new ArrayList<>();

    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public List<Entry> getTenants() { return tenants; }
    public void setTenants(List<Entry> tenants) { this.tenants = tenants; }

    public static class Entry {
        private String name;
        private boolean enabled = false;
        private String profile = "dev";

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getProfile() { return profile; }
        public void setProfile(String profile) { this.profile = profile; }
    }
}
