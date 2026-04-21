package com.telcobright.api.nms.dto;

import java.util.List;

/** Aggregated cluster status derived from polling every configured node. */
public record ClusterStatus(
        String name,
        int configuredNodes,
        int reachableNodes,
        int syncedNodes,
        boolean primary,            // quorum / Primary component present
        String clusterStateUuid,    // consensus uuid, or "inconsistent"
        long lastCommitted,         // max seqno across nodes
        long trailingBy,            // lastCommitted - min(seqno) across synced nodes
        String overallHealth,       // healthy | warning | critical
        List<NodeStatus> nodes,
        long pollMs                 // how long the poll took
) {}
