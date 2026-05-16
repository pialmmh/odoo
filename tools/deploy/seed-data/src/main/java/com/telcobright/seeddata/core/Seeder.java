package com.telcobright.seeddata.core;

import com.telcobright.seeddata.cli.SeedRequest;

public interface Seeder {
    SeedResult run(SeedRequest req) throws Exception;
}
