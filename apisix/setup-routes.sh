#!/bin/bash
#
# Configure APISIX routes for Telcobright Platform
# Run after APISIX + etcd start. Routes persist in etcd.
# Re-run if etcd data is lost.
#

ADMIN="http://localhost:9180/apisix/admin"
KEY="telcobright-apisix-admin-key"
KC_SECRET="tde2klJ3vsgG5wYprw8IHHP9xo7df8V9"
KC_DISCOVERY="http://localhost:7104/realms/telcobright/.well-known/openid-configuration"
CORS='{"allow_origins":"http://localhost:5180","allow_methods":"**","allow_headers":"**","allow_credential":true}'
OIDC="{\"client_id\":\"platform-api\",\"client_secret\":\"$KC_SECRET\",\"discovery\":\"$KC_DISCOVERY\",\"bearer_only\":true,\"scope\":\"openid\"}"

echo "Configuring APISIX routes..."

# Upstream: Spring Boot API
curl -s -X PUT "$ADMIN/upstreams/1" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d '{"name":"platform-api","type":"roundrobin","nodes":{"127.0.0.1:8180":1}}' > /dev/null
echo "  ✓ Upstream: platform-api → :8180"

# Public: health
curl -s -X PUT "$ADMIN/routes/1" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-health\",\"uri\":\"/api/odoo/health\",\"methods\":[\"GET\",\"POST\"],\"upstream_id\":\"1\",\"priority\":10,\"plugins\":{\"cors\":$CORS}}" > /dev/null
echo "  ✓ Route: /api/odoo/health (public)"

# Public: tenant loading (partners)
curl -s -X PUT "$ADMIN/routes/2" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-tenants\",\"uri\":\"/api/odoo/res.partner/*\",\"methods\":[\"GET\",\"POST\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":10,\"plugins\":{\"cors\":$CORS}}" > /dev/null
echo "  ✓ Route: /api/odoo/res.partner/* (public)"

# Public: tenant config (billing creds, branding — needed before auth)
curl -s -X PUT "$ADMIN/routes/5" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-tenant-config\",\"uri\":\"/api/odoo/platform.tenant.config/*\",\"methods\":[\"GET\",\"POST\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":10,\"plugins\":{\"cors\":$CORS}}" > /dev/null
echo "  ✓ Route: /api/odoo/platform.tenant.config/* (public)"

# Protected: all Odoo APIs
curl -s -X PUT "$ADMIN/routes/3" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-odoo\",\"uri\":\"/api/odoo/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"DELETE\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":0,\"plugins\":{\"cors\":$CORS,\"openid-connect\":$OIDC}}" > /dev/null
echo "  ✓ Route: /api/odoo/* (Keycloak JWT)"

# Protected: Kill Bill APIs
curl -s -X PUT "$ADMIN/routes/4" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-kb\",\"uri\":\"/api/kb/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"DELETE\",\"OPTIONS\"],\"upstream_id\":\"1\",\"plugins\":{\"cors\":$CORS,\"openid-connect\":$OIDC}}" > /dev/null
echo "  ✓ Route: /api/kb/* (Keycloak JWT)"

# Protected: ERP-neutral catalog APIs (tax rates, products, etc. — replaces raw /api/odoo/*)
curl -s -X PUT "$ADMIN/routes/8" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-catalog\",\"uri\":\"/api/catalog/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"DELETE\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":0,\"plugins\":{\"cors\":$CORS,\"openid-connect\":$OIDC}}" > /dev/null
echo "  ✓ Route: /api/catalog/* (Keycloak JWT)"

# Protected: ERP (experimental — iDempiere read-only)
curl -s -X PUT "$ADMIN/routes/9" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-erp\",\"uri\":\"/api/erp/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"DELETE\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":0,\"plugins\":{\"cors\":$CORS,\"openid-connect\":$OIDC}}" > /dev/null
echo "  ✓ Route: /api/erp/* (Keycloak JWT)"

# Public: CRM health
curl -s -X PUT "$ADMIN/routes/6" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-crm-health\",\"uri\":\"/api/crm/health\",\"methods\":[\"GET\"],\"upstream_id\":\"1\",\"priority\":10,\"plugins\":{\"cors\":$CORS}}" > /dev/null
echo "  ✓ Route: /api/crm/health (public)"

# Protected: EspoCRM APIs
curl -s -X PUT "$ADMIN/routes/7" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-crm\",\"uri\":\"/api/crm/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"DELETE\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":0,\"plugins\":{\"cors\":$CORS,\"openid-connect\":$OIDC}}" > /dev/null
echo "  ✓ Route: /api/crm/* (Keycloak JWT)"

echo ""
echo "Done. Verify: curl http://localhost:9081/api/odoo/health"
