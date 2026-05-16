package com.telcobright.seeddata.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;

/**
 * Renders a tenant-overlay.json.tmpl file ({@code {{name}}}-style placeholders),
 * then executes the resulting SQL statements. Template format:
 *
 * <pre>{
 *   "sql": [
 *     "UPDATE res_company SET name = '{{tenant}}' WHERE id = 1;",
 *     ...
 *   ]
 * }</pre>
 */
public final class JsonOverlay {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JsonOverlay() {}

    public static int apply(Connection conn, Path tmpl, Map<String, String> vars) throws IOException, SQLException {
        if (!Files.exists(tmpl)) return 0;
        String raw = Files.readString(tmpl);
        String rendered = render(raw, vars);
        JsonNode root = MAPPER.readTree(rendered);
        JsonNode sqlArray = root.path("sql");
        int executed = 0;
        try (Statement st = conn.createStatement()) {
            // pg_dump emits set_config('search_path','',false) — restore a sane
            // search_path so unqualified overlay statements still resolve.
            st.execute("SET search_path TO public, pg_catalog");
            for (JsonNode node : sqlArray) {
                String stmt = node.asText().trim();
                if (stmt.isEmpty()) continue;
                if (stmt.endsWith(";")) stmt = stmt.substring(0, stmt.length() - 1);
                st.execute(stmt);
                executed++;
            }
        }
        return executed;
    }

    static String render(String src, Map<String, String> vars) {
        String out = src;
        for (Map.Entry<String, String> e : vars.entrySet()) {
            out = out.replace("{{" + e.getKey() + "}}", e.getValue());
        }
        return out;
    }
}
