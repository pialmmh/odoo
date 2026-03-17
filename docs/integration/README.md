# Integration Guide

## Service Dependencies

```
React UI
  └── requires: Spring Boot API (8180)
      └── requires: Odoo (7169)
      └── optional: Kill Bill (18080) — billing features only
      └── optional: Keycloak (7104) — falls back to legacy auth

Odoo
  └── requires: PostgreSQL (5433)
  └── optional: Vault (8200) — for SSH key storage

Kill Bill
  └── requires: MySQL (3306)
```

## Auth Flow (end-to-end)

```
React                    Keycloak              Spring Boot           Odoo
  │                         │                      │                  │
  ├── redirect login ──────>│                      │                  │
  │                         ├── validate creds     │                  │
  │<── JWT token ───────────┤                      │                  │
  │                         │                      │                  │
  ├── POST /api/odoo/model/method ────────────────>│                  │
  │   (Authorization: Bearer JWT)                  │                  │
  │                         │                      ├── validate JWT   │
  │                         │                      │   (KC public key)│
  │                         │                      │                  │
  │                         │                      ├── XML-RPC ──────>│
  │                         │                      │   (admin/admin)  │
  │                         │                      │<── result ───────┤
  │<── JSON response ─────────────────────────────┤                  │
```

## Data Model Relationships

### Odoo → Kill Bill
| Odoo Model | Kill Bill Entity | Sync Direction |
|-----------|------------------|----------------|
| `res.partner` | KB Account | Odoo → KB (on verification) |
| `product.template` | KB Catalog Plan | Odoo → KB (XML upload) |
| `account.move` | KB Invoice | KB → Odoo |
| `account.payment` | KB Payment | KB → Odoo |

### Infra → Artifacts
| Infra Model | Artifact Model | Relationship |
|-------------|---------------|--------------|
| `infra.compute` | `artifact.deployment.compute_id` | Deploy target |
| `infra.container` | `artifact.deployment.container_id` | Deploy target |
| `infra.ssh.credential` | `artifact.deployment.ssh_credential_id` | SSH connection for deploy |
| `infra.ssh.credential` | `artifact.deploy.pipeline.ssh_credential_id` | Pipeline executor |

### Infra → Vault
| Infra Model | Vault Path | Purpose |
|-------------|-----------|---------|
| `infra.ssh.key` (vault mode) | `secret/infra/ssh-keys/{name}` | Private key storage |
| `infra.vault.config` | N/A | Vault connection settings |

## Theme System
Two themes: `btcl` (green) and `telcobright` (blue).
- Defined in `ui/src/theme/themes.js`
- Switched via TopBar dropdown, persisted to localStorage
- Brand colors used by sidebar, infra tree badges

## Adding a New Service

1. **Add Odoo models** in a new module under `odoo-backend/custom-addons/`
2. **Add API functions** in `ui/src/services/{service}.js` using `call()` from `odoo.js`
3. **Add React pages** under `ui/src/pages/{service}/`
4. **Add route** in `ui/src/App.jsx` and sidebar item in `ui/src/layouts/Sidebar.jsx`
5. **No Spring Boot changes needed** — the generic Odoo proxy handles all models

## Adding a Non-Odoo Backend

1. Create a proxy controller in `api/src/main/java/.../controller/`
2. Add config properties in `application.yml`
3. Add Vite proxy rule if needed (or reuse `/api` prefix)
