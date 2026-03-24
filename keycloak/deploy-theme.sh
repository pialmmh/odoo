#!/bin/bash
#
# Deploy Telcobright login theme to Keycloak
# Copies theme files and sets it as the realm login theme.
#

KC_HOME="/opt/keycloak-24.0.5"
KC_URL="http://localhost:7104"
REALM="telcobright"
THEME_SRC="$(dirname "$0")/theme/telcobright"
THEME_DEST="$KC_HOME/themes/telcobright"

echo "=== Deploy Keycloak Login Theme ==="

# 1. Copy theme files
echo "Copying theme files to $THEME_DEST..."
rm -rf "$THEME_DEST"
cp -r "$THEME_SRC" "$THEME_DEST"
echo "  Done"

# 2. Set realm login theme to 'telcobright'
echo "Setting realm login theme..."
TOKEN=$(curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" -d "username=admin" -d "password=admin" -d "grant_type=password" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "  WARNING: Could not get admin token. Set theme manually in KC admin console."
  echo "  Go to: Realm Settings → Themes → Login Theme → telcobright"
else
  curl -s -X PUT "$KC_URL/admin/realms/$REALM" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"loginTheme":"telcobright"}' > /dev/null
  echo "  Set login theme to 'telcobright' for realm '$REALM'"
fi

echo ""
echo "=== Done ==="
echo "Theme will take effect on next login (KC caches themes in dev mode, changes are live)."
echo "Test: open http://localhost:5180 in incognito or after logout."
