package com.telcobright.seeddata.core;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class SeedResult {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public final List<String> applied = new ArrayList<>();
    public final Map<String, Integer> stmtCounts = new LinkedHashMap<>();
    public String dbName;

    public void record(String stage, int stmtCount) {
        applied.add(stage);
        stmtCounts.put(stage, stmtCount);
    }

    public String toJson(long durationMs) {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("status", "ok");
        root.put("db", dbName);
        root.put("applied", applied);
        root.put("stmtCounts", stmtCounts);
        root.put("durationMs", durationMs);
        try {
            return MAPPER.writeValueAsString(root);
        } catch (Exception e) {
            return "{\"status\":\"ok\"}";
        }
    }
}
