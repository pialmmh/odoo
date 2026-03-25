# Per-Tenant Config Loader API

## What
Build config loader that reads config/tenants.yml + profile YAMLs. Expose via API so UI and services fetch tenant config dynamically.

## Exists
- config/tenants.yml (master registry)
- config/tenants/{slug}/{profile}/profile-{profile}.yml (all 3 tenants × 3 envs)
- KB credentials hardcoded in ui/src/config/platform.js

## Missing
- Python or Spring Boot config loader
- API endpoint: GET /api/config/tenant/{slug}
- UI reads credentials from API instead of hardcoded platform.js
- Move kbTenants from platform.js → served from config
