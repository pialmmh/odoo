# NBR Chalan Dispatch

## What
New Odoo model + UI for dispatching accumulated VAT/AIT to NBR (tax authority).

## VAT Chalan
- DR VAT Payable (2200), CR Bank (1014) — clears liability
- Track: chalan number, NBR reference, period, amount

## AIT Settlement (annual)
- DR Income Tax Expense (5100), CR AIT Receivable (1300), CR Bank (remainder)

## New Odoo model: chalan.dispatch
- date, amount, tax_type (vat/ait/income_tax), chalan_number
- nbr_reference, period_from, period_to
- journal_entry_id (link to account.move)
- status (draft/submitted/acknowledged)
- notes, attachments (scanned receipt)

## UI needed
- Chalan management page: see accumulated balances, record dispatch, history

## Blocked by
- Accounting bridge must be working first (so VAT/AIT liabilities accumulate)
