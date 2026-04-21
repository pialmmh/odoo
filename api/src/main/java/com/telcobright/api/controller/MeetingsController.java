package com.telcobright.api.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.telcobright.api.livekit.LiveKitTokenService;
import com.telcobright.api.livekit.RoomServiceClient;
import com.telcobright.api.meetings.MeetingRoomNaming;
import jakarta.servlet.http.HttpServletRequest;
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
 *   POST /api/crm/meetings/{id}/token    → mint LiveKit JWT (tenant-aware room)
 *   POST /api/crm/meetings/{id}/control  → moderation via LiveKit RoomService
 *
 * All other /api/crm/meetings/**  traffic (list/read/update the Meeting
 * entity itself) falls through to EspoProxyController unchanged.
 */
@RestController
@RequestMapping("/api/crm/meetings")
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class MeetingsController {

    private final LiveKitTokenService tokens;
    private final RoomServiceClient roomService;

    public MeetingsController(LiveKitTokenService tokens, RoomServiceClient roomService) {
        this.tokens = tokens;
        this.roomService = roomService;
    }

    @PostMapping("/{id}/token")
    public ResponseEntity<?> issueToken(@PathVariable String id,
                                        @RequestBody(required = false) TokenRequest req,
                                        HttpServletRequest http) {
        TokenRequest r = req != null ? req : new TokenRequest();
        String tenant = http.getHeader("X-Tenant");
        String identity = r.identity != null && !r.identity.isBlank()
                ? r.identity
                : identityFromPrincipal();
        String displayName = r.name != null && !r.name.isBlank() ? r.name : identity;
        String room = MeetingRoomNaming.roomName(tenant, id);

        LiveKitTokenService.Result res = tokens.issue(room, identity, displayName, r.role);

        Map<String, Object> body = new HashMap<>();
        body.put("token", res.token());
        body.put("wsUrl", res.wsUrl());
        body.put("room", res.room());
        body.put("identity", res.identity());
        body.put("expiresAtMs", res.expiresAtMs());
        return ResponseEntity.ok(body);
    }

    /**
     * Moderation. Actions:
     *   MUTE              — mute the target's specific trackSid, or if no sid
     *                       is given, strip their publish permission
     *   UNMUTE            — unmute the specified trackSid (required)
     *   REMOVE / KICK     — remove from room
     *   BLOCK             — remove; persistent-deny list TODO (needs BlockedUser
     *                       custom entity)
     *   LIST_PARTICIPANTS — enumerate room participants (for host UI refresh)
     *   END               — close the room entirely (not yet wired; returns 501)
     */
    @PostMapping("/{id}/control")
    public ResponseEntity<?> control(@PathVariable String id,
                                     @RequestBody ControlRequest req,
                                     HttpServletRequest http) {
        String tenant = http.getHeader("X-Tenant");
        String room = MeetingRoomNaming.roomName(tenant, id);
        String action = req.action == null ? "" : req.action.toUpperCase();

        Map<String, Object> body = new HashMap<>();
        body.put("meetingId", id);
        body.put("action", action);
        body.put("targetIdentity", req.targetIdentity);

        try {
            switch (action) {
                case "MUTE" -> {
                    JsonNode res;
                    if (req.trackSid != null && !req.trackSid.isBlank()) {
                        res = roomService.mutePublishedTrack(room, req.targetIdentity, req.trackSid, true);
                    } else {
                        // No trackSid given: revoke publish permission — effective "mute all tracks".
                        res = roomService.disablePublish(room, req.targetIdentity);
                    }
                    body.put("result", res);
                    body.put("ok", true);
                }
                case "UNMUTE" -> {
                    JsonNode res = roomService.mutePublishedTrack(room, req.targetIdentity, req.trackSid, false);
                    body.put("result", res);
                    body.put("ok", true);
                }
                case "REMOVE", "KICK" -> {
                    JsonNode res = roomService.removeParticipant(room, req.targetIdentity);
                    body.put("result", res);
                    body.put("ok", true);
                }
                case "LIST_PARTICIPANTS" -> {
                    body.put("result", roomService.listParticipants(room));
                    body.put("ok", true);
                }
                case "BLOCK" -> {
                    roomService.removeParticipant(room, req.targetIdentity);
                    body.put("ok", true);
                    body.put("note", "participant removed; persistent block-list not yet wired (needs BlockedUser custom entity)");
                }
                case "END" -> {
                    body.put("ok", false);
                    body.put("note", "END not yet implemented — use RoomService.DeleteRoom once wired");
                    return ResponseEntity.status(501).body(body);
                }
                default -> {
                    body.put("ok", false);
                    body.put("note", "unknown action: " + action);
                    return ResponseEntity.status(400).body(body);
                }
            }
            return ResponseEntity.ok(body);
        } catch (RoomServiceClient.RoomServiceException e) {
            body.put("ok", false);
            body.put("error", e.getMessage());
            return ResponseEntity.status(502).body(body);
        }
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
        public String role;        // PUBLISHER | SUBSCRIBER | HOST | ADMIN_SILENT | ADMIN_COACH | ADMIN_BARGE | ADMIN_TAKEOVER
        public String identity;    // override principal (e.g. contact/lead id for guest links)
        public String name;        // display name
    }

    public static class ControlRequest {
        public String action;         // MUTE | UNMUTE | REMOVE | KICK | BLOCK | LIST_PARTICIPANTS | END
        public String targetIdentity; // participant to act on
        public String trackSid;       // optional — specific track sid for MUTE/UNMUTE
        public Map<String, Object> payload;
    }
}
