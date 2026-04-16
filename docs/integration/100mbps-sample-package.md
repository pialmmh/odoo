# 100 Mbps Sample Package — Reference Flow

The canonical end-to-end example we use to validate the catalog → billing →
entitlement pipeline. Every new integration or change should still make this
flow work.

Linked visual: `docs/entity-modeling/subscription-entity-diagram.md` (and
`.html`).

## What it is

A residential/SMB internet plan: **"Internet 100 Mbps — Monthly"**, BDT 1,200/mo.
Unlimited data, standard tier. Not actually provisioned against hardware in
this doc — that part is the job of the event bridge + RTC-Manager.

## The chain

```
Odoo product (source of truth)
   │
   ├── product.template  "Internet 100Mbps"      id=5
   │     list_price=1200, categ=Internet
   │     x_kb_product_name = Internet-100Mbps
   │
   ├── product.product (variant) "DIA 100 Mbps Monthly"   id=12
   │     lst_price=1200
   │     x_kb_plan_name      = internet-100mbps-monthly
   │     x_kb_billing_period = MONTHLY
   │     x_package_items     = [ {bandwidth 100 MBPS}, {data unlimited} ]
   │
   └── product.rate.history
         price=1200, effective_date=2026-01-01, end_date=NULL
         tier=standard
         │
         ▼
Kill Bill (derived — build artifact)
   catalog plan: internet-100mbps-monthly     BDT 1200/MONTHLY
   subscription event fires on customer sign-up
         │
         ▼
Event bridge (to build)
   reads Odoo variant.x_package_items
         │
         ▼
RTC-Manager — PackageAccount (derived)
   entitlements provisioned from x_package_items
```

## Current state — what works, what's left

### Works
- Odoo `product.template` + `product.product` variant created via `scripts/setup_products.py`
- `x_package_items` field exists on `product.product` (JSON text)
- `product.rate.history` dated pricing with `get_rate_at_date()` and
  `get_current_rates_bulk()`
- UI: Products page shows variants, inline-edit `lst_price`, editor for
  `x_package_items`
- UI: Rate History page with variant attribute chips
- UI: Pricing page with dual columns (List + Effective)

### Left to do (ordered)
1. **Seed `x_package_items` on the 100 Mbps DIA Monthly variant**
   ```json
   [
     {"type":"bandwidth","value":100,"unit":"MBPS","direction":"symmetric"},
     {"type":"data","value":"unlimited","unit":"GB"},
     {"type":"static_ip","value":1,"unit":"COUNT"}
   ]
   ```
   Save through the Products page modal (no migration script needed).
2. **Migrate UI consumers off `planFeatures.js`**. Files that still read the
   deprecated shim:
   - `ui/src/pages/CustomerDetail.jsx`
   - `ui/src/pages/Invoices.jsx`
   - `ui/src/pages/Payments.jsx`
   Replace calls with `getProductVariants()` → `variant.x_package_items`
   (parse JSON). Delete `services/planFeatures.js` when last consumer migrates.
3. **KB event bridge**: subscribe to KB `SUBSCRIPTION_CREATION` / `PHASE` events,
   look up the Odoo variant by `x_kb_plan_name`, read `x_package_items`,
   POST to RTC-Manager to create the `PackageAccount` rows. (Event bus:
   Kafka topic TBD — see pending task "Wire KB event bridge".)
4. **Verify flow end-to-end**: create KB subscription on test customer →
   observe PackageAccount rows appear with the three entitlements above.

## Invariants (don't break these)

- `x_package_items` is the **only** place entitlement template lives. Do not
  hard-code bandwidth/data numbers in `planFeatures.js`, in Kill Bill catalog
  XML, or in RTC-Manager seed scripts.
- Price used for invoicing = `get_rate_at_date(today)` on `product.rate.history`
  falling back to `lst_price` when no dated rate covers the date. Do not read
  prices from Kill Bill's catalog XML in Odoo reports.
- `x_kb_plan_name` on the variant is the join key between Odoo and Kill Bill.
  Changing it requires regenerating the KB catalog.

## Smoke test

1. Log in to UI, go to Products → "Internet 100Mbps" → variant "DIA 100 Mbps Monthly"
2. Confirm `lst_price=1200`, `x_kb_plan_name=internet-100mbps-monthly`,
   `x_package_items` JSON is present and parses
3. Go to Rate History → filter by this variant → row with price 1200, effective 2026-01-01
4. Go to Pricing → row shows List=1200 and Effective=1200 for this variant
5. (After bridge built) Trigger KB subscription creation → PackageAccount rows
   appear in RTC-Manager with bandwidth/data/static_ip entitlements
