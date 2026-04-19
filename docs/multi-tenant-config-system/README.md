# Multi-tenant config system

This doc describes how configuration is organised across backend
(Spring Boot `api/`) and frontend (React `ui/`) for orchestrix-v2.

## Hierarchy

```
Operator         — owner of this deployment (BTCL, link3, Telcobright, …)
  └── Tenants    — clients of the operator (each picks its own profile)
        └── Profile  (dev | staging | prod)
              └── profile-<profile>.(yml|js)   ← actual config values
```

**One deployment = one operator.** The operator is a single value set in
`application.yml` / `tenants.js`. Tenants are a list under that operator.

Each tenant has **its own profile** — tenant A can run `dev` while tenant B
runs `staging` in the same JVM. There is no deployment-wide "active profile"
gating the tenant config. A tenant's config is loaded iff its `enabled` flag
is `true`.

## Backend layout

```
api/src/main/resources/
├── application.yml                  ← operator + tenant list
├── application-dev.yml              ← Spring global infra (CRM creds, …)
├── application-staging.yml
├── application-prod.yml
└── config/operators/
    └── <operator>/
        └── tenants/
            └── <tenant>/
                ├── dev/profile-dev.yml
                ├── staging/profile-staging.yml
                └── prod/profile-prod.yml
```

### `application.yml`

```yaml
orchestrix:
  operator: telcobright
  tenants:
    - {name: btcl,        enabled: true, profile: dev}
    - {name: telcobright, enabled: true, profile: dev}

spring:
  profiles:
    active: dev        # selects application-dev.yml (global infra, not tenants)
```

- `orchestrix.operator` — owner of this deployment.
- `orchestrix.tenants[]` — list of tenants to load. Each entry has
  `{name, enabled, profile}`. Disabled tenants are skipped at startup.
- `spring.profiles.active` — selects global `application-<profile>.yml`
  (CRM admin creds, DB URLs, …). Independent of tenant profiles.

### Loader

`com.telcobright.api.tenant.TenantConfigRegistry` (runs at `@PostConstruct`):

1. Requires `orchestrix.operator` to be set.
2. For each enabled entry, reads
   `config/operators/<operator>/tenants/<name>/<profile>/profile-<profile>.yml`.
3. Parses via SnakeYAML, resolves `${VAR:default}` placeholders, freezes the
   result, exposes `get(slug)` / `all()` / `isEnabled(slug)`.

### Gating

`TenantGatingFilter` is an `OncePerRequestFilter` that inspects the
`X-Tenant` request header. Unknown or disabled slug → HTTP 404. Header
absent → passes through (for shared / health endpoints).

## Frontend layout

```
ui/src/config/
├── tenants.js                       ← operator + tenant list (mirrors BE)
├── index.js                         ← loader (import.meta.glob eager)
└── operators/
    └── <operator>/
        └── tenants/
            └── <tenant>/
                ├── dev/profile-dev.js
                ├── staging/profile-staging.js
                └── prod/profile-prod.js
```

### `tenants.js`

```js
export const OPERATOR = 'telcobright';

export const TENANTS = [
  { name: 'btcl',        enabled: true, profile: 'dev' },
  { name: 'telcobright', enabled: true, profile: 'dev' },
];
```

### Profile file shape

Client-safe values only — no secrets (those live server-side in
`application-<profile>.yml`).

```js
export default {
  tenant:   { name: 'BTCL', slug: 'btcl', partnerId: 8, environment: 'development' },
  branding: { displayName: 'BTCL', shortName: 'TB', theme: 'green' },
  crm:      { enabled: true, proxyBaseUrl: '/api/crm', espoBaseUrl: 'http://localhost:7080' },
  features: { crm: true },
};
```

### Consuming

```js
import { getTenant, isTenantEnabled, config } from '@/config';

const cfg = getTenant('btcl');     // or null
config.operator                    // 'telcobright'
config.enabledSlugs                // ['btcl','telcobright']
```

The loader uses Vite's `import.meta.glob(..., { eager: true })`, so disabled
tenants are *still bundled* but never exposed. To strip a tenant entirely,
remove its directory.

## Secrets boundary

| Where | Holds | Example |
|---|---|---|
| `application.yml` / tenant YAML (BE) | DB creds, KB api-secret, Odoo passwords | `killbill.api-secret` |
| `application-<profile>.yml` (BE) | Global infra creds for that env | CRM admin password |
| `tenants.js` / `profile-*.js` (FE) | URLs, feature flags, partner IDs | `espoBaseUrl`, `partnerId` |

The FE must never hold passwords or API keys. Add-a-secret-to-the-FE-config
reviews should be rejected.

## Deploying for a different operator

1. Create `config/operators/<new-operator>/tenants/...` trees on both BE and FE.
2. Flip `orchestrix.operator` in `application.yml` and `OPERATOR` in
   `tenants.js` to `<new-operator>`.
3. Replace `tenants[]` with the operator's client list.
4. Rebuild both apps.

No code changes.

## Deviation from routesphere

Routesphere pins one tenant (or a handful) per JVM and has no operator layer
— every deployment is effectively single-operator by convention. Orchestrix
serves all tenants of one operator from a single JVM (super-admin switches
tenant at runtime via the UI) and makes the operator layer explicit in the
path, so the same codebase can serve BTCL's deployment and link3's deployment
with no structural changes.
