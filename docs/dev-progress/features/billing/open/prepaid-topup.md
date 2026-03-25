# Prepaid Top-Up & Data Packs

## What
One-time purchases that credit PackageAccount balances. No recurring subscription — consumed until zero or expired.

## Examples
- "10GB Data Pack (30 days)" — credits 10GB to Data Transfer PackageAccount
- "100 Minutes Voice Pack" — credits 100 to Talktime PackageAccount
- "500 SMS Bundle" — credits 500 to SMS PackageAccount

## How it works
1. Customer selects a top-up pack (BundledPackage with type=ONE_TIME)
2. Payment collected via Kill Bill external charge or SSLCommerz
3. PackagePurchase created with expireDate = now + validity
4. PackageAccount.CREDIT(amount) called for each PackageItem
5. Service consumes balance via PackageAccount.DEBIT() calls
6. When balance=0 or expired → pack exhausted, no auto-renewal

## Entity reuse
- Uses BundledPackage with type=ONE_TIME
- Uses existing PackagePurchase + PackageAccount
- No Kill Bill subscription needed — just an external charge for payment

## Blocked by
- BundledPackage entity
