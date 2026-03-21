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
- **Username:** `admin`
- **Password:** `password`
- Auth handled by Keycloak (realm: `telcobright`, client: `platform-ui`)

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
- Redirect URIs: `http://localhost:5180/*`, `http://localhost:9080/*`

### Roles
| Role | Purpose |
|------|---------|
| `super_admin` | Full access, can switch tenants |
| `tenant_admin` | Manages a single tenant |
| `operator` | Day-to-day operations |
| `readonly` | View-only access |

### Users
| Username | Password | Roles |
|----------|----------|-------|
| `admin` | `password` | `super_admin` |

## Tenant URLs
After login, select a tenant. URLs are prefixed with tenant slug:
```
http://localhost:5180/btcl/infra
http://localhost:5180/telcobright/customers
http://localhost:5180/abc-isp/settings
```

## Starting All Services
```bash
cd /home/mustafa/telcobright-projects/odoo
./launch-all.sh          # Start all missing services
./launch-all.sh --status # Check status only
```

## Service Architecture
```
React (:5180) → APISIX (:9080) → Spring Boot (:8180) → Odoo (:7169) / Kill Bill (:18080)
                    ↕                                         ↕
              Keycloak (:7104)                          PostgreSQL (:5433)
              (JWT validation)                          MySQL (:3306)
```

### APISIX Dashboard
- **URL:** http://localhost:9000
- **Username:** `admin`
- **Password:** `admin`
- Shows all routes, upstreams, plugins configured in APISIX
