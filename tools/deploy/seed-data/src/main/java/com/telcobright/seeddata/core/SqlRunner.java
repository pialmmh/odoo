package com.telcobright.seeddata.core;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.zip.GZIPInputStream;

public final class SqlRunner {

    private SqlRunner() {}

    public static int runFile(Connection conn, Path file) throws IOException, SQLException {
        try (InputStream raw = Files.newInputStream(file);
             InputStream in = file.toString().endsWith(".gz") ? new GZIPInputStream(raw) : raw;
             BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            return executeScript(conn, br);
        }
    }

    static int executeScript(Connection conn, BufferedReader br) throws IOException, SQLException {
        StringBuilder buf = new StringBuilder(8192);
        boolean inSingleQuote = false;
        boolean inLineComment = false;
        boolean inBlockComment = false;
        String dollarTag = null;
        int executed = 0;

        try (Statement st = conn.createStatement()) {
            int c;
            while ((c = br.read()) != -1) {
                char ch = (char) c;
                char next = peek(br);

                // dollar-quote handling (e.g. $$ ... $$ for plpgsql bodies)
                if (!inSingleQuote && !inLineComment && !inBlockComment && ch == '$') {
                    String tag = readDollarTag(br, ch);
                    if (tag != null) {
                        buf.append(tag);
                        if (dollarTag == null) {
                            dollarTag = tag;
                        } else if (dollarTag.equals(tag)) {
                            dollarTag = null;
                        }
                        continue;
                    }
                }

                if (dollarTag != null) {
                    buf.append(ch);
                    continue;
                }

                if (inLineComment) {
                    if (ch == '\n') inLineComment = false;
                    buf.append(ch);
                    continue;
                }
                if (inBlockComment) {
                    buf.append(ch);
                    if (ch == '*' && next == '/') {
                        buf.append((char) br.read());
                        inBlockComment = false;
                    }
                    continue;
                }
                if (inSingleQuote) {
                    buf.append(ch);
                    if (ch == '\'') {
                        if (next == '\'') {
                            buf.append((char) br.read()); // escaped quote
                        } else {
                            inSingleQuote = false;
                        }
                    }
                    continue;
                }

                // skip psql meta-commands at start of line
                if (ch == '\\' && (buf.length() == 0 || buf.charAt(buf.length() - 1) == '\n')) {
                    skipLine(br);
                    continue;
                }

                if (ch == '-' && next == '-') {
                    inLineComment = true;
                    buf.append(ch);
                    continue;
                }
                if (ch == '/' && next == '*') {
                    inBlockComment = true;
                    buf.append(ch);
                    continue;
                }
                if (ch == '\'') {
                    inSingleQuote = true;
                    buf.append(ch);
                    continue;
                }

                if (ch == ';') {
                    String stmt = buf.toString().trim();
                    buf.setLength(0);
                    if (!stmt.isEmpty()) {
                        st.execute(stmt);
                        executed++;
                    }
                    continue;
                }

                buf.append(ch);
            }

            String tail = buf.toString().trim();
            if (!tail.isEmpty()) {
                st.execute(tail);
                executed++;
            }
        }
        return executed;
    }

    private static char peek(BufferedReader br) throws IOException {
        br.mark(1);
        int n = br.read();
        if (n == -1) return '\0';
        br.reset();
        return (char) n;
    }

    private static void skipLine(BufferedReader br) throws IOException {
        int c;
        while ((c = br.read()) != -1 && c != '\n') { /* drop */ }
    }

    private static String readDollarTag(BufferedReader br, char first) throws IOException {
        // We've read one '$'. Look ahead for [tag]$ or just $.
        br.mark(256);
        StringBuilder tag = new StringBuilder().append(first);
        int c;
        while ((c = br.read()) != -1) {
            char ch = (char) c;
            tag.append(ch);
            if (ch == '$') return tag.toString();
            if (!Character.isLetterOrDigit(ch) && ch != '_') {
                br.reset();
                return null;
            }
            if (tag.length() > 64) {
                br.reset();
                return null;
            }
        }
        br.reset();
        return null;
    }
}
