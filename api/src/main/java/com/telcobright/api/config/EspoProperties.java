package com.telcobright.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "integrations.crm")
public class EspoProperties {
    private boolean enabled = false;
    private String baseUrl = "http://127.0.0.1:7170";
    // X-Api-Key path — only works for type=api users, which fail isAdmin()
    // on User/Role/Team/Settings. Left in for non-admin scopes if you want
    // dual-channel auth; otherwise leave blank and use adminUser/adminPassword.
    private String apiKey = "";
    // Admin Basic auth — required for admin-scope endpoints (User/Role/Team
    // /AuthToken/ActionHistoryRecord/Settings). Source these from
    // enable_api_permission.sh output.
    private String adminUser = "";
    private String adminPassword = "";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getAdminUser() { return adminUser; }
    public void setAdminUser(String adminUser) { this.adminUser = adminUser; }
    public String getAdminPassword() { return adminPassword; }
    public void setAdminPassword(String adminPassword) { this.adminPassword = adminPassword; }
}
