# Multi-Tenancy Design

## Approach

**Odoo Multi-Company (single database)** maps to **Kill Bill row-level tenant isolation**.

Each KB tenant = one Odoo `res.company`.

Why single DB:
- Kill Bill already provides hard tenant isolation at the billing layer
- Odoo's role is accounting/GL — logical company separation is sufficient
- Finance team needs consolidated cross-tenant reporting
- One DB to maintain, backup, and upgrade

## Tenant Mapping — Custom Fields on `res.company`

The `kb_integration` module adds these fields:

| Field | Type | Purpose |
|---|---|---|
| `x_kb_api_key` | Char | KB tenant API key — used in `X-Killbill-ApiKey` header |
| `x_kb_api_secret` | Char | KB tenant API secret — used in `X-Killbill-ApiSecret` header |
| `x_kb_tenant_id` | Char | KB tenant UUID (set after tenant creation in KB) |

## Tenant Resolution

**Odoo → KB**: Partner verified in company X → sync service reads `x_kb_api_key` and `x_kb_api_secret` from that company → uses them as KB API headers.

**KB → Odoo**: Webhook arrives with `X-Killbill-ApiKey: telcobright-isp` → sync service searches `res.company` where `x_kb_api_key = 'telcobright-isp'` → finds `company_id` → creates records in that company.

## Per-Company Scoping (isolated per tenant)

| Record | Notes |
|---|---|
| `res.partner` | Each tenant has its own customers |
| `account.move` (invoices) | Each tenant has its own GL |
| `account.payment` | Scoped to tenant's journals |
| `account.journal` | Each tenant gets own bKash/Bank/Cash journals |
| `account.account` (chart of accounts) | Separate chart per tenant |
| `account.tax` | Separate tax config |
| `sale.order` | Sales scoped to tenant |
| `kb.sync.log` | Sync logs scoped per tenant |

## Shared Across Companies (global)

| Record | Why |
|---|---|
| `product.template` / `product.product` | Same catalog for all tenants |
| `product.attribute` | Shared attributes |
| Users (super admin) | Admin sees all; tenant users see only theirs |

## Concrete Tenant Mapping

| KB Tenant (apiKey) | KB apiSecret | Odoo Company |
|---|---|---|
| `telcobright-isp` | `telcobright-isp-secret` | Telcobright ISP (default company, id=1) |
| (future tenants) | (per tenant) | (one `res.company` each) |

## Setup Steps

1. **Rename default company** (id=1) to "Telcobright ISP"
2. Set `x_kb_api_key = 'telcobright-isp'`, `x_kb_api_secret = 'telcobright-isp-secret'`
3. For each new KB tenant: create `res.company` with KB credentials
4. Each new company needs: chart of accounts, journals, tax, payment terms
5. Create tenant admin users with `company_ids = [their_company]` only
6. Super admin keeps access to all companies

## Flow Example

```
KB tenant "telcobright-isp"  ──maps to──►  Odoo company "Telcobright ISP" (id=1)
KB tenant "btcl-sms"         ──maps to──►  Odoo company "BTCL SMS" (id=2)

Webhook arrives with apiKey="btcl-sms"
  → sync service: search res.company where x_kb_api_key="btcl-sms"
  → finds company_id=2
  → creates account.move with company_id=2
  → uses company 2's journals, chart of accounts, tax config
```

Odoo's default `ir.rule` records already enforce company-level isolation on `account.move`, `account.payment`, `res.partner`, etc. — no custom access rules needed.
