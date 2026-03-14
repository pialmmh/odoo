# Odoo Modules — Allowed & Banned

**Hard rule: Only Odoo Community (free/open-source) modules. No Enterprise/paid modules.**

## Allowed (Community Edition — free)

| Module | Purpose | Notes |
|---|---|---|
| `base` | Core framework | Always installed |
| `contacts` | Partner/contact management | Master customer records |
| `account` | Invoicing & Accounting | Chart of accounts, journal entries, invoices, basic reports |
| `account_payment` | Payment registration | Included with `account` |
| `sale_management` | Sales pipeline | Quotations → Sales Orders → triggers KB subscription |
| `purchase` | Purchase/vendor management | If needed for vendor bills |
| `mail` | Email integration | Invoice delivery, payment confirmations |
| `portal` | Customer portal | Clients view invoices/payments online |
| `product` | Product/service catalog | Service products mapped to KB plans |
| `l10n_bd` | Bangladesh localization | Chart of accounts, BDT, tax config |

## BANNED (Enterprise/Paid — do NOT install)

| Module | Why | Alternative |
|---|---|---|
| `sale_subscription` | Enterprise only | Kill Bill handles all subscriptions |
| `account_accountant` | Enterprise only | Community `account` + custom reports |
| `account_reports` | Enterprise only | OCA reporting modules |
| `account_followup` | Enterprise only | Custom cron + email template |
| `spreadsheet_dashboard` | Enterprise only | Custom dashboards or OCA |
| `account_bank_statement_import` | Enterprise only | Manual or custom import |
| Any `enterprise` branded module | Paid | OCA alternative or custom |

## Recommended OCA (Odoo Community Association)

Free community-maintained modules from https://github.com/OCA:

- **`OCA/account-financial-reporting`** — Aged partner balance, trial balance, general ledger, journal report
- **`OCA/account-payment`** — Extended payment features
- **`OCA/account-reconcile`** — Bank reconciliation tools
- **`OCA/partner-contact`** — Extended partner fields
- **`OCA/reporting-engine`** — QWeb/Excel report builder
