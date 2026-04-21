package com.telcobright.api.meetings;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.telcobright.api.espo.EspoClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Thin wrapper around {@link EspoClient} that handles the
 * "build JSON / parse JSON / build EspoCRM query string" ceremony so
 * controllers can stay concise. Not a full ORM — just boilerplate shedding.
 *
 * Every method returns a Jackson {@link JsonNode}; callers read the fields
 * they care about. EspoCRM REST responses for custom entities follow the
 * standard shape: list = {"total":N,"list":[...]}, single = {...fields...}.
 */
@Component
@ConditionalOnProperty(name = "integrations.crm.enabled", havingValue = "true")
public class EspoEntities {
    private final EspoClient espo;
    private final ObjectMapper mapper = new ObjectMapper();

    public EspoEntities(EspoClient espo) {
        this.espo = espo;
    }

    public ObjectMapper mapper() { return mapper; }

    /** GET /{entity}/{id} → null when 404. */
    public Optional<JsonNode> get(String entity, String id) {
        ResponseEntity<byte[]> r = espo.forward("GET",
                "/" + entity + "/" + id, null, null, "application/json");
        if (!r.getStatusCode().is2xxSuccessful()) return Optional.empty();
        return Optional.ofNullable(parse(r.getBody()));
    }

    /** GET /{entity}?{equalityFilters...}&orderBy=...&order=... */
    public JsonNode list(String entity, Map<String, String> equals, String orderBy, boolean desc) {
        StringBuilder qs = new StringBuilder();
        int i = 0;
        if (equals != null) {
            for (Map.Entry<String, String> e : equals.entrySet()) {
                if (i > 0) qs.append('&');
                qs.append("where[").append(i).append("][type]=equals")
                        .append("&where[").append(i).append("][attribute]=").append(e.getKey())
                        .append("&where[").append(i).append("][value]=").append(urlEnc(e.getValue()));
                i++;
            }
        }
        if (orderBy != null) {
            if (qs.length() > 0) qs.append('&');
            qs.append("orderBy=").append(urlEnc(orderBy))
                    .append("&order=").append(desc ? "desc" : "asc");
        }
        ResponseEntity<byte[]> r = espo.forward("GET",
                "/" + entity, qs.toString(), null, "application/json");
        return parse(r.getBody());
    }

    public JsonNode create(String entity, ObjectNode payload) {
        ResponseEntity<byte[]> r = espo.forward("POST",
                "/" + entity, null, payload.toString(), "application/json");
        return parse(r.getBody());
    }

    public JsonNode update(String entity, String id, ObjectNode payload) {
        ResponseEntity<byte[]> r = espo.forward("PUT",
                "/" + entity + "/" + id, null, payload.toString(), "application/json");
        return parse(r.getBody());
    }

    public void delete(String entity, String id) {
        espo.forward("DELETE",
                "/" + entity + "/" + id, null, null, "application/json");
    }

    private JsonNode parse(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return null;
        try {
            return mapper.readTree(new String(bytes, StandardCharsets.UTF_8));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Invalid JSON from EspoCRM: " + e.getMessage(), e);
        }
    }

    private static String urlEnc(String s) {
        return java.net.URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }

    /** Iterate a list response's "list" array. Safe on null / non-array. */
    public static Iterable<JsonNode> items(JsonNode listResponse) {
        if (listResponse == null || !listResponse.has("list") || !listResponse.get("list").isArray()) {
            return java.util.Collections::emptyIterator;
        }
        return listResponse.get("list");
    }

    /** Empty ObjectNode factory (saves controllers importing ObjectMapper). */
    public ObjectNode newObject() { return mapper.createObjectNode(); }
}
