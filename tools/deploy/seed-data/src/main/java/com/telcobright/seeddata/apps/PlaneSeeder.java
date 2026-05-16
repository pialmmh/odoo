package com.telcobright.seeddata.apps;

import com.telcobright.seeddata.cli.SeedRequest;
import com.telcobright.seeddata.core.SeedResult;
import com.telcobright.seeddata.core.Seeder;

public class PlaneSeeder implements Seeder {
    @Override
    public SeedResult run(SeedRequest req) {
        throw new UnsupportedOperationException(
                "PlaneSeeder is reserved for standalone Plane provisioning. " +
                "For combined Odoo+Plane, use seed-odoo.");
    }
}
