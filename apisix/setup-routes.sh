#!/bin/bash
#
# Configure APISIX routes for Telcobright Platform
# Run after APISIX + etcd start. Routes persist in etcd.
# Re-run if etcd data is lost.
#

ADMIN="http://localhost:9180/apisix/admin"
KEY="telcobright-apisix-admin-key"
KC_SECRET="T3HRg6Jf72Botb5Tgx1Hbd61VLBGrkbf"
KC_DISCOVERY="http://localhost:7104/realms/telcobright/.well-known/openid-configuration"
CORS='{"allow_origins":"http://localhost:5180","allow_methods":"**","allow_headers":"**","allow_credential":true}'
OIDC="{\"client_id\":\"platform-ui\",\"client_secret\":\"$KC_SECRET\",\"discovery\":\"$KC_DISCOVERY\",\"bearer_only\":true,\"scope\":\"openid\"}"

echo "Configuring APISIX routes..."

# Upstream: Spring Boot API
curl -s -X PUT "$ADMIN/upstreams/1" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d '{"name":"platform-api","type":"roundrobin","nodes":{"127.0.0.1:8180":1}}' > /dev/null
echo "  ✓ Upstream: platform-api → :8180"

# Public: health
curl -s -X PUT "$ADMIN/routes/1" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-health\",\"uri\":\"/api/odoo/health\",\"methods\":[\"GET\",\"POST\"],\"upstream_id\":\"1\",\"priority\":10,\"plugins\":{\"cors\":$CORS}}" > /dev/null
echo "  ✓ Route: /api/odoo/health (public)"

# Public: tenant loading
curl -s -X PUT "$ADMIN/routes/2" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-tenants\",\"uri\":\"/api/odoo/res.partner/*\",\"methods\":[\"GET\",\"POST\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":10,\"plugins\":{\"cors\":$CORS}}" > /dev/null
echo "  ✓ Route: /api/odoo/res.partner/* (public)"

# Protected: all Odoo APIs
curl -s -X PUT "$ADMIN/routes/3" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-odoo\",\"uri\":\"/api/odoo/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"DELETE\",\"OPTIONS\"],\"upstream_id\":\"1\",\"priority\":0,\"plugins\":{\"cors\":$CORS,\"openid-connect\":$OIDC}}" > /dev/null
echo "  ✓ Route: /api/odoo/* (Keycloak JWT)"

# Protected: Kill Bill APIs
curl -s -X PUT "$ADMIN/routes/4" -H "X-API-KEY: $KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"api-kb\",\"uri\":\"/api/kb/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"DELETE\",\"OPTIONS\"],\"upstream_id\":\"1\",\"plugins\":{\"cors\":$CORS,\"openid-connect\":$OIDC}}" > /dev/null
echo "  ✓ Route: /api/kb/* (Keycloak JWT)"

echo ""
echo "Done. Verify: curl http://localhost:9080/api/odoo/health"
