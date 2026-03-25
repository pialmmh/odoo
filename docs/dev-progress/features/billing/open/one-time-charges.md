# One-Time Charges (OTC)

## What
Non-recurring charges attached to a BundledPackage: installation fees, equipment deposits, activation fees.

## Entity: OneTimeCharge
| Field | Type | Description |
|-------|------|-------------|
| id | Long | PK |
| bundledPackageId | Long | FK → BundledPackage |
| name | String | "Installation Fee", "Router Deposit" |
| amount | BigDecimal | Charge amount |
| waivable | Boolean | Can be waived by sales |
| refundable | Boolean | Returned on cancellation (deposits) |
| chargeOn | Enum | SIGNUP, FIRST_INVOICE, ACTIVATION |

## How it works
- On BundledPurchase creation, OTCs are added as Kill Bill external charges
- Waivable charges can be skipped during purchase flow if sales approves
- Refundable deposits tracked — credited back on cancellation

## Kill Bill integration
- `POST /invoices/charges/{accountId}?autoCommit=true` for each OTC
- Or use KB FIXED phase in plan (internet-100mbps-otc-monthly pattern already exists)

## Blocked by
- BundledPackage entity
