# seed-data

DB provisioning + seed-data loader. Creates a fresh database on a target
Postgres host and applies versioned schema/seed/demo dumps over JDBC.

Designed to be invoked from deploy scripts, but the underlying classes are
also a usable Java library.

- **Stack**: plain Java 21 + Maven, JDBC + Jackson — no frameworks.
- **Distribution**: single fat-jar (`target/seed-data.jar`, ~3.6 MB) plus
  thin shell wrappers under `bin/`.
- **Targets**: Odoo+Plane today; Plane standalone, Kill Bill, Keycloak
  reserved.

## Build

```bash
mvn -q package
```

## Use (CLI)

```bash
export DB_PASSWORD='secret'
./bin/seed-odoo \
  --db-host          127.0.0.1 \
  --db-port          5433 \
  --db-user          postgres \
  --db-password-env  DB_PASSWORD \
  --db-name          odoo_acme \
  --tenant           acme \
  --version          v19
```

Optional flags:

| Flag | Effect |
|------|--------|
| `--admin-db <name>`     | Bootstrap DB used for `CREATE DATABASE` (default `postgres`). |
| `--data-dir <path>`     | Override location of `data/<app>/<version>/`. Default: relative to the jar. |
| `--with-demo`           | Load `demo.sql.gz` after `seed.sql.gz`. |
| `--force-recreate`      | `DROP DATABASE` if it already exists, then recreate. |

On success prints one JSON line on stdout and exits `0`:

```json
{"status":"ok","db":"odoo_acme","applied":["pristine","seed","overlay"],
 "stmtCounts":{"pristine":62360,"overlay":2},"durationMs":42024}
```

| Exit | Meaning |
|------|---------|
| `0`  | success |
| `2`  | DB already exists (pass `--force-recreate` to drop) |
| `3`  | connection failed (host/port/credentials) |
| `4`  | a SQL statement failed |
| `64` | usage error |

## Use (library)

Same classes drive the CLI. From any JVM caller:

```java
SeedRequest req = new SeedRequest(
    "odoo", "v19",
    "127.0.0.1", 5433, "postgres", System.getenv("DB_PASSWORD"), "postgres",
    "odoo_acme", "acme",
    /* withDemo */ false, /* forceRecreate */ false, /* dataDir */ null);
SeedResult result = new OdooSeeder().run(req);
```

## Layout

```
seed-data/
├── pom.xml
├── bin/
│   ├── seed-odoo                       # shell wrapper -> java -jar ... odoo "$@"
│   └── seed-plane                      # placeholder (PlaneSeeder is reserved)
├── src/main/java/com/telcobright/seeddata/
│   ├── Main.java                       # entry; dispatches by app name
│   ├── cli/
│   │   ├── Args.java                   # plain-Java arg parser
│   │   └── SeedRequest.java            # immutable request record
│   ├── core/
│   │   ├── DbProvisioner.java          # CREATE/DROP DATABASE via JDBC
│   │   ├── SqlRunner.java              # streams .sql / .sql.gz, splits on `;`
│   │   ├── JsonOverlay.java            # tenant-overlay templating + apply
│   │   ├── Seeder.java                 # interface
│   │   └── SeedResult.java             # JSON status object
│   └── apps/
│       ├── OdooSeeder.java             # orchestrates Odoo+Plane provisioning
│       └── PlaneSeeder.java            # placeholder
├── data/<app>/<version>/
│   ├── pristine.sql.gz                 # schema + seed rows; .gitignored — regenerate locally
│   ├── seed.sql.gz                     # optional, for split pristine/seed model
│   ├── demo.sql.gz                     # optional; loaded with --with-demo
│   ├── tenant-overlay.json.tmpl        # rendered with {{tenant}}, {{db_name}}, {{version}}
│   └── manifest.json                   # provenance, modules, checksums
└── tools/regen-odoo-v19.sh             # stub; rebuild dumps from a clean source DB
```

## Two-artifact model: pristine vs seed vs demo

The seeder applies up to four artifacts in order, each optional:

1. **`pristine.sql.gz`** — empty schema only (or schema + irreducible seed if you
   prefer a single artifact). What you load when a real new tenant signs up.
2. **`seed.sql.gz`** — bootstrap rows the app needs to be usable (currencies,
   default issue states, COA, etc.). Kept separate so you can re-apply seed
   after a schema bump without resetting tenant data.
3. **`tenant-overlay.json.tmpl`** — per-tenant templated SQL (rename company,
   patch admin email). Renders Mustache-style `{{tenant}}` placeholders.
4. **`demo.sql.gz`** *(only with `--with-demo`)* — sample data for testing.

If you don't want the split, you can put everything in `pristine.sql.gz`
and leave the others empty — that's exactly what today's `data/odoo/v19/`
ships (full snapshot of an existing dev DB).

## Generating dumps

`pristine.sql.gz`, `seed.sql.gz`, `demo.sql.gz` are **not in git** — keep them
out so the repo stays small and so artifact provenance lives in
`manifest.json` instead of binary diffs.

Generate with `pg_dump`. Always pass `--inserts` so output is JDBC-loadable;
default `pg_dump` uses `\.` COPY blocks that JDBC cannot run.

```bash
sudo -u postgres pg_dump -p 5433 \
  --inserts --no-owner --no-acl --quote-all-identifiers \
  odoo_billing_19 \
  | gzip -9 > data/odoo/v19/pristine.sql.gz
```

`tools/regen-odoo-v19.sh` is a stub for the full clean-rebuild flow
(create empty DB → `odoo-bin -i base,…` → run Plane Django migrations →
dump schema-only and data-only separately). Fill in the Plane init step
when documented.

## Verified round-trip

Smoke-tested against the live `odoo_billing_19` (Odoo 19 + Plane, 673
public tables incl. 98 `plane_*`, 11 issues, 2 workspaces):

| Stage | Result |
|-------|--------|
| `pg_dump --inserts` → `pristine.sql.gz` | 2.2 MB compressed, 2.6 s |
| `seed-odoo --force-recreate …` round-trip | exit 0, 62,360 statements, 42 s |
| 13-metric fingerprint diff (table count, row counts, sample rows) | identical |
| Storage size delta | shrunk 11.5 MB → 10.0 MB (dead-tuple bloat — expected) |
| Odoo restart against the restored DB | HTTP 303 login redirect (healthy) |

## SQL splitter notes

`SqlRunner` is a small state machine, not a SQL parser. It handles:

- statement termination on top-level `;`,
- single-quoted strings (with `''` escaping),
- line comments (`-- …`) and block comments (`/* … */`),
- dollar-quoted blocks (`$$ … $$`, `$tag$ … $tag$`) — needed for plpgsql,
- skipping psql meta-commands (`\connect`, `\restrict`, etc.) at line start.

It does **not** support `COPY … FROM stdin` data blocks, server-side
prepared statements, or `;` inside identifiers. Always generate dumps with
`--inserts`.
