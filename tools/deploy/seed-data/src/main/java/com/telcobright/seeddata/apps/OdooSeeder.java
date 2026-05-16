package com.telcobright.seeddata.apps;

import com.telcobright.seeddata.cli.SeedRequest;
import com.telcobright.seeddata.core.DbProvisioner;
import com.telcobright.seeddata.core.JsonOverlay;
import com.telcobright.seeddata.core.SeedResult;
import com.telcobright.seeddata.core.Seeder;
import com.telcobright.seeddata.core.SqlRunner;

import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.CodeSource;
import java.sql.Connection;
import java.util.Map;

public class OdooSeeder implements Seeder {

    @Override
    public SeedResult run(SeedRequest req) throws Exception {
        Path appDir = resolveAppDir(req);
        if (!Files.isDirectory(appDir)) {
            throw new IllegalStateException("data dir not found: " + appDir);
        }
        Path pristine = appDir.resolve("pristine.sql.gz");
        Path seed = appDir.resolve("seed.sql.gz");
        Path demo = appDir.resolve("demo.sql.gz");
        Path overlay = appDir.resolve("tenant-overlay.json.tmpl");

        SeedResult result = new SeedResult();
        result.dbName = req.dbName();

        try (Connection admin = DbProvisioner.connect(req.adminJdbcUrl(), req.dbUser(), req.dbPassword())) {
            if (DbProvisioner.databaseExists(admin, req.dbName())) {
                if (!req.forceRecreate()) {
                    throw new DbProvisioner.DbExistsException(req.dbName());
                }
                DbProvisioner.dropDatabase(admin, req.dbName());
            }
            DbProvisioner.createDatabase(admin, req.dbName());
        }

        try (Connection conn = DbProvisioner.connect(req.targetJdbcUrl(), req.dbUser(), req.dbPassword())) {
            conn.setAutoCommit(false);
            if (Files.exists(pristine)) {
                int n = SqlRunner.runFile(conn, pristine);
                conn.commit();
                result.record("pristine", n);
            }
            if (Files.exists(seed)) {
                int n = SqlRunner.runFile(conn, seed);
                conn.commit();
                result.record("seed", n);
            }
            if (Files.exists(overlay)) {
                int n = JsonOverlay.apply(conn, overlay, Map.of(
                        "tenant", req.tenant(),
                        "db_name", req.dbName(),
                        "version", req.version()
                ));
                conn.commit();
                result.record("overlay", n);
            }
            if (req.withDemo() && Files.exists(demo)) {
                int n = SqlRunner.runFile(conn, demo);
                conn.commit();
                result.record("demo", n);
            }
        }
        return result;
    }

    private Path resolveAppDir(SeedRequest req) throws URISyntaxException {
        if (req.dataDir() != null) {
            return req.dataDir().resolve(req.app()).resolve(req.version());
        }
        String prop = System.getProperty("seed.data.dir");
        if (prop != null) {
            return Path.of(prop).resolve(req.app()).resolve(req.version());
        }
        // Fall back to data/ next to the jar.
        CodeSource cs = OdooSeeder.class.getProtectionDomain().getCodeSource();
        Path jarPath = Path.of(cs.getLocation().toURI());
        Path home = jarPath.getParent().getParent(); // target/seed-data.jar -> project root
        return home.resolve("data").resolve(req.app()).resolve(req.version());
    }
}
