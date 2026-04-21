package com.telcobright.api.controller;

import com.telcobright.api.nms.GaleraService;
import com.telcobright.api.nms.dto.Alert;
import com.telcobright.api.nms.dto.ClusterStatus;
import com.telcobright.api.nms.dto.LogEntry;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * NMS: Galera cluster monitoring endpoints.
 *
 *   GET /api/nms/galera/clusters
 *   GET /api/nms/galera/clusters/{name}/status
 *   GET /api/nms/galera/clusters/{name}/alerts
 *   GET /api/nms/galera/clusters/{name}/logs?tail=200
 */
@RestController
@RequestMapping("/api/nms/galera")
public class NmsGaleraController {

    private final GaleraService svc;

    public NmsGaleraController(GaleraService svc) {
        this.svc = svc;
    }

    @GetMapping("/clusters")
    public List<String> listClusters() {
        return svc.listClusters();
    }

    @GetMapping("/clusters/{name}/status")
    public ResponseEntity<?> status(@PathVariable String name) {
        try {
            ClusterStatus cs = svc.getClusterStatus(name);
            return ResponseEntity.ok(cs);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", "cluster_not_found", "message", e.getMessage()));
        }
    }

    @GetMapping("/clusters/{name}/alerts")
    public ResponseEntity<?> alerts(@PathVariable String name) {
        try {
            List<Alert> alerts = svc.getAlerts(name);
            return ResponseEntity.ok(alerts);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", "cluster_not_found", "message", e.getMessage()));
        }
    }

    @GetMapping("/clusters/{name}/logs")
    public ResponseEntity<?> logs(@PathVariable String name,
                                  @RequestParam(defaultValue = "200") int tail) {
        try {
            List<LogEntry> entries = svc.tail(name, Math.min(Math.max(tail, 1), 2000));
            return ResponseEntity.ok(entries);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", "cluster_not_found", "message", e.getMessage()));
        }
    }
}
