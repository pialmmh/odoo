# foss-buster-odoo — extends [`../foss-buster.md`](../foss-buster.md)

> Odoo target-pack. Pins the inputs and supplies Odoo-specific authority rules
> and cross-cutting mappings for cloning Odoo screens onto our React UI with
> an iDempiere-backed BFF.
>
> **Read order:** `../foss-buster.md` first (methodology + phases + gates),
> then this file (paths + Odoo specifics). Conflicts resolve in favour of
> this file.

---

## Target binding (mandatory)

| Slot | Value |
|---|---|
| `target` | `odoo` |
| `target.version` | `17.0` |
| `target.source_path` | `orchestrix-v2/odoo-backend/odoo-src/` |
| `target.runtime_url` | `http://localhost:7169` |
| `target.runtime_db` | `odoo_billing` |
| `target.source_mcp` | `mcp__jcodemunch-ai-vm` (must be reachable at `10.10.186.1:8901`) |
| `tutorial.video_path` | `video-extractor/odoo/<slug>/` |
| `tutorial.wiki_path` | `video-extractor/wiki/odoo-<slug>-*.md` |
| `destination` | `idempiere` |
| `destination.version` | `12` |
| `destination.bff` | `orchestrix-erp/api/` (Spring Boot, port 8180, gateway via APISIX :9081) |
| `destination.frontend` | `orchestrix-erp/ui/` (Vite, port 5180) |
| `destination.write_path` | iDempiere GridTab via BFF — direct JDBC against iDempiere tables is forbidden for new entities (see global memory feedback) |

The first call on a slug copies these into `<slug>/sources.lock` and resolves
each SHA at lock time.

---

## Authority addendum (Odoo-specific)

Inherits the generic order from the base skill. Adds:

- **Multiple Odoo addons can disagree.** The order is: addon installed in
  the target runtime > stock addon (`odoo-src/addons/<name>`) > community
  addon (`odoo-src/odoo/addons/<name>`). When an installed addon overrides a
  stock view, the installed version wins.
- **Onchange beats default.** If a field has both a `default` and an
  `@api.onchange` that overwrites it on related-field change, the spec must
  describe the onchange path; the default is only relevant for the *new*
  record case.
- **`detailed_type` outranks `type`.** Odoo 17 split the legacy `type`
  selection into `detailed_type` for finer granularity. Stories must reference
  `detailed_type` and treat `type` as a derived/legacy field.

---

## Cross-cutting mapping (Odoo → iDempiere)

Use this as the seed for the `Cross-Cutting` sheet. Target-pack stays
authoritative; the workbook is the per-slug audit copy.

| Concern | Odoo mechanism | iDempiere mechanism | Strategy |
|---|---|---|---|
| i18n | `EN` marker per field; `res.lang`; `_translation` tables | `AD_Language` + per-record `_Trl` tables | Tenant-aware translations via existing locale provider; `EN` marker is decorative in slice 1 |
| Multi-tenancy | `company_id` (`res.company`) | `AD_Client_ID` + `AD_Org_ID` | Every BFF endpoint scopes by tenant; ErpAdapter resolves `AD_Client` from JWT |
| RBAC | `ir.rule` + `res.groups` | `AD_Role` + `AD_Role_OrgAccess` + `AD_Window_Access` | Predicate translation table; default-deny BFF; UI hides controls per role |
| Workflows | `ir.cron` + `automated.action` + `mail.template` | `AD_WorkflowProcessor` + `R_RequestProcessor` + `AD_AlertProcessor` | Slice 1: skip; flag fields that are workflow-driven so we don't hand-edit them |
| Auditing | `mail.tracking.value` | `AD_ChangeLog` | Show on chatter in slice 2; backed by `AD_ChangeLog` reads |
| Attachments | `ir.attachment` | `AD_Attachment` + `AD_AttachmentNote` | Documents smart button + chatter both read this |
| Chatter | `mail.thread` mixin | (no equivalent) | Add a custom mixin table on iDempiere side; expose via BFF only |

---

## Invocation

```
/foss-buster-odoo "<prompt>"
```

`<prompt>` is freeform. The agent classifies it and resolves to a complete
instruction per the base skill's prompt resolution rules. Examples that all
work without further input:

| Prompt | Resolves to |
|---|---|
| `"product"` | slug=product, kb_folder=`video-extractor/odoo/product/`, all phases, resume=true |
| `"/home/.../video-extractor/odoo/product/"` | same as above (kb_folder explicit) |
| `"product P0 P1 P2"` | slug=product, scope=[P0,P1,P2] |
| `"do the product general tab through Phase 2"` | slug=product, scope=[P0..P2], NL hint kept in instruction.lock |
| `"resume product, P3 only"` | slug=product, scope=[P3], resume=true |
| `"gate product"` | slug=product, gate-check only (no writes) |
| `"sale-order"` | slug=sale-order; kb_folder must exist or agent stops and asks |

If the prompt can't be classified, the agent stops with a structured ask
listing what it tried and what's missing. It never invents inputs.

The resolved instruction is written to `<output_root>/instruction.lock` on
first run so subsequent calls replay deterministically (the YAML *can* live
on disk for repeatability, but is never the input).

---

## Slug index (per-slug workbooks live alongside this file)

| Slug | Status | Path |
|---|---|---|
| `product` | seeded — Phases 0/1 partial, P2 prototype-stub | [`product/`](./product/) |

When you add a slug, create `<slug>/` next to this file and run the workbook
generator (`build_workbook.py`) to seed it.

---

## Notes specific to this destination (iDempiere)

These are not theoretical — they have already bitten us; left here so the
next agent doesn't relearn them.

- **No template-level variants in iDempiere.** Odoo's `product.product`
  cartesian per `product.template` has no direct counterpart;
  `M_AttributeSetInstance` exists per *document line*, not per template. Any
  story that hinges on materialised variants must surface this in
  `Conflict-Log` and propose either a new lookup table or an adapter shim.
- **Pricelist shape differs.** Odoo stores `list_price` directly on
  `product.template`; iDempiere stores prices on `M_ProductPrice` rows under
  a versioned `M_PriceList`. The BFF must resolve the active pricelist per
  tenant; do not surface raw `list_price` round-trips.
- **Tax shape differs.** Odoo binds `account.tax` m2m on the product;
  iDempiere binds via `C_TaxCategory_ID` and resolves the actual tax at the
  order line based on document context (date, ship-from, ship-to). Do not
  expose direct tax-id round-trips on a product DTO.
- **No chatter.** iDempiere has `AD_Note` and `AD_ChangeLog` but no
  follower / subtype model. Plan for a custom mixin table when chatter stories
  go beyond display.
