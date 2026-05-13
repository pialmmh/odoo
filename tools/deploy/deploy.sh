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
# │ Per-operator values live in operators/<operator>.conf — no separate  │
# │ per-operator README; the workflow guide is generic.                  │
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
#
# Flags:
#   --components <csv>  Comma-separated component list (overrides components_default)
#   --all               Use components_default from the profile
#   --skip-build        Reuse existing local artifacts; skip mvn/npm/etc build
#   --seed              Force seed-data sub-step before odoo deploy
#   --local             Skip SSH; run commands on this machine (DB still over network)
#   --no-launch         Render configs but don't start services (odoo, plane)
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
DRY_RUN=false

while [ $# -gt 0 ]; do
    case "$1" in
        --components)   COMPONENTS="$2"; shift 2 ;;
        --all)          USE_ALL=true; shift ;;
        --skip-build)   SKIP_BUILD=true; shift ;;
        --seed)         FORCE_SEED=true; shift ;;
        --local)        LOCAL_MODE=true; shift ;;
        --no-launch)    NO_LAUNCH=true; shift ;;
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
CONFIG_FILE="$SCRIPT_DIR/operators/${OPERATOR}.conf"
README_FILE="$SCRIPT_DIR/README.md"

# Reuse routesphere's ssh inventory (per project decision — single source of truth).
SSH_INVENTORY_DIR="${ORCHESTRIX_SSH_INVENTORY:-/home/mustafa/telcobright-projects/routesphere/routesphere-core/tools/ssh-automation/servers}"

# ── source helpers ──
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/parse-conf.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/ssh.sh"

# ── validate conf + profile ──
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: operator conf not found: $CONFIG_FILE" >&2
    echo "" >&2
    echo "Available operators:" >&2
    ls -1 "$SCRIPT_DIR/operators"/*.conf 2>/dev/null | xargs -n1 basename | sed 's/\.conf$//' | sed 's/^/  /' >&2
    exit 1
fi

if ! list_sections "$CONFIG_FILE" | grep -qx "$PROFILE"; then
    echo "ERROR: profile '$PROFILE' not in $CONFIG_FILE" >&2
    echo "Available profiles:" >&2
    list_sections "$CONFIG_FILE" | sed 's/^/  /' >&2
    exit 1
fi

DESCRIPTION="$(parse_conf "$CONFIG_FILE" "$PROFILE" description)"

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
    INVENTORY_OPERATOR="$(parse_conf "$CONFIG_FILE" "$PROFILE" inventory_operator)"
    SERVER_NAME="$(parse_conf "$CONFIG_FILE" "$PROFILE" server)"

    if [ -z "$INVENTORY_OPERATOR" ] || [ -z "$SERVER_NAME" ]; then
        echo "ERROR: [$PROFILE] must define inventory_operator and server (or pass --local)" >&2
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

# ── load profile keys into env (prefix CONF_) ──
load_section_into_env "$CONFIG_FILE" "$PROFILE" CONF_

# ── resolve component list ──
if [ "$USE_ALL" = "true" ]; then
    COMPONENTS="${CONF_COMPONENTS_DEFAULT:-}"
    if [ -z "$COMPONENTS" ]; then
        echo "ERROR: --all but [$PROFILE] does not define components_default" >&2
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
Description:   ${DESCRIPTION:-(none)}
Workflow doc:  $([ -f "$README_FILE" ] && echo "$README_FILE" || echo "(missing: $README_FILE)")
SSH target:    ${SSH_TARGET}:${SSH_PORT}  (key: $KEY_NAME)
Private IP:    ${PRIVATE_IP:-(none)}
Components:    ${COMPONENT_LIST[*]}
Skip build:    $SKIP_BUILD
Force seed:    $FORCE_SEED
Local mode:    $LOCAL_MODE
No-launch:     $NO_LAUNCH
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
