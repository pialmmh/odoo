#!/usr/bin/env bash
# Tenant DB lifecycle for the Odoo backend.
#
# Usage:
#   tenant.sh create <slug> [--display "Long Name"] [--admin-email a@b.c]
#   tenant.sh exists <slug>
#   tenant.sh drop   <slug>          # destructive
#   tenant.sh list
#   tenant.sh upgrade <slug> [modules]
#
# DB name is "${DB_PREFIX}<slug>" (default prefix: "odoo_"). Slug must match
# [a-z0-9][a-z0-9_-]{0,62}.
#
# Idempotent: 'create' fails fast if the DB already exists; pass --force to drop+recreate.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ODOO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ODOO_BIN="$ODOO_DIR/venv/bin/python $ODOO_DIR/odoo-src/odoo-bin"
ODOO_CONF="$ODOO_DIR/odoo.conf"

DB_PREFIX="${DB_PREFIX:-odoo_}"
# Empty PG_HOST → connect via Unix socket (peer auth). Set PG_HOST=127.0.0.1 to
# force TCP; in that case PGPASSWORD must be set.
PG_HOST="${PG_HOST:-}"
PG_PORT="${PG_PORT:-5433}"
PG_USER="${PG_USER:-mustafa}"
DEFAULT_MODULES="${DEFAULT_MODULES:-base,crm,sale_management,mail,contacts,calendar,orchestrix_crm}"

err()   { echo "ERROR: $*" >&2; exit 1; }
info()  { echo ">> $*"; }

valid_slug() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || err "Invalid slug: $1 (must match [a-z0-9][a-z0-9_-]{0,62})"
}

db_for()   { echo "${DB_PREFIX}$1"; }

psql_q() {
  if [ -n "$PG_HOST" ]; then
    psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -tAc "$1"
  else
    psql -p "$PG_PORT" -U "$PG_USER" -d postgres -tAc "$1"
  fi
}

db_exists(){ [ "$(psql_q "SELECT 1 FROM pg_database WHERE datname='$1'")" = "1" ]; }

cmd_list() {
  psql_q "SELECT datname FROM pg_database WHERE datname LIKE '${DB_PREFIX}%' ORDER BY datname"
}

cmd_exists() {
  local slug="$1"
  valid_slug "$slug"
  local db; db="$(db_for "$slug")"
  if db_exists "$db"; then echo "yes ($db)"; else echo "no ($db)"; fi
}

cmd_drop() {
  local slug="$1"
  valid_slug "$slug"
  local db; db="$(db_for "$slug")"
  db_exists "$db" || { info "$db does not exist"; return 0; }
  info "Dropping $db (terminating active connections first)…"
  psql_q "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$db' AND pid<>pg_backend_pid()" >/dev/null
  if [ -n "$PG_HOST" ]; then
    psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "DROP DATABASE \"$db\""
  else
    psql -p "$PG_PORT" -U "$PG_USER" -d postgres -c "DROP DATABASE \"$db\""
  fi
  info "Dropped."
}

cmd_create() {
  local slug=""
  local display=""
  local admin_email=""
  local force=0
  local modules="$DEFAULT_MODULES"

  while [ $# -gt 0 ]; do
    case "$1" in
      --display)     display="$2"; shift 2 ;;
      --admin-email) admin_email="$2"; shift 2 ;;
      --modules)     modules="$2"; shift 2 ;;
      --force)       force=1; shift ;;
      -*)            err "Unknown flag: $1" ;;
      *)             [ -z "$slug" ] && slug="$1" || err "Unexpected arg: $1"; shift ;;
    esac
  done

  [ -n "$slug" ] || err "slug required"
  valid_slug "$slug"
  local db; db="$(db_for "$slug")"

  if db_exists "$db"; then
    if [ "$force" = "1" ]; then
      cmd_drop "$slug"
    else
      err "DB $db already exists (use --force to drop and recreate)"
    fi
  fi

  info "Initializing $db with modules: $modules"
  cd "$ODOO_DIR"
  $ODOO_BIN -c "$ODOO_CONF" -d "$db" -i "$modules" --stop-after-init --no-http --without-demo=False

  if [ -n "$display" ] || [ -n "$admin_email" ]; then
    info "Applying post-install settings via XML-RPC…"
    DB_NAME="$db" DISPLAY_NAME="$display" ADMIN_EMAIL="$admin_email" \
      "$ODOO_DIR/venv/bin/python" "$SCRIPT_DIR/_post_install.py" || \
      info "(post-install settings step failed — DB is still usable; rerun manually if needed)"
  fi

  info "Done. DB ready: $db"
}

cmd_upgrade() {
  local slug="${1:-}"
  local modules="${2:-all}"
  [ -n "$slug" ] || err "slug required"
  valid_slug "$slug"
  local db; db="$(db_for "$slug")"
  db_exists "$db" || err "DB $db does not exist"

  info "Upgrading modules ($modules) on $db"
  cd "$ODOO_DIR"
  $ODOO_BIN -c "$ODOO_CONF" -d "$db" -u "$modules" --stop-after-init --no-http
  info "Done."
}

case "${1:-}" in
  create)  shift; cmd_create  "$@" ;;
  exists)  shift; cmd_exists  "$@" ;;
  drop)    shift; cmd_drop    "$@" ;;
  list)    shift; cmd_list    "$@" ;;
  upgrade) shift; cmd_upgrade "$@" ;;
  *) cat >&2 <<EOF
Usage:
  tenant.sh create <slug> [--display "Long Name"] [--admin-email a@b.c] [--modules m1,m2] [--force]
  tenant.sh exists <slug>
  tenant.sh drop   <slug>
  tenant.sh list
  tenant.sh upgrade <slug> [modules]
EOF
  exit 2 ;;
esac
