# Odoo 19 — parallel install

Runs alongside the legacy Odoo 17 instance (under `../odoo-backend/`) so both
stay reachable during the migration.

| Layer | This (19) | Legacy (17) |
|-------|-----------|-------------|
| Source | `odoo-src/` (cloned `19.0` branch, gitignored) | `../odoo-backend/odoo-src/` |
| Custom addons | `custom-addons/` (ported, committed) | `../odoo-backend/custom-addons/` |
| Database | `odoo_billing_19` | `odoo_billing` |
| Port | **7170** | 7169 |
| Python venv | `venv/` (gitignored) | `../odoo-backend/venv/` |

## First-time bootstrap (already done — recipe for reproducibility)

```bash
cd /home/mustafa/telcobright-projects/orchestrix-v2/odoo-backend-19

# 1. Source
git clone --branch 19.0 --depth 1 https://github.com/odoo/odoo.git odoo-src

# 2. Python deps
python3 -m venv venv
./venv/bin/pip install --upgrade pip wheel setuptools
./venv/bin/pip install -r odoo-src/requirements.txt

# 3. Postgres database
psql -h /var/run/postgresql -p 5433 -U mustafa -d postgres \
  -c "CREATE DATABASE odoo_billing_19 ENCODING 'UTF8' LC_COLLATE='C' LC_CTYPE='en_US.UTF-8' TEMPLATE template0"

# 4. Initial install with our custom addons + demo data
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d odoo_billing_19 \
  -i tb_fluent_theme,platform_config,rbac_management,product_fluent_view,\
infra_management,artifact_management,kb_integration \
  --without-demo=False --stop-after-init
```

## Day-to-day

```bash
./start-odoo-19.sh                       # start
./start-odoo-19.sh -u tb_fluent_theme    # upgrade single addon
./start-odoo-19.sh --dev=assets          # auto-rebuild SCSS/JS bundles
```

Login: `admin` / `admin`. Master DB password: same as the 17 instance.

## Odoo 17 → 19 breaking changes we hit (and fixed in `custom-addons/`)

1. **`<tree>` view → `<list>`** — every list view tag and `view_mode='tree'`.
2. **`<group expand="0">` in search views** — `expand` attribute removed.
3. **`<group string="…">` in search views** — `string` attribute removed.
4. **`<separator/>` inside `<search>`** — element no longer accepted.
5. **`<label for="id">` requires a real field name** — was previously
   permissive about pointing at a `<div name="…">`.
6. **XPath in inherited views referencing `/tree/`** — must say `/list/`.

If you port additional addons later, sweep these patterns first.

## Data merge

Demo data is loaded already. Merging operational records from the 17 DB
(`odoo_billing`) into 19 (`odoo_billing_19`) is a separate phase — schemas
differ across majors so we use Odoo's per-model export/import (CSV) rather
than raw SQL. Tracked as a follow-up task.
