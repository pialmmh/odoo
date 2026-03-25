# Fix APISIX Port References in Docs

**Completed:** 2026-03-25 — Updated all remaining 9080→9081 refs in docs.

**Task:** #1
**Priority:** Low (cosmetic)

## What
APISIX was moved from port 9080 → 9081 (due to promtail conflict). Code references were updated but doc files still reference 9080.

## Files to update
- docs/ui-links-and-credentials.md (lines referencing 9080)
- docs/infra/infra-progress-2026-03-23.md (architecture diagram, port table)

## Already fixed
- ui/vite.config.js (→ 9081)
- ui/tests/smoke.spec.js (→ 9081)
- launch-all.sh (→ 9081)
- apisix/setup-routes.sh (→ 9081)
- /usr/local/apisix/conf/config.yaml (node_listen: 9081)
