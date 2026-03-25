# UI Links & Credentials

## Application URLs

| Service | URL | Description |
|---------|-----|-------------|
| **React UI** | http://localhost:5180 | Main platform UI (redirects to Keycloak login) |
| **Keycloak Admin** | http://localhost:7104/admin/ | User/role/client management |
| **Odoo Admin** | http://localhost:7169 | Odoo backend admin panel |
| **APISIX Admin API** | http://localhost:9180 | API gateway route management |
| **Vault UI** | http://localhost:8200/ui | Secret/key management |
| **Kill Bill** | http://localhost:18080 | Billing engine (API only, no UI) |
| **Spring Boot API** | http://localhost:8180/api/odoo/health | Backend proxy health check |

## Credentials

### React UI (Platform Login)

Everyone uses the same login URL: **http://localhost:5180**

| User | Password | Role | Tenants | Behavior after login |
|------|----------|------|---------|----------------------|
| `admin` | `password` | `super_admin` | All | Tenant selector (pick any) |
| `btcl-admin` | `password` | `tenant_admin` | BTCL only | Auto-redirects to `/btcl/` |

Auth handled by Keycloak (realm: `telcobright`, client: `platform-ui`)

### Keycloak Admin Console
- **Username:** `admin`
- **Password:** `admin`
- URL: http://localhost:7104/admin/

### Odoo Admin
- **Username:** `admin`
- **Password:** `admin`
- Database: `odoo_billing`

### APISIX Admin API
- **API Key:** `telcobright-apisix-admin-key`
- Header: `X-API-KEY: telcobright-apisix-admin-key`
- Example: `curl http://localhost:9180/apisix/admin/routes -H "X-API-KEY: telcobright-apisix-admin-key"`

### Vault / OpenBao
- **Token (dev):** `dev-root-token`
- URL: http://localhost:8200/ui

### Kill Bill
- **Username:** `admin`
- **Password:** `password`
- Accessed only via Spring Boot proxy (KB basic auth injected server-side)

### Databases
| Database | Host | Port | User | Password |
|----------|------|------|------|----------|
| PostgreSQL (Odoo) | 127.0.0.1 | 5433 | mustafa | (none) |
| MySQL (Kill Bill) | 127.0.0.1 | 3306 | root | 123456 |

## Keycloak Realm: `telcobright`

### Client: `platform-ui`
- Type: Confidential
- Client Secret: `T3HRg6Jf72Botb5Tgx1Hbd61VLBGrkbf`
- Redirect URIs: `http://localhost:5180/*`, `http://localhost:9081/*`

### Roles
| Role | Purpose |
|------|---------|
| `super_admin` | Full access to all tenants, sees tenant selector |
| `tenant_admin` | Manages assigned tenant(s) only |
| `operator` | Day-to-day operations on assigned tenant(s) |
| `readonly` | View-only access on assigned tenant(s) |

### Tenant Groups
Tenant access is controlled by Keycloak groups under `/tenants/`:

| Group | Tenant |
|-------|--------|
| `/tenants/btcl` | BTCL |
| `/tenants/telcobright` | Telcobright |
| `/tenants/abc-isp` | ABC ISP |

Users are assigned to one or more tenant groups. The JWT includes a `groups` claim used by both the React UI and Spring Boot API to enforce tenant isolation. Super admins bypass group checks.

**Setup script:** `keycloak/setup-tenant-groups.sh` (creates groups, roles, and JWT mapper — idempotent)

### Users
| Username | Password | Roles | Groups |
|----------|----------|-------|--------|
| `admin` | `password` | `super_admin` | (none — access to all) |
| `btcl-admin` | `password` | `tenant_admin` | `/tenants/btcl` |

### Creating a new tenant user
1. Create user in Keycloak admin (http://localhost:7104/admin/)
2. Assign a realm role (`tenant_admin`, `operator`, or `readonly`)
3. Assign to a tenant group (`/tenants/{slug}`)
4. User logs in at the same URL — sees only their assigned tenant(s)

## Tenant URLs
After login, select a tenant. URLs are prefixed with tenant slug:
```
http://localhost:5180/btcl/infra
http://localhost:5180/telcobright/customers
http://localhost:5180/abc-isp/settings
```

### Tenant access behavior
- **Super admin:** Sees tenant selector → picks any tenant → can switch freely
- **Single-tenant user:** Auto-redirects to their tenant (selector skipped)
- **Multi-tenant user:** Sees selector with only their assigned tenants
- **URL manipulation blocked:** Navigating to an unauthorized tenant slug redirects to `/`
- **API enforcement:** Spring Boot validates JWT `groups` claim against `X-Killbill-ApiKey` — returns 403 on mismatch

## Starting All Services
```bash
cd /home/mustafa/telcobright-projects/odoo
./launch-all.sh          # Start all missing services
./launch-all.sh --status # Check status only
```

## Service Architecture
```
React (:5180) → APISIX (:9081) → Spring Boot (:8180) → Odoo (:7169) / Kill Bill (:18080)
                    ↕                    ↕                    ↕
              Keycloak (:7104)    JWT tenant filter     PostgreSQL (:5433)
              (JWT validation)    (groups → tenant)     MySQL (:3306)
```

### APISIX Dashboard
- **URL:** http://localhost:9000
- **Username:** `admin`
- **Password:** `admin`
- Shows all routes, upstreams, plugins configured in APISIX

### Monitoring
- **Grafana:** http://localhost:3100 (`admin` / `admin`)
  - Dashboard: APISIX Gateway Metrics (requests, latency, status codes, bandwidth)
- **Prometheus:** http://localhost:9095
  - Scrapes APISIX metrics from :9091/apisix/prometheus/metrics
