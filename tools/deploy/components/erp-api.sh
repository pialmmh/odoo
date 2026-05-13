# shellcheck shell=bash
#
# Component handler: erp-api
#
# Build local mvn package, ship the fat-jar, restart systemd unit.
#
# Reads CONF_*: erp_api_home, erp_api_service, erp_api_jvm_heap_min/max

deploy_erp_api() {
    local local_dir="$DEPLOY_BASE_DIR/erp-api"
    local jar_glob="$local_dir/target/erp-api-*.jar"
    local remote_home="${CONF_ERP_API_HOME:?missing erp_api_home in profile}"
    local svc="${CONF_ERP_API_SERVICE:?missing erp_api_service in profile}"

    if [ "${DEPLOY_SKIP_BUILD:-false}" != "true" ]; then
        echo "mvn package erp-api..."
        dry_or_run "(cd \"$local_dir\" && mvn -q clean package -DskipTests)"
    fi

    # find the jar (assumes a single matching artifact)
    local jar
    jar="$(ls -1t $jar_glob 2>/dev/null | head -1 || true)"
    if [ -z "$jar" ] && [ "${DRY_RUN:-false}" != "true" ]; then
        echo "ERROR: no erp-api jar matched: $jar_glob" >&2
        exit 1
    fi

    echo "Shipping $(basename "${jar:-erp-api.jar}") → ${SSH_TARGET}:${remote_home}/"
    dry_or_run "ssh_run 'mkdir -p $remote_home'"
    if [ "${DRY_RUN:-false}" != "true" ]; then
        scp_to "$jar" "$remote_home/erp-api.jar"
    fi

    echo "Restarting $svc..."
    dry_or_run "ssh_run 'sudo systemctl restart $svc'"
}
