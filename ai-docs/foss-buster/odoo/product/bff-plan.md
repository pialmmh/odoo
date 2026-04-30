# BFF Plan — Odoo product slug → iDempiere

Generated: 2026-04-30 by `/foss-buster-odoo "run and build product"`.
Phases run: P0 ✅ · P1 ✅ · P2 ✅ · P3 partial (10/38 verified) · P4 partial (8 conflicts logged) · P5 partial · P6 pending (this report) · P7 pending.

This file is the human-review surface for what to **build next**. All claims here trace to verified file:line refs in `interactions.jsonl` / `workbook.xlsx`.

---

## What we know now (post-discovery)

| Surface | Verdict | Effort | Notes |
|---|---|---|---|
| Read product list + detail | shipped slice 1 | n/a | iDempiere → ProductDto already wired through `IdempiereErpAdapter`. |
| Toggle favourite (yellow star) | new — write-new column or table | small | Field is `priority` in Odoo, not `is_favorite`. iDempiere has no equivalent — we'd add a per-user pref table. |
| Edit list_price | adapter-shim | medium | iDempiere prices live on `M_ProductPrice` keyed by `M_PriceList_Version`, not on `M_Product`. BFF must resolve the active sales pricelist per tenant. |
| Edit tax (Customer Taxes) | adapter-shim | medium | Drop the m2m round-trip; expose `taxCategoryId` instead — iDempiere binds `C_TaxCategory_ID` and resolves the actual tax at order line. |
| Edit detailed_type / Product Type | reuse-method | small | Map Odoo's 8-value selection to iDempiere's `ProductType + IsStocked` pair. |
| Edit Internal Notes / Sales Description / Purchase Description | reuse-method | small | Direct text writes on `M_Product.Description / SalesDescription / PurchaseNote`. |
| Vendors table (Purchase tab) | reuse-method | small | `M_Product_PO` is a field-for-field analogue of `product.supplierinfo`. |
| Attribute lines + variants matrix | write-new | large | iDempiere has no template-level variants. Needs new `TC_Product_AttributeLine` lookup + a materialiser process. |
| Update Quantity smart button | reuse-process | medium | Read via `MStorageOnHand`; inline edit posts an `MInventory` document and `completeIt()`. |
| Replenish button | reuse-process | small | `MReplenish` + `org.compiere.process.ReplenishReport`. |
| Chatter (Send message / Log note) | write-new | medium | `MNote` is partial only; need `TC_Message` + `TC_MessageFollower` mixin. |

---

## Recommended next slice — **Slice 2a: "Save-button infrastructure"**

Smallest viable advance from where the UI sits today. Wires the edit lifecycle without taking on any of the adapter-shim work yet, so we can validate the contract before committing to harder mapping.

### Backend

1. **PATCH `/api/erp-v2/products/{id}`** — partial `ProductDto`. First version handles only fields whose iDempiere mapping is `equivalent` per `DB-Mapping`:
   - `name`, `value` (Search Key / Internal Reference), `sku`, `description` (Internal Notes), `upc` (UPC/EAN)
   - `salesDescription`, `purchaseDescription`
   - `isActive`, `isStocked`, `isSold`, `isPurchased`
   - `priority` (added column or per-user table — pick at code time)
   - `categoryId`, `uomId` (m2o swaps)
2. **Field-level diff** — compute changed-only set on the BFF, hit iDempiere via `MProduct` (or `GridTab` once the BFF wraps it), single `save()`.
3. **Concurrency token** — return `Updated` (timestamp) with the GET; reject the PATCH if it changed.

### Frontend

4. **Dirty tracking + Save bar** — Fluent v9 message bar at top of detail page when the form is dirty: "You have unsaved changes" + Save/Discard.
5. **Editable bindings** — convert the existing read-only inputs (Name, Internal Ref, Notes, scope checkboxes, category, UoM) to controlled inputs with local state; flush via PATCH on Save.
6. **Optimistic-then-reconcile** — apply locally, PATCH, re-fetch on success. Roll back on 409.

### Tests

7. Playwright:
   - `tests/general/save_simple_fields.spec.ts` — change Name → Save → reload → name persists.
   - `tests/general/dirty_tracking.spec.ts` — type then navigate → confirm prompt fires.
   - `tests/general/concurrent_update_409.spec.ts` — PATCH twice with the same `Updated` token → second returns 409.

### Out of slice 2a

- No pricing edits (slice 2b).
- No tax category edits (slice 2c).
- No detailed_type edits (slice 2d).
- No variants (slice 3).

---

## Slice 2b — pricing (the first adapter-shim)

Once 2a is green, add list_price edit:

- New helper on the iDempiere side: `MProductPrice.upsertActive(tenant, M_Product_ID, listPrice)` which: locates the tenant's default sales `M_PriceList`, fetches/creates the active `M_PriceList_Version` (today's date), and upserts `M_ProductPrice`.
- BFF: add `listPrice` to PATCH; on write, call the helper.
- UI: unblock the Sales Price field in the General tab.

Effort: ~½ day if `M_PriceList` per tenant is already configured, full day if we need a default-pricelist resolver.

---

## Slice 2c — tax category

- Replace the m2m chip with a single m2o picker (`Tax Category` → `MTaxCategory`).
- BFF reads/writes `M_Product.C_TaxCategory_ID`.
- The "(= Incl. Taxes)" suffix becomes UI-only: list_price × (1 + headlineRate). Headline rate comes from `MTaxCategory.getDefaultTax()` per tenant.

Effort: ~½ day. Adds 1 ProductDto field, 1 BFF endpoint slot.

---

## Slice 2d — detailed_type

- New mapping table in `IdempiereDtoMapper`:
  | Odoo detailed_type | iDempiere `ProductType` | `IsStocked` |
  |---|---|---|
  | Consumable | I (Item) | N |
  | Storable Product | I (Item) | Y |
  | Service | S (Service) | N |
  | Booking Fees / Combo / Event Ticket / Event Booth / Course | (deferred — decide per tenant) | – |

- Storable + Consumable + Service cover ~90% of demo data; the Event/Combo/Course tail can stay read-only with a banner until a tenant actually needs it.

Effort: ~½ day for the three mapped types; deferred for the rest.

---

## Slice 3 — variants (large; defer)

iDempiere fundamentally doesn't model template-level variants. Two options:

- **3-shim** — synthesise variants on read (cartesian of selected attribute values, no persistence). Works for visualisation; breaks if you want SKUs per combination.
- **3-real** — write `TC_Product_AttributeLine` (template-scoped) + a materialiser process that creates `M_AttributeSetInstance` and (optionally) per-combination `M_Product` rows. Significant lift; touches inventory + costing assumptions.

**Recommend:** ship 2a/2b/2c first, then revisit 3 only if a tenant demands it.

---

## Open questions for the user

1. **Slice 2a now?** — confirm the field set above is the right starting cut. Is `priority` (favourite) in or out of 2a? In adds a small table; out keeps the slice purely "edit existing fields".
2. **Concurrency strategy** — token-based (above) or last-write-wins? Token is safer; LWW is simpler. iDempiere uses an `Updated` column natively; either works.
3. **Per-user favourites** — should favourites be per-user or per-tenant? The Odoo `priority` field is record-scoped (everyone sees the same star). Per-user is what most modern CRMs do, but it's more code.
4. **Variants** — defer to slice 3 or accept the read-only stub from slice 1 as final until business demands more?

Mark up `workbook.xlsx` with any disagreements and re-run `/foss-buster-odoo "product"` — the factory will pick up your edits via the round-trip rule (jsonl → workbook → jsonl).
