#!/usr/bin/env bash
#
# deploy_env.sh — pure env/config rendering for a tenant profile.
#
# Wraps deploy.sh with --env-only so the caller doesn't have to think about it.
# All other flags pass through.
#
# Use cases:
#   1. Local dev setup — render env files into in-tree paths so the local
#      Odoo / Plane API / Plane web pick them up:
#
#        ./deploy_env.sh btcl dev --all
#
#   2. Production server bundle — package rendered configs into a tar.gz
#      for shipping to a remote box:
#
#        ./deploy_env.sh btcl prod --all --bundle /tmp/btcl-prod-env.tgz
#        scp /tmp/btcl-prod-env.tgz user@prod-host:/opt/orchestrix/
#        ssh user@prod-host 'cd /opt/orchestrix && tar xzf btcl-prod-env.tgz'
#
#   3. Per-component env render (useful when iterating on one template):
#
#        ./deploy_env.sh btcl dev --components plane
#
# Source of truth: tools/deploy/operators/<operator>/<profile>.yml
# Templates:       tools/deploy/templates/*.tmpl

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
exec "$SCRIPT_DIR/deploy.sh" "$@" --env-only
