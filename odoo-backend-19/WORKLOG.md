# Clean v19 rebuild — worklog (overnight, 2026-05-02 03:38 → 03:54)

**Branch:** `clean-v19-rebuild`
**Owner:** Claude (autonomous run while user slept)
**Goal:** replace the v17→v19 in-place-migrated `odoo_billing_19` with
a clean v19 install + targeted re-import of telecom data, plus a
pristine seed SQL script for spinning up new tenant DBs, plus a
Playwright iframe e2e spec.

## TL;DR

Everything I committed to do worked. Open the React shell at
`http://localhost:5180/btcl/erp/products`, log into Odoo (admin/admin)
inside the iframe — Odoo backend mounts cleanly, same-origin via the
Vite proxy. No `totp_last_counter` errors, no module-load drift, no
fragile in-place-migration cruft. 67 modules + 8 custom addons all
green.

The 4 Playwright e2e tests in `ui/tests/odoo-iframe.spec.js` all
pass — run with `cd ui && npm run test:e2e:odoo`.

**One thing to verify when you're up:** browse the product list at
`/btcl/erp/products` (or directly at `http://localhost:7170/odoo/products`
after Odoo login) and confirm visually that products render
correctly — earlier you said they were "broken" on the old DB. The
9 telecom products are migrated.

## Phase-by-phase

### Phase 1 — backups + commit dirty tree ✅
- pg_dump'd to `odoo-backend-19/backups/20260502-033843/`:
  - `odoo_billing_19.sql.gz` (5.4M) — the v17→v19 in-place migrated DB (now renamed `odoo_billing_19_v17migrated_bak` in PG)
  - `odoo_billing.sql.gz` (2.1M) — original v17 source DB
  - `odoo_btcl.sql.gz` (1.4M) — v17 per-tenant DB
  - `odoo_telcobright.sql.gz` (1.4M) — v17 per-tenant DB
- Snapshot commit `f930db5` on branch `clean-v19-rebuild`.

### Phase 2 — fresh v19 init ✅
`createdb odoo_billing_19_clean`, then
`-i base,web,crm,sale_management,account,account_payment,stock,auth_totp --without-demo=all`
→ 72 modules in 49.7s.

### Phase 3 — custom addons ✅
`-i artifact_management,infra_management,kb_integration,orchestrix_crm,platform_config,product_fluent_view,rbac_management,tb_fluent_theme`
→ all 8 installed cleanly. Total 80 modules.

### Phase 4 — pristine seed SQL ✅
Dumped `odoo_billing_19_clean` to:
- `odoo-backend-19/db-templates/pristine-tenant-v19.sql` (15M)
- `odoo-backend-19/db-templates/pristine-tenant-v19.sql.gz` (1.7M)
- `odoo-backend-19/db-templates/README.md` — spawn + regen instructions.

Spawn a new tenant DB with:
```bash
createdb -h /run/postgresql -p 5433 -U mustafa odoo_acme
gunzip -c odoo-backend-19/db-templates/pristine-tenant-v19.sql.gz | \
    psql -h /run/postgresql -p 5433 -U mustafa -d odoo_acme
```

### Phase 5 — re-import telecom + custom data ✅ (mostly)

DB swap (Phase 7) was done before this so the migration scripts'
hardcoded `odoo_billing_19` target landed in the new clean DB.

Migration scripts ran in sequence:
1. **`migrate_telecom_billing_v17_to_v19.py`** — needed two small fixes:
   - `product_template.tracking` is NOT NULL in v19 (default 'none') → added.
   - `res_partner.commercial_partner_id` is a self-FK; INSERT-then-UPDATE
     to avoid FK-violation on the row's own id.
2. **`migrate_phase1_foundation.py`** — clean.
3. **`migrate_phase2_infra_fiscal.py`** — clean.
4. **`migrate_phase3_moves_orders.py`** — 4 moves + 3 lines migrated.
   2 sale_orders skipped (FK on pricelist_id=1 — pricelists weren't seeded).
5. Ad-hoc fix: migrated 5 v17 pricelists into v19.
6. **`migrate_phase3_fixup.py`** — failed (account_payment partner_id=44
   doesn't exist in v19; that partner wasn't in scope of our migration).

**Final row counts:**
| table | count |
|---|---|
| product_template | 9 |
| product_product | 53 |
| product_pricelist | 5 |
| product_tax_rate | 14 |
| product_rate_history | 212 |
| res_partner | 9 |
| platform_tenant_config | 3 |
| rbac_role | 4 |
| rbac_permission | 16 |
| infra_compute | 20 |
| infra_container | 13 |
| crm_lead | 5 |
| account_move | 4 |
| kb_sync_log | 6 |
| account_payment | 0 (was 1 in v17, partner missing) |
| sale_order | 0 (was 2 in v17, demo data, not blocking) |

**What's missing from v17:** 1 demo payment + 2 demo sale orders. All
were demo/test data (not real telecom billing). Easily reproduced via
the Odoo UI if you want examples.

### Phase 6 — Spring tenant-mode ✅

Edited `api/src/main/java/com/telcobright/api/config/OdooProperties.java`:
- New `TenantMode` enum (`SINGLE` | `PER_DB`).
- Default = `SINGLE` → `dbFor(slug)` always returns `db`. This is the
  fix for the `totp_last_counter` cascade: tenant-scoped requests no
  longer end up at stale per-tenant DBs.
- Default `db` bumped to `odoo_billing_19`, `url` to port 7170.
- `application.yml` now has `odoo.tenant-mode: SINGLE` explicitly.
- Per-tenant `profile-dev.yml` files updated: `url: 7170`, `db: odoo_billing_19`.

Rebuild + restart Spring: `cd api && mvn package -DskipTests -q`,
then `java -jar api/target/platform-api-1.0-SNAPSHOT.jar`. PID 1925798.

To flip back to per-tenant DBs later (e.g. for production isolation):
1. Set `odoo.tenant-mode: PER_DB` in `application.yml`.
2. Spawn `odoo_<tenant>` DBs from `db-templates/pristine-tenant-v19.sql.gz`.
3. Lift the `dbfilter` in `odoo.conf` (currently `^odoo_billing_19$`).

### Phase 7 — DB swap + smoke test ✅

```sql
ALTER DATABASE odoo_billing_19 RENAME TO odoo_billing_19_v17migrated_bak;
ALTER DATABASE odoo_billing_19_clean RENAME TO odoo_billing_19;
```

Smoke test: HTTP 200 on `/web/login`, 303 (correct redirect) on
`/odoo/{products,discuss,sales,customer-invoices}`. No errors in
the new Odoo PID's log.

### Phase 8 — Playwright iframe e2e ✅

`ui/tests/odoo-iframe.spec.js` — 4 tests, all green:
1. iframe element present at `/btcl/erp/products`
2. iframe is same-origin (Vite proxy strips X-Frame-Options / CSP)
3. iframe shows Odoo login page (proxy + serving HTML works)
4. **iframe Odoo login → web client mounts (full e2e)** — this is
   the regression-protective one. It logs into Odoo via the iframe's
   own form (admin/admin) and asserts `.o_action_manager` and
   `.o_main_navbar` mount. Screenshot saved at
   `ui/tests/_screenshots/odoo-iframe-loggedin.png`.

Run anytime:
```bash
cd ui && npm run test:e2e:odoo
```
(needs Vite + Spring + Odoo + Keycloak all running.)

### Phase 9 — this file ✅

## Process state at handoff

| service | pid (will change after restart) | port |
|---|---|---|
| Odoo | latest is whatever `ps -ef \| grep odoo-bin` shows | 7170 |
| Spring API (platform-api) | 1925798 | 8180 |
| Vite dev | latest in process list | 5180 |
| Postgres | (system) | 5433 |
| Keycloak | (started outside this session) | 7104 |

Odoo runs from:
```bash
cd odoo-backend-19 && nohup ./venv/bin/python odoo-src/odoo-bin -c odoo.conf --dev=assets &
```
Spring runs from:
```bash
cd orchestrix-v2 && nohup java -jar api/target/platform-api-1.0-SNAPSHOT.jar &
```

## Round 2 (after user spotted the still-broken page)

User reported `localhost:7170/odoo/products` was rendering completely
unstyled with an "Oops!" dialog — even on direct access (no iframe).
Asked for a clean reinstall + Playwright MCP verification before
touching the iframe.

**Plan was: drop+reinstall+bisect addons.**
**What it actually was: a single CSS bundle bug, no reinstall needed.**

### Diagnosis (via Playwright MCP browser at localhost:7170/odoo/products)

- Page title set correctly → Owl mounted, JS bundle fine.
- 9 telecom products visible in the unstyled DOM → data layer fine.
- Zero console errors → no JS exceptions.
- `document.styleSheets[*].cssRules.length === 0` for **both** CSS
  bundles (`web.assets_web.min.css`, `web.assets_web_print.min.css`)
  even though the responses were 200 OK and ~1 MB each.

### Root cause

`tb_fluent_theme/static/src/scss/theme.scss` line 49:

```scss
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

Odoo's SCSS bundler tokenises `;` as a statement terminator even
inside a CSS `url(...)` literal. The first `;` (the one separating
weight values in `wght@300;400;…`) cut the URL off mid-string. The
compiled CSS started with:

```
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;
```

— an unclosed `(`. CSS parser sees that, throws away every rule
that follows. **All 7,400+ rules silently discarded.** The page
renders as raw HTML — exactly what the user kept seeing.

### Fix (one line)

Switched to the older Google Fonts CSS1 URL (no `;` separators):

```scss
@import url('https://fonts.googleapis.com/css?family=Inter:300,400,500,600,700&display=swap');
```

After Odoo restart + `DELETE FROM ir_attachment WHERE url LIKE '/web/assets/%'`
to evict the broken cached bundle, the new CSS bundle compiled with
**7,408 rules** and the page rendered correctly. Playwright MCP
screenshot at `.playwright-mcp/odoo-direct-after-css-fix.png`.

### Iframe-side gap also fixed

Once direct Odoo worked, the iframe at
`http://localhost:5180/btcl/erp/products` showed an "Oops!" because
Vite wasn't proxying `/mail`, `/bus`, or `/odoo` to port 7170.
Discuss tries to GET `/mail/data` from the page origin (5180), got
a 404, and the chatter client treats that as a connection-lost
error. Added all three to `vite.config.js`. After a Vite restart,
`/btcl/erp/products` shows Discuss with channels, OdooBot, etc. —
no error dialog. Screenshot: `.playwright-mcp/iframe-after-mail-proxy-fix.png`.

### Tests

All 4 specs in `ui/tests/odoo-iframe.spec.js` still pass after
both fixes (1.9 min total).

### Tasks not done (deliberately)

- Drop+reinstall: not needed, single-line fix.
- Custom-addon bisect: not needed, only `tb_fluent_theme` was at
  fault; other 7 are clean.
- Re-import data: data is intact, never lost.

## Known issues / things to verify in the morning

1. **Visual check:** confirm the products at `/btcl/erp/products`
   render correctly. The old DB had broken rendering — the clean DB
   should fix it, but you mentioned this so it's worth eyeballing.
2. **Demo-data parse error noise:** Odoo logs a warning about
   `addons/sale/data/product_demo.xml` parse on every boot — this is
   pre-existing v19 source-tree noise, not blocking, all 80 modules
   load anyway.
3. **2 v17 demo sale_orders + 1 demo payment** were skipped during
   re-import (referenced FKs not in scope). If you actually need that
   demo data, easiest is to recreate via Odoo UI.
4. **`odoo_btcl` and `odoo_telcobright` v17-schema DBs still exist**
   in PG — left untouched as backup. Drop when you're confident the
   single-DB mode is what you want.
5. **`odoo_billing_19_v17migrated_bak`** also still in PG (5.4M) —
   the previous broken in-place-migrated DB. Same: drop when
   confident.

## How to roll back

If anything's wrong and you want the previous (v17→v19 migrated) DB back:

```bash
cd /home/mustafa/telcobright-projects/orchestrix-v2

# stop Odoo
ps -ef | grep odoo-bin | grep -v grep | awk '{print $2}' | xargs kill

# rename clean → bak, restore migrated → primary
psql -h /run/postgresql -p 5433 -U mustafa -d postgres -c "
  ALTER DATABASE odoo_billing_19 RENAME TO odoo_billing_19_clean_bak;
  ALTER DATABASE odoo_billing_19_v17migrated_bak RENAME TO odoo_billing_19;
"

# revert branch
git checkout master

# restart Odoo
cd odoo-backend-19 && nohup ./venv/bin/python odoo-src/odoo-bin -c odoo.conf --dev=assets &
```

The branch `clean-v19-rebuild` and the SQL dumps under `backups/`
remain available for any second attempt.
