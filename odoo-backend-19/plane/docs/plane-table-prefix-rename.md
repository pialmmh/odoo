# Plane table rename — `plane_*` prefix

**Date:** 2026-05-04
**Branch:** `preview` (uncommitted)
**Migrations:** `db.0122_rename_tables_plane_prefix`, `license.0007_rename_tables_plane_prefix`

## What changed

Every Plane-owned database table in the `db` and `license` Django apps was renamed from its bare name to a `plane_`-prefixed name. 96 tables in total.

Examples:

| Before | After |
|---|---|
| `issues` | `plane_issues` |
| `projects` | `plane_projects` |
| `workspaces` | `plane_workspaces` |
| `users` | `plane_users` |
| `cycles` | `plane_cycles` |
| `pages` | `plane_pages` |
| `issue_comments` | `plane_issue_comments` |
| `workspace_members` | `plane_workspace_members` |

Tables left untouched:
- `auth_*`, `django_*`, `django_celery_beat_*`, `django_content_type`, `django_session`, `django_migrations` — Django framework internals; would never collide with Odoo's namespace.

## Why

This Plane fork is being treated as the new Orchestrix UI. The long-term plan is to **co-locate Plane and Odoo schemas in the same Postgres database per tenant**, so a tenant's full state (PM + ERP) lives in one DB and is one backup/restore unit.

Odoo uses prefixed table names everywhere (`crm_lead`, `res_partner`, `mail_message`, …). Plane historically used bare names. Putting both schemas in one DB without a Plane prefix would risk future collisions whenever Odoo installs a new module — for example, installing Odoo's `project` addon would conflict with Plane's `project_*` tables.

The rename eliminates that risk uniformly: Plane sits in `plane_*`, Odoo in its existing module-prefixed namespaces. They can coexist in `public.*` of the same DB without conflict.

See `/tmp/shared-instruction/plane-per-db-multitenancy.md` for the broader multi-tenancy plan.

## Scope of the rename

- **96 `db_table` declarations** updated across model files in:
  - `apps/api/plane/db/models/`
  - `apps/api/plane/license/models/`
- **1 raw SQL block** patched in `apps/api/plane/app/views/page/base.py` (the recursive descendants query for unarchive — `pages` → `plane_pages`)
- **2 new migrations** generated:
  - `apps/api/plane/db/migrations/0122_rename_tables_plane_prefix.py` (92 `AlterModelTable` ops)
  - `apps/api/plane/license/migrations/0007_rename_tables_plane_prefix.py` (4 `AlterModelTable` ops)
- Migration history files (`0001_initial.py` through `0121_*.py`) are immutable Django records and were **not** touched.

## How the rename was applied

1. Edit model files in place, sed-style: `db_table = "X"` → `db_table = "plane_X"`
2. Generate `AlterModelTable` migration ops from the (model class, new table) mapping
3. Patch raw SQL hits found by greping the API source
4. Rebuild Docker images that bundle the API code: `api`, `migrator`, `worker`, `beat-worker` (all share `Dockerfile.api`)
5. Stop dependent containers (`api`, `worker`, `beat-worker`)
6. Run `migrator` once — applies the `AlterModelTable` ops as `ALTER TABLE … RENAME TO …`
7. Start dependents with new image — they pick up the new model code

```bash
cd /home/mustafa/telcobright-projects/plane-project/plane
docker compose build api migrator worker beat-worker
docker compose stop api worker beat-worker
docker compose run --rm migrator
docker compose up -d --force-recreate api worker beat-worker
```

## Verification

After the rename:

```bash
# All Plane tables are now prefixed
docker exec plane-db psql -U plane -d plane -c "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE 'plane_%';"
# → 98

# Old bare names are gone
docker exec plane-db psql -U plane -d plane -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('issues','projects','workspaces','users','accounts');"
# → 0 rows

# API serves real data
curl -s http://localhost:7110/api/instances/
# → 200 with full instance config
```

## What was NOT changed

- API endpoint URLs (`/api/v1/workspaces/...` etc.) — unchanged.
- Frontend route paths (`/{workspaceSlug}/projects/...`) — unchanged.
- React component names, imports, file structure — unchanged.
- The chat surface I shipped earlier — unaffected (mock store, no DB).
- The CRM module's `apps/web/core/services/crm/odoo.ts` — unchanged (talks to Odoo via gateway, not Plane DB).
- Django framework tables (`auth_*`, `django_*`) — unchanged.

## Rollback

To revert:

```bash
cd /home/mustafa/telcobright-projects/plane-project/plane
docker compose stop api worker beat-worker
docker compose run --rm migrator python manage.py migrate db 0121_alter_estimate_type
docker compose run --rm migrator python manage.py migrate license 0006_instance_is_current_version_deprecated
git checkout apps/api/plane/db/models apps/api/plane/license/models apps/api/plane/app/views/page/base.py
rm apps/api/plane/db/migrations/0122_rename_tables_plane_prefix.py
rm apps/api/plane/license/migrations/0007_rename_tables_plane_prefix.py
docker compose build api migrator worker beat-worker
docker compose up -d --force-recreate api worker beat-worker
```

## Related work

- `/tmp/shared-instruction/plane-per-db-multitenancy.md` — broader plan for parallel per-tenant DBs (Plane + Odoo) in same cluster
- `/tmp/shared-instruction/plane-per-db-checklist.md` — granular Phase 0–11 work plan for Plane PER_DB
- `/tmp/shared-instruction/plane-fork-handoff.md` — orientation doc for the Plane-fork agent

## Notes for future maintainers

- Do **not** attempt to `git pull` from upstream Plane after this rename. The fork has explicitly diverged from upstream conventions; future Plane releases will assume bare table names. Any upstream merge will need manual reconciliation.
- When adding a new model, set `db_table = "plane_<table_name>"` in `Meta` from the start.
- When writing raw SQL anywhere in the API, use the `plane_*` table names. Greping for `FROM <bare_name>` / `JOIN <bare_name>` / `INTO <bare_name>` / `UPDATE <bare_name>` is the easiest sanity check.
