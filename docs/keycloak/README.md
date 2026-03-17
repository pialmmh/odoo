# Keycloak Authentication

## Server
- Binary: `/opt/keycloak/` (Keycloak 24.0.5)
- Port: 7104
- Admin console: `http://localhost:7104/admin/`
- Admin credentials: `admin` / `admin`

## Start
```bash
export KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin
/opt/keycloak/bin/kc.sh start-dev --http-port=7104 &
```

## Realm: `telcobright`

### Client: `platform-ui`
| Setting | Value |
|---------|-------|
| Client type | Public (no secret) |
| Direct access grants | Enabled |
| Standard flow | Enabled (PKCE) |
| Redirect URIs | `http://localhost:5180/*`, `http://localhost:8180/*` |
| Web origins | `http://localhost:5180`, `http://localhost:8180` |

### Roles
| Role | Purpose |
|------|---------|
| `super_admin` | Full access to all features |
| `tenant_admin` | Manages a single tenant |
| `operator` | Day-to-day operations |
| `readonly` | View-only access |

### Users
| Username | Password | Roles |
|----------|----------|-------|
| `admin` | `password` | `super_admin` |

## Auth Flow

```
1. User opens http://localhost:5180
2. keycloak-js redirects to Keycloak login page
3. User enters credentials → Keycloak validates
4. Keycloak redirects back with authorization code
5. keycloak-js exchanges code for JWT (PKCE flow)
6. React stores JWT in memory, auto-refreshes every 10s
7. All API calls include: Authorization: Bearer <JWT>
8. Spring Boot validates JWT against Keycloak's public key
```

## JWT Token Structure
```json
{
  "sub": "user-uuid",
  "preferred_username": "admin",
  "realm_access": { "roles": ["super_admin", "default-roles-telcobright"] },
  "exp": 1710700000
}
```

## React Integration

### Files
- `ui/src/services/keycloak.js` — Keycloak client (init, getToken, getUser, logout)
- `ui/src/context/AuthContext.jsx` — Dual mode: keycloak (default) or legacy

### Dual Auth Mode
- **Keycloak mode** (default): redirect login, JWT auth, auto-refresh
- **Legacy mode**: localStorage login with hardcoded credentials (fallback when KC is down)
- Toggle: click the `KC`/`Local` chip in TopBar

## Spring Boot Integration
- Dependency: `spring-boot-starter-oauth2-resource-server`
- Config: `spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:7104/realms/telcobright`
- SecurityConfig: `/api/odoo/health` is public, everything else requires valid JWT

## Token Endpoints (for testing)
```bash
# Get token
curl -s http://localhost:7104/realms/telcobright/protocol/openid-connect/token \
  -d "grant_type=password&client_id=platform-ui&username=admin&password=password"

# Validate (userinfo)
curl -s http://localhost:7104/realms/telcobright/protocol/openid-connect/userinfo \
  -H "Authorization: Bearer <token>"
```
