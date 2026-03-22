# Billing Architecture Notes (2026-03-23)

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

### Product Types for ISPs

| Product | PackageAccount entries |
|---------|----------------------|
| Internet 100Mbps | bandwidth:100 MBPS, data_transfer:unlimited GB |
| Internet + Static IP | above + static_ip:1 IP |
| SIP Trunk (N channels) | sip_channels:N CH |
| Voice Bundle (N min) | voice_balance:N MIN |
| SMS Bundle (N) | sms_balance:N SMS |
| Combo packages | Multiple account entries |

### Offers / Discounts / Bonuses

All must result in proper PackagePurchase + PackageAccount entries:

- **Discount**: Reduce invoice amount in Kill Bill (price override or credit). PackageAccount entries stay full (customer gets full service).
- **Bonus**: Extra PackageAccount entries (e.g. buy 100Mbps, get 500 SMS free). Creates additional PackageAccount with bonus balance and appropriate UOM.
- **Promotional pricing**: KB catalog price list override (time-limited). Reverts to standard price after promo period.
- **Credit/voucher**: KB account credit applied to next invoice.

### Strict Accounting Requirements

Every payment/invoice MUST generate Odoo accounting entries:

1. **Invoice created** (KB event) → Odoo `account.move` (type=out_invoice):
   - Debit: Accounts Receivable
   - Credit: Revenue account (per product category)
   - Tax lines: VAT (15%), AIT (10%) as applicable

2. **Payment received** (KB event) → Odoo `account.move` (type=entry):
   - Debit: Bank/Cash/Mobile Money account
   - Credit: Accounts Receivable
   - Reference: KB payment ID + transactionExternalKey

3. **Credit/discount** → Odoo `account.move` (type=out_refund or journal entry):
   - Proper contra-revenue or discount account

4. **Overdue → service suspended** → No accounting entry, but status tracked

### Implementation Order

1. ~~Infra management module~~ ✅
2. ~~SSH key management~~ ✅
3. ~~RBAC UI~~ ✅
4. **KB catalog update** (add OTC phase for internet plans) — in progress
5. **Admin purchase UI** (buy subscription on behalf of partner) — next
6. **KB → Odoo accounting bridge** (webhook consumer for invoice/payment events)
7. **KB → RTC-Manager bridge** (webhook consumer for subscription events → PackageAccount)
8. **Offers/discounts system** (KB price overrides + bonus PackageAccount entries)
9. **SSLCommerz integration** (payment gateway for online purchases)

### RTC-Manager Entity Model Reference

```
Package (name, basePrice, vat%, ait%, validity, activeStatus)
  └── PackageItem[] (quantity, uom, category, prefix, description)

PackagePurchase (partner, package, dates, status, paid, autoRenew, price, vat, ait, priority)
  └── PackageAccount[] (name, lastAmount, balanceBefore, balanceAfter, uom, isSelected, creditLimit)

EnumServiceCategory (id, type) — category codes for PackageItem
UOM — unit of measure (MBPS, GB, CH, MIN, SMS, IP, etc.)
```

### Tenant Mapping

| System | Entity | BTCL |
|--------|--------|------|
| Odoo | res.partner ID | 8 |
| Odoo | res.company (KB config) | 1 (telcobright-isp) |
| Kill Bill | tenant API key | telcobright-isp |
| Kill Bill | account | to be created |
| RTC-Manager | Partner | separate DB per tenant profile |
| Platform UI | slug | btcl |
