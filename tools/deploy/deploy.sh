#!/usr/bin/env bash
#
# Orchestrix-v2 deploy entrypoint
#
# ┌──────────────────────────────────────────────────────────────────────┐
# │ READ THE WORKFLOW GUIDE                                              │
# │                                                                      │
# │ This script handles dispatch. The conceptual model — operator ×      │
# │ profile axes, component handler contract, template renderer, SSH     │
# │ inventory, conventions for adding operators / profiles / components  │
# │ / templates — lives in the README next to this file:                 │
# │                                                                      │
# │   tools/deploy/README.md                                             │
# │                                                                      │
# │ Per-operator/per-profile values live in:                             │
# │   tools/deploy/operators/<operator>/<profile>.yml                    │
# │                                                                      │
# │ One YAML file per profile (flat keys). Loaded into the environment   │
# │ as CONF_<UPPER_KEY> by lib/load-yaml.sh.                             │
# │                                                                      │
# │ If you are another agent reading this script: open the README above  │
# │ before making any changes.                                           │
# └──────────────────────────────────────────────────────────────────────┘
#
# Usage:
#   ./deploy.sh <operator> <profile> [--components <csv>|--all] [flags]
#
# Examples:
#   ./deploy.sh btcl  dev   --all
#   ./deploy.sh btcl  dev   --components odoo,seed-data,erp-api
#   ./deploy.sh link3 prod  --components odoo --seed
#   ./deploy.sh btcl  dev   --components erp-api --skip-build
#   ./deploy.sh btcl  dev   --all --dry-run
#   ./deploy.sh btcl  dev   --all --env-only         (env render only — see deploy_env.sh)
#   ./deploy.sh btcl  prod  --all --bundle /tmp/btcl-prod.tgz  (env bundle for prod ship)
#
# Flags:
#   --components <csv>  Comma-separated component list (overrides components_default)
#   --all               Use components_default from the profile
#   --skip-build        Reuse existing local artifacts; skip mvn/npm/etc build
#   --seed              Force seed-data sub-step before odoo deploy
#   --local             Skip SSH; run commands on this machine (DB still over network)
#   --no-launch         Render configs but don't start services (odoo, plane)
#   --env-only          Stronger than --no-launch: stop after rendering env/config
#                       files, skip seed-data probe, skip docker/start entirely.
#                       Same as running deploy_env.sh.
#   --bundle <path>     Implies --env-only. After render, pack all rendered files
#                       for this profile into tar.gz at <path>. Use for shipping
#                       configs to a remote production server.
#   --dry-run           Print remote/build commands without running them
#   --help              Show this help

set -euo pipefail

usage() {
    sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
}

# ── parse positional args ──
OPERATOR="${1:-}"; shift || true
PROFILE="${1:-}";  shift || true

if [ -z "$OPERATOR" ] || [ -z "$PROFILE" ] || [ "$OPERATOR" = "--help" ] || [ "$PROFILE" = "--help" ]; then
    usage
    exit 1
fi

# ── parse flags ──
COMPONENTS=""
USE_ALL=false
SKIP_BUILD=false
FORCE_SEED=false
LOCAL_MODE=false
NO_LAUNCH=false
ENV_ONLY=false
BUNDLE_PATH=""
DRY_RUN=false

while [ $# -gt 0 ]; do
    case "$1" in
        --components)   COMPONENTS="$2"; shift 2 ;;
        --all)          USE_ALL=true; shift ;;
        --skip-build)   SKIP_BUILD=true; shift ;;
        --seed)         FORCE_SEED=true; shift ;;
        --local)        LOCAL_MODE=true; shift ;;
        --no-launch)    NO_LAUNCH=true; shift ;;
        --env-only)     ENV_ONLY=true; shift ;;
        --bundle)       BUNDLE_PATH="$2"; ENV_ONLY=true; shift 2 ;;
        --dry-run)      DRY_RUN=true; shift ;;
        --help|-h)      usage; exit 0 ;;
        *)              echo "ERROR: unknown flag: $1" >&2; usage; exit 1 ;;
    esac
done

if [ -z "$COMPONENTS" ] && [ "$USE_ALL" = "false" ]; then
    echo "ERROR: pass --all or --components <csv>" >&2
    exit 1
fi

# ── paths ──
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"   # orchestrix-v2 root
CONFIG_FILE="$SCRIPT_DIR/operators/${OPERATOR}/${PROFILE}.yml"
README_FILE="$SCRIPT_DIR/README.md"

# Reuse routesphere's ssh inventory (per project decision — single source of truth).
SSH_INVENTORY_DIR="${ORCHESTRIX_SSH_INVENTORY:-/home/mustafa/telcobright-projects/routesphere/routesphere-core/tools/ssh-automation/servers}"

# ── source helpers ──
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/load-yaml.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/ssh.sh"

# ── validate config file ──
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: profile yaml not found: $CONFIG_FILE" >&2
    echo "" >&2
    if [ ! -d "$SCRIPT_DIR/operators/$OPERATOR" ]; then
        echo "Operator '$OPERATOR' has no directory. Available operators:" >&2
        ls -1d "$SCRIPT_DIR/operators"/*/ 2>/dev/null | xargs -n1 -r basename | sed 's/^/  /' >&2
    else
        echo "Available profiles for $OPERATOR:" >&2
        list_yaml_profiles "$SCRIPT_DIR/operators/$OPERATOR" | sed 's/^/  /' >&2
    fi
    exit 1
fi

# ── load profile keys into env (prefix CONF_) ──
load_yaml_into_env "$CONFIG_FILE" CONF_

DESCRIPTION="${CONF_DESCRIPTION:-}"

# ── resolve ssh inventory (skipped in --local mode) ──
if [ "$LOCAL_MODE" = "true" ]; then
    SSH_HOST="localhost"
    SSH_PORT="22"
    SSH_USER="$USER"
    SSH_KEY=""
    SSH_TARGET="local"
    KEY_NAME="(local)"
    PRIVATE_IP=""
    INVENTORY_OPERATOR="(skipped — --local)"
    SERVER_NAME="(skipped — --local)"
else
    INVENTORY_OPERATOR="${CONF_INVENTORY_OPERATOR:-}"
    SERVER_NAME="${CONF_SERVER:-}"

    if [ -z "$INVENTORY_OPERATOR" ] || [ -z "$SERVER_NAME" ]; then
        echo "ERROR: $CONFIG_FILE must define inventory_operator and server (or pass --local)" >&2
        exit 1
    fi

    HOST_FILE="$SSH_INVENTORY_DIR/$INVENTORY_OPERATOR/hosts/$SERVER_NAME"
    KEYS_DIR="$SSH_INVENTORY_DIR/$INVENTORY_OPERATOR/keys"

    if [ ! -f "$HOST_FILE" ]; then
        echo "ERROR: host file not found: $HOST_FILE" >&2
        echo "Available servers for inventory_operator '$INVENTORY_OPERATOR':" >&2
        ls -1 "$SSH_INVENTORY_DIR/$INVENTORY_OPERATOR/hosts/" 2>/dev/null | sed 's/^/  /' >&2 || true
        exit 1
    fi

    SSH_HOST="$(grep -E '^host='       "$HOST_FILE" | cut -d= -f2)"
    SSH_PORT="$(grep -E '^port='       "$HOST_FILE" | cut -d= -f2)"
    SSH_USER="$(grep -E '^user='       "$HOST_FILE" | cut -d= -f2)"
    KEY_NAME="$(grep -E '^key='        "$HOST_FILE" | cut -d= -f2)"
    PRIVATE_IP="$(grep -E '^private_ip=' "$HOST_FILE" | cut -d= -f2 || true)"

    SSH_KEY="$KEYS_DIR/$KEY_NAME"
    SSH_TARGET="${SSH_USER}@${SSH_HOST}"

    if [ ! -f "$SSH_KEY" ]; then
        echo "ERROR: ssh key not found: $SSH_KEY" >&2
        exit 1
    fi
fi

export SSH_HOST SSH_PORT SSH_USER SSH_KEY SSH_TARGET DRY_RUN
export DEPLOY_LOCAL="$LOCAL_MODE"
export DEPLOY_NO_LAUNCH="$NO_LAUNCH"
export DEPLOY_ENV_ONLY="$ENV_ONLY"

# ── resolve component list ──
if [ "$USE_ALL" = "true" ]; then
    COMPONENTS="${CONF_COMPONENTS_DEFAULT:-}"
    if [ -z "$COMPONENTS" ]; then
        echo "ERROR: --all but $CONFIG_FILE does not define components_default" >&2
        exit 1
    fi
fi

IFS=',' read -ra COMPONENT_LIST <<< "$COMPONENTS"

# ── banner ──
cat <<EOF
========================================================
  Orchestrix-v2 Deploy
========================================================
Operator:      $OPERATOR
Profile:       $PROFILE
Config:        $CONFIG_FILE
Description:   ${DESCRIPTION:-(none)}
Workflow doc:  $([ -f "$README_FILE" ] && echo "$README_FILE" || echo "(missing: $README_FILE)")
SSH target:    ${SSH_TARGET}:${SSH_PORT}  (key: $KEY_NAME)
Private IP:    ${PRIVATE_IP:-(none)}
Components:    ${COMPONENT_LIST[*]}
Skip build:    $SKIP_BUILD
Force seed:    $FORCE_SEED
Local mode:    $LOCAL_MODE
No-launch:     $NO_LAUNCH
Env-only:      $ENV_ONLY
Bundle:        ${BUNDLE_PATH:-(none)}
Dry-run:       $DRY_RUN
========================================================
EOF

# ── orchestrate ──
export DEPLOY_OPERATOR="$OPERATOR"
export DEPLOY_PROFILE="$PROFILE"
export DEPLOY_BASE_DIR="$BASE_DIR"
export DEPLOY_SCRIPT_DIR="$SCRIPT_DIR"
export DEPLOY_SKIP_BUILD="$SKIP_BUILD"
export DEPLOY_FORCE_SEED="$FORCE_SEED"

for comp in "${COMPONENT_LIST[@]}"; do
    comp="$(echo "$comp" | tr -d '[:space:]')"
    [ -z "$comp" ] && continue

    handler="$SCRIPT_DIR/components/${comp}.sh"
    if [ ! -f "$handler" ]; then
        echo "ERROR: no handler for component '$comp' (expected $handler)" >&2
        exit 1
    fi

    fn="deploy_$(echo "$comp" | tr '-' '_')"

    echo ""
    echo "── Component: $comp ──────────────────────────────"
    # shellcheck disable=SC1090
    . "$handler"

    if ! declare -f "$fn" >/dev/null; then
        echo "ERROR: $handler does not define function $fn" >&2
        exit 1
    fi

    "$fn"
    echo "── $comp: done ──"
done

echo ""
echo "All components complete."

# ── optional: pack a bundle of rendered files for prod ship ──
if [ -n "$BUNDLE_PATH" ]; then
    echo ""
    echo "── Bundling rendered env files → $BUNDLE_PATH ──"
    bundle_root="$BASE_DIR"
    # Collect render targets per component (env files only; no built artifacts)
    bundle_paths=()
    [ -f "$bundle_root/odoo-backend-19/profiles/${OPERATOR}-${PROFILE}/odoo.conf" ] && \
        bundle_paths+=("odoo-backend-19/profiles/${OPERATOR}-${PROFILE}/odoo.conf")
    if [ -d "$bundle_root/odoo-backend-19/plane/profiles/${OPERATOR}-${PROFILE}" ]; then
        bundle_paths+=("odoo-backend-19/plane/profiles/${OPERATOR}-${PROFILE}")
    fi
    if [ ${#bundle_paths[@]} -eq 0 ]; then
        echo "  ! Nothing to bundle (no rendered files for ${OPERATOR}-${PROFILE})" >&2
        exit 1
    fi
    mkdir -p "$(dirname "$BUNDLE_PATH")"
    ( cd "$bundle_root" && tar -czf "$BUNDLE_PATH" "${bundle_paths[@]}" )
    echo "  ✓ Bundle written: $BUNDLE_PATH"
    echo "    Contents:"
    tar -tzf "$BUNDLE_PATH" | sed 's/^/      /'
fi
