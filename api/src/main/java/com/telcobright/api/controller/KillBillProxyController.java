package com.telcobright.api.controller;

import com.telcobright.api.config.KillBillProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

/**
 * Pass-through proxy for Kill Bill REST API.
 * Forwards /api/kb/** to Kill Bill at localhost:18080/1.0/kb/**
 */
@RestController
@RequestMapping("/api/kb")
@CrossOrigin(origins = "*")
public class KillBillProxyController {

    private static final Logger log = LoggerFactory.getLogger(KillBillProxyController.class);

    private final KillBillProperties props;
    private final RestTemplate restTemplate = new RestTemplate();

    public KillBillProxyController(KillBillProperties props) {
        this.props = props;
    }

    @RequestMapping(value = "/**", method = {RequestMethod.GET, RequestMethod.POST,
            RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH})
    public ResponseEntity<byte[]> proxy(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        try {
            String path = request.getRequestURI().substring("/api/kb".length());
            String query = request.getQueryString();
            String targetUrl = props.getUrl() + "/1.0/kb" + path + (query != null ? "?" + query : "");

            HttpHeaders headers = new HttpHeaders();
            Collections.list(request.getHeaderNames()).forEach(name -> {
                if (!name.equalsIgnoreCase("host") && !name.equalsIgnoreCase("connection")) {
                    headers.add(name, request.getHeader(name));
                }
            });

            // Add KB auth if not present
            if (!headers.containsKey("Authorization")) {
                headers.setBasicAuth(props.getUsername(), props.getPassword());
            }

            HttpEntity<byte[]> entity = new HttpEntity<>(body, headers);
            HttpMethod method = HttpMethod.valueOf(request.getMethod());

            ResponseEntity<byte[]> response = restTemplate.exchange(targetUrl, method, entity, byte[].class);
            return ResponseEntity.status(response.getStatusCode())
                    .headers(response.getHeaders())
                    .body(response.getBody());

        } catch (Exception e) {
            log.error("Kill Bill proxy error: {}", e.getMessage());
            return ResponseEntity.status(502)
                    .body(("{\"error\":\"killbill_proxy_error\",\"message\":\"" + e.getMessage() + "\"}").getBytes());
        }
    }
}
