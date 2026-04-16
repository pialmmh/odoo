# Backend Proxy Routing — Keycloak → Spring Boot → {Odoo, EspoCRM}

How the UI talks to backend business systems. One pattern, reused for every
backend we integrate (Odoo today, EspoCRM next, others later).

## The pattern

```
 Browser (React)
      │  Bearer <Keycloak JWT>
      ▼
 APISIX gateway        (/api/** → Spring Boot)
      │
      ▼
 Spring Boot API       (JWT validated here)
      │
      ├─ /api/odoo/{model}/{method}    → Odoo XML-RPC (object endpoint)
      └─ /api/crm/{resource}/**        → EspoCRM REST  (/api/v1/...)
```

### Why a proxy at all

1. **Auth in one place.** Keycloak issues a JWT. Spring Boot is the only thing
   that validates it. Odoo/EspoCRM never see the JWT — Spring Boot translates
   to whatever each backend understands (Odoo admin creds, EspoCRM API key).
2. **One CORS/network surface.** Browser only ever talks to `/api/**` on the
   gateway. Backends can stay on internal ports with no CORS config.
3. **Swap backends without UI rewrites.** If EspoCRM is replaced later, only
   the Spring Boot proxy changes; React keeps calling `/api/crm/...`.
4. **Hide the tech stack from users.** Matches the UI rule in project
   `CLAUDE.md` — no leaking of "Odoo"/"EspoCRM" into user-visible URLs would
   be ideal, but the `/api/odoo` / `/api/crm` prefixes are internal-only
   (only appear in devtools, never in UI text).

## Reference implementation — Odoo (existing)

Use this as the template for every new backend.

### 1. Spring Boot generic proxy

`api/src/main/java/com/telcobright/api/controller/OdooProxyController.java`

```java
@RestController
@RequestMapping("/api/odoo")
public class OdooProxyController {
    @PostMapping("/{model}/{method}")
    public ResponseEntity<?> proxy(
        @PathVariable String model,
        @PathVariable String method,
        @RequestBody Map<String,Object> body
    ) {
        Object[] args = toArray(body.get("args"));
        Map<String,Object> kwargs = (Map) body.get("kwargs");
        return ResponseEntity.ok(odoo.call(model, method, args, kwargs));
    }
}
```

One endpoint covers every Odoo model/method. No per-model controllers.

### 2. Security

`api/src/main/java/com/telcobright/api/config/SecurityConfig.java`

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/odoo/health").permitAll()
    .requestMatchers("/api/**").authenticated())
.oauth2ResourceServer(o -> o.jwt(j -> {}));
```

JWT is validated against the Keycloak realm's public key (issuer URI set
via `spring.security.oauth2.resourceserver.jwt.issuer-uri`).

### 3. React client

`ui/src/services/odoo.js`

```js
const api = axios.create({ baseURL: '/api/odoo' });
api.interceptors.request.use(async cfg => {
  cfg.headers.Authorization = `Bearer ${getToken()}`; // Keycloak token
  return cfg;
});
export const call = (model, method, args=[], kwargs={}) =>
  api.post(`/${model}/${method}`, { args, kwargs }).then(r => r.data);
```

---

## New backend — EspoCRM (to implement)

EspoCRM runs locally and exposes a plain REST API at
`http://127.0.0.1:<espo_port>/api/v1/...`. We mirror the Odoo pattern
verbatim.

### 1. Spring Boot proxy

Create `api/src/main/java/com/telcobright/api/controller/EspoProxyController.java`:

```java
@RestController
@RequestMapping("/api/crm")
public class EspoProxyController {

    private final EspoClient espo; // wraps WebClient / RestTemplate

    @RequestMapping(value="/**",
        method={RequestMethod.GET, RequestMethod.POST,
                RequestMethod.PUT,  RequestMethod.DELETE, RequestMethod.PATCH})
    public ResponseEntity<?> proxy(HttpServletRequest req,
                                   @RequestBody(required=false) String body) {
        String path = req.getRequestURI().replaceFirst("^/api/crm", "");
        String qs   = req.getQueryString();
        return espo.forward(req.getMethod(), path, qs, body);
    }
}
```

`EspoClient` holds the EspoCRM base URL + API key from config and forwards
the request 1:1. No per-entity controllers — same philosophy as Odoo.

### 2. Config

`api/src/main/resources/application.yml`:

```yaml
integrations:
  crm:
    enabled: ${CRM_ENABLED:false}
    base-url: http://127.0.0.1:7170    # local EspoCRM
    api-key:  ${ESPOCRM_API_KEY:}
```

`EspoProxyController` should return `404` when `integrations.crm.enabled=false`
so a disabled CRM doesn't leak endpoints.

### 3. Security

Add to `SecurityConfig`:

```java
.requestMatchers("/api/crm/**").authenticated()
```

EspoCRM itself is **not** exposed through APISIX directly — only via
`/api/crm/**`. Bind EspoCRM to `127.0.0.1` only.

### 4. React client

`ui/src/services/crm.js`:

```js
import axios from 'axios';
import { getToken } from './keycloak';

const api = axios.create({ baseURL: '/api/crm' });
api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${getToken()}`;
  return cfg;
});

export const listLeads    = ()     => api.get('/Lead').then(r => r.data);
export const getLead      = id     => api.get(`/Lead/${id}`).then(r => r.data);
export const createLead   = data   => api.post('/Lead', data).then(r => r.data);
export const updateLead   = (id,d) => api.put(`/Lead/${id}`, d).then(r => r.data);
```

### 5. UI gating (config-driven)

The "CRM" section under the main menu must be **hidden when disabled**.

`ui/src/config/platform.js`:

```js
export const FEATURES = {
  crm: import.meta.env.VITE_CRM_ENABLED === 'true',
};
```

`ui/src/config/rbac.js` — add `CRM_VIEW` permission, a `/crm` route, and
a menu entry guarded by `FEATURES.crm`.

`ui/src/layouts/Sidebar.jsx` — only render the CRM menu item when
`FEATURES.crm && hasPermission('CRM_VIEW')`.

### 6. APISIX

No new APISIX route needed. `/api/crm/**` is already covered by the
existing `/api/**` → Spring Boot route.

---

## Checklist for adding a new backend integration

1. Spring Boot: one `@RestController` at `/api/<slug>/**` — generic passthrough.
2. Spring Boot: config block `integrations.<slug>.{enabled,base-url,credentials}`.
3. Spring Boot: `SecurityConfig` requires JWT for `/api/<slug>/**`.
4. Backend service bound to `127.0.0.1` only — never exposed via APISIX.
5. React: one `services/<slug>.js` with a shared `axios` + JWT interceptor.
6. React: feature flag in `config/platform.js`; menu entry gated by it.
7. Never import backend-specific SDKs into React. All calls go through
   `/api/<slug>/**`.

## Non-negotiables

- **No direct browser → backend calls.** Everything goes through Spring Boot.
- **JWT validated once** (Spring Boot). Downstream backends use their own
  service credentials, set in Spring Boot config.
- **No tech names in UI text.** Menu label is "CRM", not "EspoCRM". See
  project `CLAUDE.md` naming crib sheet.
- **Feature flag off by default.** New integrations ship disabled; an
  operator flips the flag per environment.
