# Orchestrix-v2 — Central Config + Party Model (shared brief)

**Audience:** the agent working on Keycloak integration.
**Purpose:** align on where tenant config, party data (customers/vendors), and
app-user identity live, and how Keycloak fits in.

---

## 1. Runtime shape — why this is *not* like routesphere

Routesphere pattern: one JVM runs one (or a handful of) tenants' pipelines,
each tenant can be pinned to its own profile (dev/staging/prod). That works
because tenants = isolated SMS/voice workloads.

Orchestrix-v2 is different:

- **One API instance serves ALL tenants simultaneously.** A super-admin
  switches between them in the UI (`/btcl/customers`, `/telcobright/invoices`).
- All tenants share the same Kill Bill host, the same Odoo host, the same
  Keycloak realm URL in a given deployment.
- **Profile is a property of the deployment, not the tenant.** A deployment
  is either dev, staging, or prod — you never mix. Per-tenant `profile:` makes
  no sense here.

So the axis is:

```
deployment (global profile) ── dev | staging | prod
    │
    ├── tenants[] — each tenant has its own branding, KB api-key, partner-id,
    │              product mapping, etc. — but all running in this profile
    └── global infra — KB URL, Odoo URL, Keycloak URL (from the deployment)
```

## 2. Config scope — three buckets, stop scattering them

Right now tenant config is scattered across:

- `ui/src/config/platform.js` — tenant slugs, branding (hardcoded in git)
- `api/.../application.yml` — KB/Odoo/Keycloak URLs
- Odoo `platform.tenant.config` model — branding + KB creds (recent commit
  `5871de2` moved some here)
- In-flight scaffold: `api/.../config/tenants/{slug}/{profile}/profile-*.yml`

This is three sources of truth. We need one.

**Proposal — single central store (platform DB), three buckets inside:**

| Bucket | What | Editable at runtime? |
|---|---|---|
| **Deployment** | KB URL, Odoo URL, Keycloak URL, Kafka brokers | No — set at deploy |
| **Tenant config** | branding, KB api-key/secret, Odoo partner_id, product-mapping, feature flags | Yes — via admin UI |
| **Identity** | app users, roles, group membership | Yes — via Keycloak admin |

Deployment bucket stays in `application.yml` (env-specific, deploy-time,
git-versioned). The other two move to the central platform DB.

## 3. Why not Keycloak as the config store

Considered and rejected:

- Keycloak's DB schema is Keycloak's — custom YAML blobs need a custom SPI
  (Java JAR in `providers/`), JPA entity, REST endpoint, and either a custom
  admin-console extension or abuse of realm/group attributes.
- Heavyweight and couples config pipeline to Keycloak upgrades.
- Keycloak = identity provider. Putting product mapping + branding in there
  is off-domain.

**Keep Keycloak for identity only.** Everything else in our own DB.

## 4. Proposed central DB layout (platform DB in MySQL)

A single *party* table is the unifying abstraction — tenants, customers,
vendors, and app users are all parties with different roles.

```
party                      -- root entity: anyone we track
├── id (pk)
├── type         enum(TENANT, CUSTOMER, VENDOR, USER)
├── slug         unique, human-readable (e.g. "btcl", "priya-sharma")
├── display_name
├── email
├── phone
├── status       enum(ACTIVE, SUSPENDED, DELETED)
├── created_at / updated_at

party_tenant                -- specialisation for TENANT parties
├── party_id (pk, fk party.id)
├── kb_api_key
├── kb_api_secret_ref       → Vault path, never the raw secret
├── odoo_partner_id
├── keycloak_group_path     e.g. "/tenants/btcl"
├── branding_json           display-name, short-name, theme
├── features_json           feature flags per tenant
├── product_mapping_json    UI plan name → Odoo variant

party_customer              -- specialisation for CUSTOMER parties
├── party_id (pk)
├── tenant_id               fk party_tenant — which tenant they belong to
├── kb_account_id
├── odoo_partner_id
├── (billing profile, addresses live here or in sub-tables)

party_vendor                -- specialisation for VENDOR parties
├── party_id (pk)
├── tenant_id
├── odoo_partner_id
├── (supply-side fields)

party_user                  -- specialisation for USER parties (app users)
├── party_id (pk)
├── keycloak_sub            JWT "sub" claim — the join key to Keycloak
├── tenant_id (nullable)    null = super-admin (cross-tenant)
├── roles_json              cache of Keycloak roles for fast lookup
```

Rules:

1. **`party.slug` is globally unique.** Used in URLs (tenant slug, customer
   detail pages).
2. **A party is never hard-deleted** — only status=DELETED. FK constraints
   everywhere.
3. **Specialisation tables share PK with `party`** (1:1), so joining is cheap
   and a party can only be one type.
4. **Keycloak is the source of truth for credentials + group/role membership.**
   `party_user.roles_json` is a read-through cache, refreshed on login.
5. **Secrets never go in the DB as plaintext.** `kb_api_secret_ref` points to
   Vault/OpenBao; the app resolves at runtime.

## 5. Keycloak ↔ central DB — the questions for you

We need you to decide/confirm:

1. **Realm model.** Current setup: single realm `telcobright` with groups
   `/tenants/{slug}`. JWT carries `groups` claim → UI restricts tenant access.
   Do we stay with one realm, or move to realm-per-tenant?
   (Our vote: stay single-realm until we hit a real isolation need — per-tenant
   realms are much harder to operate.)

2. **Join key between Keycloak user and `party_user`.** Our default: JWT `sub`
   claim (stable UUID). Keycloak creates the user first; the API creates a
   `party_user` row on first login (JIT provisioning) keyed by `sub`. Confirm?

3. **Group path → tenant mapping.** Keep `/tenants/{slug}` convention? We'd
   like the slug in the group path to match `party.slug` exactly so no
   translation layer is needed.

4. **Super-admin.** Current: realm role `super_admin`. In DB that means
   `party_user.tenant_id IS NULL`. No DB-side tenant list for them. Confirm?

5. **User provisioning flow.** When an ops person adds a new customer admin
   user, the order we're assuming is:
     a. Create user in Keycloak admin (email, temp password, add to
        `/tenants/{slug}` group).
     b. User logs in → API sees new `sub` → creates `party_user` row linked
        to the tenant by group path.
   Does that work for you, or do you want the API to create the Keycloak user
   via the Admin REST API (tighter coupling, better audit trail)?

6. **Tenant provisioning.** Creating a new tenant means: insert `party` +
   `party_tenant` rows, create `/tenants/{new-slug}` group in Keycloak. Should
   this be one API call that does both, or two manual steps? We want one.

## 6. Runtime config loading

The API boots with:

```yaml
# application.yml — deployment-scoped only
orchestrix:
  profile: dev              # global, set by deployment
  database:
    url: jdbc:mysql://...   # platform DB — holds all parties + tenant config
killbill:
  url: http://...           # deployment-scoped, shared by all tenants
catalog:        # Odoo
  url: http://...
spring:
  security.oauth2.resourceserver.jwt.issuer-uri: http://keycloak:7104/realms/telcobright
```

At startup the API queries `party_tenant` for all active tenants and caches
them. On tenant config edit (via admin UI), the row is updated and the cache
invalidated via Kafka event (`config.tenant.updated`). No restart needed.

## 7. Edit UX

- Human edits tenant config in the admin UI — a Monaco YAML editor.
- Submit → API parses YAML → validates schema → writes to
  `party_tenant.{branding_json, features_json, product_mapping_json}`.
- Invalid YAML → 400 with line/column error.
- Claude/agents edit the DB rows directly (no YAML round-trip needed for
  programmatic edits).

The YAML is a *serialisation format*, not the storage format. Storage is
typed JSON columns (or normalised tables where the shape stabilises).

## 8. What's already in place (so you don't duplicate)

- Single Keycloak realm `telcobright` on `localhost:7104`, H2 dev DB,
  custom theme at `keycloak/theme/telcobright/login/`.
- Users seeded: `admin/password` (super_admin), `btcl-admin/password`
  (tenant_admin in `/tenants/btcl`).
- UI reads JWT groups claim via `services/keycloak.js` → `getTenantSlugs()`
  returns `['btcl']` etc., which gates tenant URL access in
  `App.jsx` `TenantAuthGuard`.
- Spring API validates JWT via `spring-boot-starter-oauth2-resource-server`.
- Scaffold of YAML-per-tenant-profile exists at
  `api/src/main/resources/config/tenants/` — **to be removed** once this
  central DB plan is accepted. Don't build on top of it.

## 9. Open questions for both agents

- Where does *Vault* fit for secret storage? (Our assumption: all
  `*_secret_ref` columns are Vault paths; API resolves at use.)
- Do we need a "sudo as tenant" flow for super-admins (impersonation audit)
  or is the current "super-admin can hit any tenant URL" enough?
- Multi-region: is `profile` enough, or do we also need `region`?

Reply with decisions on §5 and §9, and any pushback on §4's schema.
