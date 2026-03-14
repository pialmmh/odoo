# Sync Service Architecture

## Overview

Event-driven sync layer using **Apache Kafka** as the message bus between Odoo and Kill Bill. No direct API calls between the two systems — all communication flows through Kafka topics for guaranteed delivery and eventual consistency.

**Location**: `/home/mustafa/telcobright-projects/odoo-kb-sync/`

## Structure

```
odoo-kb-sync/
├── kb-consumer/                # Reads odoo.* topics, calls KB REST API
│   ├── main.py                 # Consumer entry point
│   ├── config.py               # Kafka + KB connection config
│   ├── kb_client.py            # Kill Bill REST client (port 18080)
│   ├── catalog_generator.py    # Odoo product data → KB catalog XML
│   ├── handlers/
│   │   ├── partner_handler.py  # odoo.partner.verified → create KB account
│   │   ├── catalog_handler.py  # odoo.catalog.changed → upload catalog XML
│   │   ├── subscription_handler.py  # odoo.subscription.requested → create KB subscription
│   │   └── payment_handler.py  # odoo.payment.recorded → record KB payment
│   └── requirements.txt
│
├── odoo-consumer/              # Reads kb.* topics, calls Odoo XML-RPC
│   ├── main.py                 # Consumer entry point
│   ├── config.py               # Kafka + Odoo connection config
│   ├── odoo_client.py          # Odoo XML-RPC client (port 7169)
│   ├── handlers/
│   │   ├── invoice_handler.py  # kb.invoice.created → create account.move
│   │   ├── payment_handler.py  # kb.payment.succeeded → create account.payment
│   │   ├── subscription_handler.py  # kb.subscription.changed → update partner/SO
│   │   └── overdue_handler.py  # kb.overdue.changed → update partner tags
│   └── requirements.txt
│
├── kb-webhook-relay/           # Receives KB webhooks, publishes to kb.* topics
│   ├── main.py                 # FastAPI app (port 8900)
│   ├── config.py               # Kafka connection config
│   └── requirements.txt
│
├── common/                     # Shared code
│   ├── kafka_config.py         # Kafka producer/consumer factory
│   ├── models.py               # Pydantic event models
│   └── topics.py               # Topic name constants
│
└── docker-compose.kafka.yml    # Kafka + Zookeeper for dev (optional)
```

## Connection Details

| System | Protocol | Endpoint |
|--------|----------|----------|
| Kafka | Kafka protocol | `localhost:9092` (default) |
| Odoo | XML-RPC | `http://localhost:7169/xmlrpc/2/common` and `/xmlrpc/2/object` |
| Kill Bill | REST | `http://localhost:18080/1.0/kb/` |
| Odoo DB | PostgreSQL | `localhost:5433`, user `mustafa` |
| KB DB | MySQL | `127.0.0.1:3306`, user `root`, password `123456`, database `killbill` |
| KB Auth | Basic | `admin:password` |
| Odoo Auth | XML-RPC | database `odoo_billing`, user `admin`, password `admin` |
| KB Webhook Relay | HTTP | `http://localhost:8900/webhook/kb` |

## Kafka Topics

| Topic | Direction | Partition Key | Payload |
|---|---|---|---|
| `odoo.partner.verified` | Odoo → KB | `{tenant_api_key}:{external_key}` | Partner data |
| `odoo.catalog.changed` | Odoo → KB | `{tenant_api_key}` | Catalog XML + hash |
| `odoo.subscription.requested` | Odoo → KB | `{tenant_api_key}:{external_key}` | SO line data |
| `odoo.payment.recorded` | Odoo → KB | `{tenant_api_key}:{external_key}` | Payment data |
| `kb.invoice.created` | KB → Odoo | `{tenant_api_key}:{account_id}` | Invoice event |
| `kb.payment.succeeded` | KB → Odoo | `{tenant_api_key}:{account_id}` | Payment event |
| `kb.subscription.changed` | KB → Odoo | `{tenant_api_key}:{account_id}` | Subscription state |
| `kb.overdue.changed` | KB → Odoo | `{tenant_api_key}:{account_id}` | Overdue state |

### Consumer Groups

| Consumer | Group ID | Topics |
|---|---|---|
| KB Consumer Service | `kb-consumer-group` | `odoo.partner.verified`, `odoo.catalog.changed`, `odoo.subscription.requested`, `odoo.payment.recorded` |
| Odoo Consumer Service | `odoo-consumer-group` | `kb.invoice.created`, `kb.payment.succeeded`, `kb.subscription.changed`, `kb.overdue.changed` |

## Event Schemas (JSON)

### `odoo.partner.verified`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "tenant_api_secret": "telcobright-isp-secret",
  "odoo_partner_id": 42,
  "data": {
    "name": "ABC ISP Ltd",
    "email": "billing@abcisp.com",
    "external_key": "ISP-001",
    "currency": "BDT",
    "company_name": "ABC ISP Ltd",
    "phone": "+8801712345678"
  }
}
```

### `odoo.catalog.changed`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "tenant_api_secret": "telcobright-isp-secret",
  "catalog_hash": "sha256-of-xml-without-effectiveDate",
  "catalog_xml": "<catalog>...full XML...</catalog>"
}
```

### `odoo.subscription.requested`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "tenant_api_secret": "telcobright-isp-secret",
  "odoo_sale_order_line_id": 15,
  "data": {
    "kb_account_id": "account-uuid",
    "plan_name": "internet-100mbps-monthly",
    "external_key": "SO-S00001-1"
  }
}
```

### `odoo.payment.recorded`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "tenant_api_secret": "telcobright-isp-secret",
  "odoo_payment_id": 88,
  "data": {
    "kb_account_id": "account-uuid",
    "amount": 20700.00,
    "currency": "BDT",
    "transaction_external_key": "BKASH:TXN12345:Monthly payment"
  }
}
```

### `kb.invoice.created`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "kb_event_type": "INVOICE_CREATION",
  "data": {
    "invoice_id": "invoice-uuid",
    "account_id": "account-uuid",
    "invoice_date": "2026-03-15",
    "amount": 18000.00,
    "currency": "BDT",
    "items": [
      {
        "description": "Internet-100Mbps — internet-100mbps-monthly",
        "amount": 18000.00,
        "plan_name": "internet-100mbps-monthly",
        "start_date": "2026-03-15",
        "end_date": "2026-04-14"
      }
    ]
  }
}
```

### `kb.payment.succeeded`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "kb_event_type": "PAYMENT_SUCCESS",
  "data": {
    "payment_id": "payment-uuid",
    "account_id": "account-uuid",
    "amount": 20700.00,
    "currency": "BDT",
    "transaction_external_key": "BKASH:TXN12345:Monthly payment",
    "target_invoice_id": "invoice-uuid"
  }
}
```

### `kb.subscription.changed`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "kb_event_type": "SUBSCRIPTION_PHASE",
  "data": {
    "subscription_id": "subscription-uuid",
    "account_id": "account-uuid",
    "plan_name": "internet-100mbps-monthly",
    "phase": "EVERGREEN",
    "state": "ACTIVE"
  }
}
```

### `kb.overdue.changed`

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2026-03-15T10:00:00+06:00",
  "tenant_api_key": "telcobright-isp",
  "kb_event_type": "OVERDUE_CHANGE",
  "data": {
    "account_id": "account-uuid",
    "blocking_state": "SUSPENDED",
    "previous_state": "WARNING"
  }
}
```

## Sync Flows — Odoo → Kafka → Kill Bill

### Flow 1: Partner Verified → Create KB Account

```
Odoo: partner.x_verification_status set to "verified"
  │
  ▼
Odoo publishes to: odoo.partner.verified
  partition key: "telcobright-isp:ISP-001"
  payload: { name, email, external_key, currency }
  │
  ▼
KB Consumer reads message:
  1. Check idempotency: does partner already have x_kb_account_id? (query Odoo)
  2. If not: POST /1.0/kb/accounts to Kill Bill
  3. Extract accountId from response
  4. Write accountId back to Odoo partner via XML-RPC
  5. Log to kb.sync.log (operation=partner_to_kb, status=success)
  6. Commit Kafka offset
```

### Flow 2: Product Catalog Changed → Upload XML

```
Odoo: product with x_kb_product_name created/modified
  │
  ▼
Odoo publishes to: odoo.catalog.changed
  partition key: "telcobright-isp"
  payload: { catalog_xml, catalog_hash }
  │
  ▼
KB Consumer reads message:
  1. Check hash against last successful catalog_hash in kb.sync.log
  2. If unchanged: skip, commit offset
  3. If changed: POST /1.0/kb/catalog/xml to Kill Bill
  4. Log to kb.sync.log with new hash
  5. Commit offset
```

### Flow 3: SO Confirmed → Create Subscription

```
Odoo: Sale Order confirmed
  │
  ▼
Odoo publishes to: odoo.subscription.requested (one message per SO line)
  partition key: "telcobright-isp:ISP-001"
  payload: { kb_account_id, plan_name, external_key }
  │
  ▼
KB Consumer reads message:
  1. Check idempotency: does SO line already have x_kb_subscription_id?
  2. If not: POST /1.0/kb/subscriptions to Kill Bill
  3. Write subscriptionId back to Odoo SO line
  4. Log to kb.sync.log
  5. Commit offset
```

### Flow 4: Payment Recorded in Odoo → Record in KB

```
Odoo: account.payment created
  │
  ▼
Odoo publishes to: odoo.payment.recorded
  partition key: "telcobright-isp:ISP-001"
  payload: { kb_account_id, amount, transaction_external_key }
  │
  ▼
KB Consumer reads message:
  1. POST /1.0/kb/accounts/{accountId}/payments to Kill Bill
  2. Write paymentId back to Odoo
  3. Log to kb.sync.log
  4. Commit offset
```

## Sync Flows — Kill Bill → Kafka → Odoo

### How KB Events Reach Kafka

Kill Bill fires push notification webhooks. The **KB webhook relay** (port 8900) receives them and publishes to the correct Kafka topic:

```
KB event fires
  │
  ▼
POST http://localhost:8900/webhook/kb
  │
  ▼
KB webhook relay:
  1. Parse event type (INVOICE_CREATION, PAYMENT_SUCCESS, etc.)
  2. Fetch full object from KB REST API (invoice with items, payment with attempts)
  3. Resolve tenant_api_key from webhook headers
  4. Publish enriched event to appropriate kb.* topic
  5. Return 200 to KB (acknowledge webhook)
```

### Flow 5: KB Invoice → Odoo Invoice

```
kb.invoice.created topic message consumed by Odoo Consumer:
  1. Resolve company_id: search res.company where x_kb_api_key matches
  2. Check idempotency: search account.move where x_kb_invoice_id = invoiceId
  3. If exists: skip, commit offset
  4. Resolve partner: search res.partner where x_kb_account_id = accountId
  5. Create account.move:
     - move_type = 'out_invoice'
     - partner_id = resolved partner
     - invoice_date = KB invoiceDate
     - x_kb_invoice_id = KB invoiceId
     - company_id = resolved company
     - Lines from KB invoice items (mapped to Odoo products by x_kb_plan_name)
  6. Post (confirm) the invoice
  7. Log to kb.sync.log
  8. Commit offset
```

### Flow 6: KB Payment → Odoo Payment

```
kb.payment.succeeded topic message consumed by Odoo Consumer:
  1. Resolve company_id from tenant_api_key
  2. Check idempotency: search account.payment where x_kb_payment_id = paymentId
  3. Parse transactionExternalKey: {METHOD}:{REFERENCE}:{NOTE}
  4. Create account.payment:
     - partner_id = lookup by x_kb_account_id
     - amount = payment amount
     - journal_id = map METHOD to journal (see mapping table)
     - ref = transactionExternalKey
     - x_kb_payment_id = KB paymentId
  5. Reconcile with matching account.move (by x_kb_invoice_id)
  6. Log to kb.sync.log
  7. Commit offset
```

### Flow 7: Subscription State → Update Partner

```
kb.subscription.changed topic message consumed by Odoo Consumer:
  1. Find partner by x_kb_account_id
  2. Update partner tags (e.g. add "SUSPENDED", remove "ACTIVE")
  3. Add chatter note with state change details
  4. Commit offset
```

### Flow 8: Overdue State → Update Partner Tags

```
kb.overdue.changed topic message consumed by Odoo Consumer:
  1. Find partner by x_kb_account_id
  2. Update partner tags based on blocking_state:
     - WARNING → add "OVERDUE-WARNING" tag
     - SUSPENDED → add "SUSPENDED" tag
     - DISCONNECTED → add "DISCONNECTED" tag
  3. Add chatter note
  4. Commit offset
```

## Payment Method → Journal Mapping

| `transactionExternalKey` prefix | Odoo Journal |
|---|---|
| `CASH` | Cash Journal |
| `BANK_TRANSFER` | Bank Journal |
| `BKASH` | bKash Journal |
| `NAGAD` | Nagad Journal |
| `ROCKET` | Rocket Journal |
| `CHEQUE` | Cheque Journal |
| `ONLINE` | Online Gateway Journal |
| `OTHER` | Cash Journal (fallback) |

## KB Webhook Registration

Still needed per tenant — this tells Kill Bill where to POST events. The relay receives them and publishes to Kafka:

```bash
curl -X POST "http://localhost:18080/1.0/kb/tenants/registerNotificationCallback" \
  -u admin:password \
  -H "X-Killbill-ApiKey: telcobright-isp" \
  -H "X-Killbill-ApiSecret: telcobright-isp-secret" \
  -H "X-Killbill-CreatedBy: admin" \
  -H "Content-Type: application/json" \
  -d '"http://localhost:8900/webhook/kb"'
```

## Idempotency

Same UUID-based idempotency keys as before — critical because Kafka consumers may process the same message more than once (at-least-once delivery):

| Sync Operation | Idempotency Key | Check |
|---|---|---|
| Partner → KB Account | `x_kb_account_id` on partner | If set, skip |
| KB Invoice → Odoo | `x_kb_invoice_id` on account.move | Search existing |
| KB Payment → Odoo | `x_kb_payment_id` on account.payment | Search existing |
| SO → KB Subscription | `x_kb_subscription_id` on SO line | If set, skip |
| Catalog Upload | SHA256 hash in kb.sync.log | Compare hash |

## Error Handling & Dead Letters

### Consumer Error Handling

1. **Transient errors** (network, 5xx from KB/Odoo): consumer retries the message with backoff
   - Backoff: 5s → 10s → 20s → 40s → 80s (exponential, max 5 retries)
   - During retry, consumer pauses the partition (doesn't block other partitions)
2. **Permanent errors** (4xx, validation failures): message sent to dead-letter topic
   - Dead-letter topics: `odoo.partner.verified.dlq`, `kb.invoice.created.dlq`, etc.
   - DLQ messages logged to `kb.sync.log` with `status=failed`
3. **Poison messages**: if a message fails all retries, it goes to DLQ and consumer moves on

### Monitoring

- Every consumed message creates a `kb.sync.log` entry in Odoo
- Status: `pending` → `success` or `failed`
- On failure: `error_message` populated, `retry_count` incremented
- Failed operations visible in Odoo UI (Kill Bill > Sync Log > filter by Failed)
- Kafka consumer lag monitored via standard Kafka tooling (`kafka-consumer-groups.sh --describe`)

## Kafka Setup (Dev)

For local development, run Kafka via Docker:

```bash
# docker-compose.kafka.yml
docker compose -f docker-compose.kafka.yml up -d
```

Or use a lightweight single-node Kafka (KRaft mode, no Zookeeper):

```bash
# Using Kafka 3.7+ with KRaft
kafka-storage.sh format -t $(kafka-storage.sh random-uuid) -c config/kraft/server.properties
kafka-server-start.sh config/kraft/server.properties
```

### Create Topics

```bash
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic odoo.partner.verified --partitions 3
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic odoo.catalog.changed --partitions 1
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic odoo.subscription.requested --partitions 3
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic odoo.payment.recorded --partitions 3
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic kb.invoice.created --partitions 3
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic kb.payment.succeeded --partitions 3
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic kb.subscription.changed --partitions 3
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic kb.overdue.changed --partitions 3
```
