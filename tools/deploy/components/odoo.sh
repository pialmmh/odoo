# shellcheck shell=bash
#
# Component handler: odoo
#
# Two modes:
#   --local: render templates/odoo.conf.tmpl → odoo-backend-19/profiles/<op>-<prof>/odoo.conf,
#            kill any running odoo on the profile port, relaunch via odoo-bin as daemon.
#   remote:  rsync addons, ssh + systemctl restart on target host.
#
# Reads CONF_* loaded from operators/<op>.conf [<profile>]:
#   pg_host, pg_port, pg_user, pg_password, odoo_db_name,
#   odoo_http_port, odoo_workers, odoo_log_level, odoo_proxy_mode, odoo_admin_passwd,
#   odoo_home, odoo_service (remote-deploy only)

deploy_odoo() {
    # ── 1. seed-data sub-step ──
    local needs_seed="false"
    if [ "${DEPLOY_FORCE_SEED:-false}" = "true" ]; then
        needs_seed="true"
    elif [ "${DEPLOY_LOCAL:-false}" = "true" ]; then
        # Probe DB directly via JDBC URL (psql client)
        local exists
        exists="$(PGPASSWORD="${CONF_PG_PASSWORD}" psql -h "${CONF_PG_HOST}" -p "${CONF_PG_PORT}" -U "${CONF_PG_USER}" -d "${CONF_PG_ADMIN_DB:-postgres}" -tAc "SELECT 1 FROM pg_database WHERE datname='${CONF_ODOO_DB_NAME}'" 2>/dev/null || true)"
        [ "$exists" != "1" ] && needs_seed="true"
    else
        # Remote probe — relies on .pgpass / peer auth on the target host
        local exists
        exists="$(ssh_run "psql -h ${CONF_PG_HOST} -p ${CONF_PG_PORT} -U ${CONF_PG_USER} -d ${CONF_PG_ADMIN_DB:-postgres} -tAc \"SELECT 1 FROM pg_database WHERE datname='${CONF_ODOO_DB_NAME}'\" 2>/dev/null || true")"
        [ "$exists" != "1" ] && needs_seed="true"
    fi

    if [ "$needs_seed" = "true" ]; then
        echo "DB ${CONF_ODOO_DB_NAME} missing or --seed forced — running seed-data sub-step."
        # shellcheck disable=SC1090
        . "$DEPLOY_SCRIPT_DIR/components/seed-data.sh"
        deploy_seed_data
    fi

    # ── 2. local vs remote dispatch ──
    if [ "${DEPLOY_LOCAL:-false}" = "true" ]; then
        _deploy_odoo_local
    else
        _deploy_odoo_remote
    fi
}

_deploy_odoo_local() {
    local base="$DEPLOY_BASE_DIR/odoo-backend-19"
    local profile_dir="$base/profiles/${DEPLOY_OPERATOR}-${DEPLOY_PROFILE}"
    local out_conf="$profile_dir/odoo.conf"

    if [ ! -x "$base/venv/bin/python" ]; then
        echo "ERROR: $base/venv/bin/python missing — run odoo-backend-19 venv setup first" >&2
        exit 1
    fi
    if [ ! -d "$base/odoo-src" ]; then
        echo "ERROR: $base/odoo-src missing" >&2
        exit 1
    fi

    # ── compute path-derived knobs (not in conf) and export for renderer ──
    export CONF_OPERATOR="$DEPLOY_OPERATOR"
    export CONF_PROFILE="$DEPLOY_PROFILE"
    export CONF_ODOO_ADDONS_PATH="$base/odoo-src/addons,$base/custom-addons"
    # Per-profile data_dir keeps filestores isolated between profiles.
    export CONF_ODOO_DATA_DIR="$base/data/${DEPLOY_OPERATOR}-${DEPLOY_PROFILE}"
    export CONF_ODOO_LOGFILE="$base/logs/odoo-${DEPLOY_OPERATOR}-${DEPLOY_PROFILE}.log"

    # ── render odoo.conf from template ──
    # shellcheck disable=SC1091
    . "$DEPLOY_SCRIPT_DIR/lib/render-template.sh"
    local tmpl="$DEPLOY_SCRIPT_DIR/templates/odoo.conf.tmpl"
    echo "Rendering $tmpl → $out_conf"
    dry_or_run "render_template \"$tmpl\" \"$out_conf\""

    [ "${DRY_RUN:-false}" = "true" ] && return

    # ── render-only mode: stop here, leave config in place ──
    if [ "${DEPLOY_NO_LAUNCH:-false}" = "true" ]; then
        echo "  ✓ Configured (no launch). Start with:"
        echo "      ORCHESTRIX_PROFILE=${DEPLOY_OPERATOR}-${DEPLOY_PROFILE} $base/start-odoo-19.sh"
        return 0
    fi

    # ── stop any currently running Odoo on this port ──
    local port="${CONF_ODOO_HTTP_PORT}"
    local pids
    pids="$(ss -ltnp "sport = :$port" 2>/dev/null | awk 'NR>1{match($0,/pid=([0-9]+)/,m); if(m[1])print m[1]}' | sort -u)"
    if [ -n "$pids" ]; then
        echo "Stopping existing process on :$port (pids: $pids)"
        kill $pids 2>/dev/null || true
        sleep 2
        kill -9 $pids 2>/dev/null || true
    fi

    # ── optional: update modules ──
    mkdir -p "$base/logs" "$CONF_ODOO_DATA_DIR"
    if [ "${DEPLOY_SKIP_BUILD:-false}" != "true" ]; then
        echo "odoo -u all --stop-after-init (may take a minute)..."
        ( cd "$base" && ./venv/bin/python odoo-src/odoo-bin -c "$out_conf" -u all --stop-after-init ) \
            || { echo "ERROR: odoo module update failed" >&2; exit 1; }
    fi

    # ── launch as daemon ──
    # setsid -f forks into a new session, fully detaching from this shell so
    # deploy.sh doesn't wait on Odoo at exit. Odoo's own `logfile=` config
    # handles file logging; we drop stdio to /dev/null to release the pipe.
    echo "Starting Odoo (logfile: $CONF_ODOO_LOGFILE)"
    setsid -f bash -c "cd '$base' && exec ./venv/bin/python odoo-src/odoo-bin -c '$out_conf' >/dev/null 2>&1 </dev/null"

    # ── verify ──
    local elapsed=0
    while [ $elapsed -lt 30 ]; do
        local code
        code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 "http://127.0.0.1:$port/web/login" 2>/dev/null)"
        if [ "$code" != "000" ] && [ -n "$code" ]; then
            echo "  ✓ Odoo up on :$port (HTTP $code)"
            return 0
        fi
        sleep 1; elapsed=$((elapsed + 1))
    done
    echo "  ✗ Odoo did not come up on :$port within 20s — check $CONF_ODOO_LOGFILE" >&2
    exit 1
}

_deploy_odoo_remote() {
    local odoo_home="${CONF_ODOO_HOME:?missing odoo_home in profile}"
    local odoo_service="${CONF_ODOO_SERVICE:?missing odoo_service in profile}"
    local local_addons="$DEPLOY_BASE_DIR/odoo-backend-19/custom-addons"

    if [ ! -d "$local_addons" ]; then
        echo "ERROR: local addons dir missing: $local_addons" >&2
        exit 1
    fi

    echo "Rsync custom-addons → ${SSH_TARGET}:${odoo_home}/custom-addons/"
    if [ "${DRY_RUN:-false}" != "true" ]; then
        rsync_to "$local_addons/" "${odoo_home}/custom-addons/"
    else
        echo "[dry-run] rsync $local_addons/ → ${odoo_home}/custom-addons/"
    fi

    if [ "${DEPLOY_SKIP_BUILD:-false}" != "true" ]; then
        echo "Running odoo -u all --stop-after-init on remote..."
        dry_or_run "ssh_run \"cd $odoo_home && ./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d ${CONF_ODOO_DB_NAME} -u all --stop-after-init\""
    fi

    echo "Restarting $odoo_service..."
    dry_or_run "ssh_run 'sudo systemctl restart $odoo_service'"
}
