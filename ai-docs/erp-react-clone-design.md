# ERP React Clone — Design & Plan

**Status:** active design doc. Read this end-to-end before resuming or making
architecture-level decisions. Update it whenever a load-bearing decision
changes (don't bury new decisions in commit messages).

**Last meaningful update:** 2026-04-29 — initial consolidation after the
inventory module landed and after agreeing on the ERP-adapter pattern.

---

## 0. Why this doc exists

We are cloning Odoo's UI/UX in our React app while keeping the data backend
pluggable (today: iDempiere; tomorrow: Odoo or others). The work spans
multiple sessions, several backends, and a strict UI ruleset. This doc is the
single place to load context cold:

1. Where things live (code paths, ports, indexed repos, credentials).
2. What is already built and known-working.
3. The architecture we agreed on.
4. The migration plan and the order in which steps must happen.
5. Project rules that override defaults (Fluent UI v9 only, no backend names
   in UI, etc.).

If a future session contradicts this doc, **either update the doc first** or
explain in the next commit why the doc is now wrong.

---

## 1. North-star architecture

The new clone work runs **side-by-side** with the existing `/erp` system,
not in place of it. Two parallel routes/packages, both serving the same
React app:

```
┌───────────────────────────────────────────────────────────────┐
│ React UI (orchestrix-v2/ui)  — Fluent UI v9, single SPA       │
│                                                               │
│   /erp/...     existing iDempiere clone screens (untouched)   │
│                Sidebar entry: "ERP" / "ERP Warehouses (exp)"  │
│                                                               │
│   /erp-v2/...  new Odoo-style clone (this design)             │
│                Sidebar entry: separate "ERP v2" group         │
│                Source folder: ui/src/pages/erp-v2/            │
└──────────────────────────┬────────────────────────────────────┘
                           │ JSON
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ Spring Boot platform api (orchestrix-v2/api)                  │
│                                                               │
│   /api/erp/**     existing controllers, inline forwarders     │
│                   package: com.telcobright.api.controller     │
│                   (do NOT touch — they keep /erp working)     │
│                                                               │
│   /api/erp-v2/**  new controllers using the adapter pattern   │
│                   package: com.telcobright.api.erpv2.*        │
│                   thin: delegate to ErpAdapter only           │
└──────────────────────────┬────────────────────────────────────┘
                           │ ErpAdapter (interface, in erpv2/)
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ ErpAdapter implementations (erpv2/idempiere, erpv2/odoo, …)   │
│  - IdempiereErpAdapter  (today)                               │
│  - OdooErpAdapter       (later)                               │
│  - ErpNextErpAdapter    (already scaffolded on orchestrix-erp │
│                          for tax-rate slice; expand later)    │
│ Selected by `erp.backend` config.                             │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ├──► iDempiere BFF servlet
                           │     erp-api/ApiServlet.java — uses
                           │     MTable/MProduct/MWarehouse/MInOut/
                           │     MMovement/MInventory only — no SQL.
                           │
                           ├──► Odoo JSON-RPC (later)
                           └──► ErpNext REST (later)
```

**Why two systems instead of one refactor:** the existing `/erp` screens
are working and committed. Refactoring their controllers risks breaking
them. The new clone is a green-field design (Odoo-style UX, adapter
pattern, vendor-neutral DTOs). Running them in parallel under separate
routes lets the new system reach feature-parity at its own pace; old
screens get retired one by one when their `/erp-v2` counterpart ships.

**Hard rules backing this picture:**

- **No raw SQL** against either ERP. iDempiere writes go through PO + GridTab
  + `processIt("CO")` + `Doc.postImmediate(...)`. iDempiere reads go through
  `MTable.get(...)` + the `Query` API. Odoo reads/writes go through
  JSON-RPC `call_kw` only.
- **Vendor names never appear in UI strings.** `product.template` → "Product".
  `M_Warehouse` → "Warehouse". `C_BPartner` → "Customer" / "Vendor". This
  is enforced by `orchestrix-v2/CLAUDE.md`.
- **Catalog source-of-truth (per project CLAUDE.md):** Odoo is canonical for
  product / pricing / tax class. We currently *also* use iDempiere for
  product to support inventory + accounting; the long-term goal is the
  adapter abstracting which backend serves what. The current focus
  (per latest user direction) is iDempiere.

---

## 2. Project state — known-working, 2026-04-29

### 2.1 Inventory module (committed and uncommitted)

| Capability                  | Where                                  | Status                                  |
|-----------------------------|----------------------------------------|-----------------------------------------|
| Adjust on-hand (Physical Inventory, Difference) | `ApiServlet.inventoryAdjust` + `/api/erp/inventory/adjust` + `InventoryDialogs.AdjustStockDialog` | Smoke-tested, docStatus=CO |
| Receive from vendor (Material Receipt) | `ApiServlet.inventoryReceive` | Smoke-tested |
| Move between locators       | `ApiServlet.inventoryMove`             | Smoke-tested |
| Internal use / Issue        | `ApiServlet.inventoryIssue` (auto-resolves first active `MCharge` if not supplied) | Smoke-tested |
| Synchronous accounting post | `postSync` helper calling `Doc.postImmediate(MAcctSchema[], …, force=true, null)` after every `processIt("CO")` | Working; demo-data warnings about "No Costs for Oak Tree" are GardenWorld limitation, not a defect |
| Warehouse list              | `ErpWarehouseList.jsx` + `/api/erp/warehouses` | Working |
| Warehouse detail (locators + product×locator stock) | `ErpWarehouseDetail.jsx` + `/api/erp/warehouses/{id}/locators` and `/stock` | Working |
| Vendor / Charge pickers     | `/api/erp/bpartners/list?role=vendor`, `/api/erp/charges/list` | Working |

Known data quirk: GardenWorld vendors `Color Inc` (50001), `Chrome Inc`
(50002) have no active `C_BPartner_Location` — `inventoryReceive` rejects
them cleanly with a clear error. Use Patio Fun (121), GardenUser (119),
Chemical Product (50003), or GardenAdmin (113) for receipt smoke tests.

### 2.2 Other ERP screens already on main

- `ErpProductList.jsx`, `ErpProductDetail.jsx`, `ErpProductSimpleDetail.jsx`
  — all iDempiere-backed via the BFF.
- `ErpBPartnerList.jsx`, `ErpBPartnerDetail.jsx` — full CRUD via GridTab.
- ERP workspace shell (`pages/erp/workspace/*`) — multi-document tab shell,
  app catalog, app search, dirty indicator.

### 2.3 Spring Boot platform (`api/`) — current shape

```
com.telcobright.api/
├── controller/
│   ├── ErpProductController.java
│   ├── ErpBPartnerController.java
│   ├── ErpInventoryController.java     (new — Adjust/Receive/Move/Issue forwarder)
│   ├── ErpWarehouseController.java     (new — warehouses/bpartners/charges forwarder)
│   ├── OdooProxyController.java        (separate concern: catalog/billing admin)
│   ├── KillBillProxyController.java
│   ├── EspoProxyController.java
│   ├── NmsGaleraController.java
│   ├── MeetingsController.java
│   └── CallRoomExperimentController.java
├── erp/idempiere/
│   ├── IdempiereProperties.java        (BFF base URL)
│   └── IdempiereProductService.java    (legacy direct-JDBC — to be deleted)
├── odoo/
│   └── OdooClient.java
├── config/, espo/, killbill/, livekit/, nms/, tenant/, filter/
└── PlatformApiApplication.java
```

The `Erp*Controller`s currently inline a `RestTemplate` forward to the
in-iDempiere BFF. That inlined code is the chunk we lift into
`IdempiereErpAdapter` during the refactor.

### 2.4 In-iDempiere BFF (`erp-api/ApiServlet.java`)

Single OSGi bundle inside iDempiere. Routes:

| Pattern                        | Returns                                   |
|--------------------------------|-------------------------------------------|
| `POST /inventory/adjust`       | `{ok, inventoryId, documentNo, docStatus, postWarning?}` |
| `POST /inventory/receive`      | `{ok, inoutId, documentNo, docStatus}`    |
| `POST /inventory/move`         | `{ok, movementId, documentNo, docStatus}` |
| `POST /inventory/issue`        | `{ok, inventoryId, documentNo, docStatus}` |
| `GET  /warehouse/list`         | `{items: [{id, name, …}]}`                |
| `GET  /warehouse/{id}/locators`| `{items: [{id, code, qtyOnHand, …}]}`     |
| `GET  /warehouse/{id}/stock`   | `{items: [{productId, productName, locatorId, qty, …}]}` |
| `GET  /bpartner/list?role=…&q=…` | `{items: [{id, name, …}]}`              |
| `GET  /charge/list`            | `{items: [{id, name}]}`                   |
| (existing) product / bpartner CRUD via GridTab |                              |

Hot-deploy gotcha: Felix OSGi caches. After dropping a new bundle:

```bash
pkill -9 -f equinox.launcher
rm -rf $IDEMP/configuration/org.eclipse.osgi/[0-9]* \
       $IDEMP/configuration/org.eclipse.osgi/.manager \
       $IDEMP/configuration/org.eclipse.osgi/framework.info*
```

Then start iDempiere normally.

---

## 3. Target architecture: ERP adapter pattern (under `erpv2/`)

### 3.1 New package layout (`erpv2/` — leaves existing `controller/` and `erp/` alone)

```
com.telcobright.api/
├── controller/                           UNCHANGED — existing /api/erp/* forwarders
│   ├── ErpProductController              (keep — serves /erp screens)
│   ├── ErpWarehouseController            (keep)
│   ├── ErpInventoryController            (keep)
│   └── ErpBPartnerController             (keep)
├── erp/                                  UNCHANGED — existing iDempiere helpers
│   └── idempiere/
│       ├── IdempiereProperties.java      (still used by old controllers)
│       └── IdempiereProductService.java  (legacy JDBC; delete IF zero refs)
├── erpv2/                                NEW — adapter-based stack
│   ├── ErpAdapter.java                   interface — vendor-neutral domain ops
│   ├── ErpAdapterConfig.java             @Configuration + @ConditionalOnProperty wiring
│   ├── ErpV2Properties.java              binds erp-v2.* config keys
│   ├── controller/                       REST surface for /api/erp-v2/**
│   │   ├── ErpV2ProductController.java
│   │   ├── ErpV2WarehouseController.java
│   │   ├── ErpV2InventoryController.java
│   │   └── ErpV2BPartnerController.java
│   ├── dto/                              canonical, vendor-neutral DTOs
│   │   ├── ProductDto.java
│   │   ├── WarehouseDto.java
│   │   ├── LocatorDto.java
│   │   ├── BPartnerDto.java
│   │   ├── ChargeDto.java
│   │   ├── StockOnHandDto.java
│   │   ├── InventoryAdjustRequest.java
│   │   ├── InventoryReceiveRequest.java
│   │   ├── InventoryMoveRequest.java
│   │   ├── InventoryIssueRequest.java
│   │   └── InventoryDocResult.java
│   ├── idempiere/                        backend impl (today)
│   │   ├── IdempiereErpAdapter.java      @ConditionalOnProperty(name="erp.backend", havingValue="idempiere")
│   │   ├── IdempiereV2Properties.java    URL of the in-iDempiere BFF
│   │   └── IdempiereDtoMapper.java       JsonNode ↔ DTO
│   ├── odoo/                             FUTURE
│   │   ├── OdooErpAdapter.java
│   │   ├── OdooProperties.java
│   │   └── OdooDtoMapper.java
│   └── erpnext/                          FUTURE (tax-rate slice already started on orchestrix-erp branch)
│       ├── ErpNextErpAdapter.java
│       ├── ErpNextProperties.java
│       └── ErpNextDtoMapper.java
└── (other packages: espo, killbill, livekit, nms, tenant, filter, …)
```

`OdooProxyController` and `odoo/OdooClient.java` stay where they are —
they serve catalog/billing admin and are NOT part of the ERP-domain
abstraction. `OdooErpClient` / `OdooTaxRateService` (already on
`orchestrix-erp` branch) get folded into `erpv2/odoo/` when we wire the
Odoo adapter for real.

**No refactor of existing controllers.** The old `/api/erp/**` paths
keep doing what they do. New work goes under `/api/erp-v2/**`.

### 3.2 Configuration

`application.yml`:

```yaml
erp:
  backend: idempiere     # or "odoo" later
```

Each adapter implementation is a Spring bean gated with
`@ConditionalOnProperty(name="erp.backend", havingValue="<vendor>")`.
There is exactly one `ErpAdapter` bean active at runtime.

### 3.3 `ErpAdapter` interface (intended shape)

```java
public interface ErpAdapter {

    // Catalog
    List<ProductDto> listProducts(ProductFilter filter);
    ProductDto getProduct(int id);
    ProductDto saveProduct(ProductDto dto);  // create or update

    // Partners
    List<BPartnerDto> listBPartners(BPartnerFilter filter);
    BPartnerDto getBPartner(int id);

    // Warehouses + locators
    List<WarehouseDto> listWarehouses();
    List<LocatorDto>   listLocators(int warehouseId);
    List<StockOnHandDto> getWarehouseStock(int warehouseId);

    // Charges (for Issue)
    List<ChargeDto> listCharges();

    // Inventory operations (each posts the document and the journal)
    InventoryDocResult adjust(InventoryAdjustRequest req);
    InventoryDocResult receive(InventoryReceiveRequest req);
    InventoryDocResult move(InventoryMoveRequest req);
    InventoryDocResult issue(InventoryIssueRequest req);
}
```

Method names use **domain language**, not vendor terms (no `MInOut`, no
`stock.picking`, no `M_Movement`).

### 3.4 DTO field-set policy

Default approach: **start from the union of fields needed by current
flows, plus what Odoo's product-view exposes**, all marked nullable so we
don't force every backend to fill every field.

For `ProductDto`:

- Identity: `id`, `name`, `value` (sku/code), `description`
- Type / flags: `productType`, `isStocked`, `isSold`, `isPurchased`, `isActive`
- UoM: `uomId`, `uomName`
- Category: `categoryId`, `categoryName`
- Pricing (from current pricelist context): `listPrice`, `standardPrice`, `limitPrice`, `currency`
- Inventory rollup (optional — stamped by adapter when known): `qtyOnHand`, `qtyAvailable`
- Vendor / supplier defaults (optional): `vendorId`, `vendorName`, `vendorProductCode`
- Dimensions / weight (optional): `weight`, `volume`
- Audit: `createdAt`, `updatedAt`

For `WarehouseDto`, `LocatorDto`, `BPartnerDto`, etc. — same approach:
union of what each backend exposes that we'd plausibly show, all
nullable.

Field naming uses **camelCase domain terms**, not vendor field names.
The adapter's `*DtoMapper` is responsible for translating
`M_Product.Name` → `ProductDto.name`, etc.

### 3.5 Build plan (additive — old `/erp` keeps working)

No refactor of existing controllers. The plan creates `erpv2/` from
scratch and adds new `/api/erp-v2/**` routes.

1. **Add `erpv2` skeleton.** Create `ErpAdapter` interface, all DTOs,
   `ErpAdapterConfig`, `ErpV2Properties`. Build still passes (no beans
   actually wired yet because no `@ConditionalOnProperty` impl is
   present). No /api/erp-v2 routes yet — placeholder package only.
2. **Implement `IdempiereErpAdapter`.** It calls the existing
   in-iDempiere BFF (no second BFF needed), maps `JsonNode → DTO` via
   `IdempiereDtoMapper`. Bean is gated `@ConditionalOnProperty(name="erp.backend", havingValue="idempiere")`.
3. **Add first `/api/erp-v2/**` controller — Product.** Thin: returns
   `adapter.listProducts(...)`. Verify with curl that
   `/api/erp/products` (old) and `/api/erp-v2/products` (new) both
   work side-by-side.
4. **Add the rest of the v2 controllers** — Warehouse, Inventory, BPartner.
5. **Smoke-test old endpoints unchanged** — Adjust/Receive/Move/Issue
   on /erp must still pass.
6. **Delete `IdempiereProductService.java`** ONLY if `find_references`
   shows zero callers. Otherwise leave it.
7. **Begin the Odoo-clone UI work** under `/erp-v2` (Phase A onwards
   in §4).

---

## 4. Odoo → React clone workflow

The reference is `/home/mustafa/Downloads/odoo-cloning-CLAUDE.md`.
We adapt it for our environment as follows.

### 4.1 Adaptations from the upstream cloning doc

| Doc says                           | Our reality                              |
|------------------------------------|------------------------------------------|
| Tailwind CSS                       | **Fluent UI v9** strictly. Tokens only. Griffel longhand. |
| Generic `web_search_read` against Odoo | Generic adapter call against `ErpAdapter`; Odoo metadata informs UI shape, not data |
| Cookie auth to Odoo                | Existing Keycloak Bearer auth (already wired with token interceptor) |
| New parallel project               | Extend `ui/erp/` directly                |
| Search panel matches Odoo          | Search panel is **modern, our theme** — explicit per the user |
| Single dynamic route `/web/:actionId` | Slot inside existing ERP workspace shell `pages/erp/workspace/*` |

### 4.2 Phase A — Odoo metadata discovery (UI design reference)

Goal: capture *what Odoo renders* for the inventory module, scoped down.
Output is a design input, not a runtime feed.

1. Confirm Odoo creds (already verified):
   - URL: `http://localhost:7169`
   - DB: `odoo_billing`
   - Login: `admin`
   - Password: `admin`
   - Server version: 17.0 (`/web/webclient/version_info`)
   Store in `.env.local`, **never commit**.
2. Authenticate via `POST /web/session/authenticate`.
3. Dump in this order to `data/raw/`:
   - `version.json` — `GET /web/webclient/version_info`
   - `menus.json` — `GET /web/webclient/load_menus` (filter to inventory subtree)
   - `actions.json` — read `ir.actions.act_window` for every action ID under the inventory subtree
   - `models.json` — `search_read` on `ir.model.fields` for every `res_model` referenced
   - `views.json` — `model.get_view({view_id, view_type})` for every `(model, view_type)` pair (Odoo returns the resolved arch — inheritance already merged)
   - `groups.json`, `modules.json` — for ACL / module hygiene
4. Parse arch XML → JSON AST under `data/parsed/views.json` (use
   `fast-xml-parser` with attribute preservation; preserve verbatim:
   `string`, `name`, `widget`, `invisible`, `readonly`, `required`,
   `domain`, `context`, `options`, `class`, `groups`, `attrs`, `column_invisible`,
   `decoration-*`, `optional`, all kanban `<templates>`, search `<filter>`,
   form `<header>` `<sheet>` `<group>` `<notebook>` `<page>` `<chatter>`).
5. Quality gate: report counts (menus, actions, models, views) and any
   models referenced by actions but missing from `ir.model`.

Use `jcodemunch` against `odoo-src` to *understand* anomalies (Python
computed fields, widget semantics) — don't just guess from the JSON.

### 4.3 Phase B — Visual reference (Playwright MCP)

One screenshot per `(view_type, representative_model)` from the
inventory module:

- kanban: `stock.picking.type`
- list: `product.template` (or `stock.move.line`)
- form: `product.template` (rich; has notebook)
- search panel: `product.template`
- app chrome: sidebar, breadcrumb, user menu
- design tokens: computed style of `body` and `.o_main_navbar` →
  `data/parsed/tokens.json` (font-family, font scale, accent color,
  spacing scale, border radius, shadow)

Anti-patterns: looping every action, screenshotting every page,
extracting layout from screenshots. **Arch wins. Screenshot is reference
only.**

### 4.4 Phase C — Canonical DTOs informed by Odoo + iDempiere

Already covered in §3.4. The Phase A dump tells us which fields Odoo
shows on, e.g. the product form notebook. We add any of those to the
DTO that we want to surface.

### 4.5 Phase D — React generation (under `ui/src/pages/erp-v2/`)

**New folder, new route.** Existing `ui/src/pages/erp/` stays untouched.
The new clone lives under:

```
ui/src/pages/erp-v2/
  ErpV2Workspace.jsx          (own workspace shell — can clone the existing one)
  ErpV2ProductList.jsx
  ErpV2ProductDetail.jsx
  components/                 (engine pieces — KanbanView, ListView, FormView, ...)
  search/                     (modern search panel — our theme)
  AppShell/                   (sidebar, breadcrumb tied to /erp-v2)
ui/src/services/erpV2.js      (RPC client to /api/erp-v2/**, keycloak token)
```

The Sidebar gets a **separate group** for "ERP v2" (or similar — exact
label is a UI-text decision, no vendor names). Old "ERP" / "ERP
Warehouses (exp)" entries stay where they are.

**Prototype first: Product page.** The user explicitly chose this as
the prototype before the full inventory module. Build the new product
detail with:

- Layout patterns inspired by Odoo's product form (notebook with
  General / Sales / Purchase / Inventory tabs; statusbar; chatter
  optional).
- Rendered in **Fluent UI v9** components per `.claude/skills/fluent-ui-forms`.
- Data source: `ErpAdapter.getProduct(id)` / `saveProduct(dto)` →
  `IdempiereErpAdapter` → existing iDempiere BFF.
- Search panel uses our existing modern style (NOT Odoo's classic
  search bar).
- Acceptance: side-by-side compare with Odoo's product form for the
  same conceptual product. Field set / tabs match. Visual style is
  ours.

**Then: full Inventory module clone.** Exact clone of inventory links,
pages, nested tabs from Odoo (drives the menu tree and the action
graph). Each landing screen reads via `ErpAdapter` (today: iDempiere).

Implementation ordering for the engine pieces:

1. `ErpRpcClient` (new — talks to `/api/erp/...` with the existing
   keycloak token interceptor; mirrors the shape of `services/erpInventory.js`).
2. Schema types (`src/lib/erp-schema.ts` or similar — generated from
   our DTOs, not from Odoo's `models.json` directly).
3. Field components per `ttype × widget` actually appearing in our
   chosen subset of arch — built with Fluent v9 primitives.
4. View renderers (`KanbanView`, `ListView`, `FormView`, `SearchView`).
   `SearchView` is our existing modern style. Implement `Calendar`,
   `Pivot`, `Graph`, `Activity` only if the inventory subset uses them.
5. AppShell / route — slot inside existing ERP workspace shell. The
   existing tab/dirty/multi-doc behavior stays.

### 4.6 Phase E — Iterate to parity

For the cloned subset:

- Each screen passes the Phase B screenshot side-by-side at the field
  level (not pixel level — we're Fluent v9, not Odoo skin).
- `ErpAdapter` covers all read/write paths used.
- No vendor name leaks in user-facing text.

---

## 5. Tooling & MCP usage

### 5.1 Indexed jcodemunch repos (use these instead of grep/Read)

| Repo (jcodemunch ID)             | Path                                         | Use for |
|----------------------------------|----------------------------------------------|---------|
| `odoo-src-eeae1302`              | `orchestrix-v2/odoo-backend/odoo-src`        | Odoo 17 source — class definitions, field/widget semantics, computed-field logic |
| `idempiere-src-d6194ef9`         | `~/idempiere-src`                            | iDempiere model classes (MProduct, MWarehouse, MLocator, MInOut, MMovement, MInventory, MCharge, MAcctSchema, etc.) and Doc.* posting |
| `custom-addons-be89f052`         | `orchestrix-v2/odoo-backend/custom-addons`   | Local Odoo customizations (`x_kb_plan_name`, `x_kb_billing_period`, `x_package_items`) |
| `orchestrix-v2-f520478e`         | `orchestrix-v2`                              | Our app — last indexed 2026-04-25; **re-index before Phase D** |

Common moves:
- `search_symbols` — find a class/method by name or description.
- `get_context_bundle` — symbol source + imports in one call.
- `find_references` / `get_blast_radius` — before refactoring `ApiServlet.java` or any controller.
- `register_edit` — track our edits.

### 5.2 Playwright MCP

Used in Phase B only. Login once, persist storage state, capture the
short list above, dump tokens. Do NOT loop screenshots per action.

### 5.3 Odoo JSON-RPC

Plain `curl` or a small TS script (`scripts/1-discover.ts`). No MCP
needed — JSON-RPC is the source of truth, no DOM crawling.

### 5.4 Skills

- `.claude/skills/fluent-ui-forms` — invoke whenever generating any
  form, dialog, modal, settings panel, table filter bar, or input
  layout under `ui/`. Enforces 12-col grid, span-comment-first JSX,
  theme tokens, Griffel longhand, field-count thresholds.
- `.claude/skills/mui-forms` — for the legacy MUI surfaces only
  (don't introduce new MUI screens).

---

## 6. Project conventions (overrides defaults)

These come from `orchestrix-v2/CLAUDE.md` and `.claude/ui-rules.md`.
Re-stated here so this doc is self-contained.

1. **UI library: Fluent UI v9 only** for new work. MUI v6 is legacy
   (edit in place; do not introduce new MUI screens). Never import
   from any other UI lib.
2. **No backend names in user-facing strings.** "Odoo", "iDempiere",
   "Kill Bill", "Keycloak", "APISIX", "Vault", "Kafka" — never in
   labels, headings, errors, menus, page titles, tooltips. Allowed
   only inside service files / code comments / variable names.
3. **Theme tokens only.** Colors, spacing, typography, radii come from
   `tokens.*` (Fluent) or `theme.palette.*` / `theme.spacing()` (MUI).
   No raw hex, no raw px, no inline styles except SVG icons.
4. **Griffel longhand.** Fluent's `makeStyles` rejects shorthand for
   RTL safety. Use `borderTopWidth` / `Style` / `Color`, not `border:`.
   Same for `padding`, `outline`, `transition`.
5. **Form field-count thresholds (apply automatically):**
   1–6 flat, 7–12 subtitle headers, 13–24 tabs, 25+ vertical-tab rail
   or wizard.
6. **12-column grid.** Every row gets a span-plan comment first:
   `{/* Row 1: Code(md=2) + Name(md=4) + Price(md=3) + UoM(md=3) = 12 ✓ */}`
7. **No raw SQL against iDempiere.** Reads via `Query` / `MTable`,
   writes via `PO`/`GridTab` + `processIt("CO")` + `Doc.postImmediate`.
   This rule is in user memory and is hard.
8. **No SaaS-only fallbacks for hypothetical needs.** Only validate
   at system boundaries (user input, external APIs). Internal code
   trusts framework guarantees.

---

## 7. Reference data

### 7.1 Paths

| Thing                                  | Path                                                                                              |
|----------------------------------------|---------------------------------------------------------------------------------------------------|
| Main React UI                          | `orchestrix-v2/ui/`                                                                               |
| ERP screens (existing)                 | `orchestrix-v2/ui/src/pages/erp/`                                                                 |
| Spring Boot platform API               | `orchestrix-v2/api/src/main/java/com/telcobright/api/`                                            |
| In-iDempiere BFF servlet               | `orchestrix-v2/erp-api/src/main/java/com/telcobright/erp/api/ApiServlet.java`                     |
| Cloning doc (upstream)                 | `~/Downloads/odoo-cloning-CLAUDE.md`                                                              |
| Project rules                          | `orchestrix-v2/CLAUDE.md`, `orchestrix-v2/.claude/ui-rules.md`                                    |
| UI skills                              | `orchestrix-v2/.claude/skills/{fluent-ui-forms,mui-forms}/`                                       |
| Odoo install                           | `orchestrix-v2/odoo-backend/`                                                                     |
| Odoo conf                              | `orchestrix-v2/odoo-backend/odoo.conf`                                                            |
| iDempiere window-spec extractor        | `orchestrix-v2/scripts/idempiere/extract_window.py`                                               |

### 7.2 Ports / endpoints

| Service                        | Port / URL                                |
|--------------------------------|-------------------------------------------|
| Local iDempiere                | port 7079 (per memory)                    |
| iDempiere Postgres             | port 5433 (per memory)                    |
| Local Odoo                     | `http://localhost:7169`                   |
| Odoo Postgres                  | port 5433, db `odoo_billing`              |
| In-iDempiere BFF base          | (set via `IdempiereProperties.bff-url`)   |
| Spring Boot platform           | (per `application*.yml`)                  |

### 7.3 Credentials (do NOT commit; copy into `.env.local` only)

```
ODOO_URL=http://localhost:7169
ODOO_DB=odoo_billing
ODOO_USER=admin
ODOO_PASSWORD=admin
```

iDempiere admin / GardenWorld credentials per the iDempiere install
doc — kept out of this file.

### 7.4 Felix OSGi cache reset (when iDempiere serves stale BFF code)

```bash
pkill -9 -f equinox.launcher
rm -rf $IDEMP/configuration/org.eclipse.osgi/[0-9]* \
       $IDEMP/configuration/org.eclipse.osgi/.manager \
       $IDEMP/configuration/org.eclipse.osgi/framework.info*
# then start iDempiere normally
```

---

## 8. Decision log

| Date       | Decision                                                                                              | Rationale |
|------------|-------------------------------------------------------------------------------------------------------|-----------|
| 2026-04-29 | Inventory writes via PO + GridTab + `processIt("CO")` + `Doc.postImmediate(...)`                      | Correctness; matches ZK behavior; user rule "no manual SQL" |
| 2026-04-29 | React stays "as dumb as ZK" — no client-side validation                                                | User direction; iDempiere is the validator |
| 2026-04-29 | Inventory dialogs surface BFF 422 messages verbatim                                                    | Same as above; UI never lies about what server thinks |
| 2026-04-29 | Adopt **ERP adapter pattern** — `ErpAdapter` interface + `IdempiereErpAdapter` + (future) `OdooErpAdapter`. Selected by `erp.backend` config. | User direction; cleanest place to plug Odoo in later |
| 2026-04-29 | `OdooProxyController` + `OdooClient` stay outside the ERP-domain abstraction                            | They serve catalog/billing admin, not domain ERP ops |
| 2026-04-29 | Product page is the **prototype** for the Odoo-clone work; full inventory module follows                | User direction |
| 2026-04-29 | Search panel is **our modern style**, NOT an Odoo clone                                                 | User direction |
| 2026-04-29 | Extend `ui/erp/` in-place; do NOT create a parallel `ui-odoo/` app                                      | User direction |
| 2026-04-29 | Bundler stays existing (Vite + Fluent UI v9 + Tanstack Query) — no Tailwind                             | Project rules |
| 2026-04-29 | Delete `erp/idempiere/IdempiereProductService.java` (legacy direct-JDBC) **after** zero-references check | Aligns with no-SQL rule |
| 2026-04-29 | New work lives **side-by-side** under `/erp-v2` (UI route) and `com.telcobright.api.erpv2.*` (backend package). Existing `/erp` and `controller/Erp*Controller` are NOT refactored. | User direction — additive rollout, no risk to working screens |
| 2026-04-29 | Future development happens in the `orchestrix-erp` worktree on the `orchestrix-erp` branch. `main` is for stable / pushable state to GitHub. | User direction |
| 2026-04-29 | A third backend (ErpNext) is in scope long-term. A tax-rate slice has already been scaffolded on `orchestrix-erp` (`api/.../erp/erpnext/`, `api/.../erp/odoo/`, `api/.../erp/dto/`). Will be folded into `erpv2/` packages when wired. | User direction (commit on orchestrix-erp 47eb3b4) |

---

## 9. Open questions / TBDs

- [ ] Confirm DTO field-set strategy: union of Odoo + iDempiere with
  nullable optionals, or minimal core that grows per use case? Default
  picked above is the union; revisit when first DTO PR lands.
- [ ] How do we represent multi-warehouse stock rollup on `ProductDto`?
  Single scalar `qtyOnHand` is misleading once a product lives in many
  locators. Options: (a) optional, only set when the call is
  warehouse-scoped; (b) drop from DTO, expose via separate
  `getProductStock(productId)` adapter call.
- [ ] Search-panel UX details — single global search bar vs facets?
  We said "modern, our theme" but haven't picked the shape. Decide
  before Phase D step 4.
- [ ] When should `OdooErpAdapter` get its skeleton? Now (so we lock
  the interface against two implementations), or after iDempiere
  adapter ships (cheaper, lower risk)?
- [ ] `LivekitCallExp.jsx` modification on main is unrelated to the
  ERP work — confirm whether to commit alongside or strip out.

---

## 10. Resume checklist (cold start, after compact)

When opening a new session to continue this work:

1. **Read this file end-to-end.** Don't skim.
2. **Verify environment:**
   - iDempiere up: `curl http://localhost:7079/...`
   - Odoo up: `curl http://localhost:7169/web/login` (HTTP 200)
   - VPN up if jcodemunch MCP is needed: `ping -c1 10.10.186.1`
3. **Check what's committed:**
   `git -C /home/mustafa/telcobright-projects/orchestrix-v2 log --oneline -20`
   and `git status -s` to see what's in flight.
4. **Re-index `orchestrix-v2`** in jcodemunch if you'll be searching
   our code (the index can lag behind recent commits).
5. **Find your next step** in §3.5 (migration) or §4 (cloning phases).
   Each step lists prerequisites; do not skip.
6. **Update this doc** the moment a load-bearing decision changes.
   New rule, dropped DTO field, swapped library — document it.

---

## 11. Glossary (so we stop saying "the thing")

| Term             | Means                                                                                  |
|------------------|----------------------------------------------------------------------------------------|
| BFF              | The OSGi servlet inside iDempiere (`erp-api/ApiServlet.java`) that wraps iDempiere model classes for our Spring Boot platform |
| Platform API     | The Spring Boot service at `orchestrix-v2/api/` exposing `/api/erp/**`                 |
| ErpAdapter       | The Java interface in `com.telcobright.api.erp` that the Platform API delegates to    |
| Canonical DTO    | A vendor-neutral DTO (`ProductDto`, `WarehouseDto`, etc.) that the adapter both produces and consumes |
| Engine (cloning) | The set of generic React view components (`KanbanView`, `ListView`, `FormView`, `SearchView`, AppShell) that render Odoo arch into Fluent UI v9 |
| Arch             | An Odoo view's resolved XML (returned by `model.get_view`); inheritance is already merged in this resolved form |
| Posting          | Writing to `Fact_Acct` via `Doc.postImmediate(MAcctSchema[], adTableId, recordId, force, trxName)` |

---

*End of doc. Update freely; commit changes inline with whatever code change
they describe.*
