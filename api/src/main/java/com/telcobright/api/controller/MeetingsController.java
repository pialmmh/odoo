package com.telcobright.api.controller;

import com.telcobright.api.livekit.LiveKitTokenService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Meeting endpoints that sit in front of the generic Espo proxy.
 *
 * Must be mounted on a more specific path than {@code /api/crm/**} so the
 * catch-all EspoProxyController doesn't swallow these. Spring's AntPathMatcher
 * picks the more specific mapping first.
 *
 * Endpoints:
 *   POST /api/crm/meetings/{id}/token    → mint LiveKit JWT
 *   POST /api/crm/meetings/{id}/control  → lifecycle actions (stub)
 *
 * All other /api/crm/meetings/**  traffic (list/read/update the Meeting
 * entity itself) falls through to EspoProxyController unchanged.
 */
@RestController
@RequestMapping("/api/crm/meetings")
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class MeetingsController {

    private final LiveKitTokenService tokens;

    public MeetingsController(LiveKitTokenService tokens) {
        this.tokens = tokens;
    }

    @PostMapping("/{id}/token")
    public ResponseEntity<?> issueToken(@PathVariable String id, @RequestBody(required = false) TokenRequest req) {
        TokenRequest r = req != null ? req : new TokenRequest();
        String identity = r.identity != null && !r.identity.isBlank()
                ? r.identity
                : identityFromPrincipal();
        String displayName = r.name != null && !r.name.isBlank() ? r.name : identity;
        String room = roomName(id);

        LiveKitTokenService.Result res = tokens.issue(room, identity, displayName, r.role);

        Map<String, Object> body = new HashMap<>();
        body.put("token", res.token());
        body.put("wsUrl", res.wsUrl());
        body.put("room", res.room());
        body.put("identity", res.identity());
        body.put("expiresAtMs", res.expiresAtMs());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{id}/control")
    public ResponseEntity<?> control(@PathVariable String id, @RequestBody ControlRequest req) {
        // Stub: will later call LiveKit RoomService (mute/unmute/remove/stop).
        // For now, acknowledge so the UI can exercise its dispatch path.
        Map<String, Object> body = new HashMap<>();
        body.put("ok", true);
        body.put("meetingId", id);
        body.put("action", req.action);
        body.put("targetIdentity", req.targetIdentity);
        body.put("note", "control endpoint is a stub — LiveKit RoomService wiring pending");
        return ResponseEntity.accepted().body(body);
    }

    private static String roomName(String meetingId) {
        // LiveKit room names must be URL-safe; Espo IDs already are.
        return "meeting-" + meetingId;
    }

    private static String identityFromPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            String preferred = jwt.getClaimAsString("preferred_username");
            if (preferred != null && !preferred.isBlank()) return preferred;
            String sub = jwt.getSubject();
            if (sub != null && !sub.isBlank()) return sub;
        }
        return "guest-" + Long.toHexString(System.currentTimeMillis());
    }

    public static class TokenRequest {
        public String role;        // PUBLISHER | SUBSCRIBER | ADMIN_SILENT | ADMIN_COACH | ADMIN_BARGE | ADMIN_TAKEOVER
        public String identity;    // override principal (e.g. contact/lead id for guest links)
        public String name;        // display name
    }

    public static class ControlRequest {
        public String action;         // END | MUTE | UNMUTE | REMOVE | ADMIT | START_RECORDING | STOP_RECORDING | ...
        public String targetIdentity; // optional — participant to act on
        public Map<String, Object> payload;
    }
}
