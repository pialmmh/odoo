# Goals & Progress

## Vision

Build a multi-tenant billing platform for Telcobright's telecom/ISP clients (BTCL, etc.) where:
- **Odoo** is the brain — masters partners, product catalog, accounting/GL, tax, sales
- **Kill Bill** is the engine — executes subscriptions, recurring invoicing, payments, dunning
- **Kafka** is the nervous system — all sync between Odoo and Kill Bill flows through Kafka topics for guaranteed delivery and eventual consistency

## What's Done

### Kill Bill Side (COMPLETE — ready to use)
- [x] Kill Bill 0.24.16 installed from source at `/home/mustafa/telcobright-projects/odoo/killbill-billing/`
- [x] Build/start/reset scripts working (`build.sh`, `start.sh`, `reset-db.sh`)
- [x] Server runs on port 18080, MySQL `killbill` database on 127.0.0.1:3306
- [x] Multi-tenancy enabled (`org.killbill.server.multitenant=true`)
- [x] First tenant created: `telcobright-isp` / `telcobright-isp-secret`
- [x] ISP catalog uploaded (8 products, 8 plans — see `catalogs/isp-catalog.xml`)
- [x] Overdue/dunning config uploaded (WARNING 7d → SUSPENDED 14d → DISCONNECTED 30d)
- [x] Custom React UI on port 5180 with: customers, subscriptions, invoices, payments, AR report, tenant management
- [x] Full/partial payment with method tracking (`transactionExternalKey` convention)
- [x] Payment receipt view/print
- [x] Multi-tenant UI with login/tenant selector
- [x] JDK 17 (Kill Bill requires JDK 11-17, NOT 21)

### Odoo Side (PARTIALLY DONE)
- [x] Odoo 17 CE installed from source, running on port 7169
- [x] PostgreSQL 16 on port 5433, database `odoo_billing`
- [x] Core modules installed: `base`, `contacts`, `account`, `account_payment`, `l10n_bd`, `sale_management`, `mail`, `portal`
- [x] Product catalog created via XML-RPC script: Shared Internet (21 variants), DIA (21 variants), Bulk SMS (5 variants), 6 simple services
- [x] Product categories and attributes set up (Bandwidth, Billing Cycle, SMS Package)
- [ ] `kb_integration` custom module — NOT CREATED YET
- [ ] Multi-company setup — NOT CONFIGURED (single default company)
- [ ] Payment journals (bKash, Nagad, Rocket, etc.) — NOT CREATED
- [ ] 15% VAT tax — NOT CREATED
- [ ] Payment terms (Net 7/15/30) — NOT CREATED
- [ ] Fiscal year (July-June) — NOT SET
- [ ] KB fields on products (x_kb_product_name, x_kb_plan_name, etc.) — NOT POPULATED

### Kafka & Sync Services (NOT STARTED)
- [ ] Kafka setup (KRaft single-node for dev)
- [ ] Topic creation (8 topics: 4 odoo.*, 4 kb.*)
- [ ] KB Consumer Service — reads odoo.* topics, calls KB REST API
- [ ] Odoo Consumer Service — reads kb.* topics, calls Odoo XML-RPC
- [ ] KB Webhook Relay — receives KB webhooks, publishes to kb.* topics
- [ ] Catalog XML generation from Odoo products
- [ ] Partner sync (Odoo → Kafka → KB)
- [ ] Invoice sync (KB → Kafka → Odoo)
- [ ] Payment sync (KB → Kafka → Odoo)
- [ ] Subscription sync (Odoo SO → Kafka → KB)

## Roadmap — Small Steps to Working Prototype

Execute these in order. Each step should be verified before moving to the next.

### Step 1: Create & install `kb_integration` module
**See**: [07-kb-integration-module.md](07-kb-integration-module.md)
- Create the module with all custom fields on res.company, res.partner, product.template, product.product, account.move, account.payment, sale.order.line
- Create `kb.sync.log` model (tracks Kafka consumption results)
- Create all views (extending existing forms with KB tabs/fields)
- Install the module in Odoo
- **Verify**: KB fields visible on company, partner, product, invoice, payment forms

### Step 2: Configure multi-tenancy
**See**: [06-multi-tenancy.md](06-multi-tenancy.md)
- Rename default company (id=1) to "Telcobright ISP"
- Set `x_kb_api_key = 'telcobright-isp'`, `x_kb_api_secret = 'telcobright-isp-secret'` on it
- **Verify**: Company form shows KB tenant credentials

### Step 3: Accounting plumbing (per company)
**See**: [10-accounting-config.md](10-accounting-config.md)
- Create payment journals: Cash, Bank, bKash, Nagad, Rocket, Cheque, Online Gateway
- Create 15% VAT tax
- Create payment terms: Net 7, Net 15, Net 30
- Set fiscal year to July-June
- **Verify**: Journals and tax visible in Accounting settings

### Step 4: Populate KB fields on existing products
- Write a script (or extend `setup_products.py`) to set `x_kb_product_name`, `x_kb_category` on product templates and `x_kb_plan_name`, `x_kb_billing_period` on product variants
- Start with 2-3 products (e.g. Internet-100Mbps, BulkSMS, StaticIP) to validate the flow
- **Verify**: Products show KB fields in Odoo UI

### Step 5: Set up Kafka + sync service skeleton
**See**: [09-sync-service.md](09-sync-service.md)
- Set up Kafka (KRaft single-node for dev)
- Create 8 topics (odoo.partner.verified, odoo.catalog.changed, odoo.subscription.requested, odoo.payment.recorded, kb.invoice.created, kb.payment.succeeded, kb.subscription.changed, kb.overdue.changed)
- Create sync service skeleton at `/home/mustafa/telcobright-projects/odoo-kb-sync/` with three services:
  - `kb-consumer/` — reads odoo.* topics, calls KB REST API
  - `odoo-consumer/` — reads kb.* topics, calls Odoo XML-RPC
  - `kb-webhook-relay/` — receives KB webhooks (port 8900), publishes to kb.* topics
- Implement common Kafka producer/consumer config
- **Verify**: Services start, connect to Kafka, log "waiting for messages"

### Step 6: Catalog sync (Odoo → Kafka → KB)
**See**: [08-catalog-sync.md](08-catalog-sync.md)
- Implement catalog XML generation from Odoo products
- Odoo publishes to `odoo.catalog.changed` when KB product fields change
- KB consumer reads topic, uploads catalog XML to Kill Bill
- **Verify**: Change product in Odoo → message in Kafka → KB serves updated catalog

### Step 7: Partner sync (Odoo → Kafka → KB)
- Odoo publishes to `odoo.partner.verified` when verification_status changes to "verified"
- KB consumer reads topic, creates KB account, writes accountId back to Odoo
- **Verify**: Create partner in Odoo, verify it → message in Kafka → KB has account → Odoo partner has x_kb_account_id

### Step 8: Subscription sync (Odoo SO → Kafka → KB)
- Odoo publishes to `odoo.subscription.requested` when SO is confirmed (one message per SO line with x_kb_plan_name)
- KB consumer reads topic, creates KB subscription, writes subscriptionId back to Odoo
- **Verify**: Confirm SO in Odoo → message in Kafka → subscription in KB → SO line has x_kb_subscription_id

### Step 9: Invoice sync (KB → Kafka → Odoo)
- Register KB webhook callback to webhook relay (port 8900)
- Webhook relay publishes INVOICE_CREATION events to `kb.invoice.created`
- Odoo consumer reads topic, creates account.move in Odoo
- **Verify**: KB generates invoice → webhook → Kafka → Odoo shows matching customer invoice

### Step 10: Payment sync (KB → Kafka → Odoo)
- Webhook relay publishes PAYMENT_SUCCESS events to `kb.payment.succeeded`
- Odoo consumer reads topic, creates account.payment in Odoo, reconciles with invoice
- Maps `transactionExternalKey` prefix to correct Odoo journal
- **Verify**: Pay invoice in KB → webhook → Kafka → Odoo shows payment, invoice reconciled

### Step 11: End-to-end test
- Create partner in Odoo → verify → Kafka → KB account created
- Create SO → confirm → Kafka → KB subscription created
- KB generates invoice → Kafka → Odoo invoice appears
- Pay in KB → Kafka → Odoo payment appears, invoice reconciled
- Test with 2nd tenant/company
- Test failure scenarios: stop KB, produce messages, restart KB, verify catch-up

## Priority Note

Steps 1-5 are the foundation (Odoo config + Kafka infra). Steps 6-10 build the actual sync flows one by one. Step 11 is the integration test that proves everything works end-to-end, including Kafka's guaranteed delivery under failure conditions.
