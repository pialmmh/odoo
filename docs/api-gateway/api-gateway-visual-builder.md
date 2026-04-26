# API Gateway Visual Policy Builder — Handoff Spec

> **Audience:** the agent picking up this feature in a **separate git
> worktree**. You have no context from the conversation that produced this
> doc. Treat this file as the complete spec. If something here conflicts with
> what you see in the repo, stop and ask — do not guess.

## TL;DR

Build a visual, drag-and-drop editor inside orchestrix-v2 that lets a super
admin author **APISIX route authorization policies** (the per-request
allow / deny plugin chain). Stage changes in our MySQL, diff against the live
APISIX config, publish on explicit confirm. **MVP scope: four plugins, edit
existing routes only.** No Keycloak editing, no reactive security flows, no
route/upstream/consumer CRUD.

## Worktree + branch

The worktree has already been created:

- Path: `/home/mustafa/telcobright-projects/orchestrix-flow-builder`
- Branch: `orchestrix-flow-builder` (forked from `main`)

All work happens there. Do **not** push to origin until the user asks. When
done, the user will merge `orchestrix-flow-builder` → `main` and remove the
worktree with `git worktree remove`.

## Repository orientation (read before coding)

- **Stack:** React 19 + MUI v7 + react-router v7 (JSX, **not TypeScript**) for
  the UI; Spring Boot 3.4 + Java 21 for the API. APISIX sits in front of the
  Spring Boot app.
- **Ports:**
  - UI dev server: 5180 (do not change)
  - Spring Boot API: 8180
  - APISIX data plane: 9080
  - APISIX admin API: **9180** — the one you'll call
  - Keycloak: 7104
- **Launch:** `./launch-all.sh` from repo root starts everything. Don't run
  components individually unless debugging one.
- **Project rules** (from `CLAUDE.md` — read it yourself):
  - UI must never expose backend tech names (Keycloak, APISIX, Kill Bill,
    Odoo) to end users. "API Gateway" is fine in super-admin UI; "APISIX"
    is not.
  - Forms need left/right padding and vertical compactness.
  - JDK 21 only.

## What already exists — copy these patterns

### Backend proxy pattern

Three existing proxies demonstrate the exact shape of what you'll add:

- `api/src/main/java/com/telcobright/api/controller/KillBillProxyController.java`
  — pass-through REST proxy with server-side auth injection
- `api/src/main/java/com/telcobright/api/controller/OdooProxyController.java`
- `api/src/main/java/com/telcobright/api/controller/EspoProxyController.java`

Each has a matching `@ConfigurationProperties` bean in
`api/src/main/java/com/telcobright/api/config/` (e.g.
`KillBillProperties.java`). Config values come from `application.yml` and
per-tenant profile YAML under
`api/src/main/resources/config/operators/<op>/tenants/<tenant>/<profile>/`.

You will create `ApisixProperties.java` and `ApisixAdminProxyController.java`
in the same style.

### UI page pattern

`ui/src/pages/party/*` — especially `Permissions.jsx`, `Roles.jsx`,
`RoleDetail.jsx` — show the established conventions: `@mui/material`,
`useNotification()`, `extractError()`, `CircularProgress` loading state,
dialogs for create/edit, tenant-scoped via `PartyTenantGate`. Copy these
idioms. Do **not** introduce a new state-management library or a different
MUI version.

### APISIX setup

- `apisix/setup-routes.sh` — shows admin API URL, admin key, and how routes
  are registered today. Your proxy controller will use the same base URL and
  key (load them from `application.yml`, don't hardcode):
  - Admin URL: `http://localhost:9180/apisix/admin`
  - Admin key: `telcobright-apisix-admin-key`

### Feature-workflow convention

Before writing code, create the feature folder:

```
docs/dev-progress/features/orchestrix-flow-builder/
  ├── open/
  │   ├── 01-backend-proxy.md
  │   ├── 02-schema-and-storage.md
  │   ├── 03-ui-route-list.md
  │   ├── 04-ui-plugin-chain-editor.md
  │   ├── 05-publish-diff-flow.md
  │   └── 06-audit-log.md
  └── closed/
```

See `docs/dev-progress/features/FEATURE-WORKFLOW.md` for the full rules.
Move each `.md` from `open/` to `closed/` when done with a completion note at
the top.

## Why this exists (do not skip — design rationale matters)

APISIX ships an official dashboard. This builder exists only because:

1. **Tenant-scoped views.** A tenant admin should only see their own routes,
   not the entire APISIX config.
2. **SSO via our Keycloak + attribution to our `party.User`.** Edits are
   auditable in our MySQL.
3. **Stage → diff → publish.** Auth config is high-blast-radius; direct live
   edits are unsafe.

If any of those three stop applying mid-build, stop and escalate — you might
be reinventing the official dashboard for no reason.

## Explicit non-goals — do not build these in MVP

- Creating / deleting routes, upstreams, services, consumers. **Edit plugin
  chains on existing routes only.**
- Keycloak realm / client editing.
- Reactive security flows (fail2ban, WAF, Wazuh events). Different engine,
  phase 4+.
- Cross-tenant or template policies.
- Live-edit mode. All changes are staged + published explicitly.
- A general-purpose workflow/DAG engine. The graph is strictly "ordered
  plugin chain".
- A policy language (OPA/Rego). We don't author policies here; we compose
  APISIX plugins.

## MVP deliverables

### 1. Backend — APISIX admin proxy

New files:

- `api/src/main/java/com/telcobright/api/config/ApisixProperties.java`
  — `@ConfigurationProperties(prefix = "apisix")` with `url`, `adminKey`.
- `api/src/main/java/com/telcobright/api/controller/ApisixAdminProxyController.java`
  — pass-through for `GET /api/gateway/**` and `PUT /api/gateway/**`,
  forwarding to `{apisix.url}/apisix/admin/**`, injecting
  `X-API-KEY: {apisix.adminKey}`. Model on `KillBillProxyController`.
- `application.yml` entries:
  ```yaml
  apisix:
    url: http://localhost:9180
    admin-key: telcobright-apisix-admin-key
  ```
- Register route in `apisix/setup-routes.sh` so `/api/gateway/*` is reachable
  from the UI (Keycloak JWT required, same as `/api/kb/*`).

### 2. Schema — staged policies + audit

Two MySQL tables in our platform DB (use the existing migration location —
look for other `CREATE TABLE` migrations in the repo and follow that
convention; do not introduce Flyway if it isn't already there):

```sql
CREATE TABLE gateway_policy (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant        VARCHAR(64)  NOT NULL,
  route_id      VARCHAR(128) NOT NULL,        -- APISIX route id
  plugins_json  JSON         NOT NULL,        -- desired plugin chain
  updated_by    VARCHAR(128) NOT NULL,        -- party user id
  updated_at    DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_tenant_route (tenant, route_id)
);

CREATE TABLE gateway_policy_audit (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant        VARCHAR(64)  NOT NULL,
  route_id      VARCHAR(128) NOT NULL,
  diff_json     JSON         NOT NULL,        -- before/after
  actor         VARCHAR(128) NOT NULL,
  action        ENUM('stage','publish') NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  INDEX idx_tenant_route (tenant, route_id),
  INDEX idx_created_at (created_at)
);
```

`plugins_json` stores the raw APISIX `plugins` block so new plugin types
never need a migration.

### 3. UI — new page

Route: `/:tenant/gateway/policies`, super admin only (guard with the
existing `isSuper` flag pattern — see `ui/src/App.jsx` for how the super
admin routes like `/party/admin/*` are gated; mirror that exactly).

Sidebar entry under Admin section: **"Gateway Policies"** (never "APISIX").
Edit `ui/src/layouts/Sidebar.jsx` — super-admin conditional, same as the
existing Party admin entries.

Page layout:

- **Left pane (35% width):** route list. Fetches `GET /api/gateway/routes`.
  Each row: route name, URI, method(s), tenant label. Filter box at top.
- **Right pane (65% width):** selected route. Three tabs:
  1. **Policy chain** — vertical React Flow graph of plugin nodes.
  2. **Diff** — side-by-side JSON: staged vs. live APISIX.
  3. **History** — audit rows for this route, newest first.

### 4. Plugin chain editor

Use `reactflow` (the library). **Four plugin node types only for MVP:**

| Plugin | Purpose | Config surface |
|---|---|---|
| `jwt-auth` | JWT validation | key, secret, algorithm |
| `ip-restriction` | IP allow/deny | whitelist[], blacklist[] |
| `limit-req` | Rate limit | rate, burst, key |
| `consumer-restriction` | Consumer ACL | whitelist[], blacklist[] |

Each node = one plugin. Order = execution order. No branching, no
conditionals — it's a linear chain rendered vertically. Drag to reorder,
button to add/remove.

Config form per node: generate from each plugin's JSON Schema using
`@rjsf/mui` (React JSON Schema Form — MUI theme). Ship the four schemas as
static JSON under `ui/src/pages/gateway/schemas/`. Pull them from APISIX docs,
don't invent fields.

### 5. Publish flow

Explicit, three-step:

1. User edits the chain → **Save** button → writes to `gateway_policy` row
   (stage only). Toast: "Staged".
2. User opens Diff tab → reads live route from APISIX via
   `GET /api/gateway/routes/{id}` and compares to staged `plugins_json`.
3. User clicks **Publish** → backend merges staged plugins into the live
   APISIX route via `PUT /api/gateway/routes/{id}` (preserves `upstream`,
   `uri`, `methods` — only touches the `plugins` block). Writes
   `gateway_policy_audit` row with action=`publish` and before/after diff.

Publish must fail closed: if the APISIX PUT fails, do not mark audit as
published. Leave the staged row intact so the user can retry.

### 6. Audit log

Read-only tab. `GET /api/gateway/audit?route_id=...` returns rows newest
first. Render as a table with columns: timestamp, actor, action, diff
(expandable JSON viewer).

## Open decisions — ask the user before starting

1. **Tenant → route mapping.** APISIX routes are untagged today
   (`apisix/setup-routes.sh`). Proposal: require a `labels.tenant=<slug>` on
   every route. The UI filters by label. Confirm this direction with the
   user; it affects `setup-routes.sh` edits.
2. **Migration tooling.** The repo does not appear to use Flyway/Liquibase.
   Ask how schema changes land (manual `.sql` file + runbook, or is there a
   tool you missed?).
3. **React Flow dependency.** Not currently in `ui/package.json`. Confirm OK
   to add `reactflow` and `@rjsf/mui` + `@rjsf/validator-ajv8`.

## Definition of done

- [ ] Feature folder created with 6 open tasks as listed above.
- [ ] Backend proxy + properties + `application.yml` wired, unit-tested with
      a mock APISIX (or integration-tested against the local one).
- [ ] Both MySQL tables created and accessible.
- [ ] UI page renders at `/:tenant/gateway/policies` for super admin only,
      returns 404 / redirect for non-super users.
- [ ] Can list routes, edit a chain of the four supported plugins, stage,
      diff, and publish successfully against a real local APISIX.
- [ ] Audit rows appear with correct actor (Keycloak sub from JWT) and diff.
- [ ] All grep-audits from the `/style` skill pass — no hex literals, no
      hardcoded `fontSize` in new JSX:
      ```
      grep -rnE '#[0-9a-fA-F]{3,6}' ui/src/pages/gateway
      grep -rnE 'fontSize:\s*[0-9]' ui/src/pages/gateway
      ```
- [ ] `./launch-all.sh` still starts cleanly; no regression on existing
      pages (smoke-test Products, Subscriptions, Party → Users).
- [ ] README at `docs/api-gateway/api-gateway-visual-builder.md` updated with
      a short "Implemented" section linking to the key files.

## Traps to avoid

- **Do not try to build a unified flow engine** that also handles fail2ban /
  WAF / reactive flows. That is a different async event-driven engine — it
  will corrupt this per-request synchronous design. Phase 4+, separate
  project.
- **Do not write a policy language.** Compose APISIX plugins only.
- **Do not expose "APISIX" in user-visible strings.** Use "API Gateway",
  "Policy", "Route". `CLAUDE.md` has the crib sheet.
- **Do not live-edit APISIX on every keystroke.** Stage in MySQL, publish
  explicitly. The whole point of this builder vs. the official one is safe
  rollout.
- **Do not skip the diff tab.** Operators must see what changes before
  clicking Publish. This is the load-bearing UX element.
- **Do not add new UI frameworks.** MUI v7 + React 19 + JSX. If you feel
  tempted to add Chakra, Mantine, Tailwind, TypeScript — stop.

## Handoff back

When done:
1. Move all `open/*.md` to `closed/` with completion notes.
2. Add a terse "Implemented — see feature folder" section to this file.
3. Tell the user; they'll merge `feature/orchestrix-flow-builder` → `main` and
   remove the worktree.

## Phasing (for reference — not MVP)

- **Phase 2:** route creation, upstream/consumer CRUD, per-tenant publish
  rights, request-sample simulator ("what happens if X hits this route?").
- **Phase 3:** Keycloak policy builder on the same UI shell (new page,
  reuses the graph component library).
- **Phase 4:** reactive security flow builder (fail2ban / WAF / login-burst
  automation) — separate engine, consumes night-watcher events.
