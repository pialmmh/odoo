# Pristine tenant DB template

Canonical "fresh tenant" SQL image. Restore this into a new Postgres
DB to get a v19 Odoo install with our custom addons already loaded
and **no operational data** (no telecom products, no rate history,
no sale orders, no RBAC role rows). The first thing the new DB needs
is the post-install migration scripts in `tools/` to populate
tenant-specific data — or a manual seed.

## What's in `pristine-tenant-v19.sql{,.gz}`

- Odoo 19 base + `web,crm,sale_management,account,account_payment,stock,auth_totp` (transitively → 72 modules)
- Custom addons (8): `artifact_management, infra_management, kb_integration, orchestrix_crm, platform_config, product_fluent_view, rbac_management, tb_fluent_theme`
- Default admin user (login `admin` / password `admin`)
- Default company **YourCompany** — rename with `UPDATE res_company SET name='<tenant>' WHERE id=1;` after restore
- **No demo data** (`--without-demo=all` was passed at init)

Generated: 2026-05-02 03:42 UTC+6, source DB `odoo_billing_19_clean`.

## Spawn a new tenant DB

```bash
TENANT=acme
PGHOST=/run/postgresql
PGPORT=5433
PGUSER=mustafa

# 1. drop+create
psql -h $PGHOST -p $PGPORT -U $PGUSER -d postgres \
    -c "DROP DATABASE IF EXISTS odoo_${TENANT};"
createdb -h $PGHOST -p $PGPORT -U $PGUSER odoo_${TENANT}

# 2. restore
gunzip -c odoo-backend-19/db-templates/pristine-tenant-v19.sql.gz | \
    psql -h $PGHOST -p $PGPORT -U $PGUSER -d odoo_${TENANT} >/dev/null

# 3. rename the default company
psql -h $PGHOST -p $PGPORT -U $PGUSER -d odoo_${TENANT} \
    -c "UPDATE res_company SET name='${TENANT^}' WHERE id=1;"
```

Then either:
- Run `tools/migrate_phase*.py` against `odoo_${TENANT}` (sourced from
  the v17 `odoo_billing` if migrating an existing tenant), OR
- Hand-seed via the Odoo UI / a tenant-specific provisioning script.

## Regenerate the template

When the module set or any custom addon's data changes (XML records,
seed data, etc.), regenerate:

```bash
PGHOST=/run/postgresql
PGPORT=5433
PGUSER=mustafa
DB=odoo_billing_19_clean

# 1. rebuild fresh
psql -h $PGHOST -p $PGPORT -U $PGUSER -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB};"
createdb -h $PGHOST -p $PGPORT -U $PGUSER ${DB}

# 2. install core
cd odoo-backend-19
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d ${DB} \
    -i base,web,crm,sale_management,account,account_payment,stock,auth_totp \
    --without-demo=all --stop-after-init

# 3. install custom addons
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d ${DB} \
    -i artifact_management,infra_management,kb_integration,orchestrix_crm,platform_config,product_fluent_view,rbac_management,tb_fluent_theme \
    --without-demo=all --stop-after-init

# 4. dump
pg_dump -h $PGHOST -p $PGPORT -U $PGUSER \
    --format=plain --no-owner --no-acl --clean --if-exists ${DB} \
    > db-templates/pristine-tenant-v19.sql
gzip -9kf db-templates/pristine-tenant-v19.sql
```

The whole regen takes ~80s on this dev machine.
