# iDempiere mapping — Product domain

Source repo (jcodemunch): `idempiere-src-d6194ef9`. Java model classes under
`org.adempiere.base/src/org/compiere/model/`.

This file is *internal reference*. Vendor terms (`MProduct`, `M_ProductPrice`,
GridTab, `processIt`) are intentional here. They MUST NOT leak into UI strings
or DTO field names — see `IdempiereDtoMapper` per the design doc §3.4.

**Hard rule (also in /tmp/shared-instruction):** all writes go through the
existing in-iDempiere BFF (`erp-api/ApiServlet.java`) using PO/GridTab —
no JDBC. There is no posting-to-`Fact_Acct` step for `M_Product` itself
(it's not a document); posting only matters for downstream documents
(MInOut, MInventory, MMovement). For those, the existing inventory
endpoints already do the `processIt("CO")` + `Doc.postImmediate(MAcctSchema[],
adTableId, recordId, force=true, null)` round-trip — those endpoints stay
the integration target; we don't reinvent them.

---

## Model-by-model mapping

### `product.template` → `MProduct` + `MProductPrice`

| Class | File | Notes |
|---|---|---|
| `MProduct` | `org.adempiere.base/src/org/compiere/model/MProduct.java` | `extends X_M_Product implements ImmutablePOSupport`. ~55+ helper methods (variants, BOM helpers, attribute-set helpers, image, costing). |
| `X_M_Product` (generated) | `org.adempiere.base/src/org/compiere/model/X_M_Product.java` | Source of truth for column names — search `COLUMNNAME_*` to enumerate. |
| `MProductPrice` | `org.adempiere.base/src/org/compiere/model/MProductPrice.java` | One row per (M_PriceList_Version, M_Product). Static `MProductPrice.get(ctx, M_PriceList_Version_ID, M_Product_ID, trxName)` finds existing. |

**Critical semantic difference: there is no separate `template` ↔ `variant`
split in iDempiere.** A single `M_Product` row carries *both* identity and
attribute-set instance data. Variants are modelled by attaching an
`M_AttributeSet` to the product and creating one `M_AttributeSetInstance`
per concrete variant *as referenced from inventory documents and orders* —
not as separate product rows. This collapses Odoo's 1-to-many template/variant
into a single row, with attribute combinations expanded only at the
transaction line. **This is the single biggest mapping risk; see "Risks"
below.**

#### Field rename map (for `IdempiereDtoMapper`)

The DTO field names below match the camelCase used in §3.4 of the design
doc; iDempiere column names are the canonical X_M_Product COLUMNNAME_* identifiers.

| ProductDto (camelCase) | iDempiere column (`M_Product`) | Notes / Odoo equivalent |
|---|---|---|
| `id` | `M_Product_ID` | Primary key. |
| `name` | `Name` | Required. Odoo `name` (translatable in Odoo, not iDempiere). |
| `value` (sku/code) | `Value` | Required, unique within client. Odoo `default_code`. |
| `description` | `Description` | Plain text. Odoo's `description` is HTML — sanitize/strip on the way in. |
| `description` (long) | `DocumentNote` | iDempiere has both `Description` (short) and `DocumentNote` (long). |
| `helpText` | `Help` | Hover help. |
| `productType` | `ProductType` | Selection: `I` (Item) / `S` (Service) / `R` (Resource) / `E` (Expense type) / `O` (Online). Map Odoo `detailed_type`: `consu`→`I`, `service`→`S`, (Odoo `product` storable→`I` with `IsStocked=Y`). |
| `isStocked` | `IsStocked` | Y/N. Has no direct Odoo equivalent (Odoo uses `detailed_type='product'` to indicate storable). |
| `isSold` | `IsSold` | Y/N. Odoo `sale_ok`. |
| `isPurchased` | `IsPurchased` | Y/N. Odoo `purchase_ok`. |
| `isActive` | `IsActive` | Y/N. Odoo `active` (form action `Archive` flips this). |
| `uomId` | `C_UOM_ID` | FK to `C_UOM`. Odoo `uom_id`. |
| `uomName` | (denormalized via join to `C_UOM.Name`) | Odoo `uom_name`. |
| `categoryId` | `M_Product_Category_ID` | FK to `M_Product_Category`. Required. Odoo `categ_id`. |
| `categoryName` | (denormalized via join) | Odoo `categ_id` display. |
| `taxCategoryId` | `C_TaxCategory_ID` | iDempiere groups taxes by category, then resolves to `C_Tax` per-document via `MTax.get(ctx, ...)`. **Odoo's `taxes_id` (Many2many on `account.tax`) does not map cleanly** — see Risks. |
| `weight` | `Weight` | Numeric. Odoo `weight`. |
| `volume` | `Volume` | Numeric. Odoo `volume`. |
| `imageUrl` | `ImageURL` | iDempiere stores a URL, not a binary blob, by default. Odoo uses `image_1920` (binary). On write, drop binary blobs; map URL only or store separately. |
| `barcode` | `UPC` | Odoo `barcode`. |
| `sku` (alt name) | `SKU` | iDempiere has both `Value` and `SKU`; the DTO uses `value` for `Value` since that's the indexed unique. |
| `sequence` | (no direct column) | Use `Discontinued`/`DiscontinuedAt` as inactivation hints. |
| `vendorId` | `MProductPO.C_BPartner_ID` (one-to-many) | iDempiere has `MProductPO` (X_M_Product_PO) — separate table for vendor catalog. Odoo `seller_ids`. |
| `vendorProductCode` | `MProductPO.VendorProductNo` | Odoo `seller_ids.product_code`. |
| `attributeSetId` | `M_AttributeSet_ID` | FK. Odoo `attribute_line_ids` (driven by `product.attribute`). **Semantic mismatch** — see Risks. |

#### Pricing — different model entirely

Odoo's `list_price` is a single Float on `product.template`. iDempiere uses
**pricelists** with versions:

```
M_PriceList → M_PriceList_Version → M_ProductPrice (pivot of product × pricelist version)
```

| ProductDto (camelCase) | iDempiere class / column | Notes |
|---|---|---|
| `listPrice` | `M_ProductPrice.PriceList` (current pricelist version) | Odoo `list_price`. Read via `MProductPrice.get(ctx, M_PriceList_Version_ID, M_Product_ID, trxName)`. |
| `standardPrice` | `M_ProductPrice.PriceStd` | Standard sales price (not necessarily cost). |
| `limitPrice` | `M_ProductPrice.PriceLimit` | Floor price for the SO line — has no Odoo equivalent. |
| `cost` | `M_Cost.CurrentCostPrice` (computed via `MProductPricing` / `MCostElement`) | Odoo `standard_price`. Not the same model — Odoo single scalar; iDempiere has `M_Cost` per cost element / per costing method. |
| `currency` | `M_PriceList.C_Currency_ID` | iDempiere binds currency to the pricelist, not to the product. Odoo binds via `product.template.currency_id` computed from `company_id.currency_id`. |

To **read** a single "the price" for the list/form/kanban: take the user's
default sales pricelist (per `M_PriceList.IsSOPriceList=Y` and the `MPriceList`
default flagged on `MUser` / `MUserRoles` or per the active company) →
its current `MPriceListVersion` → `MProductPrice.PriceList`.

To **write** the equivalent of "set list_price on the product form":
`MProductPrice.get(...)` to fetch existing, set `PriceList`/`PriceStd`/
`PriceLimit`, `saveEx()`. Or new the row if missing. **Always go through
PO/`saveEx()`; never UPDATE M_ProductPrice directly.**

#### Write paths — by user-facing action

| Action on the form | iDempiere write path |
|---|---|
| **Save (create / update)** | `IdempiereProductService` -style call → in-iDempiere BFF → `MTable.get(ctx, MProduct.Table_ID).getPO(M_Product_ID, trxName)` (or `new MProduct(ctx, 0, trxName)`), set fields via setters, `saveEx(trxName)`. **No `processIt` — `MProduct` is not a document model.** |
| **Update list_price / standard_price** | `MProductPrice.get(ctx, currentPriceListVersionId, productId, trxName)` (or new), set `PriceList`/`PriceStd`, `saveEx()`. The BFF needs a "default sales pricelist" resolution step — see Risks. |
| **Toggle `Can be Sold` (sale_ok)** | Set `MProduct.IsSold = "Y"/"N"`, `saveEx()`. |
| **Toggle `Can be Purchased` (purchase_ok)** | Set `MProduct.IsPurchased`, `saveEx()`. |
| **Archive (active=False)** | Set `MProduct.IsActive = "N"`, `saveEx()`. iDempiere has `beforeSave` validation that blocks deactivation if there are open documents. Surface its `processMsg`/exception verbatim to the UI per project rule "react is as dumb as ZK". |
| **Duplicate** | `MProduct.copy()` (PO clone) → `saveEx()`. No direct equivalent of Odoo's "Duplicate" UX, but the same behavior is achievable via PO. |
| **Update Quantity (statusbar)** | This Odoo button creates an `MInventory` document. **Already implemented** in our BFF as `inventoryAdjust` (`POST /inventory/adjust`). The clone's form button calls that existing endpoint — no new write path. |
| **Add tag (`product_tag_ids`)** | iDempiere has no first-class "product tag" model. Closest: `Group1`/`Group2` (Char columns on `M_Product`) or `Classification`. **Capability gap** — see Risks. |
| **Set vendor (`seller_ids`)** | `MProductPO` (X_M_Product_PO) row per (M_Product, C_BPartner). Set `VendorProductNo`, `Order_Min`, `PriceList`, `PriceLastPO`, `IsCurrentVendor`. `saveEx()`. |
| **Configure attributes (`attribute_line_ids`)** | `MAttributeSet` + `MAttributeUse` (link of attribute to set) + `MAttributeSetInstance` (per-document instance). The form-level edit on Odoo creates *new variant rows*; in iDempiere you only attach the attribute set to the product, and concrete combinations are picked at line-entry time. **Capability mismatch** — see Risks. |
| **Set taxes (`taxes_id` / `supplier_taxes_id`)** | Set `MProduct.C_TaxCategory_ID` (single FK, not many-to-many). Per-document tax resolution then happens via `MTax.get(...)` evaluating tax rules. **Cardinality mismatch** — see Risks. |

### `product.product` → (no separate iDempiere model)

See semantic mismatch above. For the prototype clone, treat
`product.template` and `product.product` as a single domain entity backed by
`MProduct`. Document the limitation in the UI as "variants not yet
supported" rather than fabricating a sub-table.

### `product.category` → `MProductCategory`

| Class | File | Notes |
|---|---|---|
| `MProductCategory` | `org.adempiere.base/src/org/compiere/model/MProductCategory.java` | `extends X_M_Product_Category implements ImmutablePOSupport`. |
| `MProductCategoryAcct` | `org.adempiere.base/src/org/compiere/model/MProductCategoryAcct.java` | Per-acctschema accounting accounts (Income, Expense, Asset, COGS) per category. Equivalent of Odoo `property_account_*` on `categ_id`. |

| Odoo field | iDempiere column |
|---|---|
| `categ_id.name` | `MProductCategory.Name` |
| `categ_id.parent_id` | `MProductCategory.M_Product_Category_Parent_ID` |
| `categ_id.complete_name` ("All / IT Enabled Services / SMS & Messaging") | computed by walking `Parent_ID` chain on the API side; iDempiere has no stored full-name column. |
| `property_account_income_id` | `MProductCategoryAcct.P_Revenue_Acct` (per `C_AcctSchema`) |
| `property_account_expense_id` | `MProductCategoryAcct.P_Expense_Acct` |

### `uom.uom` → `MUOM`

| Class | File |
|---|---|
| `MUOM` | `org.adempiere.base/src/org/compiere/model/MUOM.java` (`extends X_C_UOM`) |

| Odoo field | iDempiere column |
|---|---|
| `uom_id.name` | `MUOM.Name` |
| `uom_id.category_id` | `MUOM.UOMType` (Char, not FK) — **NOT structurally the same.** Odoo groups UoMs hierarchically (e.g. "Unit", "Weight", "Time") and forbids cross-category conversion via `uom_po_id` constraint. iDempiere uses `UOMType` as a code only. |
| `uom_id.factor` | `MUOM.MultiplyRate`, `DivideRate` |
| `uom_id.rounding` | `MUOM.StdPrecision`, `CostingPrecision` |

Conversion rules are stored in `C_UOM_Conversion` (`MUOMConversion`).

### `product.tag` → (no direct iDempiere counterpart)

iDempiere has no "tag" concept on `M_Product`. Workarounds:
- **Group1 / Group2 / Classification** Char columns — flat strings, no
  many-to-many. OK for one or two tags but not Odoo's free-form set.
- **`MProductCategory`** — but that's the primary category, not multi-select.
- **`AD_LabelAssignment`** — iDempiere has a generic "Label" facility
  (`MLabel`, `MLabelAssignment`, `MLabelCategory`) that is the closest match
  to free-form tags. Multi-select on any record. Recommend mapping
  `product_tag_ids` → `AD_LabelAssignment` rows scoped to `AD_Table_ID =
  M_Product_Table_ID`. Confirm with code search before committing to it.

### `product.template.attribute.line` / `product.attribute` / `product.attribute.value` → `MAttributeSet` + `MAttribute` + `MAttributeValue` + `MAttributeSetInstance`

| Class | File |
|---|---|
| `MAttributeSet` | `org.adempiere.base/src/org/compiere/model/MAttributeSet.java` |
| `MAttribute` | (search by name) `MAttribute.java` — fields per attribute (e.g. "Color") |
| `MAttributeValue` | (search by name) `MAttributeValue.java` — values for a list-type attribute |
| `MAttributeUse` | links attribute to set |
| `MAttributeSetInstance` | `MAttributeSetInstance.java` — per-document concrete instance (e.g. "Color=Red, Size=L") |

Mapping is approximate; see Risks below.

### `account.tax` → `MTax` + `MTaxCategory`

| Class | File |
|---|---|
| `MTax` | `org.adempiere.base/src/org/compiere/model/MTax.java` (`extends X_C_Tax`) |
| `MTaxCategory` | `org.adempiere.base/src/org/compiere/model/MTaxCategory.java` |

Odoo's `taxes_id` is **many-to-many** on `product.template`. iDempiere only
stores `C_TaxCategory_ID` (single FK) on `M_Product`. The actual tax rate
applied to a sales/purchase line is resolved at line-entry time by
`MTax.get(...)` — taking into account the partner's tax classification, the
warehouse, the product's tax category, and the document date. So the
"Customer Taxes: VAT 5%, AIT 5%" UX in Odoo (m2m on the form) does not have
a stable iDempiere counterpart on the product itself.

### `product.supplierinfo` → `MProductPO`

| Class | File |
|---|---|
| `MProductPO` | `org.adempiere.base/src/org/compiere/model/MProductPO.java` (`extends X_M_Product_PO`) |

| Odoo field | iDempiere column |
|---|---|
| `seller_ids.partner_id` | `C_BPartner_ID` |
| `seller_ids.product_code` | `VendorProductNo` |
| `seller_ids.product_name` | `VendorProductName` (or composed) |
| `seller_ids.min_qty` | `Order_Min` |
| `seller_ids.price` | `PriceList`, `PriceLastPO`, `PricePO` |
| `seller_ids.currency_id` | `C_Currency_ID` |
| `seller_ids.delay` | `DeliveryTime_Promised` |
| `seller_ids.date_start` / `date_end` | `ValidFrom` / (no direct end) |

### Stock-related (`stock.route`, `stock.location`, `stock.warehouse`, `qty_available`)

These map to existing iDempiere counterparts already used by our BFF
(`MWarehouse`, `MLocator`, `M_Storage*`). Out of scope for the **product
list/form clone** — the form's Inventory tab is hidden when no `stock`
storables exist, and stock rollups (`qty_available`) come from existing
warehouse endpoints. List the link but do not re-map here.

### `mail.thread` / `mail.activity` chatter → `AD_ChangeLog` + (no first-class chatter)

iDempiere has no chat/notes timeline on a record. Closest: `AD_ChangeLog`
(audit log of column writes) and `AD_Note` (admin alerts). Neither matches
Odoo's chatter. **Capability gap** — for the clone, render the chatter
panel using our existing notification/notes UI and back it with our own
data store, not iDempiere's.

---

## Top mapping risks

These are flagged for the main agent to plan around.

1. **Variants — semantic mismatch.** Odoo splits `product.template` and
   `product.product`; iDempiere uses one row per product and represents
   variation through `M_AttributeSetInstance` at the transaction line. There
   is no clean way to surface Odoo-style "5 variants" stat button data with
   stock fidelity from iDempiere. **Decision needed for the prototype:** drop
   the variants tab from the v1 clone or render it read-only as
   "M_AttributeSet attached" without trying to enumerate combinations.
   Recommendation: drop for v1.

2. **Pricing — single scalar vs pricelist version.** Odoo `list_price` is
   one Float on `product.template`. iDempiere needs a `M_PriceList_Version`
   to scope a price. The clone form must be told *which* pricelist's price
   it is editing (e.g. "Default Sales 2026"), and on save needs to write
   `MProductPrice` not `MProduct`. The DTO should expose `listPrice` as the
   resolved value for the user's default sales pricelist version, and the
   adapter must implement a "resolve default pricelist version" rule. The
   `IdempiereErpAdapter` should surface a 422 if the user has no default
   pricelist configured rather than silently picking one.

3. **Taxes — many-to-many vs C_TaxCategory.** Odoo allows multiple per-product
   taxes (VAT 5% + AIT 5% as separate rows). iDempiere's
   `M_Product.C_TaxCategory_ID` is a single FK and the actual tax mix is
   resolved at line-entry time. The clone CANNOT reproduce Odoo's "two tax
   chips" UX directly. Options: (a) display read-only the *category name*
   plus a sample preview computed via `MTax.get(...)` for a representative
   document context; (b) hide the chips and surface only a "Tax Category"
   selector. Either way, the field labels in the UI must be vendor-neutral
   ("Tax Class") and must not promise per-product `taxes_id` behavior.

4. **Product tags & chatter — no first-class iDempiere counterpart.**
   `product_tag_ids` (many-to-many) and the chatter timeline both need
   either an iDempiere extension (custom table or `AD_LabelAssignment` reuse)
   or a separate datastore in our platform API. The prototype should ship
   without these and the design doc decision-log should record which path
   we picked.

5. **Custom `kb_integration` Kill Bill tab** in the captured form is
   project-specific. It must NOT appear in `ProductDto` and the React
   notebook must not have a "Kill Bill" tab. The structural notebook in our
   clone is General / Sales / Purchase / Inventory / Accounting only.

6. **`MProduct` writes are not document writes.** No `processIt("CO")`, no
   `Doc.postImmediate(...)`. Just `PO.saveEx()` in the BFF. This is the
   exception to the project's "writes must use processIt + posting" rule —
   that rule applies to *documents* (MInOut, MInventory, MMovement). The
   product master is not a document. The mapping is correct as
   PO.saveEx-only; do not invent fake posting steps.

---

## Where the existing BFF helps

- The **product CRUD via GridTab** path is already wired in
  `erp-api/ApiServlet.java` (commit `221cb27` and earlier). The `/api/erp-v2`
  product controller can forward straight to it without writing any new BFF
  endpoint. Field-set differences (e.g. surfacing `MProductPrice.PriceList`)
  may require a small BFF widening — keep that widening *strictly model-class
  based*, no SQL.
- **Inventory action buttons** (`Update Quantity`, `Replenish`) reuse the
  existing inventory endpoints (`/inventory/adjust`, `/inventory/move`,
  etc.) — no new BFF work for the form-level buttons.
