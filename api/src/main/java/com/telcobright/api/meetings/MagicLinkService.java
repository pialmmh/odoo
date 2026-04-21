package com.telcobright.api.meetings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.telcobright.api.config.LiveKitProperties;
import com.telcobright.api.livekit.LiveKitTokenService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Issues and resolves {@code MeetingMagicLink} rows in EspoCRM, and mints the
 * guest LiveKit JWT for a successful /join.
 *
 * Two link types — both rows of the same custom entity:
 *   PERSONAL : bound to an email address (pattern 3 invite)
 *   SHARE    : reusable public link (Zoom-style "copy invite link")
 */
@Service
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class MagicLinkService {
    private static final SecureRandom RNG = new SecureRandom();
    private static final String ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String SHARE_EMAIL_SENTINEL = "share@link";
    private static final long SHARE_TTL_SECONDS = 30L * 24 * 3600;

    private final EspoEntities esp;
    private final LiveKitTokenService tokens;
    private final LiveKitProperties props;

    public MagicLinkService(EspoEntities esp, LiveKitTokenService tokens, LiveKitProperties props) {
        this.esp = esp;
        this.tokens = tokens;
        this.props = props;
    }

    /** Personal invite — bound to an email; pre-fills the name on /join. */
    public JsonNode createPersonalInvite(String meetingId, String email, String name, Long ttlSeconds) {
        long ttl = ttlSeconds != null && ttlSeconds > 0 ? ttlSeconds : 7L * 24 * 3600;
        ObjectNode payload = esp.newObject();
        payload.put("name", "Invite — " + (email != null ? email : "guest"));
        payload.put("token", randomToken(24));
        payload.put("invitedEmail", email);
        if (name != null && !name.isBlank()) payload.put("invitedName", name);
        payload.put("expiresAt", formatDt(Instant.now().plusSeconds(ttl)));
        payload.put("linkType", "PERSONAL");
        payload.put("parentMeetingId", meetingId);
        payload.put("parentMeetingType", "Meeting");
        return esp.create("MeetingMagicLink", payload);
    }

    /** Share link — reusable; creates one if none exists, else returns the existing one. */
    public JsonNode getOrCreateShareLink(String meetingId) {
        JsonNode list = esp.list("MeetingMagicLink",
                Map.of("parentMeetingId", meetingId, "linkType", "SHARE"),
                "createdAt", true);
        Instant now = Instant.now();
        for (JsonNode n : EspoEntities.items(list)) {
            Instant expires = parseDt(n.path("expiresAt").asText(null));
            if (expires != null && expires.isAfter(now)) return n;
        }
        ObjectNode payload = esp.newObject();
        payload.put("name", "Share link");
        payload.put("token", randomToken(24));
        payload.put("invitedEmail", SHARE_EMAIL_SENTINEL);
        payload.put("expiresAt", formatDt(now.plusSeconds(SHARE_TTL_SECONDS)));
        payload.put("linkType", "SHARE");
        payload.put("parentMeetingId", meetingId);
        payload.put("parentMeetingType", "Meeting");
        return esp.create("MeetingMagicLink", payload);
    }

    public JsonNode listForMeeting(String meetingId) {
        return esp.list("MeetingMagicLink", Map.of("parentMeetingId", meetingId),
                "createdAt", true);
    }

    public void revoke(String token) {
        Optional<JsonNode> hit = findByToken(token);
        hit.ifPresent(n -> esp.delete("MeetingMagicLink", n.path("id").asText()));
    }

    public Optional<JsonNode> findByToken(String token) {
        JsonNode list = esp.list("MeetingMagicLink", Map.of("token", token), null, false);
        for (JsonNode n : EspoEntities.items(list)) return Optional.of(n);
        return Optional.empty();
    }

    /** Mark the magic link used (audit) and mint a guest LiveKit JWT. */
    public Map<String, Object> join(JsonNode link, String tenantSlug, String displayName) {
        // Mark used (audit trail — doesn't block future reuse for SHARE links).
        ObjectNode patch = esp.newObject();
        patch.put("usedAt", formatDt(Instant.now()));
        esp.update("MeetingMagicLink", link.path("id").asText(), patch);

        String meetingId = link.path("parentMeetingId").asText();
        String room = MeetingRoomNaming.roomName(tenantSlug, meetingId);
        String identity = "guest-" + randomToken(10);
        String name = (displayName != null && !displayName.isBlank())
                ? displayName
                : link.path("invitedName").asText(identity);

        LiveKitTokenService.Result res = tokens.issue(room, identity, name, "PUBLISHER");

        Map<String, Object> body = new HashMap<>();
        body.put("token", res.token());
        body.put("wsUrl", res.wsUrl());
        body.put("room", res.room());
        body.put("identity", res.identity());
        body.put("meetingId", meetingId);
        return body;
    }

    /** Public-facing URL to share with recipients. */
    public String urlFor(String tenantSlug, String token) {
        String base = props.getPublicBaseUrl();
        if (base == null || base.isBlank()) base = "";
        String tenantSeg = (tenantSlug == null || tenantSlug.isBlank()) ? "" : "/" + tenantSlug;
        return base + tenantSeg + "/join/" + token;
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private static String randomToken(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) sb.append(ALPHA.charAt(RNG.nextInt(ALPHA.length())));
        return sb.toString();
    }

    static String formatDt(Instant t) {
        // EspoCRM datetime format (UTC).
        return DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                .withZone(ZoneOffset.UTC)
                .format(t);
    }

    static Instant parseDt(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return ZonedDateTime.parse(
                    s.replace(' ', 'T') + "Z",
                    DateTimeFormatter.ISO_OFFSET_DATE_TIME
            ).toInstant();
        } catch (Exception e) {
            return null;
        }
    }
}
