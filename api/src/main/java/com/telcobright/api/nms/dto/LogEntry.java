package com.telcobright.api.nms.dto;

public record LogEntry(
        String timestamp,
        String node,
        String level,    // INFO | WARN | ERROR
        String message
) {}
