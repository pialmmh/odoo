package com.telcobright.api.livekit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Talks to LiveKit's Egress service over the Twirp/HTTP+JSON interface.
 * Endpoints: {@code {http-url}/twirp/livekit.Egress/{Method}}.
 *
 * Auth is a short-lived JWT signed with the same HS256 secret we use for
 * participant tokens, carrying the {@code roomAdmin} + {@code roomRecord}
 * video grants. No io.livekit Java SDK needed (keeps consistent with the
 * jjwt-only approach in LiveKitTokenService).
 *
 * Ported from standalone livekit-meet; adapted to live under
 * com.telcobright.api.livekit alongside LiveKitTokenService.
 */
@Service
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class EgressService {
    private static final Logger log = LoggerFactory.getLogger(EgressService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final LiveKitProperties props;
    private final RestTemplate http = new RestTemplate();

    public EgressService(LiveKitProperties props) {
        this.props = props;
    }

    /**
     * Start a room-composite MP4 recording. The egress worker will render the
     * room via headless Chrome + grid layout, encode to MP4, and write to
     * {@code filepath} (which must be the path *inside* the egress container —
     * typically under {@link LiveKitProperties#getRecordingsDirEgress()}).
     */
    public StartResult startRoomComposite(String roomName, String filepath) {
        ObjectNode req = MAPPER.createObjectNode();
        req.put("room_name", roomName);
        req.put("layout", "grid");
        req.put("audio_only", false);
        req.put("video_only", false);
        ArrayNode files = req.putArray("file_outputs");
        ObjectNode f = files.addObject();
        f.put("filepath", filepath);
        f.put("disable_manifest", true);
        f.put("file_type", "MP4");

        JsonNode res = call("StartRoomCompositeEgress", req, roomName);
        return new StartResult(
                res.path("egress_id").asText(),
                res.path("room_id").asText(),
                res.path("status").asText("EGRESS_STARTING")
        );
    }

    public void stop(String egressId, String roomName) {
        ObjectNode req = MAPPER.createObjectNode();
        req.put("egress_id", egressId);
        call("StopEgress", req, roomName);
    }

    /** Returns each egress info as raw JSON (includes status, file_results[].size / duration). */
    public List<JsonNode> list(String roomName, String egressId) {
        ObjectNode req = MAPPER.createObjectNode();
        if (roomName != null && !roomName.isBlank()) req.put("room_name", roomName);
        if (egressId != null && !egressId.isBlank()) req.put("egress_id", egressId);
        JsonNode res = call("ListEgress", req, roomName);
        List<JsonNode> items = new ArrayList<>();
        for (JsonNode n : res.path("items")) items.add(n);
        return items;
    }

    private JsonNode call(String method, ObjectNode body, String roomForToken) {
        String url = props.getHttpUrl() + "/twirp/livekit.Egress/" + method;
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(adminToken(roomForToken));
        try {
            ResponseEntity<String> resp = http.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body.toString(), h), String.class);
            return MAPPER.readTree(resp.getBody());
        } catch (HttpStatusCodeException e) {
            log.error("Egress call {} failed: status={} body={}", method,
                    e.getStatusCode(), e.getResponseBodyAsString());
            throw new EgressException(method + " failed: " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new EgressException(method + " failed: " + e.getMessage(), e);
        }
    }

    private String adminToken(String room) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(60);
        Map<String, Object> video = new HashMap<>();
        video.put("roomAdmin", true);
        video.put("roomRecord", true);
        if (room != null && !room.isBlank()) video.put("room", room);
        SecretKeySpec key = new SecretKeySpec(
                props.getApiSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return Jwts.builder()
                .issuer(props.getApiKey())
                .subject("egress-admin")
                .issuedAt(Date.from(now))
                .notBefore(Date.from(now))
                .expiration(Date.from(exp))
                .claim("video", video)
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public record StartResult(String egressId, String roomId, String status) {}

    public static class EgressException extends RuntimeException {
        public EgressException(String msg, Throwable cause) { super(msg, cause); }
    }
}
