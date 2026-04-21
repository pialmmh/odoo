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

### 3. platform-api: LiveKit EgressService + config additions

- **Intent**: Spring-side client to LiveKit egress API, using the same
  jjwt HS256 pattern as `LiveKitTokenService`. No new Maven deps.
- **Files**:
  - `api/src/main/java/com/telcobright/api/livekit/EgressService.java`
    (new) — `StartRoomCompositeEgress`, `StopEgress`, `ListEgress` over
    Twirp/JSON.
  - `api/src/main/java/com/telcobright/api/config/LiveKitProperties.java`
    (modified) — adds `httpUrl`, `recordingsDir`, `recordingsDirEgress`,
    `publicBaseUrl`.
- **Config** (to be added to each `application-*.yml` under `livekit:`):
  ```
  livekit:
    http-url: http://<livekit-host>:7880
    recordings-dir: /var/lib/livekit-meet/recordings
    recordings-dir-egress: /out
    public-base-url: https://hcc.btcliptelephony.gov.bd:30002
  ```
- **Verify**: `GET {httpUrl}/` should 200 (LiveKit health). Spring-boot
  build with `livekit.enabled=true` wires the bean.
- **Revert**: `git revert` this commit.

### 4. platform-api: RecordingService + RecordingController + EspoEntities helper

- **Intent**: Endpoints for start/stop/list recordings and streaming the
  MP4 file. Persists via EspoCRM's `MeetingRecording` custom entity.
- **Files** (under `api/src/main/java/com/telcobright/api/meetings/`, new):
  - `MeetingRoomNaming.java` — canonical `meeting-<tenant>-<id>` naming
  - `EspoEntities.java` — thin wrapper over `EspoClient` for get/list/
    create/update/delete on Espo custom entities
  - `RecordingService.java` — orchestrates EgressService + EspoEntities;
    per-tenant recordings path; idempotent stop; status refresh via
    `ListEgress`; file-size fill-in from local stat when egress completes
  - `RecordingController.java` — endpoints:
    `POST /api/crm/meetings/:id/recording/start`,
    `POST /api/crm/meetings/:id/recording/stop`,
    `GET  /api/crm/meetings/:id/recordings`,
    `GET  /api/crm/recordings/:id/file` (MP4 stream)
- **Tenant scope**: LiveKit room name and recording path both carry the
  tenant slug read from `X-Tenant` header.
- **Verify**: with Espo metadata deployed and `livekit.enabled=true`,
  calling start/stop round-trips via egress and persists via Espo.
- **Revert**: `git revert` this commit.

### 5. platform-api: MagicLinkService + InviteController + PublicJoinController + SecurityConfig

- **Intent**: Email-bound invites (PERSONAL) + reusable share links
  (SHARE) persisted in EspoCRM `MeetingMagicLink`. Public resolve/join
  endpoints for guests (no Keycloak).
- **Files** (new under `api/src/main/java/com/telcobright/api/meetings/`):
  - `MagicLinkService.java`
  - `InviteController.java` — authed at `/api/crm/meetings/:id/invites*`
  - `PublicJoinController.java` — public at `/api/public/meeting/:tenant/{magic,join}/:token`
- **Modified**:
  - `api/src/main/java/com/telcobright/api/config/SecurityConfig.java`
    — added `.requestMatchers("/api/public/meeting/**").permitAll()`
      above the authenticated matchers, so guests can reach magic-link
      endpoints without Keycloak.
- **Guest join flow**:
  1. Host shares `{publicBaseUrl}/{tenant}/join/{token}`
  2. Guest opens URL → frontend calls `GET /api/public/meeting/{tenant}/magic/{token}` for invite info
  3. Guest enters display name, frontend calls `POST /api/public/meeting/{tenant}/join/{token}` with `{displayName}`
  4. Backend marks usedAt, mints PUBLISHER LK JWT, returns to browser
- **Revert**: `git revert` this commit. Note: the SecurityConfig change
  is included in the same commit — reverting will also restore the
  pre-existing auth pattern.

### 6. platform-api: RoomServiceClient + moderation in /control

- **Intent**: Implement the previously-stubbed `/control` endpoint using
  LiveKit's RoomService Twirp API.
- **Files**:
  - `api/src/main/java/com/telcobright/api/livekit/RoomServiceClient.java`
    (new) — `MutePublishedTrack`, `UpdateParticipant` (disable publish),
    `RemoveParticipant`, `ListParticipants`.
  - `api/src/main/java/com/telcobright/api/controller/MeetingsController.java`
    (modified) — wire actions: MUTE / UNMUTE / REMOVE / KICK / BLOCK /
    LIST_PARTICIPANTS / END (END returns 501 for now). Room name is
    tenant-scoped using `MeetingRoomNaming`.
- **BLOCK caveat**: currently does a REMOVE only; persistent block list
  deferred (needs a future `BlockedUser` custom entity + token-mint
  check). Response includes a `note` explaining this.
- **Revert**: `git revert` this commit.
