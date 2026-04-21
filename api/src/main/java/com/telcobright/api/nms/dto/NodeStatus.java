package com.telcobright.api.nms.dto;

import java.util.Map;

/** Per-node status snapshot. `reachable=false` when the node can't be contacted. */
public record NodeStatus(
        String name,
        String host,
        int port,
        boolean reachable,
        String error,                 // populated when reachable=false
        String wsrepLocalStateComment, // Synced / Donor/Desynced / Joiner / Joined / Disconnected
        boolean ready,                 // wsrep_ready
        boolean connected,             // wsrep_connected
        long sendQueue,
        long recvQueue,
        double flowControlPaused,      // 0.0 .. 1.0
        long lastCommitted,            // wsrep_last_committed
        int clusterSize,               // wsrep_cluster_size as this node sees it
        String clusterStatus,          // Primary / non-Primary / Disconnected
        String clusterStateUuid,
        long certFailures,
        long localBfAborts,
        Map<String, String> raw        // full wsrep_* snapshot for drill-down
) {}
