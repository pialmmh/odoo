# shellcheck shell=bash
#
# Component handler: ui
#
# vite build → rsync dist/ to nginx root → reload nginx.
#
# Reads CONF_*: ui_nginx_root, ui_service (default: nginx)

deploy_ui() {
    local local_dir="$DEPLOY_BASE_DIR/ui"
    local nginx_root="${CONF_UI_NGINX_ROOT:?missing ui_nginx_root in profile}"
    local svc="${CONF_UI_SERVICE:-nginx}"

    if [ "${DEPLOY_SKIP_BUILD:-false}" != "true" ]; then
        echo "vite build..."
        dry_or_run "(cd \"$local_dir\" && npm ci && npm run build)"
    fi

    if [ ! -d "$local_dir/dist" ] && [ "${DRY_RUN:-false}" != "true" ]; then
        echo "ERROR: $local_dir/dist not found — build failed?" >&2
        exit 1
    fi

    echo "Rsync dist/ → ${SSH_TARGET}:${nginx_root}/"
    dry_or_run "ssh_run 'sudo mkdir -p $nginx_root && sudo chown \$USER $nginx_root'"
    if [ "${DRY_RUN:-false}" != "true" ]; then
        rsync_to "$local_dir/dist/" "$nginx_root/"
    fi

    echo "Reloading $svc..."
    dry_or_run "ssh_run 'sudo systemctl reload $svc'"
}
