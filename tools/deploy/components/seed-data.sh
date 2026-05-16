# shellcheck shell=bash
#
# Component handler: seed-data
#
# Responsibilities:
#   - locate the seed-data jar (built in routesphere worktree, not duplicated here)
#   - ship the jar + data/ dir to the remote host
#   - invoke java -jar … against the operator's Postgres
#
# Reads from CONF_*:
#   CONF_PG_HOST, CONF_PG_PORT, CONF_PG_USER, CONF_PG_PASSWORD_ENV, CONF_PG_ADMIN_DB
#   CONF_ODOO_DB_NAME, CONF_SEED_APP, CONF_SEED_VERSION, CONF_SEED_TENANT
#
# Reads from environment:
#   DEPLOY_FORCE_SEED  (true → pass --force-recreate)
#   DEPLOY_SKIP_BUILD  (true → don't rebuild jar)
#
# Lives in-tree at tools/deploy/seed-data/. Override with ORCHESTRIX_SEED_DATA_HOME
# if you ever need to point at an external checkout.

deploy_seed_data() {
    local seed_home="${ORCHESTRIX_SEED_DATA_HOME:-$DEPLOY_SCRIPT_DIR/seed-data}"
    local jar="$seed_home/target/seed-data.jar"
    local data_dir="$seed_home/data"

    if [ ! -d "$seed_home" ]; then
        echo "ERROR: seed-data tool not found at $seed_home" >&2
        echo "Set ORCHESTRIX_SEED_DATA_HOME if you've relocated it." >&2
        exit 1
    fi

    if [ ! -f "$jar" ] || [ "${DEPLOY_SKIP_BUILD:-false}" != "true" ]; then
        echo "Building seed-data jar..."
        dry_or_run "(cd \"$seed_home\" && mvn -q package)"
    fi

    if [ ! -f "$jar" ] && [ "${DRY_RUN:-false}" != "true" ]; then
        echo "ERROR: $jar still missing after build" >&2
        exit 1
    fi

    # ── ship to remote (skip in --local) ──
    local remote_root="/opt/orchestrix/seed-data"
    if [ "${DEPLOY_LOCAL:-false}" != "true" ]; then
        echo "Shipping jar + data to ${SSH_TARGET}:${remote_root}"
        dry_or_run "ssh_run 'mkdir -p $remote_root/target $remote_root/data'"
        if [ "${DRY_RUN:-false}" != "true" ]; then
            scp_to "$jar" "$remote_root/target/seed-data.jar"
            rsync_to "$data_dir/" "$remote_root/data/"
        fi
    fi

    # ── build CLI args ──
    local app="${CONF_SEED_APP:-odoo}"
    local version="${CONF_SEED_VERSION:-v19}"
    local tenant="${CONF_SEED_TENANT:-$DEPLOY_OPERATOR}"
    local pg_host="${CONF_PG_HOST:?missing pg_host in profile}"
    local pg_port="${CONF_PG_PORT:?missing pg_port in profile}"
    local pg_user="${CONF_PG_USER:?missing pg_user in profile}"
    local pg_admin="${CONF_PG_ADMIN_DB:-postgres}"
    local db_name="${CONF_ODOO_DB_NAME:?missing odoo_db_name in profile}"

    # Password: inline pg_password wins; else fall back to env-var indirection
    local pw_flag
    if [ -n "${CONF_PG_PASSWORD:-}" ]; then
        pw_flag="--db-password '${CONF_PG_PASSWORD}'"
    elif [ -n "${CONF_PG_PASSWORD_ENV:-}" ]; then
        pw_flag="--db-password-env '${CONF_PG_PASSWORD_ENV}'"
    else
        echo "ERROR: set either pg_password or pg_password_env in [$DEPLOY_PROFILE]" >&2
        exit 1
    fi

    local force_flag=""
    [ "${DEPLOY_FORCE_SEED:-false}" = "true" ] && force_flag="--force-recreate"

    if [ "${DEPLOY_LOCAL:-false}" = "true" ]; then
        local local_cmd
        local_cmd="cd \"$seed_home\" && java -jar target/seed-data.jar $app \
            --db-host '$pg_host' --db-port '$pg_port' \
            --db-user '$pg_user' $pw_flag \
            --admin-db '$pg_admin' \
            --db-name '$db_name' --tenant '$tenant' \
            --version '$version' \
            $force_flag"
        echo "Invoking seed-data locally..."
        dry_or_run "$local_cmd"

        _post_seed_cleanup_assets "$pg_host" "$pg_port" "$pg_user" "$db_name"
        return
    fi

    local remote_cmd
    remote_cmd="cd $remote_root && \
        java -jar target/seed-data.jar $app \
            --db-host '$pg_host' --db-port '$pg_port' \
            --db-user '$pg_user' $pw_flag \
            --admin-db '$pg_admin' \
            --db-name '$db_name' --tenant '$tenant' \
            --version '$version' \
            $force_flag"

    echo "Invoking seed-data on remote..."
    dry_or_run "ssh_run \"$remote_cmd\""

    _post_seed_cleanup_assets "$pg_host" "$pg_port" "$pg_user" "$db_name"
}

# After seeding an Odoo DB, drop the `ir_attachment` rows that point at
# `web.assets_*` bundles. The pristine SQL dump carries those rows but NOT
# the corresponding files in the filestore — so Odoo serves HTTP 500 for
# every asset URL until the bundles regenerate.
#
# Deleting these rows is the standard Odoo "force asset rebuild" trick:
# on the next request, Odoo re-bundles, writes fresh files into the
# filestore with new hashes, and re-creates the ir_attachment rows.
# Idempotent — running it on a DB with no such rows is a no-op.
#
# Odoo-specific. Skipped for non-Odoo seed apps.
_post_seed_cleanup_assets() {
    local pg_host="$1" pg_port="$2" pg_user="$3" db_name="$4"
    local app="${CONF_SEED_APP:-odoo}"

    [ "$app" != "odoo" ] && return 0
    [ "${DRY_RUN:-false}" = "true" ] && return 0

    local sql="DELETE FROM ir_attachment WHERE name LIKE 'web.assets_%'"

    if [ "${DEPLOY_LOCAL:-false}" = "true" ]; then
        local pw
        pw="${CONF_PG_PASSWORD:-}"
        if [ -z "$pw" ] && [ -n "${CONF_PG_PASSWORD_ENV:-}" ]; then
            pw="${!CONF_PG_PASSWORD_ENV:-}"
        fi
        echo "Post-seed: dropping stale web.assets_% bundle records (forces Odoo to regenerate on first request)"
        PGPASSWORD="$pw" psql -h "$pg_host" -p "$pg_port" -U "$pg_user" -d "$db_name" -c "$sql" 2>&1 | head -3
    else
        echo "Post-seed: dropping stale web.assets_% bundle records on remote"
        dry_or_run "ssh_run \"psql -h $pg_host -p $pg_port -U $pg_user -d $db_name -c \\\"$sql\\\"\""
    fi
}
