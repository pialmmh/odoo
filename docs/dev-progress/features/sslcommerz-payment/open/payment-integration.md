# SSLCommerz → KB Payment Recording

## What
When BTCL SMS portal receives SSLCommerz payment callback, also record payment in Kill Bill.

## Exists
- BTCL SMS portal has SSLCommerz integration (success/fail/cancel callbacks)
- Portal calls RTC-Manager unified purchase API
- KB invoices exist but don't get marked as paid from portal payments

## Missing
- Webhook or API bridge: portal payment callback → KB POST /invoices/{id}/payments
- Map portal transaction to KB invoice
