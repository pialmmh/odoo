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
 * Experimental app-to-app call/meeting rooms on LiveKit — kept separate
 * from MeetingsController so we can iterate on the spike without touching
 * production meeting semantics. Scope is WebRTC-to-WebRTC only; PSTN/SIP
 * via livekit-sip is deliberately out of scope for this experiment.
 *
 *   POST /api/crm/call-room-exp/token  → mint LiveKit JWT for a room
 *
 * Only active when livekit.enabled=true.
 */
@RestController
@RequestMapping("/api/crm/call-room-exp")
@ConditionalOnProperty(name = "livekit.enabled", havingValue = "true")
public class CallRoomExperimentController {

    private final LiveKitTokenService tokens;

    public CallRoomExperimentController(LiveKitTokenService tokens) {
        this.tokens = tokens;
    }

    @PostMapping("/token")
    public ResponseEntity<?> issueToken(@RequestBody(required = false) TokenRequest req) {
        TokenRequest r = req != null ? req : new TokenRequest();
        String roomName = r.roomName != null && !r.roomName.isBlank()
                ? r.roomName : "exp-call-spike";
        // LiveKit room names are URL-safe lower/upper/digits/-/_ — prefix to
        // avoid colliding with meeting rooms.
        String room = roomName.startsWith("call-exp-") ? roomName : "call-exp-" + roomName;

        String identity = r.identity != null && !r.identity.isBlank()
                ? r.identity
                : identityFromPrincipal();
        String displayName = r.name != null && !r.name.isBlank() ? r.name : identity;

        // Full publish+subscribe grant; this is an interactive voice room.
        LiveKitTokenService.Result res = tokens.issue(room, identity, displayName, "PUBLISHER");

        Map<String, Object> body = new HashMap<>();
        body.put("token", res.token());
        body.put("wsUrl", res.wsUrl());
        body.put("room", res.room());
        body.put("identity", res.identity());
        body.put("expiresAtMs", res.expiresAtMs());
        return ResponseEntity.ok(body);
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
        public String roomName;   // logical, e.g. "spike-1" → "call-exp-spike-1"
        public String identity;   // override principal
        public String name;       // display name
    }
}
