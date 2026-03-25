# Billing Architecture Notes

Last updated: 2026-03-25

## Key Decisions

### Pricing Authority
- **Kill Bill** is the billing authority — whatever price is in the KB catalog is what gets invoiced
- **Odoo** is the catalog of record for display, audit, tax rules, and accounting entries
- **RTC-Manager** is the service delivery system — it enforces entitlements via PackageAccount balances

### Purchase Flow
```
Portal/Admin UI purchase
  → Kill Bill: createSubscription → generates invoice
  → RTC-Manager: /package/purchase-package → creates PackageAccount entries
  → Payment (SSLCommerz/manual) → KB records payment
  → KB payment event → Odoo: create accounting journal entry (account.move)
```

---

## Product Types for ISPs

| Product | PackageAccount entries |
|---------|----------------------|
| Internet 100Mbps | bandwidth:100 MBPS, data_transfer:unlimited GB |
| Internet + Static IP | above + static_ip:1 IP |
| Hosted PBX Bronze | extensions:10 EXT, call_channels:5 CH, ivr_configs:2 IVR, talktime:500 MIN |
| Hosted PBX Silver | extensions:30 EXT, call_channels:7 CH, ivr_configs:5 IVR, talktime:1000 MIN |
| Hosted PBX Gold | extensions:100 EXT, call_channels:15 CH, ivr_configs:10 IVR, talktime:3000 MIN |
| Voice Broadcast Basic | vbs_messages:20000 MSG |
| Voice Broadcast Standard | vbs_messages:50000 MSG |
| Voice Broadcast Enterprise | vbs_messages:unlimited MSG |
| Contact Center | agents:N AGENT, call_channels:N CH (quantity-based) |
| SIP Trunk (N channels) | sip_channels:N CH |
| Voice Bundle (N min) | voice_balance:N MIN |
| SMS Bundle (N) | sms_balance:N SMS |

---

## Offers / Discounts / Bonuses

All must result in proper PackagePurchase + PackageAccount entries:

- **Discount**: Reduce invoice amount in Kill Bill (price override or credit). PackageAccount entries stay full (customer gets full service).
- **Bonus**: Extra PackageAccount entries (e.g. buy 100Mbps, get 500 SMS free). Creates additional PackageAccount with bonus balance and appropriate UOM.
- **Promotional pricing**: KB catalog price list override (time-limited). Reverts to standard price after promo period.
- **Credit/voucher**: KB account credit applied to next invoice.

---

## Pricing with Effective Dates

Odoo is the **pricing authority of record**. KB executes the billing.

### Rate History (product.rate.history)

Tracks price changes with effective dates and auto-closes previous rates:

```
product.rate.history:
  #1: price=1000, effective=2025-06-01, end=2025-12-31, tier=standard, reason="Launch price"
  #2: price=1200, effective=2026-01-01, end=NULL,       tier=standard, reason="Annual revision"
```

- `get_rate_at_date(product, date, tier)` — returns applicable rate for a specific date
- `record_rate_change()` — auto-closes previous rate (end_date = new_effective - 1 day)
- Tiers: standard, enterprise, government, wholesale, custom
- When Odoo product price changes → `kb.sync.log` entry queued → catalog XML regenerated and uploaded to KB

### Tax Rates (product.tax.rate)

Tax rates also have effective dates and gazette references:

```
product.tax.rate:
  VAT: rate=15.0%, effective=2024-07-01, gazette="SRO 190/2024", tax_type=vat
  AIT: rate=10.0%, effective=2024-07-01, gazette="SRO 191/2024", tax_type=ait, is_deduction=true
```

**Critical:** Tax computation MUST use `get_applicable_taxes(target_date=invoice_date)`, NOT today's date. This ensures rate changes are applied correctly when KB generates an invoice.

---

## Strict Accounting Requirements

### VAT and AIT Treatment (Bangladesh / NBR)

**VAT (Value Added Tax):**
- Added ON TOP of base price — customer pays base + VAT
- Company collects VAT and holds in **VAT Payable (2200)** — this is a LIABILITY to NBR
- Company dispatches to NBR periodically via **Chalan**

**AIT (Advance Income Tax):**
- **Deducted at source by the payer (customer)**
- Customer pays less cash, provides AIT certificate
- Company records the deduction as **AIT Receivable / Tax Credit (1300)** — asset
- Used as credit against company's annual income tax liability

### Journal Entries

#### 1. Invoice Created (kb.invoice.created → Odoo)

Internet 100Mbps, base price 1,200 BDT:

```
account.move (type=out_invoice)
  x_kb_invoice_id: "inv-uuid-001"
  partner_id: XYZ Corp
  invoice_date: 2026-03-24

  DR  1,200.00  Accounts Receivable (1200)
  CR  1,200.00  Revenue: Internet Services (4100)

  Tax lines (from product.tax.rate at invoice_date):
  DR    180.00  Accounts Receivable (1200)    ← VAT added to bill
  CR    180.00  VAT Payable (2200)            ← LIABILITY to NBR

  Total Receivable from customer: 1,380.00 BDT (base 1,200 + VAT 180)
```

Note: AIT is NOT on the invoice. It is deducted at payment time.

#### 2a. Payment Received — Full (no AIT deduction)

```
account.move (type=entry)
  x_kb_payment_id: "pay-uuid-001"

  DR  1,380.00  Bank / bKash / Cash (1014/1015/1010)
  CR  1,380.00  Accounts Receivable (1200)
```

#### 2b. Payment Received — With AIT Deduction at Source

Customer deducts 10% AIT on base amount (120 BDT), pays 1,260 BDT:

```
account.move (type=entry)
  x_kb_payment_id: "pay-uuid-001"

  DR  1,260.00  Bank (actual cash received)
  DR    120.00  AIT Receivable / Tax Credit (1300)   ← company claims from govt
  CR  1,380.00  Accounts Receivable (1200)
```

Company receives AIT certificate from customer for 120 BDT.

#### 3. OTC / One-Time Connection Fee

```
account.move (type=out_invoice)
  x_kb_invoice_id: "inv-uuid-002"

  DR  5,000.00  Accounts Receivable (1200)
  CR  5,000.00  Revenue: Connection Fee (4200)

  DR    750.00  Accounts Receivable (1200)    ← 15% VAT
  CR    750.00  VAT Payable (2200)

  Total: 5,750.00 BDT
```

#### 4. Credit / Discount / Refund

```
account.move (type=out_refund)
  DR  amount    Revenue account (contra)
  CR  amount    Accounts Receivable
  Tax reversal lines as applicable
```

#### 5. Overdue → Service Suspended

No accounting entry. Status tracked in KB (subscription BLOCKED) and RTC-Manager (PackageAccount deactivated).

---

## NBR Chalan — Dispatching VAT/AIT to Tax Authority

VAT Payable (2200) and AIT Receivable (1300) accumulate over time. Company must periodically settle with NBR.

### VAT Chalan (company pays accumulated VAT to NBR)

```
account.move (type=entry)
  ref: "Chalan #12345, NBR VAT dispatch March 2026"

  DR  accumulated_vat  VAT Payable (2200)       ← clear the liability
  CR  accumulated_vat  Bank (1014)               ← actual payment to NBR
```

After this entry, VAT Payable balance resets to zero (or remaining balance if partial).

### AIT Settlement (annual income tax return)

AIT Receivable (1300) is used as tax credit against company's income tax:

```
account.move (type=entry)
  ref: "Annual IT Return FY 2025-26, AIT credit offset"

  DR  tax_due          Income Tax Expense (5100)
  CR  ait_credit       AIT Receivable (1300)         ← offset against tax due
  CR  remaining_tax    Bank (1014)                    ← pay remainder if tax > AIT credits
```

### Chalan Tracking (new Odoo model needed: chalan.dispatch)

Fields:
- date, amount, tax_type (vat/ait/income_tax), chalan_number
- nbr_reference, period_from, period_to
- journal_entry_id (link to account.move)
- status (draft/submitted/acknowledged)
- notes, attachments (scanned chalan receipt)

---

## Account Code Reference

| Code | Account Name | Type | Purpose |
|------|-------------|------|---------|
| 1010 | Cash | Asset | Cash payments |
| 1014 | Bank | Asset | Bank transfers |
| 1015 | Mobile Money (bKash/Nagad) | Asset | Mobile payments |
| 1200 | Accounts Receivable | Asset | Customer owes |
| 1300 | AIT Receivable / Tax Credit | Asset | AIT deducted at source, claimable |
| 2200 | VAT Payable | Liability | Collected VAT, owed to NBR |
| 2201 | AIT Payable / Withholding | Liability | (if company withholds on payments to vendors) |
| 4000 | Revenue (General) | Revenue | |
| 4100 | Revenue: Internet Services | Revenue | Bandwidth subscriptions |
| 4200 | Revenue: Connection Fees | Revenue | OTC / setup charges |
| 4300 | Revenue: Voice Services | Revenue | PBX, VBS, CC |
| 4400 | Revenue: SMS Services | Revenue | Bulk SMS |
| 5100 | Income Tax Expense | Expense | Annual IT liability |

---

## Tenant Mapping

| System | Entity | BTCL | Telcobright | ABC ISP |
|--------|--------|------|-------------|---------|
| Odoo | res.partner ID | 8 | 1 | 7 |
| Kill Bill | tenant API key | btcl | telcobright | abc-isp |
| Kill Bill | tenant API secret | btcl-secret | telcobright-secret | abc-isp-secret |
| Kill Bill | catalog | ISP catalog (uploaded) | Not uploaded | Not uploaded |
| RTC-Manager | Partner DB | Separate per tenant | Separate per tenant | Separate per tenant |
| Platform UI | slug | btcl | telcobright | abc-isp |
| Config | path | config/tenants/btcl/ | config/tenants/telcobright/ | config/tenants/abc-isp/ |

---

## RTC-Manager Entity Model Reference

```
Package (name, basePrice, vat%, ait%, validity, activeStatus)
  └── PackageItem[] (quantity, uom, category, prefix, description)

PackagePurchase (partner, package, dates, status, paid, autoRenew, price, vat, ait, priority)
  └── PackageAccount[] (name, lastAmount, balanceBefore, balanceAfter, uom, isSelected)

PackageAccountReserve (channelCallUuid, packageAccountId, name, reserveUnit, uom, time)
  — Tracks reserved amounts during active calls/sessions

PackageAccountDelta (operation: DEBIT/CREDIT/RESERVE/RELEASE/SET, amountChange, description)
  — Delta operations applied to PackageAccount

EnumServiceCategory (id, type) — category codes for PackageItem
UOM — unit of measure (MBPS, GB, CH, MIN, SMS, IP, EXT, IVR, MSG, AGENT, SEAT, etc.)
```

---

## Monthly Renewal & Overdue Lifecycle

```
Day 0:   Subscription created → Invoice #1 → PackageAccount provisioned
Day 30:  KB auto-generates Invoice #2 (RECURRING) → Odoo account.move
         PackagePurchase.expireDate extended
Day +7:  Unpaid → kb.overdue.state(WARNING) → notification to customer
Day +14: Unpaid → kb.overdue.state(SUSPENDED) → PUT /bundles/{id}/pause
         PackageAccount deactivated, no new invoices while BLOCKED
Day +30: Unpaid → DELETE /subscriptions → CANCELLED
         PackageAccount removed, final settlement invoice
```

---

## Implementation Status

| # | Component | Status |
|---|-----------|--------|
| 1 | Odoo product.template + KB mapping fields | Done |
| 2 | Odoo product.rate.history (effective date pricing) | Done |
| 3 | Odoo product.tax.rate (VAT/AIT, effective dates, gazette refs) | Done |
| 4 | Odoo account.move + x_kb_invoice_id field | Done (field only) |
| 5 | Odoo account.payment + x_kb_payment_id field | Done (field only) |
| 6 | KB catalog with ISP plans | Done (BTCL tenant) |
| 7 | KB subscription create/pause/resume | Done and tested |
| 8 | KB recurring invoice generation | Done and tested (daily test) |
| 9 | KB tenants created (btcl, telcobright, abc-isp) | Done |
| 10 | Kafka topics (11 topics) | Done |
| 11 | Per-tenant config YAML (dev/staging/prod) | Done (structure only) |
| 12 | RBAC management UI | Done |
| 13 | Purchase subscription UI | Done |
| 14 | KB webhook → Kafka event bridge | **Missing** |
| 15 | Kafka → Odoo accounting bridge (invoice/payment journal entries) | **Missing** |
| 16 | Kafka → RTC-Manager PackageAccount provisioning | **Missing** |
| 17 | Product mapping config (plan → PackageItem[]) | **Missing** |
| 18 | Tiered PBX/VBS/CC plans in KB catalog | **Missing** |
| 19 | NBR Chalan dispatch (clear VAT/AIT liabilities) | **Missing** |
| 20 | Overdue → suspension automation | **Missing** |
| 21 | Config loader API (serve tenant YAML to services) | **Missing** |
| 22 | SSLCommerz → KB payment recording | **Missing** |
