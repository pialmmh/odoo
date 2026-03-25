# Config Architecture: YAML for Infra, DB for Everything Else

## Problem

Current tenant YAML files mix two concerns:
1. **Platform infra** — where is MySQL, Kafka, Keycloak, APISIX (varies per deployment/server)
2. **Tenant business config** — KB credentials, branding, product mapping, tax rates, overdue policy (varies per tenant, managed by admins)

Infra config is static per server. Tenant config changes at runtime (admin adds a tenant, changes branding, adjusts tax rates). Storing tenant config in YAML means redeploying to change anything.

## Proposal

### YAML keeps ONLY platform/infra per deployment

One file per server/deployment: `config/platform.yml`

```yaml
# Platform infrastructure — what's running on this server
# This file is the ONLY YAML config. Everything else comes from DB.

platform:
  environment: dev    # dev | staging | prod

  # ── Database ──
  mysql:
    host: 127.0.0.1
    port: 3306
    username: root
    password: 123456

  postgresql:
    host: 127.0.0.1
    port: 5433
    username: odoo
    password: odoo
    database: odoo_billing

  # ── Message Broker ──
  kafka:
    bootstrap-servers: 127.0.0.1:9092

  # ── Cache (future) ──
  redis:
    host: 127.0.0.1
    port: 6379

  # ── Identity Provider ──
  keycloak:
    url: http://localhost:7104
    realm: telcobright
    admin-username: admin
    admin-password: admin
    client-id: platform-api
    client-secret: tde2klJ3vsgG5wYprw8IHHP9xo7df8V9

  # ── API Gateway ──
  apisix:
    url: http://localhost:9081
    admin-url: http://localhost:9180
    admin-key: telcobright-apisix-admin-key

  # ── Backend Services ──
  odoo:
    url: http://127.0.0.1:7169
    db: odoo_billing
    username: admin
    password: admin

  killbill:
    url: http://127.0.0.1:18080
    username: admin
    password: password

  # ── Secrets (future: Vault/OpenBao) ──
  vault:
    url: http://localhost:8200
    token: dev-root-token
```

### DB stores ALL tenant config (Odoo models)

Everything else moves to Odoo as structured models. Admins manage it via the UI — no file edits, no redeploys.

#### Odoo model: `platform.tenant.config` (new)

| Field | Type | Description |
|-------|------|-------------|
| partner_id | Many2one → res.partner | Which tenant (company partner) |
| slug | Char | URL slug (btcl, telcobright) |
| is_active | Boolean | Enabled/disabled |
| environment | Selection | dev/staging/prod |

#### Odoo model: `platform.tenant.billing` (new)

| Field | Type | Description |
|-------|------|-------------|
| tenant_config_id | Many2one → platform.tenant.config | |
| kb_api_key | Char | Kill Bill API key |
| kb_api_secret | Char | Kill Bill API secret |
| currency | Char | BDT, USD |
| timezone | Char | Asia/Dhaka |
| locale | Char | en_BD |

#### Odoo model: `platform.tenant.branding` (new)

| Field | Type | Description |
|-------|------|-------------|
| tenant_config_id | Many2one → platform.tenant.config | |
| login_title | Char | "BTCL Service Portal" |
| login_subtitle | Char | "Bangladesh Telecommunications..." |
| app_name | Char | "BTCL Portal" |
| app_short_name | Char | "BTCL" |
| theme | Selection | green/blue/red/gray/orange/light-* |
| logo | Binary | Logo image |

#### Odoo model: `platform.tenant.overdue` (new)

| Field | Type | Description |
|-------|------|-------------|
| tenant_config_id | Many2one → platform.tenant.config | |
| warning_days | Integer | 7 |
| suspend_days | Integer | 14 |
| disconnect_days | Integer | 30 |

#### Existing Odoo models already in DB
- `product.tax.rate` — VAT/AIT rates (already in Odoo)
- `product.template` / `product.product` — product catalog with KB mapping (already in Odoo)
- `rbac.role`, `rbac.permission`, `rbac.url.pattern` — RBAC (already in Odoo)

### API endpoints (Spring Boot)

```
# Platform infra (from YAML — read-only)
GET /api/config/platform          → infra config (ports, hosts)

# Tenant config (from Odoo DB — CRUD via Odoo XML-RPC)
GET /api/config/tenants           → list active tenants with billing/branding
GET /api/config/tenant/{slug}     → full tenant config (billing + branding + overdue)
```

Spring Boot reads platform YAML on startup for infra. For tenant config, it proxies to Odoo (same as OdooProxyController, but typed).

### What moves where

| Config | Currently | Moves to |
|--------|-----------|----------|
| MySQL host/port/creds | YAML per tenant (duplicated) | YAML once per deployment |
| Kafka bootstrap servers | YAML per tenant (duplicated) | YAML once per deployment |
| Keycloak URL/realm/secret | YAML per tenant (duplicated) | YAML once per deployment |
| APISIX URL/admin key | YAML per tenant (duplicated) | YAML once per deployment |
| Odoo URL/creds | YAML per tenant (duplicated) | YAML once per deployment |
| KB URL/creds (admin) | YAML per tenant (duplicated) | YAML once per deployment |
| KB API key/secret (per-tenant) | YAML + hardcoded in platform.js | Odoo DB: platform.tenant.billing |
| Branding (title, theme) | YAML + hardcoded in platform.js | Odoo DB: platform.tenant.branding |
| Tax rates | Already in Odoo | Stays in Odoo |
| Overdue policy | YAML per tenant | Odoo DB: platform.tenant.overdue |
| Product mapping | Not yet built | Odoo DB (new model) |
| Kafka topics | YAML per tenant (identical) | Convention-based (no config needed) |

### What happens to existing per-tenant YAMLs

Delete them. The `config/tenants/` directory and all per-tenant YAML files go away. Replaced by:
- One `config/platform.yml` per deployment
- Everything else in Odoo DB, managed via UI

### Migration path
1. Create Odoo models (platform.tenant.config, billing, branding, overdue)
2. Write migration script: read existing YAMLs → insert into Odoo
3. Build API endpoints
4. Update React to fetch from API instead of platform.js
5. Delete per-tenant YAMLs and hardcoded platform.js config
6. Delete config-loader-api.md and move-kb-creds-to-yaml.md (superseded by this)

## Blocked by
- Nothing — can start immediately
