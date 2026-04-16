package com.telcobright.api.controller;

import com.telcobright.api.espo.EspoClient;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

/**
 * Generic passthrough to EspoCRM.
 *
 * React calls:  /api/crm/**   (any method)
 * Forwarded to: {integrations.crm.base-url}/api/v1/**
 *
 * Only active when integrations.crm.enabled=true (otherwise 404 on /api/crm/**).
 */
@RestController
@RequestMapping("/api/crm")
@ConditionalOnProperty(name = "integrations.crm.enabled", havingValue = "true")
public class EspoProxyController {

    private final EspoClient espo;

    public EspoProxyController(EspoClient espo) {
        this.espo = espo;
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("crm_enabled", true));
    }

    @RequestMapping(
            value = "/**",
            method = {
                    RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
                    RequestMethod.DELETE, RequestMethod.PATCH
            }
    )
    public ResponseEntity<byte[]> proxy(HttpServletRequest req) throws IOException {
        String path = req.getRequestURI().replaceFirst("^/api/crm", "");
        String qs = req.getQueryString();
        String body = req.getReader().lines().reduce("", (a, b) -> a + b);
        String accept = req.getHeader("Accept");
        return espo.forward(req.getMethod(), path, qs, body, accept);
    }
}
