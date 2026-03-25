# Per-Tenant Keycloak Realm/Role Isolation

**Task:** #10
**Priority:** Medium

## What
Currently all tenants share one Keycloak realm (`telcobright`). Evaluate whether each tenant needs its own realm or if role-based separation within a single realm is sufficient.

## Current state
- Single realm: `telcobright`
- Single UI client: `platform-ui` (public)
- Single API client: `platform-api` (confidential)
- Test user: `admin/password` — has access to all tenants
- RBAC is Odoo-driven (rbac.permission, rbac.role, rbac.url.pattern)
- Sidebar filtering uses `useRBAC.js` hook
- URL patterns support per-tenant filtering (e.g., `/btcl/*`, `/telcobright/*`)

## Options

### A. Single realm with tenant-scoped roles (recommended for now)
- Keep one realm
- Add realm roles like `btcl-admin`, `btcl-billing`, `telcobright-admin`
- Map Keycloak roles to Odoo RBAC roles
- Users assigned to specific tenant roles can only access those tenants
- **Pro:** Simple, one Keycloak instance, shared user pool
- **Con:** All users in one pool, complex role matrix at scale

### B. Separate realm per tenant
- Each tenant gets its own Keycloak realm
- Separate user pools, separate clients, separate secrets
- APISIX routes per tenant validate against different OIDC endpoints
- **Pro:** Full isolation, tenant can manage their own users
- **Con:** Operational complexity, multiple OIDC configs in APISIX

## Decision needed
- For dev/MVP: Option A is sufficient
- For production with external clients managing their own users: Option B
- Document the decision and implement accordingly

## Files involved
- keycloak/ (theme, config)
- apisix/setup-routes.sh (OIDC plugin config)
- ui/src/context/AuthContext.jsx
- ui/src/hooks/useRBAC.js
- odoo-backend/custom-addons/rbac_management/
