package com.telcobright.api.erp.idempiere;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "erp.idempiere")
public class IdempiereProperties {

    private String jdbcUrl = "jdbc:postgresql://127.0.0.1:5433/idempiere";
    private String username = "adempiere";
    private String password = "adempiere";
    private String schema = "adempiere";
    private int clientId = 0;
    private String clientIds = "0,11";

    public String getJdbcUrl() { return jdbcUrl; }
    public void setJdbcUrl(String jdbcUrl) { this.jdbcUrl = jdbcUrl; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getSchema() { return schema; }
    public void setSchema(String schema) { this.schema = schema; }
    public int getClientId() { return clientId; }
    public void setClientId(int clientId) { this.clientId = clientId; }
    public String getClientIds() { return clientIds; }
    public void setClientIds(String clientIds) { this.clientIds = clientIds; }

    public List<Integer> clientIdList() {
        return Arrays.stream(clientIds.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(Integer::parseInt).toList();
    }
}
