# Cloning iDempiere screens to React — the method

**Goal in one sentence**: Replace iDempiere's ZK web UI with React, screen by
screen, while keeping iDempiere's server-side engine (callouts, validation,
sequence/workflow, Model Validators, processes) intact and authoritative.

**Audience**: any agent picking up a "clone iDempiere screen X" task. Read this
first, then the per-screen shared instruction.

---

## 1. The trap to avoid

iDempiere's browser ⇄ server channel is **not** a REST API. ZK widgets talk to
the server over the proprietary **`zkau` Update Engine** — a stateful RPC that
exchanges component UUIDs and DOM diffs:

```
POST /webui/zkau   →  {cmd:"onChange", uuid:"B5", data:{value:"Foo"}}
                   ←  [{rmv:"B7"}, {addCld:{uuid:"B9", html:"…"}}]
```

Reverse-engineering this so React can speak `zkau` is a dead end: undocumented,
version-coupled, response payloads are HTML fragments, and the server-side
`Desktop`/session lifecycle does not fit React. Don't go there.

## 2. The two real sources of truth

iDempiere screens are not "ZK code" — they are a **renderer** sitting on top of
two stable layers. Both are reachable without touching ZK.

| Layer | What it is | Where it lives | What we do with it |
|---|---|---|---|
| **Metadata** — what fields/tabs/popups exist | Application Dictionary tables | `AD_Window`, `AD_Tab`, `AD_Field`, `AD_Column`, `AD_Reference`, `AD_Val_Rule`, `AD_Process`, `AD_Process_Para`, `AD_FieldGroup`, `AD_UserDef_*` (per-tenant overrides) | Read once per window, ship as JSON, render in React |
| **Behavior** — what happens when the user types/clicks/saves | `GridTab` / `GridField` / `MTable` / `ProcessCtl` Java APIs in `org.adempiere.base` | iDempiere JVM, in-process | Wrap in a small REST surface (the BFF) so React can drive the same engine ZK drives |

Everything else (column callouts, validation cascade, mandatory-on-save checks,
sequence generation, doc workflow, Model Validators) is implemented inside
those Java classes. Drive `GridTab.setValue()` and `GridTab.dataSave()` and
those side effects fire identically to a ZK click.

## 3. Architecture

```
React (Fluent UI v9)
  │  REST + WebSocket/SSE (later)
  ▼
Spring Boot (api/, Java 21)
  │  - tenant routing, Keycloak auth, audit
  │  - vendor-neutral ErpCatalogPort / ErpPartnerPort / ErpInvoicePort
  │  - per-tenant config picks the implementation (Odoo | iDempiere | ERPNext)
  │  HTTP
  ▼
org.tb.bff  (Java 17 OSGi bundle inside iDempiere, registered on the existing
             Equinox HttpService at :7079/tb-bff/*  —  no new port to operate)
  │  in-process Java
  ▼
GridTab / GridField / ProcessCtl   (the same services ZK calls)
  │
  ▼
Postgres + Model Validators + callouts
```

### Why the BFF is inside iDempiere (Java 17, not Java 21)

`GridTab` is not a library you can pull into another JVM. It depends on
iDempiere's OSGi bundles, the `Env`/`ServerContext` thread-local, the
PO cache, and Model Validators registered at server startup. The only way to
drive it correctly is to run inside the same JVM. iDempiere 12 pins
JavaSE-17 — the BFF inherits that constraint. Spring Boot stays on Java 21
and talks to the BFF over HTTP.

## 4. BFF endpoint contract (the canonical surface)

Spring Boot is a thin proxy + auth layer. The interesting contract is the BFF.
All endpoints under `:7079/tb-bff/`. Session-scoped state is keyed by an
opaque `sessionId` returned from `open`.

| Endpoint | ZK equivalent | What it does |
|---|---|---|
| `GET /window/{wid}/meta` | window load | Reads `AD_Window`/`AD_Tab`/`AD_Field`/`AD_Column`/`AD_Reference`. Returns vendor-neutral JSON: tabs (with parent-child links), fields (with type, mandatory, displayLogic, readOnlyLogic, validation rule), references (lookup sources). UserDef overrides applied for the calling user/role. |
| `POST /window/{wid}/tab/{tid}/open` | open a tab | Constructs a server-side `GridTab` from `GridWindowVO`/`GridTabVO`. Optional `parentSessionId` for child tabs. Returns `sessionId` + first row + initial field-state map. |
| `POST /tab/{sessionId}/query` | run query | `gridTab.setQuery(MQuery)` + `query()`. Returns row count + page. |
| `POST /tab/{sessionId}/navigate` | row navigation | `navigateCurrent()` / `navigate(row)`. Returns the new row's field map. |
| `POST /tab/{sessionId}/field/{col}` | type into a field | `gridTab.setValue(field, val)` → callouts fire → returns the **field diff** (only the cells that changed, including those changed by callouts). Errors/warnings included. |
| `POST /tab/{sessionId}/save` | save | `gridTab.dataSave()`. Fires Model Validators, sequence generation, doc workflow if applicable. Returns the saved row + any new fields populated by triggers. |
| `POST /tab/{sessionId}/delete` | delete row | `gridTab.dataDelete()`. |
| `POST /process/{procId}/run` | process button | Builds `ProcessInfo`, calls `ProcessCtl.process()`. Returns log + result. |
| `GET /reference/{refId}/lookup?q=…&parent=…` | dropdown / Info Window | Resolves `AD_Reference` → SQL lookup. Returns rows. |

The **field diff** response is what makes the React side small. ZK already
works this way internally — set one field, callouts may change five others,
diff the two states, render only the changed cells.

### Why this contract — and not generic CRUD over `MProduct`

Because generic CRUD bypasses the engine. Setting `M_Product.M_Product_Category_ID`
through `PO.set_ValueOfColumn` does **not** fire the column callout that
recalculates list price; calling `gridTab.setValue()` does. The whole point of
the BFF is to keep "every server-side side-effect that ZK triggers" intact.

## 5. Modern admin GUI pattern (search → list → edit)

iDempiere's ZK windows render as split panes (grid above, form below). We are
**not** cloning that layout. The React side is restructured into the standard
admin SaaS pattern:

```
/erp/products                     (LIST)
  - Sticky header: page title, "+ New" button
  - Search bar: free text + a few common filter chips (active, type, category)
  - Sortable, paginated table
  - Click a row → /erp/products/{id}

/erp/products/{id}                (EDIT)
  - Header: breadcrumb, doc identity (Value · Name · status pill)
  - Action bar (sticky top): Save, Cancel, Delete, Process menu (when applicable)
  - Field area: Fluent UI Sections (Classification, Pricing, Inventory, …),
    one section per AD_FieldGroup
  - Side rail (optional): related lists for child tabs (BOM, Substitutes,
    Vendors, …) — each opens an inline editor or a sub-route

/erp/products/new                 (NEW)
  - Same as edit, blank initial state
```

### Layout rules (apply the `fluent-ui-forms` skill)

- 12-column grid, consistent label pattern, vertical alignment of mixed controls.
- **Horizontal padding** on form panels — wide-screen monitors should not
  stretch fields edge-to-edge (per repo guideline). Cap form content width
  around `1080px` and center.
- **Vertically compact** — minimize empty rows; keep the form short enough
  that common edits don't need scrolling.
- Field types from `meta` map to Fluent components:
  `String → Input`, `Number → Input` (numeric), `YesNo → Switch`,
  `Date → DatePicker`, `TableDir/Search → Combobox` driven by
  `/reference/{refId}/lookup`, `Button → Button` that POSTs to
  `/process/{procId}/run`.
- **Don't** show field codes (`M_Product_Category_ID`) — show the AD_Field
  display name (`Product Category`) per the meta.

### Reactivity (callouts in the UI)

On every field commit (blur or explicit confirm), POST to `/tab/{sid}/field/{col}`,
take the returned diff, and `setState` only the changed fields. The component
must not assume callouts are local — a price change can come from a category
change.

## 6. Where new code lives

| Concern | Path | Notes |
|---|---|---|
| BFF bundle | `idempiere/idempiere-server/org.tb.bff/` | New OSGi bundle; built via the fast-path javac documented in `idempiere-server/docs_tb/build-deploy.md` |
| Spring Boot proxy | `orchestrix-v2/api/src/main/java/com/telcobright/api/erp/idempiere/` | New: `IdempiereBffClient` (HTTP), `IdempiereCatalogAdapter implements ErpCatalogPort` |
| Vendor-neutral port | `orchestrix-v2/api/src/main/java/com/telcobright/api/erp/port/` | `ErpCatalogPort`, DTOs (`ProductFamily`, `ProductVariant` …) — **must not leak any iDempiere or Odoo type names** |
| React | `orchestrix-v2/ui/src/pages/erp/` | Replace experimental `ErpProductList.jsx` / `ErpProductDetail.jsx` in-place with the modern admin layout above |
| Service hooks | `orchestrix-v2/ui/src/services/erpProducts.js` | Stay vendor-neutral (`listProducts`, `getProduct`, `setField`, `saveProduct`) |

## 7. Per-screen workflow

For each new screen we clone:

1. Identify the iDempiere window (`AD_Window_ID`) and primary tab.
2. Hit `/window/{wid}/meta` (or read the AD_ tables directly while the BFF is
   being built) to get the canonical layout.
3. Decide the modern admin layout (search → list → edit). Group fields per
   `AD_FieldGroup`. Pick which child tabs become inline lists vs. sub-routes.
4. Build the React list page — list endpoint + filters that map to columns
   the AD spec marks as `IsSelectionColumn` or commonly searched.
5. Build the React edit page from the meta; wire each field to the BFF's
   `field/{col}` setter so callouts fire.
6. Wire the action bar — Save calls `/save`, Process buttons call `/process`,
   Delete calls `/delete`.
7. End-to-end smoke: open list, create a record, edit a field that has a
   callout, save, verify the same record opens identically in iDempiere ZK.

## 8. What exists today

- `api/src/main/java/com/telcobright/api/erp/idempiere/IdempiereProductService.java`
  — read-only direct-JDBC against `M_Product` joined to `M_Product_Category`.
  **Stop-gap**; will be replaced by the BFF call once the bundle ships, but
  fine to keep using for the first list/read clone.
- `api/src/main/resources/erp/idempiere/m_product_window.json` — a static
  hand-extracted spec of the M_Product window. Treat as a hint for column
  metadata; the BFF's `meta` endpoint replaces it once available.
- `ui/src/pages/erp/ErpProductList.jsx` and `ErpProductDetail.jsx` — first
  experimental Fluent UI v9 product screen. Modern admin restructure replaces
  these in place.
- `org.tb.bff` — **not yet scaffolded**. First task already queued.

## 9. Constraints (do not break)

- **UI must never expose backend tech names** (Odoo, iDempiere, Kill Bill,
  Keycloak, APISIX). Use neutral terms: "Catalog", "Customer", "Subscription".
  See repo `CLAUDE.md`.
- **Catalog single source per environment.** When `erp.adapter=iDempiere`,
  `M_Product` is canonical for that tenant. Never write prices into a
  KB catalog XML or a hardcoded `planFeatures.js`. See
  `~/.claude/projects/-home-mustafa-telcobright-projects-orchestrix-v2/memory/feedback_catalog_single_source.md`.
- **Java 17 only inside iDempiere**, Java 21 in Spring Boot. Two JVMs. Don't
  collapse.
- **No new MUI**. Fluent UI v9 only. Apply the `fluent-ui-forms` skill on
  every screen.
- **No raw SQL writes to iDempiere from Spring Boot.** Writes go through the
  BFF (which goes through GridTab) so callouts fire.
- **Container ports stay in the 7000 range.** BFF reuses iDempiere's
  `:7079/tb-bff/*`.

## 10. Pointers

- Per-screen instructions live in `/tmp/shared-instruction/clone-idempiere-*.md`.
- iDempiere customization handoff: `/tmp/shared-instruction/idempiere-customization-handoff.md`
  (build/deploy fast path, OSGi caveats, java-17 toolchain).
- ERP + Kill Bill 100 Mbps handoff: `/tmp/shared-instruction/orchestrix-erp-killbill-100mbps-handoff.md`
  (the canonical POC plan; the cloned Product screen is the first concrete
  consumer).
- iDempiere local customizations doc: `idempiere/idempiere-server/docs_tb/code-changes.md`
  (read this before editing anything in `org.adempiere.ui.zk`).
- 100 Mbps reference flow: `orchestrix-v2/docs/integration/100mbps-sample-package.md`.
