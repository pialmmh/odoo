# Kafka → RTC-Manager PackageAccount Provisioning

## What
Consume kb.subscription.created/cancelled/changed → call RTC-Manager to create/deactivate PackagePurchase + PackageAccount entries.

## Exists
- RTC-Manager entities: PackagePurchase, PackageAccount, PackageItem, PackageAccountReserve (routesphere-core)
- API: POST /package/purchase-package
- Kafka topics exist

## Missing
- Kafka consumer service
- Plan → PackageItem[] mapping (from tenant config)
- Integration tested end-to-end

## PackageAccount entries for Internet 100Mbps
- {name: Bandwidth, balance: 100, uom: MBPS}
- {name: Data Transfer, balance: unlimited, uom: GB}

## Blocked by
- Event bridge (#5) and product mapping config (#7)
