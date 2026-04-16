# EspoCRM Integration — Our Side Prep

Companion to `backend-proxy-routing.md`. That doc defines the *pattern*
(Keycloak → Spring Boot → {Odoo, EspoCRM}). This doc lists **exactly what we
must build/change on the orchestrix-v2 side** so the other agent's EspoCRM
frontend work drops in cleanly.

Assume: EspoCRM is already installed locally and another agent owns the
CRM UI work inside *this* React project (`ui/`). They will call
`/api/crm/**` and expect our backend to forward to EspoCRM.

## Deliverables on our side

### 1. Spring Boot — EspoCRM generic proxy

**New files:**

- `api/src/main/java/com/telcobright/api/controller/EspoProxyController.java`
- `api/src/main/java/com/telcobright/api/espo/EspoClient.java`
- `api/src/main/java/com/telcobright/api/config/EspoProperties.java`

**Shape (mirrors `OdooProxyController`):**

```java
@RestController
@RequestMapping("/api/crm")
@ConditionalOnProperty(name = "integrations.crm.enabled", havingValue = "true")
public class EspoProxyController {

    @RequestMapping(
        value = "/**",
        method = {GET, POST, PUT, DELETE, PATCH}
    )
    public ResponseEntity<?> proxy(HttpServletRequest req,
                                   @RequestBody(required=false) String body) {
        String path = req.getRequestURI().replaceFirst("^/api/crm", "");
        String qs   = req.getQueryString();
        return espo.forward(req.getMethod(), path, qs, body, req.getHeader("Accept"));
    }
}
```

**`EspoClient`** — thin `WebClient`/`RestTemplate` wrapper:
- Base URL from `integrations.crm.base-url`
- Injects `X-Api-Key: <integrations.crm.api-key>` on every request
- Forwards method + path + query string + body 1:1
- Returns the raw response body + status code

No per-entity methods (same as `OdooClient.call`).

### 2. Spring Boot — config

Append to `api/src/main/resources/application.yml`:

```yaml
integrations:
  crm:
    enabled:  ${CRM_ENABLED:false}
    base-url: ${CRM_BASE_URL:http://127.0.0.1:7170}
    api-key:  ${CRM_API_KEY:}
```

`@ConfigurationProperties("integrations.crm")` on `EspoProperties`.

### 3. Spring Boot — security

`api/src/main/java/com/telcobright/api/config/SecurityConfig.java` —
add **one line** under the existing `authorizeHttpRequests` block:

```java
.requestMatchers("/api/crm/**").authenticated()
```

No permitAll entries. EspoCRM proxy is JWT-only.

### 4. Networking

- EspoCRM must bind to `127.0.0.1` only — never exposed through APISIX.
- No new APISIX route. `/api/crm/**` is already covered by the existing
  `/api/**` → Spring Boot route in `apisix/setup-routes.sh`.
- Verify: `curl http://127.0.0.1:7170/api/v1/App/user` from the Spring Boot
  host should work; from another host it should not.

### 5. UI — service client

**New file:** `ui/src/services/crm.js`

```js
import axios from 'axios';
import { getToken } from './keycloak';

const api = axios.create({ baseURL: '/api/crm' });
api.interceptors.request.use(async cfg => {
  cfg.headers.Authorization = `Bearer ${getToken()}`;
  return cfg;
});

// Generic passthrough — mirrors services/odoo.js call()
export const get    = (path, params)     => api.get(path, { params }).then(r => r.data);
export const post   = (path, data)       => api.post(path, data).then(r => r.data);
export const put    = (path, data)       => api.put(path, data).then(r => r.data);
export const del    = (path)             => api.delete(path).then(r => r.data);

// Named helpers the other agent can build on
export const listLeads   = (params)      => get('/Lead', params);
export const createLead  = (data)        => post('/Lead', data);
export const updateLead  = (id, data)    => put(`/Lead/${id}`, data);
```

The other agent extends this for Contacts/Accounts/Opportunities as needed.

### 6. UI — feature flag

`ui/src/config/platform.js` — add:

```js
export const FEATURES = {
  ...existing,
  crm: import.meta.env.VITE_CRM_ENABLED === 'true',
};
```

`ui/.env.local` (dev) — set `VITE_CRM_ENABLED=true` to expose the menu.
Ship **off by default**.

### 7. UI — RBAC + menu + route

`ui/src/config/rbac.js`:

```js
// PERMISSIONS
CRM_VIEW:   'crm:view',
CRM_EDIT:   'crm:edit',

// ROLE_PERMISSIONS — grant to admin / sales roles as appropriate

// ROUTE_PERMISSIONS
'/crm':         [PERMISSIONS.CRM_VIEW],
'/crm/leads':   [PERMISSIONS.CRM_VIEW],
// ...

// MENU_PERMISSIONS
'crm':          [PERMISSIONS.CRM_VIEW],
```

`ui/src/layouts/Sidebar.jsx` — add menu section "CRM" guarded by
`FEATURES.crm && hasPermission(PERMISSIONS.CRM_VIEW)`. Label is literally
**"CRM"**, not "EspoCRM".

`ui/src/App.jsx` — add `/crm/*` routes. Page files live under
`ui/src/pages/crm/` (owned by the other agent).

`ui/src/layouts/MainLayout.jsx` — add `/crm` to tenant-aware paths
(`TENANT_REQUIRED_PATHS`) if CRM data is tenant-scoped, otherwise leave out.
**Decision point — confirm with other agent.**

## Handoff checklist (our side done when)

- [ ] `/api/crm/health` returns 200 when `CRM_ENABLED=true` (add this endpoint)
- [ ] `POST /api/crm/Lead` with a JWT forwards to EspoCRM and returns EspoCRM's response
- [ ] `POST /api/crm/Lead` without a JWT returns 401
- [ ] With `CRM_ENABLED=false`, `/api/crm/**` returns 404
- [ ] `ui/src/services/crm.js` exists and compiles
- [ ] `FEATURES.crm` flag toggles the sidebar entry
- [ ] RBAC entries for `CRM_VIEW`/`CRM_EDIT` are in place
- [ ] `/crm` route exists (may render a placeholder — other agent owns pages)

After this is green, the other agent only writes files under
`ui/src/pages/crm/` and wires them through `services/crm.js`. No Spring Boot
changes should be required from them.

## What the other agent should NOT do

- Do not add backend endpoints per CRM entity. The generic proxy covers it.
- Do not import an EspoCRM SDK in React. HTTP only via `services/crm.js`.
- Do not use "EspoCRM" in any user-facing text. Menu = "CRM". See
  `CLAUDE.md` naming crib sheet.
- Do not bypass Keycloak. Every call carries the JWT; Spring Boot validates.

## Open questions to lock before coding

1. **EspoCRM local port** — `integrations.crm.base-url` default. Currently
   placeholder `7170`. Confirm.
2. **API key source** — env var for dev, Vault/OpenBao path for prod?
3. **Tenant scoping** — is CRM single-tenant (one EspoCRM for the platform)
   or per-tenant? Affects whether we namespace by tenant in the proxy or in
   EspoCRM itself.
4. **First UI slice** — Leads only? Leads + Pipeline kanban? Needed to size
   the other agent's work, not ours.
