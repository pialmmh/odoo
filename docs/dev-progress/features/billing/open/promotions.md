# Promotions

## What
Time-limited benefits applied to a BundledPackage or standalone. Covers signup bonuses, price discounts, free add-ons, OTC waivers.

## Entity: Promotion
| Field | Type | Description |
|-------|------|-------------|
| id | Long | PK |
| bundledPackageId | Long | FK (null = standalone, applicable to any) |
| name | String | "New Year 15% Off" |
| type | Enum | PRICE_DISCOUNT, BONUS_QUOTA, FREE_ADDON, WAIVE_OTC, EXTRA_VALIDITY |
| discountPercent | BigDecimal | For PRICE_DISCOUNT |
| discountFlat | BigDecimal | Flat amount off |
| bonusAccountName | String | For BONUS_QUOTA — which PackageAccount to credit |
| bonusAmount | BigDecimal | Bonus quantity |
| bonusUom | String | UOM for bonus |
| freeAddonPlanName | String | For FREE_ADDON — which KB plan |
| durationMonths | Integer | How long promo lasts (0 = one-time credit) |
| triggerEvent | Enum | SIGNUP, RENEWAL, UPGRADE, REFERRAL |
| validFrom | LocalDate | Promo availability start |
| validTo | LocalDate | Promo availability end |
| maxRedemptions | Integer | Total uses (null = unlimited) |
| currentRedemptions | Integer | Counter |
| couponCode | String | If coupon-based |
| stackable | Boolean | Can combine with other promos |

## Examples
- Signup bonus: type=BONUS_QUOTA, bonusAccountName="Data Transfer", bonusAmount=50, bonusUom="GB", triggerEvent=SIGNUP
- Price discount: type=PRICE_DISCOUNT, discountPercent=15, durationMonths=6, triggerEvent=SIGNUP
- Free add-on: type=FREE_ADDON, freeAddonPlanName="static-ip-monthly", durationMonths=12
- Coupon: type=PRICE_DISCOUNT, couponCode="NEWCUST2026", discountFlat=500, maxRedemptions=100
- Referral: type=BONUS_QUOTA, triggerEvent=REFERRAL, bonusAmount=10, bonusUom="GB"

## Blocked by
- BundledPackage entity
