package com.telcobright.seeddata.cli;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public final class Args {

    public static final class UsageError extends RuntimeException {
        public UsageError(String msg) { super(msg); }
    }

    private Args() {}

    public static SeedRequest parse(String app, String[] argv) {
        Map<String, String> kv = new HashMap<>();
        boolean withDemo = false;
        boolean forceRecreate = false;

        for (int i = 0; i < argv.length; i++) {
            String a = argv[i];
            if (a.equals("--help") || a.equals("-h")) {
                System.out.println(usage());
                System.exit(0);
            }
            if (!a.startsWith("--")) {
                throw new UsageError("unexpected token: " + a);
            }
            String key = a.substring(2);
            if (key.equals("with-demo")) { withDemo = true; continue; }
            if (key.equals("force-recreate")) { forceRecreate = true; continue; }
            if (i + 1 >= argv.length) {
                throw new UsageError("missing value for --" + key);
            }
            kv.put(key, argv[++i]);
        }

        String dbHost = required(kv, "db-host");
        int dbPort = Integer.parseInt(required(kv, "db-port"));
        String dbUser = required(kv, "db-user");
        String dbPassword = readPassword(kv);
        String adminDb = kv.getOrDefault("admin-db", "postgres");
        String dbName = required(kv, "db-name");
        String tenant = required(kv, "tenant");
        String version = required(kv, "version");
        Path dataDir = kv.containsKey("data-dir") ? Path.of(kv.get("data-dir")) : null;

        return new SeedRequest(
                app, version,
                dbHost, dbPort, dbUser, dbPassword, adminDb,
                dbName, tenant, withDemo, forceRecreate, dataDir
        );
    }

    private static String required(Map<String, String> kv, String key) {
        String v = kv.get(key);
        if (v == null || v.isBlank()) {
            throw new UsageError("--" + key + " is required");
        }
        return v;
    }

    private static String readPassword(Map<String, String> kv) {
        if (kv.containsKey("db-password")) {
            return kv.get("db-password");
        }
        if (kv.containsKey("db-password-env")) {
            String envName = kv.get("db-password-env");
            String v = System.getenv(envName);
            if (v == null) throw new UsageError("env var " + envName + " is not set");
            return v;
        }
        throw new UsageError("either --db-password or --db-password-env is required");
    }

    public static String usage() {
        return """
                usage: seed-<app> [options]

                Required:
                  --db-host <host>            target Postgres host
                  --db-port <port>            target Postgres port
                  --db-user <user>            DB superuser (or role with CREATEDB)
                  --db-password <pw>          DB password (insecure; prefer --db-password-env)
                  --db-password-env <NAME>    read password from env var NAME
                  --db-name <name>            target DB to create
                  --tenant <short>            tenant short name (used in overlay templating)
                  --version <ver>             which artifact bundle (e.g. v19)

                Optional:
                  --admin-db <name>           bootstrap DB to connect to for CREATE DATABASE (default: postgres)
                  --data-dir <path>           override location of data/<app>/<version>/
                  --with-demo                 also load demo.sql.gz after seed
                  --force-recreate            DROP target DB if exists, then recreate
                """;
    }
}
