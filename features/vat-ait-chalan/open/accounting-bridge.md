# KB → Odoo Accounting Bridge (VAT/AIT)

## What
Kafka consumer for kb.invoice.created and kb.payment.success that creates Odoo journal entries with proper VAT/AIT treatment.

## Invoice Entry (kb.invoice.created)
- DR Accounts Receivable (1200) — base + VAT
- CR Revenue (4100/4200/4300) — base amount
- CR VAT Payable (2200) — 15% liability to NBR
- Tax rates MUST use product.tax.rate.get_applicable_taxes(target_date=invoice_date)

## Payment Entry (kb.payment.success)
- With AIT deduction: DR Bank (actual) + DR AIT Receivable (1300), CR Receivable
- Without AIT: DR Bank (full), CR Receivable

## Blocked by
- Event bridge (KB webhook → Kafka) must be wired first

## Files involved
- odoo-backend/custom-addons/kb_integration/models/account_move.py (x_kb_invoice_id exists)
- odoo-backend/custom-addons/kb_integration/models/account_payment.py (x_kb_payment_id exists)
- odoo-backend/custom-addons/kb_integration/models/product_tax_rate.py (get_applicable_taxes exists)
