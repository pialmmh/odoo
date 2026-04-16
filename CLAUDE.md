# orchestrix-v2 — project notes

## Catalog architecture — one source of truth

The catalog (what we sell, features, prices, tax class) lives in **Odoo only**. Everything
else is derived.

```
Odoo product (SOURCE OF TRUTH)
  ├── product.template               → product family (e.g. "Internet DIA")
  ├── product.product (variant)      → specific SKU (e.g. "DIA 100 Mbps Monthly")
  │     ├── lst_price                → base catalog price
  │     ├── x_kb_plan_name           → links variant to a Kill Bill plan
  │     ├── x_kb_billing_period      → MONTHLY / QUARTERLY / ANNUAL
  │     └── x_package_items (JSON)   → entitlement template for PackageAccount
  └── product.rate.history           → dated pricing, effective_date / end_date, audit trail

Derived (NEVER a second source of truth):
  Kill Bill catalog    ← generated from Odoo variants with x_kb_plan_name set
  PackageAccount       ← provisioned from x_package_items when a KB subscription fires
```

**Rules:**

1. There is **no separate "catalog" page** in the UI. The Products page IS the catalog.
   Do not recreate a `Catalog.jsx` or a hard-coded `planFeatures.js` — both were deleted
   for exactly this reason.
2. Kill Bill catalog is a **build artifact**, not a source. When a variant is edited in
   Odoo, a sync job (later phase) regenerates the KB catalog XML. Never hand-edit it.
3. PackageAccount entitlements are **derived** from `x_package_items`. The event bridge
   (later phase) reads the JSON and provisions RTC-Manager records. Never enter
   entitlement values directly into PackageAccount — always through the product.
4. Prices flow one way: Rate History (dated) → `get_rate_at_date()` → invoicing.
   `lst_price` is the fallback when no dated rate exists. Never write prices into
   Kill Bill's catalog XML or into `planFeatures.js`.
5. When adding a new sellable thing, the checklist is: create the Odoo product →
   set `x_kb_plan_name`, `x_kb_billing_period`, `x_package_items` → seed a
   `rate_history` entry if the price isn't the list price. Everything downstream follows.

## UI must never expose underlying tech stack

End users see the UI. They must **not** see the names or concepts of the backend
systems we integrate with. This includes, but is not limited to:

- **Odoo** — our catalog / tax / accounting backend
- **Kill Bill / KB** — our billing / subscription engine
- **Keycloak** — our auth provider
- **APISIX** — our API gateway
- **Vault / OpenBao** — our secrets store
- **Kafka** — our event bus

### Rules

1. **Never** put these names in UI labels, headings, tooltips, error messages,
   column headers, menu items, page titles, or help text.
2. **Never** expose internal IDs that leak the backend (e.g. "KB Account ID",
   "Odoo Partner ID", "Kill Bill Plan Name"). Use neutral terms: "Account",
   "Customer", "Plan".
3. **Never** copy internal model/field names to the UI. `product.template` →
   "Product". `product.rate.history` → "Rate History". `kb.subscription` →
   "Subscription".
4. Code comments, service files (`services/odoo.js`, `services/killbill.js`),
   and internal variable names **can** use the real tech names — this rule
   applies to **user-facing text only**.
5. When you find existing UI that violates this (e.g. "Odoo catalog snapshot",
   "KB Plan"), fix it opportunistically when touching that code.

### Why

- Customers and non-technical staff should see a single coherent product, not a
  stitched-together toolchain.
- We may swap any of these components later (e.g. Kill Bill → a custom billing
  service). UI text shouldn't need rewriting for that.
- Leaking backend names is a minor information disclosure (tells attackers
  exactly which CVEs to try).

### Naming crib sheet

| Don't say          | Say instead                          |
|--------------------|--------------------------------------|
| Odoo / Odoo catalog| Catalog / Product catalog            |
| Kill Bill / KB     | Billing / Subscription engine (internal) — in UI just "Subscription" / "Invoice" / "Payment" |
| KB Account         | Customer account                     |
| Odoo Partner       | Customer / Company                   |
| Keycloak realm     | Tenant                               |
| APISIX route       | (never mention — it's infrastructure)|
| Kafka topic        | Event / Notification (if user-visible at all) |
