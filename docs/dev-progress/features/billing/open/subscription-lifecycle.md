# Subscription Lifecycle & Contract Management

## What
End-to-end lifecycle of a BundledPurchase: purchase → activate → renew/upgrade/downgrade → pause → suspend → cancel. Includes contract enforcement and upgrade paths.

## Lifecycle States
```
DRAFT → ACTIVE → PAUSED → ACTIVE (resume)
                → SUSPENDED (overdue) → ACTIVE (payment)
                → CANCELLED
                → UPGRADED (migrated to new BundledPackage)
```

## Contract enforcement
- contractTermMonths on BundledPackage defines lock-in
- Early cancellation before contractEndDate charges earlyTerminationFee
- UI shows remaining contract period and ETF amount
- Contract auto-converts to month-to-month after term ends

## Upgrade/Downgrade
- BundledPackage.upgradePaths[] defines allowed migrations
- Upgrade: create new BundledPurchase, cancel old components, prorate
- Downgrade: same flow but with lower-tier package
- Kill Bill handles proration via plan change

## Renewal
- Auto-renewal via Kill Bill recurring billing
- PackagePurchase.autoRenewalStatus controls per-component
- Non-renewal: subscription continues until end of current period then stops

## One-time (non-recurring) subscriptions
- type=ONE_TIME: no KB subscription created
- PackagePurchase created with fixed expireDate
- Used for: prepaid data packs, temporary boosts, event-based access
- Balance in PackageAccount consumed until zero or expiry

## Blocked by
- BundledPackage entity, Promotions, Discounts
