#!/bin/bash
#
# Setup Keycloak tenant groups and group-membership token mapper.
#
# Prerequisites:
#   - Keycloak running on localhost:7104
#   - Realm "telcobright" exists with client "platform-ui"
#   - Admin credentials: admin / admin (default KC admin)
#
# This script:
#   1. Gets an admin token
#   2. Creates /tenants parent group
#   3. Creates child groups: btcl, telcobright, abc-isp
#   4. Adds a "groups" protocol mapper to platform-ui client so JWT includes group membership
#   5. Creates the super_admin realm role (if not exists)
#
# Idempotent — safe to re-run.

KC_URL="http://localhost:7104"
REALM="telcobright"
CLIENT_ID_NAME="platform-ui"
ADMIN_USER="admin"
ADMIN_PASS="admin"

# Tenant slugs to create as groups
TENANT_SLUGS=("btcl" "telcobright" "abc-isp")

echo "=== Keycloak Tenant Group Setup ==="

# 1. Get admin access token
echo "Getting admin token..."
TOKEN=$(curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get admin token. Check KC is running and admin credentials."
  exit 1
fi
echo "  OK"

# Helper: KC admin API call
kc_api() {
  curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"
}

# 2. Create /tenants parent group
echo "Creating /tenants parent group..."
PARENT_ID=$(kc_api "$KC_URL/admin/realms/$REALM/groups" | python3 -c "
import sys, json
groups = json.load(sys.stdin)
for g in groups:
    if g['name'] == 'tenants':
        print(g['id'])
        break
" 2>/dev/null)

if [ -z "$PARENT_ID" ]; then
  kc_api -X POST "$KC_URL/admin/realms/$REALM/groups" \
    -d '{"name":"tenants"}' > /dev/null
  PARENT_ID=$(kc_api "$KC_URL/admin/realms/$REALM/groups" | python3 -c "
import sys, json
groups = json.load(sys.stdin)
for g in groups:
    if g['name'] == 'tenants':
        print(g['id'])
        break
")
  echo "  Created (id=$PARENT_ID)"
else
  echo "  Already exists (id=$PARENT_ID)"
fi

# 3. Create child groups for each tenant
for SLUG in "${TENANT_SLUGS[@]}"; do
  echo "Creating /tenants/$SLUG group..."
  EXISTS=$(kc_api "$KC_URL/admin/realms/$REALM/groups/$PARENT_ID/children" | python3 -c "
import sys, json
children = json.load(sys.stdin)
for c in children:
    if c['name'] == '$SLUG':
        print(c['id'])
        break
" 2>/dev/null)

  if [ -z "$EXISTS" ]; then
    kc_api -X POST "$KC_URL/admin/realms/$REALM/groups/$PARENT_ID/children" \
      -d "{\"name\":\"$SLUG\"}" > /dev/null
    echo "  Created"
  else
    echo "  Already exists"
  fi
done

# 4. Add group-membership protocol mapper to platform-ui client
echo "Setting up group-membership mapper on $CLIENT_ID_NAME..."

# Get client internal ID
CLIENT_UUID=$(kc_api "$KC_URL/admin/realms/$REALM/clients?clientId=$CLIENT_ID_NAME" | python3 -c "
import sys, json
clients = json.load(sys.stdin)
if clients: print(clients[0]['id'])
" 2>/dev/null)

if [ -z "$CLIENT_UUID" ]; then
  echo "  ERROR: Client '$CLIENT_ID_NAME' not found in realm '$REALM'"
  exit 1
fi

# Check if mapper already exists
MAPPER_EXISTS=$(kc_api "$KC_URL/admin/realms/$REALM/clients/$CLIENT_UUID/protocol-mappers/models" | python3 -c "
import sys, json
mappers = json.load(sys.stdin)
for m in mappers:
    if m['name'] == 'group-membership':
        print('yes')
        break
" 2>/dev/null)

if [ "$MAPPER_EXISTS" != "yes" ]; then
  kc_api -X POST "$KC_URL/admin/realms/$REALM/clients/$CLIENT_UUID/protocol-mappers/models" \
    -d '{
      "name": "group-membership",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-group-membership-mapper",
      "config": {
        "full.path": "true",
        "id.token.claim": "true",
        "access.token.claim": "true",
        "claim.name": "groups",
        "userinfo.token.claim": "true"
      }
    }' > /dev/null
  echo "  Created mapper (groups claim in JWT)"
else
  echo "  Mapper already exists"
fi

# 5. Create super_admin realm role if not exists
echo "Ensuring super_admin realm role exists..."
ROLE_EXISTS=$(kc_api "$KC_URL/admin/realms/$REALM/roles/super_admin" 2>/dev/null | python3 -c "
import sys, json
r = json.load(sys.stdin)
if 'name' in r: print('yes')
" 2>/dev/null)

if [ "$ROLE_EXISTS" != "yes" ]; then
  kc_api -X POST "$KC_URL/admin/realms/$REALM/roles" \
    -d '{"name":"super_admin","description":"Platform super administrator — access to all tenants"}' > /dev/null
  echo "  Created"
else
  echo "  Already exists"
fi

# Also create tenant_admin, operator, readonly roles
for ROLE in tenant_admin operator readonly; do
  ROLE_EXISTS=$(kc_api "$KC_URL/admin/realms/$REALM/roles/$ROLE" 2>/dev/null | python3 -c "
import sys, json
r = json.load(sys.stdin)
if 'name' in r: print('yes')
" 2>/dev/null)
  if [ "$ROLE_EXISTS" != "yes" ]; then
    kc_api -X POST "$KC_URL/admin/realms/$REALM/roles" \
      -d "{\"name\":\"$ROLE\",\"description\":\"Platform role: $ROLE\"}" > /dev/null
    echo "  Created role: $ROLE"
  fi
done

echo ""
echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  1. Assign 'super_admin' realm role to the admin user"
echo "  2. Assign tenant groups to tenant users, e.g.:"
echo "     - User 'btcl-admin' → group /tenants/btcl + role tenant_admin"
echo "     - User 'abc-ops'    → group /tenants/abc-isp + role operator"
echo "  3. Test: login as admin → should see all tenants"
echo "  4. Test: login as btcl-admin → should see only BTCL"
