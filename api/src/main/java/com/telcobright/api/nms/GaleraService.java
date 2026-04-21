package com.telcobright.api.nms;

import com.telcobright.api.nms.dto.Alert;
import com.telcobright.api.nms.dto.ClusterStatus;
import com.telcobright.api.nms.dto.LogEntry;
import com.telcobright.api.nms.dto.NodeStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Polls every configured Galera node in parallel, builds NodeStatus + ClusterStatus,
 * and derives alerts from thresholds. Pure JDBC — no pool, connections are short-lived.
 */
@Service
public class GaleraService {

    private static final Logger log = LoggerFactory.getLogger(GaleraService.class);

    // Threshold constants — centralized so alert derivation stays consistent.
    private static final long SEND_QUEUE_WARN = 10;
    private static final long SEND_QUEUE_CRIT = 50;
    private static final double FLOW_CTRL_WARN = 0.05;   // 5% of window paused
    private static final double FLOW_CTRL_CRIT = 0.20;   // 20%
    private static final long SEQNO_LAG_WARN = 100;
    private static final long SEQNO_LAG_CRIT = 1000;

    private final GaleraProperties props;
    private final ExecutorService poolExec =
            Executors.newCachedThreadPool(r -> {
                Thread t = new Thread(r, "galera-poll");
                t.setDaemon(true);
                return t;
            });

    public GaleraService(GaleraProperties props) {
        this.props = props;
    }

    // ─── Cluster status ──────────────────────────────────────────────────────
    public ClusterStatus getClusterStatus(String clusterName) {
        GaleraProperties.Cluster cluster = props.findCluster(clusterName);
        if (cluster == null) {
            throw new IllegalArgumentException("Unknown Galera cluster: " + clusterName);
        }

        long t0 = System.currentTimeMillis();
        List<CompletableFuture<NodeStatus>> futures = new ArrayList<>();
        for (GaleraProperties.Node n : cluster.getNodes()) {
            futures.add(CompletableFuture.supplyAsync(() -> pollNode(n), poolExec));
        }

        List<NodeStatus> nodes = futures.stream()
                .map(CompletableFuture::join)
                .toList();

        int reachable = (int) nodes.stream().filter(NodeStatus::reachable).count();
        int synced = (int) nodes.stream()
                .filter(n -> "Synced".equalsIgnoreCase(n.wsrepLocalStateComment()))
                .count();

        // Consensus uuid: all reachable nodes should agree. If not, mark inconsistent.
        Set<String> uuids = new HashSet<>();
        long maxSeqno = 0;
        long minSyncedSeqno = Long.MAX_VALUE;
        boolean anyPrimary = false;
        for (NodeStatus n : nodes) {
            if (!n.reachable()) continue;
            if (n.clusterStateUuid() != null && !n.clusterStateUuid().isBlank()) {
                uuids.add(n.clusterStateUuid());
            }
            if ("Primary".equalsIgnoreCase(n.clusterStatus())) anyPrimary = true;
            if (n.lastCommitted() > maxSeqno) maxSeqno = n.lastCommitted();
            if ("Synced".equalsIgnoreCase(n.wsrepLocalStateComment()) && n.lastCommitted() < minSyncedSeqno) {
                minSyncedSeqno = n.lastCommitted();
            }
        }
        String uuidConsensus = uuids.size() == 1 ? uuids.iterator().next()
                : uuids.isEmpty() ? null : "inconsistent";
        long trailingBy = (minSyncedSeqno == Long.MAX_VALUE) ? 0 : Math.max(0, maxSeqno - minSyncedSeqno);

        String health = deriveHealth(cluster.getNodes().size(), reachable, synced, anyPrimary, trailingBy);

        return new ClusterStatus(
                cluster.getName(),
                cluster.getNodes().size(),
                reachable,
                synced,
                anyPrimary,
                uuidConsensus,
                maxSeqno,
                trailingBy,
                health,
                nodes,
                System.currentTimeMillis() - t0
        );
    }

    private String deriveHealth(int configured, int reachable, int synced, boolean primary, long trailingBy) {
        if (!primary || reachable == 0) return "critical";
        if (reachable < configured || synced < configured) return "warning";
        if (trailingBy >= SEQNO_LAG_CRIT) return "critical";
        if (trailingBy >= SEQNO_LAG_WARN) return "warning";
        return "healthy";
    }

    // ─── Per-node poll ───────────────────────────────────────────────────────
    private NodeStatus pollNode(GaleraProperties.Node n) {
        try (Connection c = DriverManager.getConnection(n.jdbcUrl(), n.getUser(), n.getPassword());
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SHOW GLOBAL STATUS LIKE 'wsrep_%'")) {

            Map<String, String> wsrep = new LinkedHashMap<>();
            while (rs.next()) {
                wsrep.put(rs.getString(1), rs.getString(2));
            }

            return new NodeStatus(
                    n.getName(),
                    n.getHost(),
                    n.getPort(),
                    true,
                    null,
                    wsrep.getOrDefault("wsrep_local_state_comment", "Unknown"),
                    parseBool(wsrep.get("wsrep_ready")),
                    parseBool(wsrep.get("wsrep_connected")),
                    parseLong(wsrep.get("wsrep_local_send_queue"), 0),
                    parseLong(wsrep.get("wsrep_local_recv_queue"), 0),
                    parseDouble(wsrep.get("wsrep_flow_control_paused"), 0.0),
                    parseLong(wsrep.get("wsrep_last_committed"), 0),
                    (int) parseLong(wsrep.get("wsrep_cluster_size"), 0),
                    wsrep.getOrDefault("wsrep_cluster_status", "Unknown"),
                    wsrep.get("wsrep_cluster_state_uuid"),
                    parseLong(wsrep.get("wsrep_local_cert_failures"), 0),
                    parseLong(wsrep.get("wsrep_local_bf_aborts"), 0),
                    wsrep
            );
        } catch (Exception ex) {
            log.warn("Galera poll failed for node {} ({}:{}): {}", n.getName(), n.getHost(), n.getPort(), ex.getMessage());
            return new NodeStatus(
                    n.getName(), n.getHost(), n.getPort(),
                    false, ex.getMessage(),
                    "Disconnected", false, false, 0, 0, 0.0, 0,
                    0, "Disconnected", null, 0, 0,
                    Map.of()
            );
        }
    }

    // ─── Alerts ──────────────────────────────────────────────────────────────
    public List<Alert> getAlerts(String clusterName) {
        ClusterStatus cs = getClusterStatus(clusterName);
        List<Alert> out = new ArrayList<>();

        if (!cs.primary()) {
            out.add(new Alert("critical", "cluster", "NO_PRIMARY_COMPONENT",
                    "Cluster has no Primary component — quorum lost"));
        }
        if (cs.reachableNodes() < cs.configuredNodes()) {
            out.add(new Alert("critical", "cluster", "NODE_UNREACHABLE",
                    (cs.configuredNodes() - cs.reachableNodes()) + " of " + cs.configuredNodes() + " nodes unreachable"));
        }
        if ("inconsistent".equals(cs.clusterStateUuid())) {
            out.add(new Alert("critical", "cluster", "SPLIT_BRAIN_SUSPECTED",
                    "Nodes disagree on cluster state UUID"));
        }
        if (cs.trailingBy() >= SEQNO_LAG_CRIT) {
            out.add(new Alert("critical", "cluster", "REPLICATION_LAG",
                    "Trailing node is " + cs.trailingBy() + " seqno behind"));
        } else if (cs.trailingBy() >= SEQNO_LAG_WARN) {
            out.add(new Alert("warning", "cluster", "REPLICATION_LAG",
                    "Trailing node is " + cs.trailingBy() + " seqno behind"));
        }

        for (NodeStatus n : cs.nodes()) {
            if (!n.reachable()) {
                out.add(new Alert("critical", n.name(), "NODE_UNREACHABLE",
                        "Cannot connect: " + n.error()));
                continue;
            }
            if (!n.ready()) {
                out.add(new Alert("critical", n.name(), "NODE_NOT_READY",
                        "wsrep_ready=OFF — node not accepting queries"));
            }
            String state = n.wsrepLocalStateComment();
            if (!"Synced".equalsIgnoreCase(state) && !"Donor/Desynced".equalsIgnoreCase(state)) {
                out.add(new Alert("warning", n.name(), "NODE_NOT_SYNCED",
                        "wsrep_local_state_comment=" + state));
            }
            if (n.sendQueue() >= SEND_QUEUE_CRIT) {
                out.add(new Alert("critical", n.name(), "SEND_QUEUE_DEEP",
                        "Send queue depth = " + n.sendQueue()));
            } else if (n.sendQueue() >= SEND_QUEUE_WARN) {
                out.add(new Alert("warning", n.name(), "SEND_QUEUE_DEEP",
                        "Send queue depth = " + n.sendQueue()));
            }
            if (n.flowControlPaused() >= FLOW_CTRL_CRIT) {
                out.add(new Alert("critical", n.name(), "FLOW_CONTROL_PAUSED",
                        String.format("Flow control paused %.1f%%", n.flowControlPaused() * 100)));
            } else if (n.flowControlPaused() >= FLOW_CTRL_WARN) {
                out.add(new Alert("warning", n.name(), "FLOW_CONTROL_PAUSED",
                        String.format("Flow control paused %.1f%%", n.flowControlPaused() * 100)));
            }
            if (n.certFailures() > 0) {
                out.add(new Alert("info", n.name(), "CERT_FAILURES",
                        n.certFailures() + " certification failures since startup"));
            }
        }
        return out;
    }

    // ─── Logs (optional, only if errorLogPath configured and readable) ───────
    private static final Pattern LOG_LINE =
            Pattern.compile("^(\\S+\\s+\\S+)\\s+\\d+\\s+\\[(\\w+)\\]\\s+(.*)$");

    public List<LogEntry> tail(String clusterName, int maxLines) {
        GaleraProperties.Cluster cluster = props.findCluster(clusterName);
        if (cluster == null) throw new IllegalArgumentException("Unknown cluster: " + clusterName);

        int per = Math.max(10, maxLines / Math.max(1, cluster.getNodes().size()));
        List<LogEntry> all = new ArrayList<>();
        for (GaleraProperties.Node n : cluster.getNodes()) {
            if (n.getErrorLogPath() == null || n.getErrorLogPath().isBlank()) continue;
            try {
                Path p = Path.of(n.getErrorLogPath());
                if (!Files.isReadable(p)) continue;
                List<String> lines = readTail(p, per);
                for (String line : lines) {
                    if (!line.toLowerCase().contains("wsrep") && !line.contains("[ERROR]") && !line.contains("[Warning]")) continue;
                    all.add(parseLine(line, n.getName()));
                }
            } catch (IOException ex) {
                log.warn("Log tail failed for {}: {}", n.getName(), ex.getMessage());
            }
        }
        all.sort(Comparator.comparing(LogEntry::timestamp, Comparator.nullsFirst(Comparator.naturalOrder())));
        if (all.size() > maxLines) return all.subList(all.size() - maxLines, all.size());
        return all;
    }

    private static List<String> readTail(Path p, int lines) throws IOException {
        // Simple implementation: read whole file (MySQL error logs are usually rotated).
        // For very large files a reverse scan would be better; revisit if needed.
        List<String> all = Files.readAllLines(p, StandardCharsets.UTF_8);
        if (all.size() <= lines) return all;
        return all.subList(all.size() - lines, all.size());
    }

    private static LogEntry parseLine(String line, String node) {
        Matcher m = LOG_LINE.matcher(line);
        if (m.matches()) {
            String lvl = m.group(2).toUpperCase();
            if (lvl.equals("NOTE")) lvl = "INFO";
            if (lvl.equals("WARNING")) lvl = "WARN";
            return new LogEntry(m.group(1), node, lvl, m.group(3));
        }
        return new LogEntry(null, node, "INFO", line);
    }

    // ─── List configured clusters ────────────────────────────────────────────
    public List<String> listClusters() {
        return props.getClusters().stream().map(GaleraProperties.Cluster::getName).toList();
    }

    // ─── Parse helpers ───────────────────────────────────────────────────────
    private static long parseLong(String v, long dflt) {
        if (v == null || v.isBlank()) return dflt;
        try { return Long.parseLong(v.trim()); } catch (NumberFormatException e) { return dflt; }
    }
    private static double parseDouble(String v, double dflt) {
        if (v == null || v.isBlank()) return dflt;
        try { return Double.parseDouble(v.trim()); } catch (NumberFormatException e) { return dflt; }
    }
    private static boolean parseBool(String v) {
        if (v == null) return false;
        String s = v.trim();
        return s.equalsIgnoreCase("ON") || s.equalsIgnoreCase("TRUE") || s.equals("1");
    }
}
