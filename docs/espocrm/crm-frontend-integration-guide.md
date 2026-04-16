# CRM Frontend Integration Guide

Instructions for the agent building CRM pages in the orchestrix-v2 React UI.
Everything on the backend and plumbing side is already done. You only write
React pages and (optionally) extend `services/crm.js`.

---

## 1. Architecture — how your code reaches EspoCRM

```
Browser (React)
   │  Bearer <Keycloak JWT>
   ▼
APISIX gateway        /api/** → Spring Boot (port 8180)
   │
   ▼
Spring Boot           EspoProxyController  @RequestMapping("/api/crm")
   │                  Strips /api/crm prefix, prepends /api/v1,
   │                  injects X-Api-Key header, forwards 1:1
   ▼
EspoCRM               http://127.0.0.1:7170/api/v1/{entity}[/{id}]
```

You never talk to EspoCRM directly. Every call goes through `/api/crm/**`
which Spring Boot proxies. The JWT is validated by Spring Boot; EspoCRM
authenticates via API key (injected server-side, invisible to React).

---

## 2. What is already built (do not rebuild)

| Layer | File | What it does |
|-------|------|--------------|
| Java  | `api/.../controller/EspoProxyController.java` | Generic `/api/crm/**` passthrough. Active only when `CRM_ENABLED=true`. |
| Java  | `api/.../espo/EspoClient.java` | Forwards method/path/qs/body to EspoCRM, injects `X-Api-Key`. |
| Java  | `api/.../config/EspoProperties.java` | Binds `integrations.crm.{enabled,base-url,api-key}`. |
| Java  | `api/.../config/SecurityConfig.java` | `/api/crm/**` requires JWT. |
| YAML  | `api/src/main/resources/application.yml` | `integrations.crm` block with env-var overrides. |
| React | `ui/src/services/crm.js` | Axios client with JWT interceptor + Lead CRUD helpers. |
| React | `ui/src/config/platform.js` | `FEATURES.crm` flag (reads `VITE_CRM_ENABLED`). |
| React | `ui/src/config/rbac.js` | `CRM_VIEW`, `CRM_EDIT` permissions, route + menu entries. |
| React | `ui/src/layouts/Sidebar.jsx` | "CRM" menu section, visible when `FEATURES.crm` is true. |
| React | `ui/src/App.jsx` | `/:tenant/crm/*` route pointing to placeholder. |
| React | `ui/src/pages/crm/CrmPlaceholder.jsx` | Stub page you will replace. |

---

## 3. Enabling CRM locally

### 3.1 Spring Boot (backend proxy)

Set these env vars before starting Spring Boot:

```bash
export CRM_ENABLED=true
export CRM_BASE_URL=http://127.0.0.1:7170   # default, change if needed
export CRM_API_KEY=<your-espocrm-api-key>
```

To get an API key: EspoCRM Admin → Administration → API Users → create one
with full access → copy the API Key.

### 3.2 React UI (feature flag)

Create or edit `ui/.env.local`:

```
VITE_CRM_ENABLED=true
```

Restart the Vite dev server. The "CRM" section appears in the sidebar.

### 3.3 Verify

```bash
# Health check (no JWT needed for health)
curl http://localhost:8180/api/crm/health
# → {"crm_enabled":true}

# List leads (requires JWT)
curl -H "Authorization: Bearer <jwt>" http://localhost:8180/api/crm/Lead
# → EspoCRM's JSON response
```

---

## 4. How to call the API from React

### 4.1 Use `services/crm.js`

The file `ui/src/services/crm.js` provides:

```js
// Generic — works for any EspoCRM entity
import { get, post, put, del } from '../services/crm';

// List with optional params (EspoCRM query format)
const leads = await get('/Lead', { maxSize: 20, offset: 0 });

// Get single entity
const lead = await get('/Lead/some-espo-id');

// Create
const newLead = await post('/Lead', {
  firstName: 'John',
  lastName: 'Doe',
  status: 'New',
  source: 'Web',
});

// Update
await put('/Lead/some-espo-id', { status: 'Qualified' });

// Delete
await del('/Lead/some-espo-id');
```

### 4.2 Pre-built Lead helpers

```js
import { listLeads, getLead, createLead, updateLead, deleteLead } from '../services/crm';

const leads = await listLeads({ maxSize: 50 });
const lead  = await getLead('some-id');
await createLead({ firstName: 'Jane', lastName: 'Smith' });
await updateLead('some-id', { status: 'Converted' });
await deleteLead('some-id');
```

### 4.3 Adding helpers for new entities

When you need Contacts, Accounts, or Opportunities, add helpers to `services/crm.js`
following the same pattern:

```js
// Add to services/crm.js
export const listContacts  = (params)     => get('/Contact', params);
export const getContact    = (id)         => get(`/Contact/${id}`);
export const createContact = (data)       => post('/Contact', data);
export const updateContact = (id, data)   => put(`/Contact/${id}`, data);
export const deleteContact = (id)         => del(`/Contact/${id}`);
```

### 4.4 EspoCRM REST API patterns

The proxy forwards to EspoCRM's `/api/v1/...` endpoint. Key patterns:

| Operation | HTTP | Path (from React) | Body |
|-----------|------|-------------------|------|
| List      | GET  | `/Lead?maxSize=20&offset=0&orderBy=createdAt&order=desc` | — |
| Search    | GET  | `/Lead?where[0][type]=contains&where[0][attribute]=name&where[0][value]=John` | — |
| Read      | GET  | `/Lead/{id}` | — |
| Create    | POST | `/Lead` | `{ firstName, lastName, status, ... }` |
| Update    | PUT  | `/Lead/{id}` | `{ status: 'Qualified' }` |
| Delete    | DELETE | `/Lead/{id}` | — |
| Related   | GET  | `/Lead/{id}/meetings` | — |

**Response shape** (list):
```json
{
  "total": 42,
  "list": [
    { "id": "abc123", "name": "John Doe", "status": "New", ... },
    ...
  ]
}
```

**Response shape** (single):
```json
{ "id": "abc123", "name": "John Doe", "status": "New", ... }
```

---

## 5. Where to put your files

```
ui/src/
├── pages/crm/                     ← YOUR PAGES GO HERE
│   ├── CrmPlaceholder.jsx         ← replace this with a real index/router
│   ├── Leads.jsx                  ← lead list + detail
│   ├── Contacts.jsx               ← contact list + detail
│   ├── Accounts.jsx               ← account/company list
│   ├── Opportunities.jsx          ← pipeline / deals
│   └── ...
└── services/
    └── crm.js                     ← extend with new entity helpers
```

### 5.1 Routing

The route `/:tenant/crm/*` is already wired in `App.jsx`.

To add sub-routes (e.g. `/crm/leads`, `/crm/contacts`), replace the
placeholder import in `App.jsx`:

```jsx
// In App.jsx — replace:
import CrmPlaceholder from './pages/crm/CrmPlaceholder';
// With your index component that has its own Routes/Outlet:
import CrmIndex from './pages/crm/CrmIndex';
```

Or add individual routes directly:

```jsx
// In App.jsx TenantRoutes(), replace the single crm/* line with:
{FEATURES.crm && <>
  <Route path="crm" element={<CrmDashboard />} />
  <Route path="crm/leads" element={<Leads />} />
  <Route path="crm/contacts" element={<Contacts />} />
  <Route path="crm/accounts" element={<Accounts />} />
  <Route path="crm/pipeline" element={<Pipeline />} />
</>}
```

### 5.2 Sidebar sub-items

To add sub-menu items under CRM, edit `Sidebar.jsx` — the CRM block is:

```jsx
...(FEATURES.crm ? [
  { section: 'CRM' },
  { text: 'CRM', icon: <CrmIcon />, path: `${base}/crm` },
  // Add more items here, e.g.:
  // { text: 'Leads',    icon: <LeadsIcon />,    path: `${base}/crm/leads` },
  // { text: 'Pipeline', icon: <PipelineIcon />, path: `${base}/crm/pipeline` },
] : []),
```

Add corresponding `MENU_PERMISSIONS` entries in `rbac.js` for any new items.

---

## 6. UI patterns to follow

Look at existing pages for the established MUI patterns:

| Pattern | Reference file |
|---------|---------------|
| MUI table with search + pagination | `pages/Products.jsx`, `pages/Customers.jsx` |
| Tabbed edit modal (create/edit dialog) | `pages/Products.jsx` (NewProductDialog) |
| Detail page from table row click | `pages/CustomerDetail.jsx` |
| Attribute chips on table rows | `pages/RateHistory.jsx` |
| Split-pane tree + detail | `pages/infra/InfraMain.jsx` |

**Imports to use:**
- MUI components from `@mui/material`
- Icons from `@mui/icons-material`
- CRM API from `../services/crm`
- RBAC checks from `../hooks/useRBAC` (for `canAction('crm.edit')`)
- Tenant context from `../context/TenantContext` (if CRM data is tenant-scoped)

**Padding and layout**: use enough left/right padding on forms so fields aren't
full-width ugly. Keep forms vertically compact. See existing dialogs for reference.

---

## 7. RBAC

Two permissions are pre-configured:

| Permission | Used for |
|------------|----------|
| `CRM_VIEW` (crm:view) | Viewing any CRM page. Granted to: super_admin, tenant_admin, readonly. |
| `CRM_EDIT` (crm:edit) | Create/update/delete CRM entities. Granted to: super_admin, tenant_admin. |

Use them in your pages:

```jsx
import { useRBAC } from '../hooks/useRBAC';

function Leads() {
  const { can, canAction } = useRBAC();

  // Hide entire page if no CRM_VIEW
  if (!can('crm:view')) return null;

  // Conditionally show Add/Edit/Delete buttons
  const canEdit = canAction('crm.edit');
  // ...
}
```

---

## 8. Rules — do not violate

1. **No direct browser-to-EspoCRM calls.** All traffic through `services/crm.js`
   → `/api/crm/**` → Spring Boot proxy. Never `axios.get('http://localhost:7170/...')`.

2. **No EspoCRM SDK in React.** HTTP calls only through `services/crm.js`.

3. **No "EspoCRM" in user-facing text.** Menu label = "CRM". Page headings say
   "Leads", "Contacts", "Pipeline" — not "EspoCRM Leads". See `CLAUDE.md`
   naming crib sheet. This applies to labels, tooltips, error messages, column
   headers, and help text.

4. **No backend changes.** The generic proxy covers every EspoCRM entity. Do not
   add Java controllers per CRM entity. If you hit a proxy limitation, report it
   rather than working around it.

5. **No bypassing Keycloak.** Every call must carry the JWT. The interceptor in
   `services/crm.js` handles this automatically.

6. **Feature flag must gate everything.** All CRM UI (routes, menu items, page
   renders) must be behind `FEATURES.crm`. When the flag is off, zero CRM
   artifacts should appear.

7. **Follow existing MUI patterns.** Use the same table/dialog/chip components
   as `Products.jsx`, `Customers.jsx`, etc. Don't introduce new UI libraries.

---

## 9. File inventory — what exists today

```
api/
├── src/main/java/com/telcobright/api/
│   ├── config/
│   │   ├── EspoProperties.java          # integrations.crm.{enabled,base-url,api-key}
│   │   └── SecurityConfig.java           # /api/crm/** → authenticated
│   ├── espo/
│   │   └── EspoClient.java              # Forwards to EspoCRM /api/v1/...
│   └── controller/
│       └── EspoProxyController.java      # /api/crm/** passthrough + /api/crm/health
└── src/main/resources/
    └── application.yml                   # integrations.crm block

ui/src/
├── config/
│   ├── platform.js                       # FEATURES.crm (VITE_CRM_ENABLED)
│   └── rbac.js                           # CRM_VIEW, CRM_EDIT, routes, menu
├── layouts/
│   └── Sidebar.jsx                       # CRM menu section (feature-flagged)
├── services/
│   └── crm.js                            # Axios + JWT + Lead helpers
├── pages/crm/
│   └── CrmPlaceholder.jsx                # Stub — replace with real pages
└── App.jsx                               # /:tenant/crm/* route
```

---

## 10. Quick-start checklist

1. Ensure EspoCRM is running on `127.0.0.1:7170`
2. Set `CRM_ENABLED=true` + `CRM_API_KEY=...` on Spring Boot
3. Set `VITE_CRM_ENABLED=true` in `ui/.env.local`
4. Verify: `curl localhost:8180/api/crm/health` returns `{"crm_enabled":true}`
5. Start React dev server: `cd ui && npm run dev`
6. Log in, select a tenant, see "CRM" in sidebar
7. Replace `CrmPlaceholder.jsx` with your first real page (Leads is a good start)
8. Add entity helpers to `services/crm.js` as you add pages
9. Add sub-routes in `App.jsx` and sub-menu items in `Sidebar.jsx` as needed
