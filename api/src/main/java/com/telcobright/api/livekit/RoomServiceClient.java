package com.telcobright.api.livekit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.telcobright.api.config.LiveKitProperties;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin wrapper around LiveKit's RoomService (Twirp/JSON).
 *
 * Endpoints used:
 *   MutePublishedTrack  — mute/unmute an existing published track by sid
 *   UpdateParticipant   — flip permissions / metadata
 *   RemoveParticipant   — kick a participant from the room
 *   ListParticipants    — enumerate participants + their published tracks
 *
 * Auth uses the same jjwt HS256 pattern as participant tokens, with the
 * {@code roomAdmin} grant on the target room.
 */
@Service
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class RoomServiceClient {
    private static final Logger log = LoggerFactory.getLogger(RoomServiceClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final LiveKitProperties props;
    private final RestTemplate http = new RestTemplate();

    public RoomServiceClient(LiveKitProperties props) {
        this.props = props;
    }

    /** Mute or unmute a published track. */
    public JsonNode mutePublishedTrack(String room, String identity, String trackSid, boolean muted) {
        ObjectNode req = MAPPER.createObjectNode();
        req.put("room", room);
        req.put("identity", identity);
        req.put("track_sid", trackSid);
        req.put("muted", muted);
        return call("MutePublishedTrack", req, room);
    }

    /** Kick a participant. */
    public JsonNode removeParticipant(String room, String identity) {
        ObjectNode req = MAPPER.createObjectNode();
        req.put("room", room);
        req.put("identity", identity);
        return call("RemoveParticipant", req, room);
    }

    /** Strip a participant's publish permission (effective "mute all") without kicking. */
    public JsonNode disablePublish(String room, String identity) {
        ObjectNode permission = MAPPER.createObjectNode();
        permission.put("can_publish", false);
        permission.put("can_subscribe", true);
        permission.put("can_publish_data", false);
        ObjectNode req = MAPPER.createObjectNode();
        req.put("room", room);
        req.put("identity", identity);
        req.set("permission", permission);
        return call("UpdateParticipant", req, room);
    }

    public List<JsonNode> listParticipants(String room) {
        ObjectNode req = MAPPER.createObjectNode();
        req.put("room", room);
        JsonNode res = call("ListParticipants", req, room);
        List<JsonNode> out = new java.util.ArrayList<>();
        for (JsonNode n : res.path("participants")) out.add(n);
        return out;
    }

    private JsonNode call(String method, ObjectNode body, String room) {
        String url = props.getHttpUrl() + "/twirp/livekit.RoomService/" + method;
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(adminToken(room));
        try {
            ResponseEntity<String> r = http.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body.toString(), h), String.class);
            return MAPPER.readTree(r.getBody() == null || r.getBody().isEmpty() ? "{}" : r.getBody());
        } catch (HttpStatusCodeException e) {
            log.error("RoomService {} failed: status={} body={}",
                    method, e.getStatusCode(), e.getResponseBodyAsString());
            throw new RoomServiceException(method + ": " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RoomServiceException(method + ": " + e.getMessage(), e);
        }
    }

    private String adminToken(String room) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(60);
        Map<String, Object> video = new HashMap<>();
        video.put("roomAdmin", true);
        if (room != null && !room.isBlank()) video.put("room", room);
        SecretKeySpec key = new SecretKeySpec(
                props.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return Jwts.builder()
                .issuer(props.getApiKey())
                .subject("rs-admin")
                .issuedAt(Date.from(now))
                .notBefore(Date.from(now))
                .expiration(Date.from(exp))
                .claim("video", video)
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public static class RoomServiceException extends RuntimeException {
        public RoomServiceException(String msg, Throwable cause) { super(msg, cause); }
    }
}
