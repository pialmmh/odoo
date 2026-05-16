package com.telcobright.seeddata.cli;

import java.nio.file.Path;

public record SeedRequest(
        String app,
        String version,
        String dbHost,
        int dbPort,
        String dbUser,
        String dbPassword,
        String adminDb,
        String dbName,
        String tenant,
        boolean withDemo,
        boolean forceRecreate,
        Path dataDir
) {
    public String adminJdbcUrl() {
        return "jdbc:postgresql://" + dbHost + ":" + dbPort + "/" + adminDb;
    }

    public String targetJdbcUrl() {
        return "jdbc:postgresql://" + dbHost + ":" + dbPort + "/" + dbName;
    }
}
