# Meeting integration — change journal

Working branch: `feature/meeting-integration`
Base: `main`

**Goal:** finish the meeting feature in the CRM (`/crm/meetings/*`) rather
than maintain a parallel standalone project. Port lessons from the
standalone at `/home/telcobright/livekit-meet` (recording, share link,
idempotent stop, role-based UX) into this repo while respecting:

- Tenant model (`/:tenant/crm/*`)
- Keycloak auth
- EspoCRM for persistence
- APISIX → Spring Boot (`platform-api`) → EspoCRM chain

## Revert strategy

Whole feature: `git switch main && git branch -D feature/meeting-integration`

Individual steps: each phase is a separate commit on this branch — revert
any with `git revert <sha>` or drop commits with `git rebase -i main`.

Nothing outside this branch is touched. The standalone `/home/telcobright/livekit-meet`
is untouched.

## Running EspoCRM schema changes (manual, outside this repo)

EspoCRM custom metadata lives in the deployed EspoCRM install's
`custom/Espo/Custom/Resources/metadata/` — not in this repo. Any new
custom entities / fields I add here will be accompanied by:

1. JSON metadata files in `config/espocrm-custom/` (this repo, for
   deployment)
2. An "Apply" section below with exact steps

---

## Change log

*Entries added chronologically, newest at bottom. Each change lists:
intent, files touched, how to verify, how to revert.*

### 1. Branch + journal created

- **Intent**: Baseline for all subsequent changes; central place to review/revert per step.
- **Files**:
  - `CHANGES-meeting-integration.md` (this file, new)
- **Verify**: `git log --oneline main..feature/meeting-integration` shows the commits.
- **Revert**: `git switch main && git branch -D feature/meeting-integration` drops everything.

### 2. EspoCRM custom metadata (meeting extensions + new entities)

- **Intent**: Define schema for recording + magic-link persistence, extend
  `Meeting` with LK-specific fields, all drop-in deployable under
  EspoCRM's standard `Custom/Resources/metadata/` layout.
- **Files** (all under `config/espocrm-custom/`, new):
  - `README.md` — deploy instructions + revert
  - `metadata/entityDefs/Meeting.json` — adds fields: `roomName` (readonly
    varchar), `recordingEnabled` (bool), `allowSelfRegister` (bool); adds
    `recordings` and `magicLinks` hasMany links
  - `metadata/entityDefs/MeetingRecording.json` — new entity with
    egressId / status / filePath / fileSizeBytes / durationMs /
    errorText / startedAt / endedAt / parentMeeting link / startedBy
    link + audit fields
  - `metadata/entityDefs/MeetingMagicLink.json` — new entity with token /
    invitedEmail / invitedName / expiresAt / usedAt / linkType (PERSONAL|
    SHARE) / parentMeeting link
  - `metadata/scopes/MeetingRecording.json` — entity scope config
  - `metadata/scopes/MeetingMagicLink.json` — entity scope config
  - `i18n/en_US/Global.json` — human labels
- **Apply** (manual, per tenant's EspoCRM install): see
  `config/espocrm-custom/README.md`. Copy files into the Espo install's
  `custom/Espo/Custom/Resources/{metadata,i18n}`, run `clear_cache.php`
  + `rebuild.php`.
- **Verify**: after rebuild, `GET /api/v1/Meeting` returns new fields in
  the response schema; `GET /api/v1/MeetingRecording` returns 200 (empty
  list); the two entities appear in Admin → Entity Manager.
- **Revert**: remove the copied files, rerun `rebuild.php`. Files in this
  repo can be reverted per git.
