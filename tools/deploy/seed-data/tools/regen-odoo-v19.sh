#!/usr/bin/env bash
# Regenerate data/odoo/v19/{pristine,seed,demo}.sql.gz from a clean source DB.
#
# Strategy:
#   1. Build fresh "clean" DB by running odoo-bin -i <modules> --without-demo=all
#      against a throwaway DB name (e.g. odoo_billing_19_clean).
#   2. Apply Plane DDL on top (Django migrations against the same DB).
#   3. pg_dump --schema-only         -> pristine.sql.gz
#   4. pg_dump --data-only --inserts -> seed.sql.gz   (rows present after step 1+2 = seed by definition)
#   5. (optional) pg_dump live odoo_billing_19 with --inserts -> demo.sql.gz
#
# Required env:
#   PG_HOST, PG_PORT, PG_USER (sudo postgres works on dev box)
#   ODOO_BIN, ODOO_CONF      (paths to odoo-bin + odoo.conf used to init the clean DB)
#   PLANE_MIGRATE_CMD        (command to run Plane Django migrations against $CLEAN_DB)

set -euo pipefail

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5433}"
PG_USER="${PG_USER:-mustafa}"
CLEAN_DB="${CLEAN_DB:-odoo_billing_19_clean}"
LIVE_DB="${LIVE_DB:-odoo_billing_19}"

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data/odoo/v19"

echo "TODO: this regen script is a stub. Concrete steps:"
echo "  1. drop+recreate $CLEAN_DB"
echo "  2. \$ODOO_BIN -c \$ODOO_CONF -d $CLEAN_DB -i base,web,crm,... --without-demo=all --stop-after-init"
echo "  3. \$PLANE_MIGRATE_CMD against $CLEAN_DB"
echo "  4. pg_dump --schema-only         --no-owner --no-acl --inserts $CLEAN_DB | gzip -9 > $DATA_DIR/pristine.sql.gz"
echo "  5. pg_dump --data-only --inserts --no-owner --no-acl           $CLEAN_DB | gzip -9 > $DATA_DIR/seed.sql.gz"
echo "  6. (optional) pg_dump --inserts --no-owner --no-acl $LIVE_DB   | gzip -9 > $DATA_DIR/demo.sql.gz"
echo
echo "Once Plane init procedure is documented, fill these in. For now, regenerate manually."
exit 1
