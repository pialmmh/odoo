# Accounting Configuration

Per-company setup. Each Odoo company (= KB tenant) needs its own accounting config.

## Chart of Accounts (telecom-specific)

| Code | Account Name |
|------|-------------|
| `1000` | Cash |
| `1100` | Bank (main bank account) |
| `1110` | bKash Wallet |
| `1120` | Nagad Wallet |
| `1130` | Rocket Wallet |
| `1200` | Accounts Receivable |
| `2000` | Accounts Payable |
| `4000` | Revenue — SMS Services |
| `4010` | Revenue — Bandwidth Services |
| `4020` | Revenue — Other Telecom Services |

Note: `l10n_bd` (Bangladesh localization) is already installed and provides a base chart of accounts. Extend it with the telecom-specific accounts above.

## Journals (one per payment channel)

| Journal | Type | Account |
|---------|------|---------|
| Cash Journal | Cash | 1000 |
| Bank Journal | Bank | 1100 |
| bKash Journal | Bank | 1110 |
| Nagad Journal | Bank | 1120 |
| Rocket Journal | Bank | 1130 |
| Cheque Journal | Bank | 1100 |
| Online Gateway Journal (SSLCommerz) | Bank | 1100 |

## Payment Terms

- Net 7 — due 7 days after invoice
- Net 15 — due 15 days after invoice
- Net 30 — due 30 days after invoice

## Tax

- Bangladesh VAT: **15%** standard rate
- Some telecom services may be exempt — configure per product category as needed
- Tax is applied on invoice lines in Odoo, NOT in Kill Bill

## Fiscal Year

- **July 1 – June 30** (Bangladesh standard)

## Bangladesh-Specific Settings

- Country: Bangladesh (BD)
- Currency: BDT (Bangladeshi Taka) — symbol ৳
- Timezone: Asia/Dhaka (GMT+6)
- Language: English (en_US) and Bangla (bn_BD)
- Phone format: +880XXXXXXXXXX
- Fiscal localization: `l10n_bd`
