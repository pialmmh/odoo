package com.telcobright.api.nms.dto;

public record Alert(
        String severity,  // info | warning | critical
        String source,    // node name or "cluster"
        String code,      // short machine key e.g. FLOW_CONTROL_PAUSED
        String message
) {}
