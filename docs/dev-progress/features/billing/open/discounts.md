# Discounts

## What
Conditional price reductions based on customer attributes: tenure, volume, corporate agreement, seasonal, or coupon.

## Entity: Discount
| Field | Type | Description |
|-------|------|-------------|
| id | Long | PK |
| name | String | "Loyalty 10%" |
| type | Enum | LOYALTY, VOLUME, CORPORATE, COUPON, SEASONAL |
| percent | BigDecimal | Percentage off |
| flatAmount | BigDecimal | Or flat amount off |
| condition | JSON | e.g. `{"minTenureMonths": 24}` or `{"minQuantity": 5}` |
| applicableTo | String | Tenant slug (null = all tenants) |
| priority | Integer | Evaluation order when stacking |
| stackable | Boolean | Can combine with other discounts |
| validFrom | LocalDate | |
| validTo | LocalDate | |

## Discount vs Promotion
- **Discount** = conditional, based on who the customer is (loyalty, volume, corporate)
- **Promotion** = time-limited offer, based on an event (signup, referral, seasonal campaign)
- Both can be applied to a BundledPurchase. Discounts are evaluated automatically; promotions are explicitly applied.

## Examples
- Loyalty: 10% off after 24 months tenure
- Volume: 20% off when buying 5+ subscriptions (enterprise/corporate)
- Corporate: flat 1000 BDT off for partner company employees
- Seasonal: 15% off during Eid campaign (validFrom/validTo window)

## Blocked by
- BundledPackage entity
