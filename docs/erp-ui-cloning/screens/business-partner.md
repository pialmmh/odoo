# Business Partner — clone progress (POC)

Status: **read-only end-to-end through the BFF; writes return 501 with banner**.

## What's wired

```
React (/erp/bpartner) ── /api/erp/bpartners/* ── ErpBPartnerController (proxy)
                                                          │
                                                          ▼
                                  http://127.0.0.1:7079/erp-api/window/123/...
                                                          │
                                                          ▼
                                  in-process bundle: GridWindowVO, Query,
                                  MTable.getPO(), MLookupFactory
                                                          │
                                                          ▼
                                                       Postgres
```

- Sidebar: **Experimental → ERP Business Partner (exp)**.
- List: `GET /api/erp/bpartners?search=&page=&size=&sort=&dir=`
  → proxy GETs `/erp-api/window/123/tab/0/rows…`, rewrites items to vendor-neutral
  camelCase (`id`, `value`, `name`, `groupName`, `isCustomer`, …).
- Detail: `GET /api/erp/bpartners/{id}` → `/erp-api/window/123/tab/0/row/{id}`.
  Snake-case payload is translated through the bundled AD column index
  (`api/src/main/resources/erp/idempiere/c_bpartner_window.json`) so
  `isactive` → `IsActive` → `isActive`. `_display` keys are pinned to
  `groupName`, `orgName`, `priceListName`, etc.
- Capability probe: `GET /api/erp/bpartners/_caps` → `{reads:true, writes:false}`.
- Edit page: respects `_caps.writes`. When `false`:
  - Banner: "Editing is temporarily unavailable." (no backend names).
  - SaveBar message swaps; primary button disabled.
  - On forced save attempt (race), 501 is mapped to the same copy.

## Backend BFF endpoints used by this screen

Source: `orchestrix-v2/erp-api/src/main/java/com/telcobright/erp/api/ApiServlet.java`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/erp-api/window/{wid}/spec` | window+tab+field metadata via `GridWindowVO.create` |
| GET | `/erp-api/window/{wid}/tab/{n}/rows` | paginated rows via `Query.setPage(...)` |
| GET | `/erp-api/window/{wid}/tab/{n}/row/{id}` | single row via `MTable.getPO` |
| GET | `/erp-api/lookup/{ad_reference_id}` | dropdown rows via `MLookupFactory.getLookupInfo` |

All four go through iDempiere's model layer — no handcrafted SELECTs.
Reference type names are normalized server-side (`AD_REF_NAME` map):
`TableDir → "Table Direct"`, `YesNo → "Yes-No"`, etc., so the React
`FieldRenderer` matches without extra translation.

## Skill compliance — fluent-ui-forms

`ErpBPartnerDetail.jsx`:

- 12-col CSS grid with explicit per-field span (boolean=2, FK/number/date=4,
  text=6, memo=12).
- Mixed-type alignment: checkbox/button rows use `paddingTop: 26px` wrapper
  to baseline-align with labelled neighbours.
- Responsive: at ≤1023px each cell snaps to span 6; at ≤639px to span 12.
- Section headers from `AD_FieldGroup` rendered as Panel titles.
- Sticky save bar with bordered surface and 24px top spacing.

## Stubbed / known gaps

- **Writes**: `POST /api/erp/bpartners`, `PATCH /…/:id`, `DELETE /…/:id`
  return **501** with `{error:"not_implemented"}`. The BFF write path
  (`GridTab.setValue` → `dataSave`) is the next milestone — needs session
  lifecycle + callout dispatch.
- **Child tab rows** are still read directly from `/erp-api/window/123/tab/N/rows`
  via `services/erpBundle.js` — same BFF, just not through the Spring proxy.
  Acceptable because no JDBC is in the request path; revisit if we want to
  fold child-tab reads into `/api/erp/bpartners/...`.
- **Lookups (FK pickers)** are read-only in the form. The display value is
  resolved server-side; an actual picker UI is not in this PR.
- Headless context is hardcoded to GardenWorld super-admin (`AD_Client_ID=11`,
  `AD_User_ID=100`, `AD_Role_ID=102`). Per-user role context is a separate
  task once the BFF gains JWT verification.

## Manual smoke

1. `./launch-all.sh --status` — all green.
2. Open `http://localhost:5180/telcobright/erp/bpartner` (Keycloak `admin`/`password`).
3. List shows 18 GardenWorld BPartners.
4. Open `Agri-Tech` (id 200000):
   - Header chips: **Active**, **Customer**.
   - Banner: **Editing is temporarily unavailable.**
   - Side rail with 9 child tabs.
   - General panel populated end-to-end (Tenant=GardenWorld,
     Group=Standard Customers, Search Key=Agri-Tech, Customer ✓).

## Files touched

- `api/src/main/java/com/telcobright/api/controller/ErpBPartnerController.java` — rewritten as proxy.
- `api/src/main/java/com/telcobright/api/erp/idempiere/IdempiereBPartnerService.java` — **deleted**.
- `api/src/main/java/com/telcobright/api/erp/idempiere/IdempiereProperties.java` — added `bffUrl`.
- `api/src/main/java/com/telcobright/api/config/SecurityConfig.java` — `_caps` permitAll.
- `api/src/main/resources/application.yml` — `erp.idempiere.bffUrl`.
- `ui/src/services/bpartners.js` — added `getCaps`, `saveBPartner`, `createBPartner`, `deleteBPartner`.
- `ui/src/pages/erp/ErpBPartnerDetail.jsx` — 12-col grid, span planning,
  responsive collapse, mixed-type alignment, caps-gated save bar + banner,
  switched save handlers to proxy.
- `ui/src/layouts/Sidebar.jsx` — Experimental → ERP Business Partner (exp).
- `erp-api/src/main/java/com/telcobright/erp/api/ApiServlet.java` —
  `AD_REF_NAME` normalization map; `referenceName()` helper.
