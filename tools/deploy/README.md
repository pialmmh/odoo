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
   operators/<operator>.conf       ──>   [<profile>] section inside it
        + SSH inventory entry                     │
                                                  ▼
                                       a set of CONF_* env vars
                                                  │
                                                  ▼
                                        components run in order
                                       (odoo, plane, seed-data, ...)
                                                  │
                                                  ▼
                                  templates rendered → live config files
                                  services started (or skipped via --no-launch)
```

Two axes — **operator × profile** — pick exactly one INI section. That
section's keys flow as `CONF_<UPPER_KEY>` env vars into the component
handlers, which use them to render templates and run actions.

---

## Directory layout

```
tools/deploy/
├── deploy.sh                 ← entrypoint
├── README.md                 ← this file
│
├── operators/
│   └── <operator>.conf       ← INI file: [dev]/[staging]/[prod] sections
│                               One file per tenant. Plain text. Inline values
│                               (passwords are not env-var indirected).
│
├── lib/
│   ├── parse-conf.sh         ← awk-based INI parser, exports CONF_*
│   ├── render-template.sh    ← pure-bash {{key}} substitution
│   └── ssh.sh                ← ssh_run / rsync_to / scp_to / dry_or_run helpers
│
├── components/
│   └── <name>.sh             ← one file per component, exports deploy_<name>()
│                               (hyphens become underscores: seed-data → deploy_seed_data)
│
└── templates/
    └── <name>.tmpl           ← {{key}} placeholders, rendered to per-profile paths
```

---

## CLI shape

```
./deploy.sh <operator> <profile> [--components <csv>|--all] [flags]
```

| Flag | Meaning |
|---|---|
| `--all` | Use `components_default` from the matched profile section |
| `--components a,b,c` | Override the component list |
| `--local` | Skip SSH inventory; run actions on this machine (DB still over the wire) |
| `--no-launch` | Render configs but don't start services (Odoo, Plane, etc.) |
| `--seed` | Force the seed-data sub-step (otherwise it only runs when the DB is missing) |
| `--skip-build` | Skip mvn / `odoo -u all` / similar pre-build steps |
| `--dry-run` | Print remote/build commands without running them |
| `--help` | Show the script header (which links here) |

---

## How a deploy run is dispatched

1. **Parse args** — `<operator> <profile>` plus flags.
2. **Resolve config** — `operators/<operator>.conf` must exist; the
   `[<profile>]` section must exist.
3. **Resolve SSH target** (unless `--local`) — reads from the **shared SSH
   inventory** at `routesphere/.../ssh-automation/servers/<inventory_operator>/`
   using the `inventory_operator` + `server` keys in the profile. Single
   source of truth across all our deploy scripts.
4. **Load profile keys as env vars** — every `key = value` in the section
   becomes `CONF_<UPPER_KEY>` for the duration of the run.
5. **Resolve component list** — `--all` → `components_default`; else
   `--components`.
6. **Run each component** — `components/<name>.sh` is sourced and
   `deploy_<name>()` is called. Hyphens in the component name become
   underscores in the function name.

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

1. Create `operators/<operator>.conf` with sections for each profile you need.
2. Set `inventory_operator` and `server` per profile if remote deploy is
   needed (must point at entries that exist under
   `routesphere/.../ssh-automation/servers/<inventory_operator>/`).
3. Set `components_default = <csv>` so `--all` works.

### Adding a new profile to an existing operator

1. Add a new `[<profile>]` section to the operator's `.conf`.
2. Vary the **side-by-side axes** — typically `<app>_db_name` and
   `<app>_http_port` — so the new profile can run alongside the others on one
   box.
3. Re-render with `--components <csv> --local --no-launch --skip-build`.

### Adding a new component

1. Drop `components/<name>.sh` exporting `deploy_<name>()`.
2. If it needs a config file, drop a template under `templates/<name>.tmpl`.
3. Add the relevant `CONF_*` keys to each profile that should run it.
4. Add `<name>` to that profile's `components_default` if it's part of the
   default `--all` set.

### Adding a new template

1. Drop `templates/<name>.tmpl` with `{{key}}` placeholders.
2. Make sure every `{{...}}` resolves to a key in the profile section (the
   renderer warns to stderr if any are unrendered).
3. Have the component handler call `render_template "<src>" "<dst>"`.

---

## Idempotency & safety

- **Component handlers are expected to be idempotent.** Re-running `--all`
  should be a no-op when nothing has changed: configs are re-rendered (same
  content), service restarts are a stop-then-start, DB seeds are skipped when
  the DB exists.
- **Force seed = destructive.** `--seed` will DROP and re-create the target
  DB. Use carefully.
- **Passwords are inline in `.conf`**, not env-var indirected. Treat
  `operators/*.conf` as a secrets file (gitignore where appropriate, encrypt
  at rest, etc.). Deliberate trade-off for clarity.
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
| `ERROR: operator conf not found` | `ls tools/deploy/operators/*.conf` |
| `ERROR: profile '<x>' not in <file>` | Section header in the conf file (must be `[<profile>]` exactly) |
| `WARN: unrendered placeholders` | A `{{key}}` in a template has no matching `CONF_*` in the profile section — add the key or remove the placeholder |
| `port already in use` | Component should kill the prior process; if it doesn't, `ss -ltnp 'sport = :<port>'` and stop manually |
| `ERROR: ssh key not found` | Check `inventory_operator`/`server` map onto `routesphere/.../ssh-automation/servers/<op>/hosts/<srv>` |
| Database missing after `--all` ran | Component's DB probe didn't trigger seed-data; pass `--seed` explicitly |

---

## File-by-file reference

| File | Role |
|---|---|
| `deploy.sh` | CLI parser + dispatcher; everything starts here |
| `operators/<op>.conf` | Per-tenant values, one INI section per profile |
| `lib/parse-conf.sh` | `parse_conf`, `list_sections`, `load_section_into_env` |
| `lib/render-template.sh` | `render_template <tmpl> <out>` — pure-bash `{{key}}` substitution |
| `lib/ssh.sh` | `ssh_run`, `rsync_to`, `scp_to`, `dry_or_run` |
| `components/<name>.sh` | One per component; exports `deploy_<name>()` |
| `templates/<name>.tmpl` | One per renderable config; placeholders match `CONF_*` keys |

---

## For agents

If you are another agent reading this file:

1. **Open `deploy.sh`** to understand the dispatch flow.
2. **Open `operators/<operator>.conf`** for the target tenant to see actual
   values (DB endpoints, ports, etc.).
3. **Open `components/<name>.sh`** for any component you need to change.
4. Honor the flags (`--local`, `--no-launch`, `--dry-run`, `--skip-build`,
   `--seed`) when adding new handlers — users rely on them.
5. **Don't invent new conventions.** Follow the patterns above (per-profile
   output paths, `deploy_<name>()` shape, `{{key}}` templates, `CONF_*` env
   vars). If something feels missing, it probably should be added here rather
   than worked around in a single component.
