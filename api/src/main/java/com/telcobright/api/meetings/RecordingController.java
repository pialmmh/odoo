package com.telcobright.api.meetings;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

/**
 * Recording endpoints — sit beside the existing {@code MeetingsController}
 * at {@code /api/crm/meetings/**}. Spring's ant matcher prefers the more
 * specific mapping, so the catch-all {@code EspoProxyController} on
 * {@code /api/crm/**} doesn't swallow these.
 *
 * All tenant scoping uses the {@code X-Tenant} header set by the frontend
 * axios client (same as the rest of the CRM api).
 */
@RestController
@RequestMapping("/api/crm")
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class RecordingController {

    private final RecordingService service;

    public RecordingController(RecordingService service) {
        this.service = service;
    }

    @PostMapping("/meetings/{meetingId}/recording/start")
    public ResponseEntity<?> start(@PathVariable String meetingId, HttpServletRequest req) {
        String tenant = req.getHeader("X-Tenant");
        String userId = principalEspoUserId();
        JsonNode r = service.start(tenant, meetingId, userId);
        return ResponseEntity.status(201).body(Map.of("recording", r));
    }

    @PostMapping("/meetings/{meetingId}/recording/stop")
    public ResponseEntity<?> stop(@PathVariable String meetingId, HttpServletRequest req) {
        String tenant = req.getHeader("X-Tenant");
        JsonNode r = service.stop(tenant, meetingId);
        // The service returns either a single recording row or an
        // { recording, alreadyStopped:true } envelope — both shapes OK for UI.
        if (r != null && r.has("alreadyStopped")) {
            return ResponseEntity.ok(r);
        }
        return ResponseEntity.ok(Map.of("recording", r));
    }

    @GetMapping("/meetings/{meetingId}/recordings")
    public ResponseEntity<?> list(@PathVariable String meetingId) {
        JsonNode list = service.listForMeeting(meetingId);
        return ResponseEntity.ok(Map.of("recordings", list));
    }

    /** Stream the MP4 file for a given recording id. */
    @GetMapping("/recordings/{id}/file")
    public ResponseEntity<?> file(@PathVariable String id) {
        return service.find(id).map(rec -> {
            String fp = rec.path("filePath").asText(null);
            if (fp == null) return ResponseEntity.status(404).<Object>body(Map.of("error", "no file"));
            Path p = Paths.get(fp);
            if (!Files.exists(p)) return ResponseEntity.status(404).<Object>body(Map.of("error", "file missing"));
            Resource res = new FileSystemResource(p);
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.parseMediaType("video/mp4"));
            h.setContentDisposition(ContentDisposition.inline().filename(p.getFileName().toString()).build());
            return ResponseEntity.ok().headers(h).<Object>body(res);
        }).orElse(ResponseEntity.status(404).body(Map.of("error", "not found")));
    }

    /**
     * Resolve the caller's EspoCRM user id (not Keycloak subject). We keep
     * the mapping simple: EspoCRM user id == Keycloak preferred_username,
     * which matches the convention already used in MeetingsController. If
     * the mapping fails we return null so the service treats it as an
     * anonymous recording trigger.
     */
    private static String principalEspoUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            String u = jwt.getClaimAsString("preferred_username");
            if (u != null && !u.isBlank()) return u;
        }
        return null;
    }
}
