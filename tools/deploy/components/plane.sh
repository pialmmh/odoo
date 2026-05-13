# shellcheck shell=bash
#
# Component handler: plane
#
# Plane is co-located under odoo-backend-19/plane/ and shares Postgres with Odoo
# (catalog single source). We render apps/api/.env per profile and start the
# backend services via docker compose. The compose file's bundled plane-db
# service is skipped — Plane talks to the remote Postgres instead.
#
# Local mode only for now. Remote mode is a TODO.
#
# Reads CONF_*:
#   pg_host, pg_port, pg_user, pg_password, odoo_db_name,
#   plane_compose_project, plane_api_port, plane_secret_key,
#   plane_redis_host, plane_redis_port,
#   plane_mq_host, plane_mq_port, plane_mq_user, plane_mq_password, plane_mq_vhost,
#   plane_minio_access, plane_minio_secret, plane_minio_bucket

deploy_plane() {
    if [ "${DEPLOY_LOCAL:-false}" = "true" ]; then
        _deploy_plane_local
    else
        echo "ERROR: plane remote-deploy not yet implemented (use --local)" >&2
        exit 1
    fi
}

_deploy_plane_local() {
    local plane_dir="$DEPLOY_BASE_DIR/odoo-backend-19/plane"
    local profile_dir="$plane_dir/profiles/${DEPLOY_OPERATOR}-${DEPLOY_PROFILE}"
    local out_env="$profile_dir/api.env"
    local live_env="$plane_dir/apps/api/.env"

    if [ ! -d "$plane_dir" ]; then
        echo "ERROR: plane dir missing: $plane_dir" >&2
        exit 1
    fi
    if [ ! -f "$plane_dir/docker-compose-local.yml" ]; then
        echo "ERROR: $plane_dir/docker-compose-local.yml missing" >&2
        exit 1
    fi
    if ! command -v docker >/dev/null 2>&1; then
        echo "ERROR: docker not in PATH" >&2
        exit 1
    fi
    if ! docker compose version >/dev/null 2>&1; then
        echo "ERROR: 'docker compose' plugin not available" >&2
        exit 1
    fi

    # ── render apps/api/.env ──
    # shellcheck disable=SC1091
    . "$DEPLOY_SCRIPT_DIR/lib/render-template.sh"
    local tmpl="$DEPLOY_SCRIPT_DIR/templates/plane-api.env.tmpl"
    echo "Rendering $tmpl → $out_env"
    dry_or_run "render_template \"$tmpl\" \"$out_env\""

    [ "${DRY_RUN:-false}" = "true" ] && return

    # ── activate this profile's env as the live one ──
    if [ -f "$live_env" ] && [ ! -f "${live_env}.original" ]; then
        cp "$live_env" "${live_env}.original"
        echo "Backed up upstream $live_env → ${live_env}.original"
    fi
    cp "$out_env" "$live_env"
    echo "Activated $out_env as $live_env"

    # ── render-only ──
    if [ "${DEPLOY_NO_LAUNCH:-false}" = "true" ]; then
        local proj="${CONF_PLANE_COMPOSE_PROJECT:-plane-${DEPLOY_OPERATOR}-${DEPLOY_PROFILE}}"
        echo "  ✓ Configured (no launch). Start with:"
        echo "      cd $plane_dir && docker compose -p $proj -f docker-compose-local.yml up -d plane-redis plane-mq plane-minio api worker beat-worker migrator"
        return 0
    fi

    # ── docker compose up: skip plane-db (we use remote pg) ──
    local proj="${CONF_PLANE_COMPOSE_PROJECT:?missing plane_compose_project in profile}"
    local services=(plane-redis plane-mq plane-minio api worker beat-worker migrator)

    echo "docker compose up -d (project: $proj, services: ${services[*]})"
    ( cd "$plane_dir" && docker compose -p "$proj" -f docker-compose-local.yml up -d --no-deps "${services[@]}" ) \
        || { echo "ERROR: docker compose up failed" >&2; exit 1; }

    # ── verify api container is responsive ──
    local port="${CONF_PLANE_API_PORT:-7110}"
    local elapsed=0
    while [ $elapsed -lt 30 ]; do
        local code
        code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 "http://127.0.0.1:$port/api/" 2>/dev/null || true)"
        if [ -n "$code" ] && [ "$code" != "000" ]; then
            echo "  ✓ Plane api responding on :$port (HTTP $code)"
            return 0
        fi
        sleep 2; elapsed=$((elapsed + 2))
    done
    echo "  ! Plane api didn't respond on :$port within 30s — check 'docker compose -p $proj logs api'" >&2
    # Non-fatal: containers may still be migrating on first run.
    return 0
}
