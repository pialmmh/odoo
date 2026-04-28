# Discovery Summary — product

**Date:** 2026-04-29
**Odoo:** server_version=`17.0` (server_version_info `[17,0,0,"final",0,""]`)
**Scope:** Clone the Products menu (action 278, model `product.template`,
menu_id 138) — list view + form view + search facets. The React renderer
is our modern admin app style (Fluent UI v9, our theme tokens); this is
**STRUCTURAL parity, not pixel parity**. Tokens captured in
`discovery/tokens.json` are reference only.

## Counts

- **menus in subtree:** 1 leaf (138) + 2 ancestors captured for breadcrumb
  context (133 Customers, 131 Invoicing) = 3 entries in `menus.json`.
- **actions:** 1 (`ir.actions.act_window` id=278, "Products",
  res_model=`product.template`, view_mode=`kanban,tree,form,activity`,
  list view_id=737, default_search=`filter_to_sell`).
- **models:** 24 introspected via `fields_get`, 1414 fields total. Centred on
  `product.template` (121 fields) + `product.product` (157 fields) + 1-hop
  Many2one/Many2many/One2many targets.
- **views:** 6 captured.
  - kanban: 1 (id=497)
  - list: 2 — action's specific (id=737, narrow) + base default (id=495,
    wide; saved as `tree_default`)
  - form: 1 (id=496)
  - search: 1 (id=453)
  - activity: 1 (id=498)
- **screenshots:** 5 — kanban, list, form (full page — notebook + chatter
  visible), search (Filters dropdown open showing facets), and a
  navbar/breadcrumb chrome shot.

## Models flagged

None. `models.json.flagged_missing` is empty — every model referenced by
action 278's resolved arches is present in `ir.model.fields` and resolved
cleanly via `fields_get`. All Many2one/Many2many/One2many relations from
`product.template` were followed one hop and introspected.

## Models in scope

| Odoo model | iDempiere counterpart | Risk |
|---|---|---|
| `product.template` | `MProduct` (+ `MProductPrice` for `list_price`/`standard_price`) | **high** — variants and tags don't map cleanly; pricing requires `M_PriceList_Version` resolution; taxes are m2m vs single `C_TaxCategory_ID` |
| `product.product` | (no separate model — `MProduct` only) | **high** — semantic mismatch; recommend dropping variants from v1 clone |
| `product.category` | `MProductCategory` (+ `MProductCategoryAcct` for income/expense accounts) | low — direct mapping; `complete_name` computed by walking parent chain |
| `uom.uom` | `MUOM` (+ `MUOMConversion` for ratios) | medium — Odoo has hierarchical UoM categories with conversion rules; iDempiere `UOMType` is just a code |
| `product.tag` | (no first-class counterpart) | **high** — capability gap; closest is `AD_LabelAssignment` or Group1/Group2 Char fields |
| `product.template.attribute.line` + `product.attribute(.value)` | `MAttributeSet` + `MAttribute` + `MAttributeValue` (+ `MAttributeSetInstance` at the line) | **high** — Odoo creates one variant row per combination; iDempiere only attaches the set and resolves combinations at line entry |
| `product.supplierinfo` | `MProductPO` | medium — direct mapping but no `date_end` |
| `account.tax` | `MTax` (+ `MTaxCategory` on the product side) | **high** — m2m vs single FK; resolution context-dependent in iDempiere |
| `account.account` | `MAccount` (`MElementValue`) | medium — `company_dependent` in Odoo vs per-`C_AcctSchema` in iDempiere |
| `account.account.tag` | (likely `AD_LabelAssignment`) | low (out of scope for prototype) |
| `product.document` | (no first-class — closest is `AD_Attachment`) | low (out of scope for prototype) |
| `product.packaging` | `MProductPackage` (less feature-rich) | low (out of scope for prototype) |
| `res.currency` | `MCurrency` | low — direct mapping |
| `res.company` | `MClient`/`AD_Org` (cardinality differs) | medium — surface as "Organization" in our DTO |
| `res.partner` | `MBPartner` (already in our BFF) | low — already mapped in `/api/erp` |
| `res.users` | `AD_User` (`MUser`) | low — out of product clone scope |
| `stock.location` / `stock.warehouse` / `stock.route` | `MLocator` / `MWarehouse` / (no counterpart for routes) | medium — already mapped; routes out of scope |
| `mail.message` / `mail.followers` / `mail.activity*` / `calendar.event` | (no chatter equivalent) | medium — render with our notification UI; no backend mapping |

## Top 3 risks for the main agent

1. **Pricing model is structurally different.** Odoo's `list_price` /
   `standard_price` are scalars on `product.template`; iDempiere stores
   per-pricelist-version rows in `MProductPrice`. `ProductDto.listPrice`
   must be resolved against the user's default sales pricelist version on
   read, and writes must go to `MProductPrice` not `MProduct`. The
   `IdempiereErpAdapter` needs a "resolve default pricelist" step and
   should 422 if the user/company has none configured rather than silently
   picking one. Currency follows the pricelist, not the product.

2. **Variants and product tags have no clean iDempiere counterpart.** Odoo's
   template/variant split (`product.template` ↔ `product.product`) collapses
   to a single `MProduct` row in iDempiere, with attribute combinations
   only materialising at line-entry time via `M_AttributeSetInstance`.
   `product.tag` has no first-class equivalent. The prototype should drop
   the Variants tab, drop the tag chips, and record the limitation in the
   design doc decision log.

3. **Custom Kill Bill tab and tax-m2m UI must not leak into the clone.** The
   captured form arch contains a "Kill Bill" notebook tab from
   `custom-addons/kb_integration` (fields `x_kb_product_name`,
   `x_kb_category`) — project-specific Odoo customization that must NOT
   appear in `ProductDto` or the React notebook. Similarly "Customer Taxes"
   / "Vendor Taxes" m2m chips on the Sales tab cannot be reproduced 1:1
   against iDempiere's single `C_TaxCategory_ID` — surface a single "Tax
   Class" picker instead with vendor-neutral labelling, and do not promise
   per-product tax composition.

## Where to start coding

- **Smallest viable slice:** read-only Product list (`ErpV2ProductList.jsx`)
  driven by `ErpAdapter.listProducts(filter)` returning `ProductDto`
  populated from `MProduct` (+ joined `MUOM.Name`, `MProductCategory.Name`,
  + resolved `MProductPrice.PriceList` against the default pricelist
  version). Columns default-visible: `value` (Internal Reference), `name`,
  `listPrice`, `categoryName`, `uomName`, `isActive`. Optional columns:
  `standardPrice`, `barcode`, `vendorName`. Skip tax chips, variants, tags.
- **Recommended order:**
  1. `ProductDto` + `IdempiereDtoMapper.toProductDto(jsonNode)` (read-only,
     no pricing yet).
  2. `IdempiereErpAdapter.listProducts(filter)` against existing BFF
     `/product` GridTab list endpoint.
  3. `ErpV2ProductController` thin forward.
  4. `ErpV2ProductList.jsx` with our existing modern search bar (NOT Odoo
     classic facets) + the column set above.
  5. **Then** the Form (Notebook with General / Sales / Purchase /
     Accounting tabs only — drop Inventory if no storables, drop Variants,
     drop Tags). Statusbar = `Can be Sold` + `Can be Purchased` toggles +
     Archive in the cog menu. Follow `.claude/skills/fluent-ui-forms` for
     padding / Griffel longhand / theme tokens.
  6. Pricing widening (read default pricelist, write `MProductPrice`) —
     after the form skeleton lands so the BFF widening is a focused commit.

Re-run is idempotent. Read `mapping/idempiere.md` next, then
`discovery/views.parsed.json` for the notebook structure.
