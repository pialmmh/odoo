# Orchestrix-v2 Deploy — Workflow Guide

Supplement to [`deploy.sh`](deploy.sh). Read both together.

The script knows *how* to deploy. This README explains *why* the framework is
shaped the way it is, what each piece is for, and the conventions to follow
when adding new operators, profiles, components, or templates.

---

## Mental model

```
   one tenant of the platform         a stage of that tenant's lifecycle
        (operator)                            (profile)
            │                                     │
            ▼                                     ▼
   operators/<operator>/<profile>.yml   ──>   one YAML file (flat keys)
        + SSH inventory entry                     │
                                                  ▼
                                       a set of CONF_* env vars
                                                  │
                                                  ▼
                                        components run in order
                                       (odoo, plane, seed-data, ...)
                                                  │
                       ┌──────────────────────────┼──────────────────────────┐
                       ▼                          ▼                          ▼
                render_<comp>_env()        deploy_<comp>()             (--bundle PATH)
                always runs first          starts services             tar.gz of rendered
                templates → live config    (skipped under              files for prod ship
                                            --env-only / --no-launch)
```

Two axes — **operator × profile** — pick exactly one YAML file. Its keys
flow as `CONF_<UPPER_KEY>` env vars into the component handlers, which use
them to render templates and run actions.

**Two-phase component contract** (since 2026-05-16):

- `render_<comp>_env()` — pure rendering. Reads `CONF_*`, writes config/env
  files. Always called.
- `deploy_<comp>()` — calls `render_<comp>_env`, then does runtime actions
  (DB probe, docker compose up, systemctl restart, etc.). Skipped under
  `--env-only`.

This split is what lets the same machinery serve both "set up my local dev
box" and "ship a config bundle to prod."

---

## Directory layout

```
tools/deploy/
├── deploy.sh                 ← main entrypoint
├── deploy_env.sh             ← shortcut: deploy.sh ... --env-only
├── README.md                 ← this file
│
├── operators/
│   └── <operator>/
│       ├── dev.yml           ← one YAML file per profile
│       ├── staging.yml          (flat keys, no nesting)
│       └── prod.yml
│
├── lib/
│   ├── load-yaml.sh          ← Python+PyYAML loader, exports CONF_*
│   ├── render-template.sh    ← pure-bash {{key}} substitution
│   └── ssh.sh                ← ssh_run / rsync_to / scp_to / dry_or_run helpers
│
├── components/
│   └── <name>.sh             ← one file per component:
│                               render_<name>_env()   ← always called
│                               deploy_<name>()       ← runtime, skipped under --env-only
│                               (hyphens become underscores: seed-data → deploy_seed_data)
│
├── templates/
│   └── <name>.tmpl           ← {{key}} placeholders, rendered to per-profile paths
│
├── seed-data/                ← Java tool: provisions Postgres DB (in-tree)
└── bundles/                  ← gitignored output dir for --bundle tar.gz
```

---

## CLI shape

```
./deploy.sh     <operator> <profile> [--components <csv>|--all] [flags]
./deploy_env.sh <operator> <profile> [--components <csv>|--all] [flags]
```

| Flag | Meaning |
|---|---|
| `--all` | Use `components_default` from the matched profile YAML |
| `--components a,b,c` | Override the component list |
| `--local` | Skip SSH inventory; run actions on this machine (DB still over the wire) |
| `--no-launch` | Render configs but don't start services |
| `--env-only` | Stronger than `--no-launch`: stop after rendering. No seed-data probe, no docker actions. Implied by `deploy_env.sh`. |
| `--bundle PATH` | Implies `--env-only`. After render, pack rendered files into tar.gz at PATH. Use for shipping configs to a remote prod server. |
| `--seed` | Force the seed-data sub-step (otherwise it runs only when the DB is missing) |
| `--skip-build` | Skip mvn / `odoo -u all` / similar pre-build steps |
| `--dry-run` | Print remote/build commands without running them |
| `--help` | Show the script header |

### Common invocations

```bash
# Local dev setup — render env files in-tree so services find them
./tools/deploy/deploy_env.sh btcl dev --all --local

# Full local deploy (render + start)
./tools/deploy/deploy.sh btcl dev --all --local --skip-build

# Production env bundle to ship
./tools/deploy/deploy_env.sh btcl prod --all --bundle /tmp/btcl-prod-env.tgz
scp /tmp/btcl-prod-env.tgz prod-host:/opt/orchestrix/
ssh prod-host 'cd /opt/orchestrix && tar xzf btcl-prod-env.tgz'

# Just refresh one component's env after editing its template
./tools/deploy/deploy_env.sh btcl dev --components plane
```

---

## How a deploy run is dispatched

1. **Parse args** — `<operator> <profile>` plus flags.
2. **Resolve config** — `operators/<operator>/<profile>.yml` must exist.
3. **Load profile keys as env vars** — every top-level key in the YAML
   becomes `CONF_<UPPER_KEY>` for the duration of the run.
4. **Resolve SSH target** (unless `--local`) — reads from the **shared SSH
   inventory** at `routesphere/.../ssh-automation/servers/<inventory_operator>/`
   using the `inventory_operator` + `server` keys in the YAML. Single
   source of truth across all our deploy scripts.
5. **Resolve component list** — `--all` → `components_default`; else
   `--components`.
6. **Run each component** — `components/<name>.sh` is sourced and
   `deploy_<name>()` is called. Hyphens become underscores in the function
   name. Each component internally calls `render_<name>_env` first, then
   (if not `--env-only`) does runtime actions.
7. **Optional bundle** — if `--bundle PATH` was passed, after all components
   have rendered, pack the rendered profile dirs into `PATH` as tar.gz.

---

## Component handler contract

Every `components/<name>.sh` must export a function `deploy_<name>()` (hyphens
→ underscores). The handler receives:

- All `CONF_*` env vars loaded from the profile
- `DEPLOY_OPERATOR`, `DEPLOY_PROFILE`, `DEPLOY_BASE_DIR` (orchestrix-v2 root),
  `DEPLOY_SCRIPT_DIR` (this directory)
- `DEPLOY_LOCAL`, `DEPLOY_NO_LAUNCH`, `DEPLOY_SKIP_BUILD`, `DEPLOY_FORCE_SEED`,
  `DRY_RUN` — booleans as strings (`"true"` / `"false"`)
- `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY`, `SSH_TARGET` — only meaningful
  when `DEPLOY_LOCAL=false`

The standard handler shape is:

```bash
deploy_<name>() {
    if [ "${DEPLOY_LOCAL:-false}" = "true" ]; then
        _deploy_<name>_local
    else
        _deploy_<name>_remote
    fi
}

_deploy_<name>_local()  { ... render templates → run actions ... }
_deploy_<name>_remote() { ... rsync code → ssh + systemctl ... }
```

Honor the flags:

- `DRY_RUN=true` → wrap commands in `dry_or_run "<cmd>"` (prints, doesn't run)
- `DEPLOY_NO_LAUNCH=true` → render, then **stop before launching**
- `DEPLOY_SKIP_BUILD=true` → skip mvn / `-u all` / npm
- `DEPLOY_FORCE_SEED=true` → force seed-data sub-step (relevant only for
  components that own a database)

---

## Templates

Templates use `{{key}}` placeholders, substituted by `lib/render-template.sh`
from `CONF_*` env vars. The renderer:

- Substitutes ALL `CONF_*` (lower-cased after the prefix is stripped:
  `CONF_PG_HOST` → `{{pg_host}}`)
- Is **pure bash** — no `sed`, so values containing `/`, `&`, `$`, etc. are
  safe
- Warns to stderr if any `{{...}}` placeholders remain unrendered

Output paths are per-profile by convention:

```
<app-home>/profiles/<operator>-<profile>/<config>
```

Per-profile output paths mean multiple profiles can coexist on one machine.
Switching between them is just a different env var (e.g. `ORCHESTRIX_PROFILE`
for Odoo's launcher).

---

## Conventions

### Adding a new operator

1. Create `operators/<operator>/{dev,staging,prod}.yml` (one file per profile).
2. Set `inventory_operator` and `server` per profile if remote deploy is
   needed (must point at entries that exist under
   `routesphere/.../ssh-automation/servers/<inventory_operator>/`).
3. Set `components_default: <csv>` so `--all` works.

### Adding a new profile to an existing operator

1. Create `operators/<operator>/<new-profile>.yml`.
2. Vary the **side-by-side axes** — typically `<app>_db_name` and
   `<app>_http_port` — so the new profile can run alongside the others on one
   box.
3. Re-render with `deploy_env.sh <op> <new-profile> --all --local` and verify
   files appear under `odoo-backend-19/profiles/<op>-<new-profile>/`.

### Adding a new component

1. Drop `components/<name>.sh` exporting both:
   - `render_<name>_env()` — pure rendering. Reads `CONF_*`, writes config
     files. Always called.
   - `deploy_<name>()` — runtime actions. Should call `render_<name>_env`
     first, then guard against `DEPLOY_ENV_ONLY=true` before doing anything
     that requires a running daemon, docker, or remote SSH.
2. If it needs a config file, drop a template under `templates/<name>.tmpl`.
3. Add the relevant keys to each profile YAML that should run it.
4. Add `<name>` to that profile's `components_default` if it's part of the
   default `--all` set.

### Adding a new template

1. Drop `templates/<name>.tmpl` with `{{key}}` placeholders.
2. Make sure every `{{...}}` resolves to a key in the profile YAML (the
   renderer warns to stderr if any are unrendered).
3. Have the component handler call `render_template "<src>" "<dst>"` from
   inside `render_<comp>_env()`.

---

## Dev workflow — editing Odoo and Plane source

Both Odoo and Plane sources are co-located under `odoo-backend-19/`:

```
odoo-backend-19/
├── odoo-src/        ← upstream Odoo Python source (editable)
├── custom-addons/   ← our addons (editable; listed in addons_path)
└── plane/
    ├── apps/api/    ← Plane Django source (editable)
    └── ...
```

### Editing Odoo

Odoo runs from `./venv/bin/python odoo-src/odoo-bin` on the host. After
editing Python or addon code:

```bash
# Hot-reload one addon (faster):
ORCHESTRIX_PROFILE=btcl-dev ./odoo-backend-19/start-odoo-19.sh -u <addon_name> --stop-after-init
# Then start as usual:
./tools/deploy/deploy.sh btcl dev --components odoo --local --skip-build
```

For full re-install of all addons after big changes, drop `--skip-build`.

### Editing Plane

Plane's `apps/api` is **bind-mounted** into the api container at `/code`,
and Django's `runserver` autoreloader picks up changes — **no restart
needed for most edits**. For changes that the autoreloader misses
(settings, migrations, dependencies):

```bash
# Re-create just the api/worker/beat-worker:
cd odoo-backend-19/plane && \
  docker compose -p plane-btcl-dev \
    -f docker-compose-local.yml \
    -f profiles/btcl-dev/compose.override.yml \
    up -d --force-recreate api worker beat-worker

# After requirements.txt change — rebuild the image:
docker compose -p plane-btcl-dev -f docker-compose-local.yml build api
```

### Clean teardown

If a deploy gets into a weird state, tear down its compose project
cleanly **before** redeploying — this prevents the "stale project with
restart: always" trap:

```bash
# Stop + remove containers + network (keep volumes):
cd odoo-backend-19/plane && \
  docker compose -p plane-btcl-dev -f docker-compose-local.yml down --remove-orphans

# Add `-v` to also remove named volumes (destructive: deletes plane-db data,
# uploads, redis state, rabbitmq state):
docker compose -p plane-btcl-dev -f docker-compose-local.yml down -v --remove-orphans
```

For Odoo:
```bash
pkill -f "odoo-bin.*btcl-dev"
```

**Never move/rename the working directory while the compose project is
still registered with docker.** Docker keeps the project alive via its
labels (`com.docker.compose.project=<name>`), and any container with
`restart: always` will respawn forever even after the compose file is
gone. Always `docker compose down` first, then move/rename.

---

## Idempotency & safety

- **Component handlers are expected to be idempotent.** Re-running `--all`
  should be a no-op when nothing has changed: configs are re-rendered (same
  content), service restarts are a stop-then-start, DB seeds are skipped when
  the DB exists.
- **Force seed = destructive.** `--seed` will DROP and re-create the target
  DB. Use carefully.
- **Passwords are inline in the operator YAML**, not env-var indirected.
  Treat `operators/<op>/*.yml` as secrets files (gitignore in public repos,
  encrypt at rest where appropriate). Deliberate trade-off for clarity.
- **Rendered profile files are gitignored.** `odoo-backend-19/profiles/` and
  `odoo-backend-19/plane/profiles/` are regenerated on every `deploy_env.sh`
  run. Don't hand-edit — edit the YAML or the template instead.
- **Shared services** (Postgres, anything in the overlay network) are NOT
  managed by this framework. Components are expected to talk to pre-existing
  shared services; they only create per-tenant artifacts inside them
  (databases, schemas, queues, etc.).

---

## SSH inventory (shared with routesphere)

For remote deploys (when `--local` is omitted), `deploy.sh` resolves the host
from a shared inventory:

```
/home/mustafa/telcobright-projects/routesphere/routesphere-core/tools/ssh-automation/servers/
  └── <inventory_operator>/
      ├── hosts/<server>   ← INI: host=, port=, user=, key=, private_ip=
      └── keys/<keyfile>   ← matching SSH private key
```

Each profile's `inventory_operator` and `server` keys point into this tree.
The same inventory backs routesphere and any other tool that needs SSH access
to our fleet — **single source of truth** for SSH config.

Override with `ORCHESTRIX_SSH_INVENTORY=<path>` if you need to point at a
different inventory tree.

---

## Catalog single-source rule (project guardrail)

From `orchestrix-v2/CLAUDE.md`:

> **Odoo is the single source of truth for the catalog.** Kill Bill catalog
> is a build artifact derived from Odoo variants. PackageAccount entitlements
> are derived from `x_package_items` JSON on the variant. Prices flow one
> way: rate history → invoicing.

Practical effect on this deploy framework:

- Plane and other components that need a database **share Odoo's Postgres**;
  they don't get a private DB.
- Never wire a new component to a separate catalog source.
- Never hand-edit Kill Bill catalog XML — it's regenerated from Odoo by a
  later sync step (not in scope here).

---

## UI text rule (project guardrail)

The deploy framework's logs are developer-facing — referring to "Odoo",
"Plane", "Kill Bill" in `echo` lines is fine. **End-user-facing UI** (under
`ui/`) must never expose those names. Don't blur that line if you ever surface
deploy output to the product UI.

---

## Troubleshooting flow

| Symptom | Investigate |
|---|---|
| `ERROR: profile yaml not found` | `ls tools/deploy/operators/<op>/*.yml` |
| `WARN: unrendered placeholders` | A `{{key}}` in a template has no matching `CONF_*` (i.e. the YAML is missing the key) — add the key or remove the placeholder |
| `ERROR: top-level of … must be a mapping` | YAML file has an array at the top level or a syntax error — must be flat key: value pairs |
| `ERROR: nested key '…' not supported` | YAML has a nested dict/list — keys must be flat |
| `port already in use` | Component should kill the prior process; if it doesn't, `ss -ltnp 'sport = :<port>'` and stop manually |
| `ERROR: ssh key not found` | Check `inventory_operator`/`server` map onto `routesphere/.../ssh-automation/servers/<op>/hosts/<srv>` |
| Database missing after `--all` ran | Component's DB probe didn't trigger seed-data; pass `--seed` explicitly |

---

## File-by-file reference

| File | Role |
|---|---|
| `deploy.sh` | Main CLI parser + dispatcher |
| `deploy_env.sh` | Shortcut wrapper: `deploy.sh ... --env-only` |
| `operators/<op>/<profile>.yml` | Per-tenant per-profile values (flat YAML keys) |
| `lib/load-yaml.sh` | `load_yaml_into_env <file> <prefix>` — Python+PyYAML loader |
| `lib/render-template.sh` | `render_template <tmpl> <out>` — pure-bash `{{key}}` substitution |
| `lib/ssh.sh` | `ssh_run`, `rsync_to`, `scp_to`, `dry_or_run` |
| `components/<name>.sh` | One per component; exports `render_<name>_env()` + `deploy_<name>()` |
| `templates/<name>.tmpl` | One per renderable config; placeholders match `CONF_*` keys |
| `seed-data/` | Java tool for provisioning a tenant Postgres DB |

---

## For agents

If you are another agent reading this file:

1. **Open `deploy.sh`** to understand the dispatch flow.
2. **Open `operators/<operator>/<profile>.yml`** for the target tenant to see
   actual values (DB endpoints, ports, etc.).
3. **Open `components/<name>.sh`** for any component you need to change.
   Note the two-phase shape: `render_<name>_env()` + `deploy_<name>()`.
4. Honor the flags (`--local`, `--no-launch`, `--env-only`, `--bundle`,
   `--dry-run`, `--skip-build`, `--seed`) when adding new handlers — users
   rely on them. Especially `DEPLOY_ENV_ONLY` — runtime actions must be
   skipped under it.
5. **Don't invent new conventions.** Follow the patterns above (per-profile
   output paths, two-phase component contract, `{{key}}` templates, `CONF_*`
   env vars, flat YAML keys). If something feels missing, it probably should
   be added here rather than worked around in a single component.
