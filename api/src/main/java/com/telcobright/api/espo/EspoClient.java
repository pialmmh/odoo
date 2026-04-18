package com.telcobright.api.espo;

import com.telcobright.api.config.EspoProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/**
 * Thin forwarder to EspoCRM REST. Injects X-Api-Key and passes method/path/qs/body 1:1.
 * No per-entity logic — same philosophy as OdooClient.call.
 */
@Component
@ConditionalOnProperty(name = "integrations.crm.enabled", havingValue = "true")
public class EspoClient {

    private static final Logger log = LoggerFactory.getLogger(EspoClient.class);

    private final EspoProperties props;
    private final HttpClient http;

    public EspoClient(EspoProperties props) {
        this.props = props;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public ResponseEntity<byte[]> forward(String method, String path, String queryString,
                                          String body, String accept) {
        String url = props.getBaseUrl() + "/api/v1" + (path.startsWith("/") ? path : "/" + path);
        if (queryString != null && !queryString.isEmpty()) {
            url += "?" + queryString;
        }

        HttpRequest.Builder rb = HttpRequest.newBuilder(URI.create(url))
                .header(HttpHeaders.ACCEPT, accept != null ? accept : MediaType.APPLICATION_JSON_VALUE)
                .timeout(Duration.ofSeconds(30));

        // Auth: prefer admin Basic (works for admin endpoints too); fall back
        // to X-Api-Key if configured. See EspoProperties for why.
        String adminUser = props.getAdminUser();
        String adminPassword = props.getAdminPassword();
        if (adminUser != null && !adminUser.isEmpty()
                && adminPassword != null && !adminPassword.isEmpty()) {
            String token = Base64.getEncoder().encodeToString(
                    (adminUser + ":" + adminPassword).getBytes(StandardCharsets.UTF_8));
            rb.header(HttpHeaders.AUTHORIZATION, "Basic " + token);
        } else if (props.getApiKey() != null && !props.getApiKey().isEmpty()) {
            rb.header("X-Api-Key", props.getApiKey());
        }

        // Note: for multi-tenant routing (bootstrap.php uses Host's subdomain
        // prefix), set base-url directly — e.g. http://btcl.localhost:7081 —
        // rather than overriding the Host header. Java's HttpClient treats
        // Host as a restricted header.

        HttpRequest.BodyPublisher pub = (body == null || body.isEmpty())
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8);

        if (body != null && !body.isEmpty()) {
            rb.header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        }

        rb.method(method.toUpperCase(), pub);

        try {
            HttpResponse<byte[]> resp = http.send(rb.build(), HttpResponse.BodyHandlers.ofByteArray());
            String ct = resp.headers().firstValue(HttpHeaders.CONTENT_TYPE)
                    .orElse(MediaType.APPLICATION_JSON_VALUE);
            return ResponseEntity.status(resp.statusCode())
                    .header(HttpHeaders.CONTENT_TYPE, ct)
                    .body(resp.body());
        } catch (Exception e) {
            log.error("EspoCRM forward error: {} {} — {}", method, url, e.getMessage());
            String err = ("{\"error\":\"crm_forward_error\",\"message\":\""
                    + e.getMessage() + "\"}").replace("\n", " ");
            return ResponseEntity.status(502)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(err.getBytes(StandardCharsets.UTF_8));
        }
    }
}
