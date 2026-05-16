# shellcheck shell=bash
#
# Component handler: plane
#
# Two-phase contract (used by deploy.sh + deploy_env.sh):
#   render_plane_env()       — pure rendering. Always runs.
#                              Renders api.env, web.env, compose.override.yml
#                              into odoo-backend-19/plane/profiles/<op>-<prof>/
#                              and copies api.env → apps/api/.env,
#                              web.env → apps/web/.env.
#   deploy_plane()           — render_plane_env + docker compose up.
#
# Plane is co-located under odoo-backend-19/plane/ and shares Postgres with Odoo
# (catalog single source). docker-compose-local.yml's plane-db service is
# skipped — Plane uses the remote Postgres instead.
#
# Plane's React frontend (apps/web) is NOT started by this component. It runs
# natively via `pnpm turbo run dev --filter=web...` (see launch-all.sh).
#
# Reads CONF_*:
#   pg_host, pg_port, pg_user, pg_password, odoo_db_name,
#   plane_compose_project,
#   plane_api_port, plane_web_port, plane_admin_port, plane_space_port, plane_live_port,
#   plane_secret_key,
#   plane_redis_host, plane_redis_port,
#   plane_mq_host, plane_mq_port, plane_mq_user, plane_mq_password, plane_mq_vhost,
#   plane_minio_access, plane_minio_secret, plane_minio_bucket

# ── render-only phase ──
render_plane_env() {
    local plane_dir="$DEPLOY_BASE_DIR/odoo-backend-19/plane"
    local profile_dir="$plane_dir/profiles/${DEPLOY_OPERATOR}-${DEPLOY_PROFILE}"
    local out_api_env="$profile_dir/api.env"
    local out_web_env="$profile_dir/web.env"
    local out_override="$profile_dir/compose.override.yml"

    if [ ! -d "$plane_dir" ]; then
        echo "ERROR: plane dir missing: $plane_dir" >&2
        exit 1
    fi

    # shellcheck disable=SC1091
    . "$DEPLOY_SCRIPT_DIR/lib/render-template.sh"
    local api_tmpl="$DEPLOY_SCRIPT_DIR/templates/plane-api.env.tmpl"
    local web_tmpl="$DEPLOY_SCRIPT_DIR/templates/plane-web.env.tmpl"
    local ovr_tmpl="$DEPLOY_SCRIPT_DIR/templates/plane-compose.override.yml.tmpl"

    echo "Rendering $api_tmpl → $out_api_env"
    dry_or_run "render_template \"$api_tmpl\" \"$out_api_env\""
    echo "Rendering $web_tmpl → $out_web_env"
    dry_or_run "render_template \"$web_tmpl\" \"$out_web_env\""
    echo "Rendering $ovr_tmpl → $out_override"
    dry_or_run "render_template \"$ovr_tmpl\" \"$out_override\""

    [ "${DRY_RUN:-false}" = "true" ] && return

    # Activate rendered files into the dev-server-expected paths.
    # Plane's docker-compose-local.yml reads apps/api/.env; Vite reads apps/web/.env.
    local live_api_env="$plane_dir/apps/api/.env"
    local live_web_env="$plane_dir/apps/web/.env"

    if [ -f "$live_api_env" ] && [ ! -f "${live_api_env}.original" ]; then
        cp "$live_api_env" "${live_api_env}.original"
        echo "Backed up upstream $live_api_env → ${live_api_env}.original"
    fi
    if [ -f "$live_web_env" ] && [ ! -f "${live_web_env}.original" ]; then
        cp "$live_web_env" "${live_web_env}.original"
        echo "Backed up upstream $live_web_env → ${live_web_env}.original"
    fi

    cp "$out_api_env" "$live_api_env"
    cp "$out_web_env" "$live_web_env"
    echo "Activated $out_api_env as $live_api_env"
    echo "Activated $out_web_env as $live_web_env"

    # Expose for bundle packer
    export RENDERED_PLANE_API_ENV="$out_api_env"
    export RENDERED_PLANE_WEB_ENV="$out_web_env"
    export RENDERED_PLANE_COMPOSE_OVERRIDE="$out_override"
}

# ── full deploy phase ──
deploy_plane() {
    if [ "${DEPLOY_LOCAL:-false}" != "true" ]; then
        echo "ERROR: plane remote-deploy not yet implemented (use --local)" >&2
        exit 1
    fi
    _deploy_plane_local
}

_deploy_plane_local() {
    # 0. render (always)
    render_plane_env

    # env-only mode: stop here, no docker actions
    if [ "${DEPLOY_ENV_ONLY:-false}" = "true" ]; then
        echo "  ✓ env-only mode — rendered plane env + override files"
        return 0
    fi

    local plane_dir="$DEPLOY_BASE_DIR/odoo-backend-19/plane"
    local out_override="$RENDERED_PLANE_COMPOSE_OVERRIDE"
    local proj="${CONF_PLANE_COMPOSE_PROJECT:?missing plane_compose_project in profile}"

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

    if [ "${DEPLOY_NO_LAUNCH:-false}" = "true" ]; then
        echo "  ✓ Configured (no launch). Start with:"
        echo "      cd $plane_dir && docker compose -p $proj -f docker-compose-local.yml -f $out_override up -d plane-redis plane-mq plane-minio api worker beat-worker migrator"
        return 0
    fi

    # docker compose up: skip plane-db (we use remote pg)
    local services=(plane-redis plane-mq plane-minio api worker beat-worker migrator)

    echo "docker compose up -d (project: $proj, services: ${services[*]})"
    ( cd "$plane_dir" && docker compose -p "$proj" -f docker-compose-local.yml -f "$out_override" up -d --no-deps "${services[@]}" ) \
        || { echo "ERROR: docker compose up failed" >&2; exit 1; }

    # Verify api container responsive (probe / instead of /api/ — / returns 200, /api/ → 404)
    local port="${CONF_PLANE_API_PORT:-7110}"
    local elapsed=0
    while [ $elapsed -lt 30 ]; do
        local code
        code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 "http://127.0.0.1:$port/" 2>/dev/null || true)"
        if [ -n "$code" ] && [ "$code" != "000" ]; then
            echo "  ✓ Plane api responding on :$port (HTTP $code)"
            return 0
        fi
        sleep 2; elapsed=$((elapsed + 2))
    done
    echo "  ! Plane api didn't respond on :$port within 30s — check 'docker compose -p $proj logs api'" >&2
    return 0
}
