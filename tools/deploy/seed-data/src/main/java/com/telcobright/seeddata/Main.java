package com.telcobright.seeddata;

import com.telcobright.seeddata.apps.OdooSeeder;
import com.telcobright.seeddata.apps.PlaneSeeder;
import com.telcobright.seeddata.cli.Args;
import com.telcobright.seeddata.cli.SeedRequest;
import com.telcobright.seeddata.core.DbProvisioner;
import com.telcobright.seeddata.core.SeedResult;
import com.telcobright.seeddata.core.Seeder;

import java.sql.SQLException;
import java.util.Arrays;

public final class Main {

    private static final int EXIT_OK = 0;
    private static final int EXIT_USAGE = 64;
    private static final int EXIT_EXISTS = 2;
    private static final int EXIT_CONNECT = 3;
    private static final int EXIT_SQL = 4;

    public static void main(String[] argv) {
        if (argv.length == 0) {
            System.err.println(Args.usage());
            System.exit(EXIT_USAGE);
        }
        String app = argv[0];
        if (app.equals("--help") || app.equals("-h")) {
            System.out.println(Args.usage());
            System.exit(EXIT_OK);
        }

        String[] rest = Arrays.copyOfRange(argv, 1, argv.length);
        SeedRequest req;
        try {
            req = Args.parse(app, rest);
        } catch (Args.UsageError e) {
            System.err.println("error: " + e.getMessage());
            System.err.println();
            System.err.println(Args.usage());
            System.exit(EXIT_USAGE);
            return;
        }

        Seeder seeder = switch (app) {
            case "odoo" -> new OdooSeeder();
            case "plane" -> new PlaneSeeder();
            default -> {
                System.err.println("unknown app: " + app);
                System.exit(EXIT_USAGE);
                yield null;
            }
        };

        long start = System.currentTimeMillis();
        try {
            SeedResult result = seeder.run(req);
            System.out.println(result.toJson(System.currentTimeMillis() - start));
            System.exit(EXIT_OK);
        } catch (DbProvisioner.DbExistsException e) {
            System.err.println("database already exists: " + e.getMessage() +
                    " (pass --force-recreate to drop and recreate)");
            System.exit(EXIT_EXISTS);
        } catch (SQLException e) {
            String state = e.getSQLState();
            if (state != null && state.startsWith("08")) {
                System.err.println("connect failed: " + e.getMessage());
                System.exit(EXIT_CONNECT);
            }
            System.err.println("sql failed [" + state + "]: " + e.getMessage());
            System.exit(EXIT_SQL);
        } catch (Exception e) {
            System.err.println("error: " + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(EXIT_SQL);
        }
    }

    private Main() {}
}
