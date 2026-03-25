# BundledPackage Entity — Commercial Offering Model

## What
Top-level commercial entity that groups multiple service packages, one-time charges, promotions, and discounts into a single purchasable offering.

## Why
Telecom customers don't buy individual plans. They buy "BTCL Home Pro" which includes Internet + Static IP + IPTV with promotional pricing. The current model has no bundling concept.

## Entities

### BundledPackage
| Field | Type | Description |
|-------|------|-------------|
| id | Long | PK |
| name | String | "BTCL Home Pro" |
| slug | String | "btcl-home-pro" |
| description | String | Marketing description |
| type | Enum | RECURRING, ONE_TIME, HYBRID |
| status | Enum | DRAFT, ACTIVE, DEPRECATED, ARCHIVED |
| contractTermMonths | Integer | Lock-in period (0 = month-to-month) |
| earlyTerminationFee | BigDecimal | ETF if cancelled before contract end |
| tenantSlug | String | Which tenant owns this |
| validFrom | LocalDate | Available from |
| validTo | LocalDate | Stop selling (null = indefinite) |
| priority | Integer | Sort order in catalog |

### BundledPackageComponent
| Field | Type | Description |
|-------|------|-------------|
| id | Long | PK |
| bundledPackageId | Long | FK → BundledPackage |
| packageId | Long | FK → Package (RTC-Manager) |
| kbPlanName | String | Kill Bill plan to subscribe |
| required | Boolean | Must be included vs optional add-on |
| billingPeriod | Enum | MONTHLY, QUARTERLY, ANNUAL, ONE_TIME |
| freeMonths | Integer | Free period (0 = paid from start) |
| basePrice | BigDecimal | Override price (null = catalog price) |

### BundledPurchase (customer instance)
| Field | Type | Description |
|-------|------|-------------|
| id | Long | PK |
| bundledPackageId | Long | FK → BundledPackage |
| partnerId | Long | Customer (Odoo partner ID) |
| kbAccountId | String | Kill Bill account UUID |
| status | Enum | ACTIVE, PAUSED, SUSPENDED, CANCELLED |
| purchaseDate | LocalDateTime | |
| contractEndDate | LocalDateTime | purchaseDate + contractTermMonths |
| appliedPromotions | JSON | Promotion IDs applied |
| appliedDiscounts | JSON | Discount IDs applied |

## System mapping
- BundledPackage/Component/BundledPurchase → RTC-Manager (MySQL)
- Each component creates a KB subscription + PackagePurchase + PackageAccounts
- Odoo product.template gets `x_bundled_package_id` for catalog display

## Blocked by
- Nothing — can start independently
