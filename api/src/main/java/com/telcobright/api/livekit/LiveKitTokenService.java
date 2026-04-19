package com.telcobright.api.livekit;

import com.telcobright.api.config.LiveKitProperties;
import io.jsonwebtoken.Jwts;
import org.springframework.stereotype.Service;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Mints LiveKit access tokens (HS256 JWTs) server-side.
 *
 * LiveKit accepts a standard JWT with a {@code video} claim describing the
 * grants. The browser never sees the API secret — it receives only the
 * short-lived JWT produced here. See livekit-installation-info.md §3.
 *
 * Role → grants mapping:
 *
 *   PUBLISHER      canPublish=true,  canSubscribe=true,  hidden=false
 *   SUBSCRIBER     canPublish=false, canSubscribe=true,  hidden=false
 *   ADMIN_SILENT   canPublish=false, canSubscribe=true,  hidden=true   (invisible to attendees)
 *   ADMIN_COACH    canPublish=true,  canSubscribe=true,  hidden=true   (host hears them; attendees don't)
 *   ADMIN_BARGE    canPublish=true,  canSubscribe=true,  hidden=false  (visible)
 *   ADMIN_TAKEOVER canPublish=true,  canSubscribe=true,  hidden=false, roomAdmin=true
 *
 * Note: "host-only audio" for COACH cannot be enforced by LiveKit grants
 * alone — it requires a companion server agent that re-subscribes admin
 * audio only to the host participant. Until that's wired, COACH currently
 * publishes to everyone. UI surfaces this; documented for the agent work.
 */
@Service
public class LiveKitTokenService {

    private final LiveKitProperties props;

    public LiveKitTokenService(LiveKitProperties props) {
        this.props = props;
    }

    public Result issue(String roomName, String identity, String displayName, String role) {
        if (!props.isEnabled()) {
            throw new IllegalStateException("livekit.enabled=false");
        }
        Grants g = grantsForRole(role);

        Instant now = Instant.now();
        Instant exp = now.plusSeconds(props.getTokenTtlSeconds());

        Map<String, Object> video = new HashMap<>();
        video.put("room", roomName);
        video.put("roomJoin", true);
        video.put("canPublish", g.canPublish);
        video.put("canSubscribe", g.canSubscribe);
        video.put("canPublishData", true);
        video.put("hidden", g.hidden);
        if (g.roomAdmin) {
            video.put("roomAdmin", true);
            video.put("roomRecord", true);
        }

        byte[] keyBytes = props.getApiSecret().getBytes(StandardCharsets.UTF_8);
        SecretKeySpec key = new SecretKeySpec(keyBytes, "HmacSHA256");

        String jti = identity + "-" + UUID.randomUUID();

        String jwt = Jwts.builder()
                .issuer(props.getApiKey())
                .subject(identity)
                .id(jti)
                .issuedAt(java.util.Date.from(now))
                .notBefore(java.util.Date.from(now))
                .expiration(java.util.Date.from(exp))
                .claim("name", displayName != null ? displayName : identity)
                .claim("video", video)
                .signWith(key, Jwts.SIG.HS256)
                .compact();

        return new Result(jwt, props.getWsUrl(), roomName, identity, exp.toEpochMilli());
    }

    private Grants grantsForRole(String role) {
        String r = role == null ? "PUBLISHER" : role.toUpperCase();
        return switch (r) {
            case "SUBSCRIBER"     -> new Grants(false, true,  false, false);
            case "ADMIN_SILENT"   -> new Grants(false, true,  true,  false);
            case "ADMIN_COACH"    -> new Grants(true,  true,  true,  false);
            case "ADMIN_BARGE"    -> new Grants(true,  true,  false, false);
            case "ADMIN_TAKEOVER" -> new Grants(true,  true,  false, true);
            default               -> new Grants(true,  true,  false, false); // PUBLISHER
        };
    }

    private record Grants(boolean canPublish, boolean canSubscribe, boolean hidden, boolean roomAdmin) {}

    public record Result(String token, String wsUrl, String room, String identity, long expiresAtMs) {}
}
