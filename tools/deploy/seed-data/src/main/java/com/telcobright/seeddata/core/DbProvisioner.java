package com.telcobright.seeddata.core;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public final class DbProvisioner {

    public static final class DbExistsException extends RuntimeException {
        public DbExistsException(String msg) { super(msg); }
    }

    private DbProvisioner() {}

    public static Connection connect(String jdbcUrl, String user, String password) throws SQLException {
        return DriverManager.getConnection(jdbcUrl, user, password);
    }

    public static boolean databaseExists(Connection adminConn, String dbName) throws SQLException {
        try (PreparedStatement ps = adminConn.prepareStatement(
                "SELECT 1 FROM pg_database WHERE datname = ?")) {
            ps.setString(1, dbName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public static void createDatabase(Connection adminConn, String dbName) throws SQLException {
        validateIdentifier(dbName);
        try (Statement s = adminConn.createStatement()) {
            s.executeUpdate("CREATE DATABASE \"" + dbName + "\" ENCODING 'UTF8' TEMPLATE template0");
        }
    }

    public static void dropDatabase(Connection adminConn, String dbName) throws SQLException {
        validateIdentifier(dbName);
        try (Statement s = adminConn.createStatement()) {
            s.executeUpdate("DROP DATABASE IF EXISTS \"" + dbName + "\"");
        }
    }

    private static void validateIdentifier(String name) {
        if (name == null || !name.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new IllegalArgumentException("invalid DB identifier: " + name);
        }
    }
}
