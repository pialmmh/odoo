# Fix Pause/Resume Subscription API

## What
UI calls PUT /subscriptions/{id}/pause → returns 404. Correct API is PUT /bundles/{bundleId}/pause.

## Fix needed in ui/src/services/killbill.js
- pauseSubscription: first get bundleId from subscription, then PUT /bundles/{bundleId}/pause
- resumeSubscription: same pattern with /resume
