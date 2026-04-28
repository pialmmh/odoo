# ERP Integration — Design Goals

This document states the **principles** that govern how Orchestrix integrates
with an upstream ERP engine (currently iDempiere) for entity-CRUD screens
(Business Partner, Product, …). It is intentionally short. Specific window
implementations live under `docs/erp-ui-cloning/screens/`.

---

## 1. Replace the UI, not the engine

We replace the upstream ERP's stock UI (ZK in iDempiere's case) with a
React workspace, but we **faithfully reuse the engine underneath**. Every
read and write must reach the database through the *same model classes the
stock UI calls* — not through handcrafted SQL.

For iDempiere this means:

- **Window metadata** comes from `GridWindowVO.create(ctx, windowNo, windowId)`,
  not joins on `AD_Window` / `AD_Tab` / `AD_Field`.
- **List rows** come from `org.compiere.model.Query` with paging, not
  custom `LIMIT/OFFSET` queries.
- **Single rows** come from `MTable.get(ctx, table).getPO(id, trx)`.
- **Lookups** come from `MLookupFactory`, not bespoke joins on
  `AD_Ref_Table`.
- **Writes** go through `MTable.getPO(...).set_Value(...).save()` for the
  simple case, and `GridTab.setValue(...) → GridTab.dataSave()` when
  callouts must fire.

Internal SQL inside those model classes is fine — that is the whole
point. **Forbidden** is hand-writing `SELECT/INSERT/UPDATE/DELETE` against
ERP tables ourselves. That bypasses access checks, validation rules,
UserDef overrides, callouts, sequence allocation, and Model Validators —
i.e. the entire reason the engine exists.

> Grandfathered exception: `IdempiereProductService.java` is a pre-existing
> direct-JDBC service behind the experimental Product page. No new
> direct-JDBC services join it.

## 2. Two layers, two responsibilities

```
React  ──▶  Spring Boot proxy (DTO + capabilities)  ──▶  in-engine BFF (model layer)  ──▶  DB
```

Each layer has exactly one job:

- **In-engine BFF** (`erp-api/` packaged as an OSGi WAB inside iDempiere
  on `:7079`) — owns the model-layer access. Speaks the engine's native
  vocabulary (AD column names, snake_case rows, displayType ints). Stateless
  per request; no auth yet.
- **Spring Boot proxy** (`api/.../controller/Erp*Controller`) — owns the
  external HTTP contract: JWT enforcement, vendor-neutral DTOs,
  `_caps` capability probe, 501 stubs for unbuilt verbs. **No SQL here.**
  No mention of "iDempiere", "Odoo", or any other backend leaks into
  response bodies, error messages, or UI copy.
- **React** — owns the user experience. Reads `/api/erp/*` exclusively
  (or `/erp-api/*` for read-only paths the proxy doesn't add value to).
  Never sees backend identifiers in user-facing strings.

This separation is what lets us swap the engine later without ripping the
UI apart, and what lets us evolve the UI without pinning the proxy.

## 3. Vendor-neutrality is a hard rule

User-facing surfaces — UI copy, banner text, error messages, route names,
DTO keys — **must not name the upstream ERP**. Internal code, comments,
log lines, and developer docs (this file included) may use real names.

This means:

- DTO keys are camelCase generic identifiers (`id`, `name`, `groupName`),
  not `c_bpartner_id` / `M_Product_ID`.
- Banners say "Editing is temporarily unavailable.", not "iDempiere
  write path not yet implemented."
- Routes are `/erp/bpartner`, not `/idempiere/c_bpartner`.

The cost of a leak is that a future engine swap turns into a UI rewrite.

## 4. Read-first, write-later — and ship in between

For each new entity screen, the order of work is fixed:

1. **Read end-to-end through the model layer** (list, single row, lookups).
   This is the cheap half. It exercises the architecture without touching
   GridTab session lifecycle or callout dispatch.
2. **Ship the read-only screen** with a `_caps` probe and an "Editing is
   temporarily unavailable." banner. The user gets value immediately and
   the architecture is validated under real load.
3. **Add writes** through `GridTab.setValue → dataSave` so callouts,
   validators, sequence allocation, and document workflow all fire as
   they would in the stock UI. Flip `_caps.writes = true`.

A half-finished entity is shippable; a half-finished engine integration
is not. The capability probe lets each screen advance independently.

## 5. No premature generalization

Each entity is implemented as its own concrete specimen until we have at
least three working examples. **No generic `WindowRunner` until the
shapes converge organically.** Two specimens (Product, BPartner) is not
yet the right sample size to abstract from. Repetition across screens is
acceptable cost; an abstraction designed against two examples is almost
always wrong.

When the third specimen lands, look for the shared shape and lift it
**once**. Not before.

## 6. UI consistency is enforced, not optional

All entity edit screens follow the `fluent-ui-forms` skill:

- 12-column CSS grid with explicit per-field span planning
  (boolean=2, number/date/dropdown=4, text=6, memo=12).
- Mixed-type alignment via `paddingTop: 26px` wrapper for unlabelled
  controls (checkboxes, buttons) on the same row as labelled inputs.
- Responsive collapse: span 6 at ≤1023px, span 12 at ≤639px.
- `tokens.spacing*` only — no raw px outside that one alignment number.
- AD `FieldGroup` → Panel/Section. `>24` field windows use a vertical
  side rail for child tabs.
- Sticky save bar with bordered surface and 24px top spacing.
- Fluent UI v9 only. **No MUI.**

Skill compliance is what gives different screens visual coherence
without per-screen design effort.

## 7. The architecture must survive engine swaps

A second engine (Odoo, etc.) must be plug-replaceable by writing a new
in-engine BFF and pointing the same Spring proxy at it. The contract:

- BFF endpoints `GET /window/{id}/spec`, `/tab/{n}/rows`,
  `/tab/{n}/row/{id}`, `/lookup/{ref}` (and the future write verbs).
- Spec payload exposes per-field `reference` strings drawn from the
  *normalized* vocabulary in `AD_REF_NAME` / `DisplayType` —
  not engine-specific enums.
- DTO mapping in the proxy translates engine-specific keys (snake_case,
  camelCase, AD-cased — whatever the engine emits) into the canonical
  camelCase shape the UI expects.

If a design choice would tie the UI to a single engine, that's a defect
in this architecture — not a normal trade-off.

## 8. Capabilities, not feature flags

User-visible "is this verb supported yet?" lives in `GET /api/erp/<entity>/_caps`
returning `{reads, writes, ...}`. The UI gates banners and disabled-state
on this, not on environment flags or build-time constants. A given verb
either exists with a working implementation, or `_caps` says it doesn't —
nothing in between.

When `_caps.writes = false`:

- Save / Create / Delete buttons remain visible but disabled.
- A neutral banner explains the limitation in user-friendly language.
- Race-condition POSTs that slip through receive 501 mapped to the
  same banner copy.

Never silently no-op a write. Never lie about capabilities.

## 9. One source of truth per fact

- **Entity rows**: the engine's tables, accessed only through model classes.
- **Window/tab/field metadata**: `GridWindowVO.create(...)` at request time.
  A bundled JSON spec under `api/src/main/resources/erp/idempiere/` exists
  only as a **fallback** for AD-name → camelCase translation in the
  proxy; it is not the production source.
- **Display values for FKs**: `MLookup.getDisplay(value)` server-side.
  The UI does not stitch lookup tables on the client.
- **Reference type names**: a single `AD_REF_NAME` map in the BFF.
  The UI switches on the resulting strings; the BFF never emits raw
  Java identifiers like `"YesNo"` / `"TableDir"`.

When these get duplicated, divergence follows. When divergence is found,
the engine wins.

## 10. Reversibility and operational safety

- The Spring proxy is a Spring Boot module. Restarting it costs ~3s.
- The in-engine BFF is an OSGi bundle. Cold restarts of iDempiere take
  30–45s; the bundle re-extracts from `plugins/erp-api-*.jar` per
  `bundles.info` on boot.
- Bundle replacement requires nuking the OSGi cache
  (`configuration/org.eclipse.osgi/<id>`) and Jetty work dirs alongside
  swapping the JAR — Equinox caches aggressively.
- Schema-affecting iDempiere upgrades are a separate concern; this
  integration assumes the engine's database is upgraded by the engine.

If a change in this layer breaks the engine, the engine is innocent —
roll the integration back, not the engine.

---

## Anti-goals (things this architecture explicitly is not)

- **Not a replacement engine.** We are not reimplementing
  iDempiere's posting, document workflow, accounting, costing, or any
  other domain logic.
- **Not a metadata-driven generic CRUD framework.** Every entity is its
  own concrete React file until proven otherwise.
- **Not a real-time sync layer.** Reads are live against the engine; we
  do not maintain a parallel cache or projection.
- **Not multi-engine at the same instant.** One engine per deployment.
  Engine swaps are cold migrations, not runtime routing.

---

## Appendix — applies-to today

| Layer | Repo path |
|---|---|
| In-engine BFF | `orchestrix-v2/erp-api/` (OSGi WAB) |
| Spring Boot proxy | `orchestrix-v2/api/src/main/java/com/telcobright/api/controller/` |
| React workspace | `orchestrix-v2/ui/src/pages/erp/` |
| Skill | `orchestrix-v2/.claude/skills/fluent-ui-forms/` |
| Per-screen progress notes | `orchestrix-v2/docs/erp-ui-cloning/screens/` |
