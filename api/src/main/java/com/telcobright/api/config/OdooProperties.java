package com.telcobright.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "erp.odoo")
public class OdooProperties {
    private String url = "http://127.0.0.1:7169";
    private String db = "odoo_billing";
    private String username = "admin";
    private String password = "admin";

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getDb() { return db; }
    public void setDb(String db) { this.db = db; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
