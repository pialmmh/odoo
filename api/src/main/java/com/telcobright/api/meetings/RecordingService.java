package com.telcobright.api.meetings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.telcobright.api.config.LiveKitProperties;
import com.telcobright.api.livekit.EgressService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Orchestrates LiveKit egress + EspoCRM MeetingRecording persistence.
 *
 * Tenant-scoped: every recording file is stored under
 * {@code {recordings-dir}/{tenant}/{meetingId}-{recordingId}.mp4}, and the
 * LiveKit room it targets is namespaced via {@link MeetingRoomNaming}.
 */
@Service
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class RecordingService {
    private static final Logger log = LoggerFactory.getLogger(RecordingService.class);
    private static final SecureRandom RNG = new SecureRandom();
    private static final String ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static final List<String> ACTIVE_STATUSES =
            List.of("STARTING", "ACTIVE", "ENDING");

    private final EgressService egress;
    private final EspoEntities esp;
    private final LiveKitProperties props;

    public RecordingService(EgressService egress, EspoEntities esp, LiveKitProperties props) {
        this.egress = egress;
        this.esp = esp;
        this.props = props;
    }

    public JsonNode start(String tenantSlug, String meetingId, String startedByUserId) {
        // Refuse to double-start: check for an active recording on this meeting.
        Optional<JsonNode> active = activeRecording(meetingId);
        if (active.isPresent()) return active.get();

        String room = MeetingRoomNaming.roomName(tenantSlug, meetingId);
        String tenantDir = MeetingRoomNaming.tenantPathSegment(tenantSlug);
        String recId = randomId(24);
        String filename = meetingId + "-" + recId + ".mp4";
        String relPath = tenantDir.isEmpty() ? filename : tenantDir + "/" + filename;

        // Ensure tenant subdir exists on host side — shared bind into egress.
        try {
            Path hostDir = Paths.get(props.getRecordingsDir(), tenantDir);
            if (!Files.exists(hostDir)) Files.createDirectories(hostDir);
        } catch (IOException e) {
            log.warn("could not create recordings dir: {}", e.getMessage());
        }

        String egressFilepath = props.getRecordingsDirEgress() + "/" + relPath;
        String hostFilepath   = props.getRecordingsDir()       + "/" + relPath;

        EgressService.StartResult res = egress.startRoomComposite(room, egressFilepath);

        ObjectNode payload = esp.newObject();
        payload.put("name", "Recording " + nowIso());
        payload.put("egressId", res.egressId());
        payload.put("status", mapEgressStatus(res.status()));
        payload.put("filePath", hostFilepath);
        payload.put("parentMeetingId", meetingId);
        payload.put("parentMeetingType", "Meeting");
        payload.put("startedAt", nowIso());
        if (startedByUserId != null && !startedByUserId.isBlank()) {
            payload.put("startedById", startedByUserId);
        }
        return esp.create("MeetingRecording", payload);
    }

    public JsonNode stop(String tenantSlug, String meetingId) {
        Optional<JsonNode> activeOpt = activeRecording(meetingId);
        if (activeOpt.isEmpty()) {
            // Idempotent: no-op, return the most recent recording if any.
            JsonNode list = esp.list("MeetingRecording",
                    Map.of("parentMeetingId", meetingId), "startedAt", true);
            JsonNode first = null;
            for (JsonNode n : EspoEntities.items(list)) { first = n; break; }
            ObjectNode body = esp.newObject();
            body.set("recording", first);
            body.put("alreadyStopped", true);
            return body;
        }
        JsonNode active = activeOpt.get();
        String room = MeetingRoomNaming.roomName(tenantSlug, meetingId);

        try {
            egress.stop(active.path("egressId").asText(), room);
            ObjectNode patch = esp.newObject();
            patch.put("status", "ENDING");
            return esp.update("MeetingRecording", active.path("id").asText(), patch);
        } catch (EgressService.EgressException e) {
            log.warn("stop egress failed: {}", e.getMessage());
            ObjectNode patch = esp.newObject();
            patch.put("status", "ABORTED");
            patch.put("errorText", e.getMessage());
            patch.put("endedAt", nowIso());
            return esp.update("MeetingRecording", active.path("id").asText(), patch);
        }
    }

    /** Reads each non-terminal recording and reconciles its status with LiveKit. */
    public JsonNode listForMeeting(String meetingId) {
        JsonNode list = esp.list("MeetingRecording",
                Map.of("parentMeetingId", meetingId), "startedAt", true);
        for (JsonNode r : EspoEntities.items(list)) {
            String status = r.path("status").asText("");
            if (ACTIVE_STATUSES.contains(status)) refreshStatus(r);
        }
        // Re-fetch after updates to return current rows.
        return esp.list("MeetingRecording",
                Map.of("parentMeetingId", meetingId), "startedAt", true);
    }

    public Optional<JsonNode> find(String recordingId) {
        return esp.get("MeetingRecording", recordingId);
    }

    // ── internals ─────────────────────────────────────────────────────────

    private Optional<JsonNode> activeRecording(String meetingId) {
        JsonNode list = esp.list("MeetingRecording",
                Map.of("parentMeetingId", meetingId), "startedAt", true);
        for (JsonNode n : EspoEntities.items(list)) {
            if (ACTIVE_STATUSES.contains(n.path("status").asText(""))) return Optional.of(n);
        }
        return Optional.empty();
    }

    private void refreshStatus(JsonNode row) {
        String egressId = row.path("egressId").asText(null);
        if (egressId == null) return;
        try {
            List<JsonNode> infos = egress.list(null, egressId);
            if (infos.isEmpty()) {
                // LiveKit no longer tracks this egress → assume completed.
                persistTerminal(row, "COMPLETED", null);
                return;
            }
            JsonNode info = infos.get(0);
            String st = mapEgressStatus(info.path("status").asText(""));
            ObjectNode patch = esp.newObject();
            patch.put("status", st);
            if (info.has("error") && !info.get("error").asText("").isBlank()) {
                patch.put("errorText", info.get("error").asText());
            }
            JsonNode files = info.path("file_results");
            if (files.isArray() && files.size() > 0) {
                JsonNode f = files.get(0);
                if (f.has("size")) patch.put("fileSizeBytes", f.get("size").asLong());
                if (f.has("duration")) patch.put("durationMs", f.get("duration").asLong() / 1_000_000L);
            }
            if ("COMPLETED".equals(st) || "FAILED".equals(st) || "ABORTED".equals(st)) {
                if (!row.path("endedAt").asText("").isEmpty() == false) {
                    patch.put("endedAt", nowIso());
                }
            }
            fillFileSizeIfMissing(row, patch);
            esp.update("MeetingRecording", row.path("id").asText(), patch);
        } catch (EgressService.EgressException e) {
            log.debug("refresh egress failed: {}", e.getMessage());
        }
    }

    private void persistTerminal(JsonNode row, String status, String err) {
        ObjectNode patch = esp.newObject();
        patch.put("status", status);
        if (err != null) patch.put("errorText", err);
        patch.put("endedAt", nowIso());
        fillFileSizeIfMissing(row, patch);
        esp.update("MeetingRecording", row.path("id").asText(), patch);
    }

    private void fillFileSizeIfMissing(JsonNode row, ObjectNode patch) {
        if (row.path("fileSizeBytes").asLong(0) > 0) return;
        String fp = row.path("filePath").asText(null);
        if (fp == null) return;
        try {
            Path p = Paths.get(fp);
            if (Files.exists(p)) patch.put("fileSizeBytes", Files.size(p));
        } catch (IOException ignored) {}
    }

    private static String mapEgressStatus(String s) {
        return switch (s == null ? "" : s) {
            case "EGRESS_STARTING"   -> "STARTING";
            case "EGRESS_ACTIVE"     -> "ACTIVE";
            case "EGRESS_ENDING"     -> "ENDING";
            case "EGRESS_COMPLETE"   -> "COMPLETED";
            case "EGRESS_FAILED"     -> "FAILED";
            case "EGRESS_ABORTED"    -> "ABORTED";
            default                  -> "ACTIVE";
        };
    }

    private static String nowIso() {
        // EspoCRM expects "YYYY-MM-DD HH:MM:SS" UTC for datetime fields.
        return DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                .withZone(java.time.ZoneOffset.UTC)
                .format(Instant.now());
    }

    private static String randomId(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) sb.append(ALPHA.charAt(RNG.nextInt(ALPHA.length())));
        return sb.toString();
    }
}
