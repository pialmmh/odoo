# Subscription Entity Diagram — Internet 100Mbps Example

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│   ODOO  (Source of Truth — catalog, tax, accounting)                   :5433 PG     │
│                                                                                     │
│   ┌──────────────────────┐       ┌─────────────────────────────┐                    │
│   │  product.template     │       │  product.product (variant)  │                    │
│   │──────────────────────│       │─────────────────────────────│                    │
│   │  id: 5               │  1:N  │  id: 12                     │                    │
│   │  name: Internet      │◄──────│  product_tmpl_id: → 5       │                    │
│   │    100Mbps           │       │  x_kb_plan_name:            │                    │
│   │  x_kb_product_name:  │       │    internet-100mbps-monthly │                    │
│   │    Internet-100Mbps  │       │  x_kb_billing_period:       │                    │
│   │  x_kb_category: BASE │       │    MONTHLY                  │                    │
│   │  list_price: 1200    │       │  x_package_items: [JSON]    │◄── NEW FIELD       │
│   │  categ_id: → Internet│       │    defines what to provision │    What            │
│   │                      │       │    in RTC-Manager            │    PackageAccounts  │
│   └──────────┬───────────┘       └──────────────────────────┬──┘    to create       │
│              │                                              │                        │
│              │ 1:N                                          │                        │
│              ▼                                              │                        │
│   ┌──────────────────────┐                                  │                        │
│   │  product.rate.history │   Price changes with            │                        │
│   │──────────────────────│   effective dates                │                        │
│   │  product_tmpl_id: →5 │   ensures correct price         │                        │
│   │  price: 1200.00      │   at any point in time          │                        │
│   │  effective_date:     │                                  │                        │
│   │    2026-01-01        │                                  │                        │
│   │  end_date: NULL      │                                  │                        │
│   │  pricelist_tier:     │                                  │                        │
│   │    standard          │                                  │                        │
│   └──────────────────────┘                                  │                        │
│                                                             │                        │
│   ┌──────────────────────┐   Applicable to                  │                        │
│   │  product.tax.rate     │   product category or           │                        │
│   │──────────────────────│   specific product               │                        │
│   │  tax_type: vat       │   Uses effective_date to         │                        │
│   │  rate: 15.0%         │   apply correct rate at          │                        │
│   │  effective: 2024-07  │   invoice time, NOT today        │                        │
│   │  gazette: SRO-190    │                                  │                        │
│   │──────────────────────│                                  │                        │
│   │  tax_type: ait       │   AIT deducted at source         │                        │
│   │  rate: 10.0%         │   by payer — company gets        │                        │
│   │  effective: 2024-07  │   less cash + tax certificate    │                        │
│   │  is_deduction: true  │                                  │                        │
│   └──────────────────────┘                                  │                        │
│                                                             │                        │
│   ┌──────────────────────┐       ┌─────────────────────────┐│                        │
│   │  account.move         │       │  account.payment        ││                        │
│   │  (Journal Entry)      │       │──────────────────────── ││                        │
│   │──────────────────────│       │  x_kb_payment_id: uuid  ││                        │
│   │  x_kb_invoice_id:    │       │  amount: 1380           ││                        │
│   │    inv-uuid           │       │  partner_id: → XYZ Corp ││                        │
│   │  partner_id: →15     │       │  payment_method: bKash  ││                        │
│   │  invoice_date:       │       └─────────────────────────┘│                        │
│   │    2026-03-26        │                                   │                        │
│   │                      │   Created by accounting bridge    │                        │
│   │  Lines:              │   when KB invoice/payment events  │                        │
│   │  DR 1200 Receivable  │   arrive via Kafka                │                        │
│   │  CR 1200 Revenue     │                                   │                        │
│   │  DR  180 Receivable  │                                   │                        │
│   │  CR  180 VAT Payable │◄── Liability to NBR              │                        │
│   └──────────────────────┘    cleared via chalan.dispatch    │                        │
│                                                              │                        │
│   ┌──────────────────────┐                                   │                        │
│   │  res.partner          │   Each company partner           │                        │
│   │──────────────────────│   = a tenant in the platform     │                        │
│   │  id: 8 (BTCL)       │   x_external_key links to        │                        │
│   │  is_company: true    │   KB account + RTC partner       │                        │
│   │  x_external_key:    │                                   │                        │
│   │    BTCL-001          │                                   │                        │
│   │  x_kb_account_id:   │                                   │                        │
│   │    kb-acct-uuid      │                                   │                        │
│   └──────────┬───────────┘                                   │                        │
│              │                                               │                        │
└──────────────┼───────────────────────────────────────────────┘                        │
               │ x_external_key                                                         │
               │ is the cross-system                                                    │
               │ join key                                                               │
               │                                                                        │
               │                                                                        │
┌──────────────┼────────────────────────────────────────────────────────────────────────┐
│              │                                                                        │
│   KILL BILL  │ (Billing Engine — price, invoice, payment, dunning)    :18080 MySQL    │
│              │                                                                        │
│   ┌──────────┼──────────────────────────────────────────────────────────────────┐     │
│   │          ▼                                                                  │     │
│   │  ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────────┐  │     │
│   │  │  Tenant           │    │  Catalog (XML)     │    │  Account             │  │     │
│   │  │──────────────────│    │───────────────────│    │──────────────────────│  │     │
│   │  │  apiKey: btcl     │    │  Products:         │    │  name: XYZ Corp      │  │     │
│   │  │  apiSecret: ***   │    │   Internet-100Mbps │    │  externalKey:        │  │     │
│   │  │  externalKey:     │    │                    │    │    XYZ-001 ──────────┼──┼──┐  │
│   │  │    btcl           │    │  Plans:            │    │  currency: BDT       │  │  │  │
│   │  │                   │    │   ├ internet-      │    │  email, phone...     │  │  │  │
│   │  │  One per Odoo     │    │   │ 100mbps-monthly│    │                      │  │  │  │
│   │  │  company partner  │    │   │ (1200 BDT/mo)  │    │  One per customer    │  │  │  │
│   │  │                   │    │   │                │    │  partner in Odoo     │  │  │  │
│   │  └──────────────────┘    │   └ internet-      │    └──────────┬───────────┘  │  │  │
│   │                          │     100mbps-otc-   │               │              │  │  │
│   │                          │     monthly        │               │ 1:N          │  │  │
│   │                          │     (5000 OTC +    │               ▼              │  │  │
│   │                          │      1200 BDT/mo)  │    ┌──────────────────────┐  │  │  │
│   │                          │                    │    │  Bundle               │  │  │  │
│   │  KB only knows price,    │  KB does NOT know  │    │──────────────────────│  │  │  │
│   │  period, and when to     │  about bandwidth,  │    │  Auto-created per    │  │  │  │
│   │  generate invoices.      │  data caps, or     │    │  subscription group  │  │  │  │
│   │  No custom entities      │  tax rates.        │    │  Pause/resume is     │  │  │  │
│   │  needed.                 │  That's Odoo's     │    │  at bundle level     │  │  │  │
│   │                          │  job.              │    └──────────┬───────────┘  │  │  │
│   │                          └───────────────────┘               │              │  │  │
│   │                                                              │ 1:N          │  │  │
│   │                                                              ▼              │  │  │
│   │                                                   ┌──────────────────────┐  │  │  │
│   │                                                   │  Subscription         │  │  │  │
│   │                                                   │──────────────────────│  │  │  │
│   │                                                   │  planName: internet- │  │  │  │
│   │                                                   │   100mbps-monthly    │  │  │  │
│   │                                                   │  productName:        │  │  │  │
│   │                                                   │   Internet-100Mbps   │  │  │  │
│   │                                                   │  state: ACTIVE       │  │  │  │
│   │                                                   │  startDate:          │  │  │  │
│   │                                                   │   2026-03-26         │  │  │  │
│   │                                                   │  billingPeriod:      │  │  │  │
│   │                                                   │   MONTHLY            │  │  │  │
│   │                                                   └──────────┬───────────┘  │  │  │
│   │                                                              │              │  │  │
│   └──────────────────────────────────────────────────────────────┼──────────────┘  │  │
│                                                                  │                 │  │
│   KB generates automatically:                                    │                 │  │
│                                                                  │ 1:N             │  │
│   ┌──────────────────────┐       ┌──────────────────────┐        ▼                 │  │
│   │  Invoice              │       │  Payment             │  ┌──────────────────┐   │  │
│   │──────────────────────│       │──────────────────────│  │  Invoice Item     │   │  │
│   │  invoiceId: uuid     │  1:N  │  paymentId: uuid     │  │──────────────────│   │  │
│   │  accountId: → acct   │◄──────│  accountId: → acct   │  │  type: RECURRING │   │  │
│   │  invoiceDate:        │       │  amount: 1380        │  │   or FIXED (OTC) │   │  │
│   │    2026-03-26        │       │  currency: BDT       │  │  planName: →plan  │   │  │
│   │  amount: 1200        │       │  status: SUCCESS     │  │  amount: 1200    │   │  │
│   │  balance: 1200       │       │                      │  │  startDate, end  │   │  │
│   │  currency: BDT       │       │  Recorded when       │  └──────────────────┘   │  │
│   │                      │       │  customer pays       │                          │  │
│   │  Base price only!    │       │  (manual or gateway) │                          │  │
│   │  VAT computed by     │       │                      │                          │  │
│   │  Odoo at accounting  │       └──────────────────────┘                          │  │
│   │  time, not by KB     │                                                         │  │
│   └──────────────────────┘                                                         │  │
│                                                                                    │  │
│   KB fires push notification webhooks:                                             │  │
│     SUBSCRIPTION_CREATION ──→ event bridge ──→ Kafka: kb.subscription.created      │  │
│     INVOICE_CREATION ─────→ event bridge ──→ Kafka: kb.invoice.created             │  │
│     PAYMENT_SUCCESS ──────→ event bridge ──→ Kafka: kb.payment.success             │  │
│     BLOCKING_STATE ───────→ event bridge ──→ Kafka: kb.overdue.state               │  │
│                                                                                    │  │
└────────────────────────────────────────────────────────────────────────────────────┘  │
                                                                                       │
                                                                                       │
                                                                                       │
┌──────────────────────────────────────────────────────────────────────────────────────┐│
│                                                                                      ││
│   EVENT BRIDGE  (Spring Boot, in api/ module)           :8180                        ││
│                                                                                      ││
│   No persistent entities — stateless translation layer                               ││
│                                                                                      ││
│   ┌────────────────────────────────────────────────────────────────────────────────┐ ││
│   │  Receives KB webhook                                                           │ ││
│   │    ↓                                                                           │ ││
│   │  Enriches from Odoo:                                                           │ ││
│   │    product.product → x_package_items (what to provision)                       │ ││
│   │    product.tax.rate → VAT/AIT rates at invoice date                            │ ││
│   │    res.partner → partner details from externalKey                              │ ││
│   │    ↓                                                                           │ ││
│   │  Publishes enriched message to Kafka topic                                     │ ││
│   │    ↓                                                                           │ ││
│   │  Downstream consumers read from Kafka                                          │ ││
│   └────────────────────────────────────────────────────────────────────────────────┘ ││
│                                                                                      ││
│       ┌─────────────┐                                                                ││
│       │    Kafka     │  :9092                                                        ││
│       │─────────────│                                                                ││
│       │  Topics:     │                                                                ││
│       │  kb.subscription.created ───→ RTC-Manager consumer                           ││
│       │  kb.subscription.cancelled ─→ RTC-Manager consumer                           ││
│       │  kb.invoice.created ────────→ Odoo accounting consumer                       ││
│       │  kb.payment.success ────────→ Odoo accounting consumer                       ││
│       │  kb.overdue.state ──────────→ Suspension automation                          ││
│       │  rtc.package.provisioned ──→ Confirmation/audit                              ││
│       └─────────────┘                                                                ││
│                                                                                      ││
└──────────────────────────────────────────────────────────────────────────────────────┘│
                                                                                       │
         externalKey ─────────────────────────────────────────────────────────────────┘
         "XYZ-001" links
         KB Account → Odoo partner → RTC partner


┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│   RTC-MANAGER  (Service Delivery — entitlements & balances)     :8080 MySQL          │
│                                                                                      │
│   ┌──────────────────────┐                                                           │
│   │  partner              │   Same partner ID space as Odoo                          │
│   │──────────────────────│   (synced via externalKey)                                │
│   │  idPartner: 15       │                                                           │
│   │  partnerName: XYZ    │                                                           │
│   │  telephone, email    │                                                           │
│   └──────────┬───────────┘                                                           │
│              │                                                                       │
│              │ 1:N                                                                   │
│              ▼                                                                       │
│   ┌──────────────────────┐       ┌──────────────────────┐                            │
│   │  Package              │  1:N  │  PackageItem          │                            │
│   │──────────────────────│◄──────│──────────────────────│  Template: what a           │
│   │  id: 10              │       │  quantity: 100        │  package includes.          │
│   │  name: Internet-     │       │  uom: MBPS           │  Derived from Odoo's        │
│   │    100Mbps-Monthly   │       │  category: 1         │  product.product             │
│   │  basePrice: 1200     │       │  description:        │  .x_package_items            │
│   │  vatPercent: 15.00   │       │    Bandwidth          │                              │
│   │  aitPercent: 10.00   │       │──────────────────────│                              │
│   │  validity: 2592000   │       │  quantity: 999999999  │                              │
│   │    (30 days in sec)  │       │  uom: GB             │                              │
│   │  activeStatus: true  │       │  category: 2         │                              │
│   │                      │       │  description:        │                              │
│   │                      │       │    Data Transfer      │                              │
│   └──────────┬───────────┘       └──────────────────────┘                              │
│              │                                                                         │
│              │ 1:N                                                                     │
│              ▼                                                                         │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│   │  PackagePurchase                                                                 │ │
│   │──────────────────────────────────────────────────────────────────────────────────│ │
│   │  id: 501                                                                         │ │
│   │  idPartner: → 15 (XYZ Corp)        One purchase per subscription.                │ │
│   │  idPackage: → 10                    Created by Kafka consumer when                │ │
│   │  purchaseDate: 2026-03-26           kb.subscription.created event arrives.        │ │
│   │  expireDate:   2026-04-26                                                        │ │
│   │  status: ACTIVE                     ACTIVE → SUSPENDED → CANCELLED               │ │
│   │  paid: 0                                                                         │ │
│   │  autoRenewalStatus: true            On renewal: expireDate pushed forward         │ │
│   │  price:    1200.00                  Base price (same as KB plan)                  │ │
│   │  vat:       180.00                  15% of base (from Odoo tax rate)              │ │
│   │  ait:       120.00                  10% of base (deducted at source)              │ │
│   │  priority: 1                        Selection priority among packages             │ │
│   │  discount: 0                                                                     │ │
│   │                                                                                  │ │
│   │  ┌─────────────────────────────────────────────────────────────────────────────┐ │ │
│   │  │                         PackageAccount[]                                    │ │ │
│   │  │                                                                             │ │ │
│   │  │  ┌───────────────────────────────┐  ┌───────────────────────────────┐       │ │ │
│   │  │  │  PackageAccount #1            │  │  PackageAccount #2            │       │ │ │
│   │  │  │───────────────────────────────│  │───────────────────────────────│       │ │ │
│   │  │  │  id: 1001                     │  │  id: 1002                     │       │ │ │
│   │  │  │  idPackagePurchase: → 501     │  │  idPackagePurchase: → 501     │       │ │ │
│   │  │  │  name: Bandwidth              │  │  name: Data Transfer          │       │ │ │
│   │  │  │  lastAmount: 0               │  │  lastAmount: 0               │       │ │ │
│   │  │  │  balanceBefore: 0            │  │  balanceBefore: 0            │       │ │ │
│   │  │  │  balanceAfter: 100           │  │  balanceAfter: 999999999     │       │ │ │
│   │  │  │  uom: MBPS                   │  │  uom: GB                     │       │ │ │
│   │  │  │                               │  │                               │       │ │ │
│   │  │  │  This is the entitlement.     │  │  999999999 = unlimited.       │       │ │ │
│   │  │  │  Customer gets 100 Mbps       │  │  No data cap.                │       │ │ │
│   │  │  │  bandwidth.                   │  │                               │       │ │ │
│   │  │  └───────────────────────────────┘  └───────────────────────────────┘       │ │ │
│   │  │                                                                             │ │ │
│   │  └─────────────────────────────────────────────────────────────────────────────┘ │ │
│   └──────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                       │
│   On active call/session:                                                             │
│                                                                                       │
│   ┌──────────────────────────────┐     ┌──────────────────────────────┐               │
│   │  PackageAccountReserve       │     │  PackageAccountDelta         │               │
│   │──────────────────────────────│     │──────────────────────────────│               │
│   │  channelCallUuid: call-123   │     │  operation: DEBIT | CREDIT  │               │
│   │  idPackageAccount: → 1001    │     │            | RESERVE         │               │
│   │  name: Bandwidth             │     │            | RELEASE | SET   │               │
│   │  reserveUnit: 100            │     │  amountChange: -1.5         │               │
│   │  uom: MBPS                   │     │  description: "Call usage"  │               │
│   │                              │     │  sessionId: call-123         │               │
│   │  Tracks reserved balance     │     │                              │               │
│   │  during active sessions.     │     │  Applied to PackageAccount   │               │
│   │  Released when session ends. │     │  to update balances.         │               │
│   └──────────────────────────────┘     └──────────────────────────────┘               │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
 CROSS-SYSTEM JOIN KEYS
═══════════════════════════════════════════════════════════════════════════════════════════

  externalKey: "XYZ-001"
    Odoo res.partner.x_external_key ←──→ KB Account.externalKey ←──→ RTC partner

  planName: "internet-100mbps-monthly"
    Odoo product.product.x_kb_plan_name ←──→ KB Subscription.planName
    Event bridge uses this to look up x_package_items from Odoo

  x_kb_invoice_id / x_kb_payment_id:
    Odoo account.move ←──→ KB Invoice / Payment (UUID)

  idPartner:
    RTC partner.idPartner ←──→ Odoo res.partner.id (or resolved via externalKey)


═══════════════════════════════════════════════════════════════════════════════════════════
 PURCHASE FLOW: TWO OPTIONS
═══════════════════════════════════════════════════════════════════════════════════════════

  OPTION A: Recurring Only                    OPTION B: OTC + Recurring
  Plan: internet-100mbps-monthly              Plan: internet-100mbps-otc-monthly
  ─────────────────────────────               ──────────────────────────────────
  UI → KB createSubscription                  UI → KB createSubscription
     ↓                                           ↓
  KB Invoice: 1,200 BDT (RECURRING)           KB Invoice #1: 5,000 BDT (FIXED/OTC)
     ↓                                        KB Invoice #2: 1,200 BDT (RECURRING)
  Event bridge enriches from Odoo:               ↓
    x_package_items → [bandwidth, data]       Same enrichment + provisioning
    tax rates → VAT 15%, AIT 10%              OTC invoice → Revenue: Connection Fee
     ↓                                        Monthly invoice → Revenue: Internet
  Kafka → RTC: create PackagePurchase
    + PackageAccount[bandwidth, data]         Same PackageAccounts either way
     ↓                                        (OTC is a billing concern, not
  Kafka → Odoo: create account.move            a service delivery concern)
    1,200 + 180 VAT = 1,380 receivable


═══════════════════════════════════════════════════════════════════════════════════════════
 WHAT customer.x_package_items LOOKS LIKE (on Odoo product.product)
═══════════════════════════════════════════════════════════════════════════════════════════

  product.product (variant for internet-100mbps-monthly):
  x_package_items = [
    {
      "name": "Bandwidth",              ← PackageAccount.name
      "quantity": 100,                   ← PackageAccount.balanceAfter
      "uom": "MBPS",                    ← PackageAccount.uom
      "category": 1                     ← PackageItem.category (bandwidth)
    },
    {
      "name": "Data Transfer",
      "quantity": 999999999,             ← unlimited
      "uom": "GB",
      "category": 2                     ← (data transfer)
    }
  ]

  This single JSON field on the Odoo product variant carries everything
  the event bridge needs to provision the correct PackageAccounts in
  RTC-Manager. No custom KB entity. No separate mapping table.
```
