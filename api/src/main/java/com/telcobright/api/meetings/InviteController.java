package com.telcobright.api.meetings;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Authed endpoints for creating / listing / revoking meeting invites
 * (magic links, personal and share). Sits at {@code /api/crm/...} so it
 * benefits from the JWT auth chain already in place for CRM calls.
 *
 * Public counterpart (magic-link resolve, guest /join) lives in
 * {@link PublicJoinController}.
 */
@RestController
@RequestMapping("/api/crm")
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class InviteController {

    private final MagicLinkService service;

    public InviteController(MagicLinkService service) {
        this.service = service;
    }

    public static class InviteRequest {
        public String invitedEmail;
        public String invitedName;
        public Long expiresInSeconds;
    }

    @PostMapping("/meetings/{meetingId}/invites")
    public ResponseEntity<?> create(@PathVariable String meetingId,
                                    @RequestBody InviteRequest req,
                                    HttpServletRequest http) {
        if (req == null || req.invitedEmail == null || req.invitedEmail.isBlank()) {
            return ResponseEntity.status(400).body(Map.of("error", "invitedEmail required"));
        }
        JsonNode row = service.createPersonalInvite(
                meetingId, req.invitedEmail, req.invitedName, req.expiresInSeconds);
        return ResponseEntity.status(201).body(buildInviteView(row, http.getHeader("X-Tenant")));
    }

    @PostMapping("/meetings/{meetingId}/invites/share")
    public ResponseEntity<?> share(@PathVariable String meetingId, HttpServletRequest http) {
        JsonNode row = service.getOrCreateShareLink(meetingId);
        return ResponseEntity.ok(buildInviteView(row, http.getHeader("X-Tenant")));
    }

    @GetMapping("/meetings/{meetingId}/invites")
    public ResponseEntity<?> list(@PathVariable String meetingId, HttpServletRequest http) {
        JsonNode list = service.listForMeeting(meetingId);
        String tenant = http.getHeader("X-Tenant");
        var views = new java.util.ArrayList<Map<String, Object>>();
        for (JsonNode n : EspoEntities.items(list)) views.add(buildInviteView(n, tenant));
        return ResponseEntity.ok(Map.of("invites", views));
    }

    @DeleteMapping("/meetings/{meetingId}/invites/{token}")
    public ResponseEntity<?> revoke(@PathVariable String meetingId, @PathVariable String token) {
        service.revoke(token);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    private Map<String, Object> buildInviteView(JsonNode row, String tenant) {
        Map<String, Object> m = new HashMap<>();
        m.put("id",             row.path("id").asText(null));
        m.put("token",          row.path("token").asText(null));
        m.put("invitedEmail",   row.path("invitedEmail").asText(null));
        m.put("invitedName",    row.path("invitedName").asText(null));
        m.put("linkType",       row.path("linkType").asText(null));
        m.put("expiresAt",      row.path("expiresAt").asText(null));
        m.put("usedAt",         row.path("usedAt").asText(null));
        m.put("createdAt",      row.path("createdAt").asText(null));
        m.put("meetingId",      row.path("parentMeetingId").asText(null));
        m.put("url",            service.urlFor(tenant, row.path("token").asText(null)));
        return m;
    }
}
