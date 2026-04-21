package com.telcobright.api.nms;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Config binding for Galera monitoring targets.
 *
 * nms:
 *   galera:
 *     clusters:
 *       - name: db-prod
 *         nodes:
 *           - name: galera-node-1
 *             host: 10.10.199.11
 *             port: 3306
 *             user: monitor
 *             password: ${GALERA_MONITOR_PW}
 *             errorLogPath: /var/log/mysql/error.log   # optional
 */
@Component
@ConfigurationProperties(prefix = "nms.galera")
public class GaleraProperties {

    private List<Cluster> clusters = new ArrayList<>();

    public List<Cluster> getClusters() { return clusters; }
    public void setClusters(List<Cluster> clusters) { this.clusters = clusters; }

    public Cluster findCluster(String name) {
        return clusters.stream().filter(c -> c.getName().equals(name)).findFirst().orElse(null);
    }

    public static class Cluster {
        private String name;
        private List<Node> nodes = new ArrayList<>();

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public List<Node> getNodes() { return nodes; }
        public void setNodes(List<Node> nodes) { this.nodes = nodes; }
    }

    public static class Node {
        private String name;
        private String host;
        private int port = 3306;
        private String user;
        private String password;
        private String errorLogPath;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getHost() { return host; }
        public void setHost(String host) { this.host = host; }
        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        public String getUser() { return user; }
        public void setUser(String user) { this.user = user; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getErrorLogPath() { return errorLogPath; }
        public void setErrorLogPath(String errorLogPath) { this.errorLogPath = errorLogPath; }

        public String jdbcUrl() {
            return "jdbc:mysql://" + host + ":" + port
                    + "/?connectTimeout=3000&socketTimeout=5000&useSSL=false&allowPublicKeyRetrieval=true";
        }
    }
}
