#!/bin/bash
#
# Start Odoo 19. Profile-aware:
#   ./start-odoo-19.sh                      → uses ./odoo.conf (legacy localhost)
#   ORCHESTRIX_PROFILE=btcl-dev ./start-odoo-19.sh
#                                           → uses ./profiles/btcl-dev/odoo.conf
#                                             (rendered by tools/deploy/deploy.sh)
#
# Any extra args (e.g. -u all --stop-after-init, -d <db>) pass through to odoo-bin.

set -e
cd "$(dirname "$0")"

CONF="odoo.conf"
if [ -n "${ORCHESTRIX_PROFILE:-}" ]; then
    CONF="profiles/${ORCHESTRIX_PROFILE}/odoo.conf"
    if [ ! -f "$CONF" ]; then
        echo "ERROR: profile config not found: $CONF" >&2
        echo "Render it with: tools/deploy/deploy.sh <operator> <profile> --components odoo --local --no-launch" >&2
        exit 1
    fi
fi

echo "Using config: $CONF"
exec ./venv/bin/python odoo-src/odoo-bin -c "$CONF" "$@"
