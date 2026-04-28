# Odoo source mapping — product.template + relations

Source repo (jcodemunch): `odoo-src-eeae1302` (Odoo 17 source under
`orchestrix-v2/odoo-backend/odoo-src`). Custom-addons repo: `custom-addons-be89f052`
(`orchestrix-v2/odoo-backend/custom-addons`).

This file is *internal reference*. Vendor terms (`product.template`, `categ_id`,
etc.) are intentional here.

---

## product.template

- **File:** `addons/product/models/product_template.py` (base, ~1476 lines)
- **Class:** `ProductTemplate(models.Model)`
- **`_name`:** `product.template`
- **`_inherit` (base file):** `['mail.thread', 'mail.activity.mixin', 'image.mixin']`
  - `mail.thread` is what makes the chatter (Send message / Log note / Activities) appear on the form.
  - `mail.activity.mixin` provides `activity_state`, `activity_ids`, `activity_exception_decoration` (the icons in the list/kanban).
  - `image.mixin` provides `image_1920`, `image_1024`, `image_512`, etc.
- **`_description`:** `"Product"`
- **`_order`:** `"priority desc, name"` (so favorites bubble first; UI must reproduce this default sort).
- **`_check_company_domain`:** `models.check_company_domain_parent_of` (multi-company guard).

### Inherits piling on top of the base (each adds fields that show on the same form)

| Module | File | Adds to `product.template` |
|---|---|---|
| `account` | `addons/account/models/product.py` | `taxes_id` (Customer Taxes, Many2many on `account.tax` filtered `type_tax_use='sale'`), `supplier_taxes_id` (Vendor Taxes, `type_tax_use='purchase'`), `property_account_income_id` (company_dependent), `property_account_expense_id` (company_dependent), `account_tag_ids`, `tax_string` (display-only computed), `fiscal_country_codes`. Has `_check_uom_not_in_invoice` constraint blocking UoM changes once posted in journal entries. |
| `sale` | `addons/sale/models/product_template.py` | `service_type`, `sale_line_warn`, `sale_line_warn_msg`, `expense_policy` (no/cost/sales_price), `visible_expense_policy`, `sales_count`, `invoice_policy` (order/delivery). |
| `purchase` | `addons/purchase/models/product.py` | adds purchase-side fields incl. purchase-order warning, `description_purchase`, `purchase_method`. |
| `stock` | `addons/stock/models/product.py` | adds stock fields (`tracking`, `qty_available`, `virtual_available`, `nbr_moves_in/out`, `nbr_reordering_rules`, `route_ids`, `has_available_route_ids`, `route_from_categ_ids`, `description_pickingin/out`, `responsible_id`, `sale_delay`), and the `action_update_quantity_on_hand` button on the form `<header>`. |
| `mail` | (via `_inherit = ['mail.thread', 'mail.activity.mixin']`) | provides `message_follower_ids`, `message_ids`, `activity_ids` and the chatter widget. |

### Key fields on the base (the backbone for our DTO)

| Field | Type | Notes |
|---|---|---|
| `name` | Char(translate=True, required, index=trigram) | Primary label; translated. |
| `sequence` | Integer | Order in lists; with `priority` drives `_order`. |
| `description` | Html(translate=True) | Internal HTML notes (form's "INTERNAL NOTES"). |
| `description_purchase` / `description_sale` | Text(translate=True) | Per-vendor / per-customer descriptions copied to PO/SO lines. |
| `detailed_type` | Selection: `consu` / `service` (and `product` when `stock` is installed) | Drives invisibility of stock-related sections. **Note:** this Odoo install was set up without `stock`, so the form has only "Consumable" / "Service". |
| `type` | Selection (computed from `detailed_type`, store=True, readonly=False, precompute=True) | Internal type used by other modules. |
| `categ_id` | Many2one(`product.category`, required, default=`product.product_category_all`) | Has `change_default=True` (a notable Odoo quirk — picking a category prefills account_income / account_expense per category hierarchy). |
| `uom_id` | Many2one(`uom.uom`, required, default=`uom.product_uom_unit`) | Default unit of measure. Constraint `_check_uom_not_in_invoice` blocks change once journal-entry-posted. |
| `uom_po_id` | Many2one(`uom.uom`, required, computed/store) | Purchase UoM, must share category with `uom_id`. |
| `list_price` | Float(default=1.0, digits='Product Price') | Catalog sales price (single-currency, see "Risks"). |
| `standard_price` | Float(computed, inverse, search; groups=`base.group_user`) | Cost. **Computed** — read it from `_compute_standard_price`; write it via the inverse. Don't store directly. |
| `volume`, `weight` | Float(computed/inverse/store) | Have `*_uom_name` companion Char for label display. |
| `sale_ok`, `purchase_ok` | Boolean (default True) | "Can be Sold" / "Can be Purchased" toggles on the header. |
| `barcode`, `default_code` | Char (computed, inverse, store/search) | These delegate to the single-variant `product.product` if the template is single-variant. **Multi-variant gotcha**: writing on the template no-ops or errors when there are multiple variants — must write on `product.product`. |
| `priority` | Selection `0` (Normal) / `1` (Favorite) | Drives the star icon on kanban/form. |
| `product_tag_ids` | Many2many(`product.tag`) | Free-form tags (`product_tag_product_template_rel`). |
| `attribute_line_ids` | One2many(`product.template.attribute.line`) | Attributes that drive variant generation. |
| `product_variant_ids` | One2many(`product.product`) | The variants. **Computed by `_create_variant_ids`** — see Variants gotcha. |
| `product_variant_id` | Many2one(`product.product`, computed) | Performance shortcut to first variant — used to read barcode/default_code/standard_price/etc. when the template is single-variant. |
| `product_variant_count` | Integer (computed) | Drives the "Variants" stat button. |
| `seller_ids`, `variant_seller_ids` | One2many(`product.supplierinfo`) | Vendor pricelists. |
| `pricelist_item_count` | Integer (computed via search_count over `product.pricelist.item`) | Stat button "Extra Prices". |
| `product_document_count` | Integer (computed) | Stat button "Documents". |
| `product_properties` | Properties(definition=`categ_id.product_properties_definition`) | Free-form per-category properties. |
| `taxes_id`, `supplier_taxes_id` | Many2many(`account.tax`) | Filtered domains by `type_tax_use`. Default sourced from `env.companies.account_sale_tax_id` / `account_purchase_tax_id`. |
| `tax_string` | Char(computed) | "(= XXX Incl. Taxes)" string. Display-only, computed from `taxes_id` + `list_price`. |
| `fiscal_country_codes` | Char(computed) | CSV of company `account_fiscal_country_id.code`. Used in arch `invisible="fiscal_country_codes != 'XX'"` clauses. |

### Buttons on the form (statusbar / header)

The base form file is in `addons/product/views/product_template_views.xml`. The
form `<header>` carries (from the resolved arch we captured):

- `action_update_quantity_on_hand` (from `addons/stock/models/product.py`,
  appears only when `type == 'product'` — i.e. storable). On this Odoo
  instance the button reads "Update Quantity" but is hidden because we have
  no storables in the demo data.
- `Replenish` — `type="action" name="443"` (action 443 on `stock.replenish`),
  visible when `type in ['consu', 'product']`.
- Star (`priority`) toggle — visible on the form sheet next to the name.

There is **no docstatus statusbar** on `product.template`. The form does not
use `<header>` for a state machine. Instead, the only quasi-statusbar values are
the boolean toggles `sale_ok` / `purchase_ok` in the sheet header and the
Archive action on the cogwheel menu (`active=False`).

### Computed fields with UI consequences

- `_compute_currency_id`, `_compute_cost_currency_id` — currency comes from
  `company_id.currency_id` (or main company). Display of `list_price` /
  `standard_price` follows this currency. Single-currency.
- `_compute_standard_price` — reads from a single-variant
  `product.product.standard_price`; raises if multi-variant.
- `_compute_uom_po_id` — auto-aligns purchase UoM with sales UoM if their
  categories don't match.
- `_compute_has_configurable_attributes` — controls "Configure" UX hints.
- `_create_variant_ids` (line ~727) — runs whenever attribute lines change,
  generates the cross-product of `value_ids`. **The single biggest reason
  the form re-orders/duplicates `product.product` rows.**
- `_compute_tax_string` (in `account/...`) — refreshes the price+tax sentence
  shown next to `list_price`.

### Notebook tabs (form view, after view inheritance is merged)

The arch we captured (`view_id=496`) shows tabs in this order:

1. **General Information** — `categ_id`, `uom_id` / `uom_po_id`, `default_code`,
   `barcode`, `responsible_id` (from `stock`), `description` (Internal Notes).
2. **Attributes & Variants** — `attribute_line_ids` editable list +
   "Configure" / "Variants" buttons.
3. **Sales** — `taxes_id`, `expense_policy`, `visible_expense_policy`,
   `sale_line_warn`/`sale_line_warn_msg`, `description_sale`, `optional_product_ids`.
4. **Purchase** — vendors (`seller_ids`), `description_purchase`, vendor warning,
   `purchase_method`, `supplier_taxes_id` (account inherit positions this here).
5. **Inventory** — `route_ids`, `route_from_categ_ids`, `description_pickingin/out`,
   `tracking`, `weight`, `volume`, `sale_delay`, `nbr_*` stat buttons. Hidden
   when `type == 'service'`.
6. **Accounting** — `property_account_income_id`, `property_account_expense_id`,
   `account_tag_ids`, `fiscal_country_codes`-gated rows.
7. **Kill Bill** *(custom-addons/kb_integration)* — `x_kb_product_name`,
   `x_kb_category`. **Project-specific tab — must be excluded from the
   vendor-neutral DTO and tracked under "extension fields" if we ever build
   the same integration on our side.**

### Search view — facets exposed on action 278

From the captured search arch (`view_id=453`):

- **Free-text search field** (`name`): also matches `default_code`,
  `product_variant_ids.default_code`, `barcode` via `filter_domain`.
- **`categ_id`** field with `child_of` operator (hierarchical category filter).
- **Filters:** Services (`type=service`), Products (`type=consu`), Can be Sold
  (`sale_ok=True`), Can be Purchased (`purchase_ok=True`), Favorites
  (`priority='1'`), Warnings (presence of warning code), Archived
  (`active=False`).
- **Group By:** Product Type (`type`), Product Category (`categ_id`).
  (No "Vendor" group-by exposed by default in this build.)

### List view — defaults

The action's named list view is `view_id=737` (a customized one, very small —
just `default_code`, `name`, `list_price`, `taxes_id`, `supplier_taxes_id`,
`activity_exception_decoration`). The default `tree_default` (`view_id=495`,
the base product list) is wider — has `priority`, `image_1920` (handle), `name`,
`default_code`, `barcode`, `responsible_id`, `list_price`, `standard_price`,
`qty_available`, `virtual_available`, `uom_id`, `categ_id`, `product_variant_count`,
`product_properties`. Use the wider one as the menu of "optional columns" for
our list, the narrower one as default-visible.

The list `<header>` carries one button — `action_open_label_layout`.

### Kanban view — template fields

From `view_id=497`: card shows `image_1920` (square handle), `name`,
`product_variant_count` (only when >1), `list_price` formatted in
`currency_id`, `priority` star, `activity_state` (with progress-bar
coloring planned/today/overdue/etc.), `categ_id` (kanban color hint).

### Activity view — template fields

From `view_id=498`: shows `id` and a chatter-style activity card with
`image_128`. Used by Sales / CRM-style "what to follow up on" panels.

---

## product.product (variant)

- **File:** `addons/product/models/product_product.py`
- **Class:** `ProductProduct(models.Model)`
- **`_name`:** `product.product`
- **`_inherits`:** `{ 'product.template': 'product_tmpl_id' }` (delegation
  inheritance — every variant has a `product_tmpl_id` pointer; reading any
  template field on a variant transparently reads from the template).
- **Why it matters for the clone:** Odoo's "Products" menu (action 278) is
  rooted on **`product.template`**, but pricing, supplier-info, and stock
  rollups operate on **`product.product`** under the hood. The form pretends
  it's editing one row, but `attribute_line_ids` write generates one
  `product.product` per attribute-value combination.

---

## Related model snapshots (Many2one targets that appear in the form)

- **`product.category`** (`addons/product/models/product_category.py`,
  `class ProductCategory`). Tree (parent_id/parent_path). The "Garden World"
  GardenWorld categories show "All / IT Enabled Services / SMS & Messaging"
  in the screenshot. Drives `property_account_*` defaults.
- **`uom.uom`** (`addons/product/models/uom_uom.py` and inherits in
  `addons/account/`, `addons/l10n_*`). Has `category_id` — UoMs only convert
  within the same category.
- **`product.tag`** (`addons/product/models/product_tag.py`).
- **`product.template.attribute.line`** (`addons/product/models/product_template_attribute_line.py`)
  + `product.template.attribute.value` and `product.attribute`,
  `product.attribute.value`. The attribute-driven variant generator.
- **`product.supplierinfo`** (`addons/product/models/product_supplierinfo.py`)
  — vendor catalog with `partner_id`, `product_code`, `product_name`,
  `min_qty`, `price`, `currency_id`, `delay`, `date_start`/`end`.
  Multi-row table inside the Purchase tab.
- **`account.tax`** (`addons/account/models/account_tax.py`). Many2many.
  Domain filtered by `type_tax_use`.
- **`account.account`** (`addons/account/models/account_account.py`).
  Property, company-dependent (one value per company).
- **`product.document`** (one2many; "Documents" stat button).
- **`stock.route`**, **`stock.warehouse`**, **`stock.location`** (stock
  module). Inventory tab. Not relevant on this Odoo install (no stock
  storables).
- **`mail.followers`**, **`mail.message`**, **`mail.activity`** (chatter).

---

## Custom addon — `kb_integration` (the "Kill Bill" tab)

- **File:** `custom-addons/kb_integration/models/product_template.py`
- Adds two fields:
  - `x_kb_product_name` — Char, "KB Product Name" (passed to upstream billing).
  - `x_kb_category` — Selection `BASE` / `ADD_ON`.
- Overrides `write(vals)` to enqueue a `kb.sync.log` row when `x_kb_*`,
  `list_price`, or `active` change. (This is project-specific and must NOT
  be replicated 1:1 in our clone — it's billing integration, not product
  modeling.)

---

## Things on the form that are not Python source

- The chatter (Send message / Log note / Activities, "Following" toggle, the
  attachment / followers icons) is OWL/JS — `mail.thread` mixin wires up the
  arch tag `<chatter/>` and the front-end resolves it. For our clone we render
  this with our existing modern message panel; no need to mimic Odoo's exact
  layout.
- Stat buttons in the form's `<header>` (`Extra Prices`, `Documents`, `Variants`,
  `Sold`) are arch declarations of `<button class="oe_stat_button" ...>` that
  invoke action XML-IDs. Each stat-button click is a separate action — those
  belong to a different clone scope.
