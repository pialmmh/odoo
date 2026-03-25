# Fix Pause/Resume Subscription API

**Completed:** 2026-03-25 — Changed killbill.js to GET subscription → extract bundleId → PUT /bundles/{bundleId}/pause|resume.

## What
UI calls PUT /subscriptions/{id}/pause → returns 404. Correct API is PUT /bundles/{bundleId}/pause.

## Fix needed in ui/src/services/killbill.js
- pauseSubscription: first get bundleId from subscription, then PUT /bundles/{bundleId}/pause
- resumeSubscription: same pattern with /resume
