# Spring Boot API Gateway

## Overview
Single entry point for the React frontend. Proxies all backend calls, validates JWT tokens, holds service credentials.

## Server
- Location: `api/`
- Port: 8180
- Framework: Spring Boot 3.4.3, Java 21
- Build: `cd api && mvn clean package -DskipTests`
- Run: `java -jar api/target/platform-api-1.0-SNAPSHOT.jar`
- Config: `api/src/main/resources/application.yml`

## Endpoints

### Odoo Proxy (generic — no per-model wrappers needed)
```
POST /api/odoo/{model}/{method}
Body: { "args": [...], "kwargs": {...} }
Auth: Bearer JWT

Examples:
  POST /api/odoo/infra.region/search_read
  POST /api/odoo/infra.ssh.key/action_generate_key
  POST /api/odoo/artifact.deployment/action_deploy
```

Adding a new Odoo model requires **zero Java changes** — the proxy is fully generic.

### Kill Bill Proxy (pass-through)
```
{GET|POST|PUT|DELETE} /api/kb/{path}
Auth: Bearer JWT
KB auth injected server-side from application.yml
```

### Health (public, no auth)
```
GET /api/odoo/health
Response: { "odoo_connected": true, "odoo_uid": 2 }
```

## Security
- JWT validation via `spring-boot-starter-oauth2-resource-server`
- Issuer: `http://localhost:7104/realms/telcobright` (Keycloak)
- `/api/odoo/health` is public, all other endpoints require valid JWT
- CORS: allows `http://localhost:5180` and `http://localhost:8180`

## Key Classes
| Class | Purpose |
|-------|---------|
| `OdooClient` | XML-RPC client, authenticates once, caches uid |
| `OdooProxyController` | Generic `/{model}/{method}` proxy |
| `KillBillProxyController` | Pass-through `/**` proxy |
| `SecurityConfig` | JWT validation, CORS, public endpoints |
| `OdooProperties` | Odoo connection config |
| `KillBillProperties` | Kill Bill connection config |

## Service Credentials
Stored in `application.yml` (Spring Boot only — never in frontend):
```yaml
odoo:
  url: http://127.0.0.1:7169
  db: odoo_billing
  username: admin
  password: admin

killbill:
  url: http://127.0.0.1:18080
  username: admin
  password: password
```

## Vite Proxy
React dev server proxies to Spring Boot:
```js
// ui/vite.config.js
proxy: {
  '/api': { target: 'http://127.0.0.1:8180' }
}
```
