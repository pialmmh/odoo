# System Architecture

## Overview

```
┌─────────────────────────┐                           ┌─────────────────────────┐
│  Odoo 17 CE (brain)     │                           │  Kill Bill 0.24.16      │
│  Port: 7169             │                           │  (engine)               │
│  DB: PG 5433            │                           │  Port: 18080            │
│                         │                           │  DB: MySQL 3306         │
│  - Partners (master)    │                           │                         │
│  - Product catalog      │                           │  - Subscriptions        │
│  - Accounting / GL      │                           │  - Recurring invoices   │
│  - Tax / VAT            │                           │  - Payment recording    │
│  - Sales pipeline       │                           │  - Dunning/overdue      │
│  - Financial reporting  │                           │  - Multi-tenant (row)   │
│                         │                           │                         │
└────────┬────────────────┘                           └───────────┬─────────────┘
         │                                                        │
         │ Produces events                        Produces events │
         ▼                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Apache Kafka                                       │
│                                                                                 │
│  Odoo → KB topics:                        KB → Odoo topics:                     │
│    odoo.partner.verified                    kb.invoice.created                   │
│    odoo.catalog.changed                     kb.payment.succeeded                 │
│    odoo.subscription.requested              kb.subscription.changed              │
│    odoo.payment.recorded                    kb.overdue.changed                   │
│                                                                                 │
│  Partitioned by: tenant_api_key + account_external_key (per-customer ordering)  │
└────────┬──────────────────────────────────────────────────────┬─────────────────┘
         │                                                      │
         │ Consumed by                              Consumed by │
         ▼                                                      ▼
┌─────────────────────────────┐              ┌─────────────────────────────┐
│  KB Consumer Service        │              │  Odoo Consumer Service      │
│  (Python)                   │              │  (Python)                   │
│                             │              │                             │
│  Reads odoo.* topics        │              │  Reads kb.* topics          │
│  Calls KB REST API          │              │  Calls Odoo XML-RPC         │
│  Writes back to Odoo via    │              │  Logs to kb.sync.log        │
│    odoo.* response topics   │              │                             │
│    or XML-RPC               │              │                             │
└─────────────────────────────┘              └─────────────────────────────┘
```

## Why Kafka Instead of Direct API Calls

| Direct REST/Webhook (old design) | Kafka Event Bus (current design) |
|---|---|
| If KB is down, partner sync fails and is lost | Message waits in topic, consumed when KB recovers |
| Webhook delivery is fire-and-forget, no replay | Kafka retains messages, consumers can replay from any offset |
| Retry logic must be hand-built per handler | Consumer group handles retries, dead-letter topics for poison messages |
| Tight coupling: sync service must know both APIs | Loose coupling: producers and consumers are independent |
| Single sync service is a SPOF | Consumers can scale independently, crash and restart without data loss |
| No ordering guarantees across retries | Partition key guarantees per-customer event ordering |

## Event-Driven Sync Model

### Odoo → Kafka (Odoo produces, KB consumer processes)

```
Odoo partner verified     → publish to: odoo.partner.verified
Odoo product/price change → publish to: odoo.catalog.changed
Odoo SO confirmed         → publish to: odoo.subscription.requested
Odoo payment recorded     → publish to: odoo.payment.recorded
```

The **KB consumer service** reads these topics and calls Kill Bill's REST API.

### Kill Bill → Kafka (KB produces, Odoo consumer processes)

```
KB invoice generated      → publish to: kb.invoice.created
KB payment succeeded      → publish to: kb.payment.succeeded
KB subscription changed   → publish to: kb.subscription.changed
KB overdue state changed  → publish to: kb.overdue.changed
```

The **Odoo consumer service** reads these topics and calls Odoo's XML-RPC API.

### How KB Events Get to Kafka

Kill Bill fires push notifications (webhooks) on lifecycle events. A lightweight **KB webhook relay** receives these webhooks and publishes them to the appropriate Kafka topic. This relay is the only component that uses webhooks — everything downstream is Kafka.

```
KB event → webhook POST → KB webhook relay → Kafka topic (kb.*)
```

## Responsibility Matrix

| Domain | Odoo (brain — defines) | Kill Bill (engine — executes) | Sync Direction |
|---|---|---|---|
| **Partners / Customers** | Master records: contact info, NID, verification, tags, company | Account records (accountId, externalKey) — lightweight mirror | Odoo → Kafka → KB |
| **Product Catalog / Plans** | Product templates + variants define products, plans, pricing, trial config | Receives catalog XML, uses it to drive subscriptions | Odoo → Kafka → KB |
| **Sales Pipeline** | Quotations → Sales Orders → triggers subscription creation | — | Odoo → Kafka → KB |
| **Subscriptions** | — (no `sale_subscription`, it's Enterprise) | Subscription lifecycle, plan changes, pause/resume/cancel, proration | KB → Kafka → Odoo |
| **Invoice Generation** | Mirrors as `account.move` (customer invoices in GL) | Creates invoices on recurring schedule, tracks balance | KB → Kafka → Odoo |
| **Payment Recording** | Mirrors as `account.payment`, reconciles with invoice | Records payments (cash, bKash, bank, cheque, gateway), partial/refunds | KB → Kafka → Odoo |
| **Payment Gateway (SSLCommerz)** | — | Receives gateway callbacks, records payment | KB → Kafka → Odoo |
| **Accounting / GL** | Chart of accounts, journal entries, trial balance, P&L, balance sheet | — | KB feeds Odoo via Kafka |
| **Tax / VAT** | VAT calculation, tax codes, tax reports, compliance | — | Odoo owns |
| **Dunning / Overdue** | — | WARNING → SUSPENDED → DISCONNECTED escalation, auto-clear on payment | KB → Kafka → Odoo (tags/notes) |
| **Reporting** | Financial statements, aging, tax, revenue recognition | AR report, collection rate, payment history (billing UI) | Both |
| **Multi-tenancy** | Multi-company (one `res.company` per KB tenant) | Row-level tenant isolation (API key/secret) | Map KB tenant ↔ Odoo company |

## Kafka Topic Design

| Topic | Producer | Consumer | Partition Key | Payload |
|---|---|---|---|---|
| `odoo.partner.verified` | Odoo | KB consumer | `{tenant_api_key}:{external_key}` | Partner data (name, email, externalKey, currency) |
| `odoo.catalog.changed` | Odoo | KB consumer | `{tenant_api_key}` | Generated catalog XML + SHA256 hash |
| `odoo.subscription.requested` | Odoo | KB consumer | `{tenant_api_key}:{external_key}` | SO line data (accountId, planName, externalKey) |
| `odoo.payment.recorded` | Odoo | KB consumer | `{tenant_api_key}:{external_key}` | Payment data (accountId, amount, method, ref) |
| `kb.invoice.created` | KB webhook relay | Odoo consumer | `{tenant_api_key}:{account_id}` | KB invoice event (invoiceId, accountId, items) |
| `kb.payment.succeeded` | KB webhook relay | Odoo consumer | `{tenant_api_key}:{account_id}` | KB payment event (paymentId, amount, method) |
| `kb.subscription.changed` | KB webhook relay | Odoo consumer | `{tenant_api_key}:{account_id}` | Subscription state change (subscriptionId, state) |
| `kb.overdue.changed` | KB webhook relay | Odoo consumer | `{tenant_api_key}:{account_id}` | Overdue state (accountId, blockingState) |

### Topic Configuration

- **Retention**: 7 days (enough for replay/debugging)
- **Partitions**: Start with 3 per topic (scale as needed)
- **Replication**: 1 for dev, 3 for production
- **Cleanup policy**: `delete` (time-based retention)

## Component Summary

| Component | Role | Location |
|---|---|---|
| Odoo 17 CE | Brain — master data, accounting | `/home/mustafa/telcobright-projects/odoo/` |
| Kill Bill 0.24.16 | Engine — subscriptions, billing | `/home/mustafa/telcobright-projects/odoo/killbill-billing/` |
| Kafka | Event bus — guaranteed delivery | (to be set up) |
| KB Consumer Service | Reads `odoo.*` topics, calls KB REST API | `/home/mustafa/telcobright-projects/odoo-kb-sync/kb-consumer/` |
| Odoo Consumer Service | Reads `kb.*` topics, calls Odoo XML-RPC | `/home/mustafa/telcobright-projects/odoo-kb-sync/odoo-consumer/` |
| KB Webhook Relay | Receives KB webhooks, publishes to `kb.*` topics | `/home/mustafa/telcobright-projects/odoo-kb-sync/kb-webhook-relay/` |
| `kb_integration` module | Odoo custom module — KB fields, views, sync log | `/home/mustafa/telcobright-projects/odoo/custom-addons/kb_integration/` |

## Design Principles

1. **Odoo is the brain** — it defines what to bill (partners, products/plans, pricing). Kill Bill never originates catalog or customer data.
2. **Kill Bill is the engine** — it executes billing (subscriptions, invoices, payments, dunning). Odoo never generates recurring invoices.
3. **Kafka is the nervous system** — all data sync flows through Kafka topics. No direct API calls between Odoo and Kill Bill. This ensures eventual consistency even when either system is down.
4. **Catalog flows one way: Odoo → Kafka → Kill Bill** — product changes in Odoo generate catalog XML, published to Kafka, consumed by KB consumer.
5. **Billing events flow one way: Kill Bill → Kafka → Odoo** — invoices and payments created in KB are published to Kafka, consumed by Odoo consumer.
6. **No paid modules** — everything must be Odoo Community or OCA. Build custom modules for gaps.
7. **Single source of truth** — partners mastered in Odoo, billing execution mastered in Kill Bill, Kafka bridges both.
8. **Kill Bill multi-tenancy maps to Odoo multi-company** — each KB tenant = one Odoo `res.company`.
9. **Idempotency everywhere** — every consumer uses UUID-based keys to prevent duplicates on replay/retry.
10. **Per-customer ordering** — Kafka partition keys include account/external key so events for a single customer are always processed in order.
