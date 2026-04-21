package com.telcobright.api.meetings;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Public (unauthenticated) magic-link endpoints.
 *
 * Path includes the tenant slug because guests aren't in Keycloak and the
 * backend otherwise has no way to know which tenant's EspoCRM to query:
 *
 *   GET  /api/public/meeting/{tenant}/magic/{token}
 *        → { meetingId, meetingTitle?, invitedName, invitedEmail, expiresAt }
 *
 *   POST /api/public/meeting/{tenant}/join/{token}
 *        body: { displayName }
 *        → { token, wsUrl, room, identity, meetingId }
 *
 * These paths are whitelisted in {@code SecurityConfig}.
 */
@RestController
@RequestMapping("/api/public/meeting")
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class PublicJoinController {

    private final MagicLinkService service;

    public PublicJoinController(MagicLinkService service) {
        this.service = service;
    }

    public static class JoinRequest {
        @NotBlank public String displayName;
    }

    @GetMapping("/{tenant}/magic/{token}")
    public ResponseEntity<?> resolve(@PathVariable String tenant, @PathVariable String token) {
        Optional<JsonNode> hit = service.findByToken(token);
        if (hit.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "invalid link"));
        }
        JsonNode l = hit.get();
        Instant expires = MagicLinkService.parseDt(l.path("expiresAt").asText(null));
        if (expires != null && expires.isBefore(Instant.now())) {
            return ResponseEntity.status(410).body(Map.of("error", "link expired"));
        }

        Map<String, Object> body = new HashMap<>();
        body.put("meetingId",    l.path("parentMeetingId").asText(null));
        // meetingTitle: parent-fetching is optional; frontend can fetch /Meeting/:id
        // if authenticated, but here we stay public and minimal.
        body.put("invitedEmail", l.path("invitedEmail").asText(null));
        body.put("invitedName",  l.path("invitedName").asText(null));
        body.put("linkType",     l.path("linkType").asText(null));
        body.put("expiresAt",    l.path("expiresAt").asText(null));
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{tenant}/join/{token}")
    public ResponseEntity<?> join(@PathVariable String tenant,
                                  @PathVariable String token,
                                  @Valid @RequestBody JoinRequest req) {
        Optional<JsonNode> hit = service.findByToken(token);
        if (hit.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "invalid link"));
        }
        JsonNode l = hit.get();
        Instant expires = MagicLinkService.parseDt(l.path("expiresAt").asText(null));
        if (expires != null && expires.isBefore(Instant.now())) {
            return ResponseEntity.status(410).body(Map.of("error", "link expired"));
        }
        return ResponseEntity.ok(service.join(l, tenant, req.displayName));
    }
}
