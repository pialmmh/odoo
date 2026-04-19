# LiveKit Meeting Integration — Progress

**Last updated:** 2026-04-20
**Status:** Token minting live end-to-end; room control + recording pending.

---

## Goals

1. Give the CRM a first-party video meeting surface — no external Jitsi/Zoom
   embed, no separate login. A user clicks "Join" on a Meeting record and
   is in the room.
2. Support **admin intercept modes** (silent / coach / barge / takeover) for
   supervisor oversight of agent-led meetings.
3. Keep the browser secret-free: API secret stays on Spring Boot; browser
   only receives short-lived JWTs.
4. Room lifecycle (end / mute / remove / recording start-stop) controlled
   from the CRM, not from LiveKit's own admin surfaces.
5. Reuse the existing `Meeting` Espo entity for scheduling + attendee
   records — LiveKit is *session transport*, Espo is *source of truth*.

---

## Source-of-truth references

| Topic                        | File                                                                     |
|------------------------------|--------------------------------------------------------------------------|
| LiveKit deployment details   | `routesphere/webrtc/docs/livekit-installation-info.md`                   |
| Ops-side current state       | `/tmp/shared-instruction/livekit-btcl-current-state.md`                  |
| Frontend meeting components  | `orchestrix-v2/ui/src/pages/crm/meetings/`                               |
| Backend meeting endpoints    | `orchestrix-v2/api/src/main/java/com/telcobright/api/controller/MeetingsController.java` |
| Token minting service        | `orchestrix-v2/api/src/main/java/com/telcobright/api/livekit/LiveKitTokenService.java` |

---

## Architecture (current)

```
Browser (React)
   │  logged-in w/ Keycloak JWT
   │  POST /api/crm/meetings/{id}/token  { role, identity }
   ▼
APISIX  ──(validates Keycloak JWT)──►  Spring Boot (platform-api :8180)
                                         │
                                         ├── /api/crm/meetings/{id}/token   → LiveKitTokenService (HS256 JWT)
                                         ├── /api/crm/meetings/{id}/control → stub (LiveKit RoomService — pending)
                                         └── /api/crm/**                    → EspoProxyController → Espo REST
                                                                              (Meeting entity, attendees, etc.)

Browser  ──wss://hcc.btcliptelephony.gov.bd/btcl/livekit──►  LiveKit SFU (lxc on sbc4)
         (using the minted JWT)
```

Two channels from the browser: HTTP to platform-api for everything
stateful (schedule, attendees, mint, control), WSS direct to the SFU for
media.

---

## Feature inventory

| Feature                                      | Where                                    | Status       |
|----------------------------------------------|------------------------------------------|--------------|
| **Meeting CRUD** (list/create/edit/view)     | `meetings/*.jsx` → Espo `/Meeting`       | ✅ shipped    |
| **Meetings dashboard** (lifecycle stages)    | `MeetingsDashboard.jsx` + `lifecycle.js` | ✅ UI only    |
| **Meeting control page** (admin actions)     | `MeetingControl.jsx`                     | ✅ UI only    |
| **Admin rooms list**                         | `MeetingRoomsAdmin.jsx`                  | ✅ UI only    |
| **Zoom-style meeting room**                  | `MeetingRoom.jsx` + `lkSession.js`       | ✅ wired      |
| **Demo Room shortcut (sidebar)**             | `Sidebar.jsx` → `meetings/demo/room`     | ✅            |
| **Intercept dialog + 4 modes**               | `InterceptDialog.jsx`                    | ✅ UI only    |
| **Context panel (parent entity + log note)** | `ContextPanel.jsx`                       | ✅            |
| **Entity header card across entities**       | `EntityHeaderCard.jsx`                   | ✅            |
| **LiveKit token endpoint**                   | `MeetingsController#issueToken`          | ✅ **done**   |
| **Role → grant mapping** (6 roles)           | `LiveKitTokenService#grantsForRole`      | ✅ done       |
| **LiveKit control endpoint**                 | `MeetingsController#control`             | 🟡 stub       |
| **Recording start/stop (Egress)**            | —                                        | ❌ not started |
| **Admin-coach host-only audio**              | —                                        | ❌ needs agent |
| **Token refresh / long-meeting TTL**         | —                                        | ❌ not started |
| **Waiting room / admit flow**                | —                                        | ❌ not started |
| **In-meeting chat (LiveKit data channel)**   | `MeetingRoom.jsx` side panel (shell only)| 🟡 UI stub    |
| **Hand-raise / reactions over data channel** | `MeetingRoom.jsx` buttons (shell only)   | 🟡 UI stub    |

Legend: ✅ working — 🟡 scaffolded, no server action — ❌ not yet built.

---

## Role → LiveKit grants (authoritative)

| Role             | canPublish | canSubscribe | hidden | roomAdmin | Notes                                               |
|------------------|:----------:|:------------:|:------:|:---------:|-----------------------------------------------------|
| `PUBLISHER`      | ✓          | ✓            | ✗      | ✗         | Default attendee.                                   |
| `SUBSCRIBER`     | ✗          | ✓            | ✗      | ✗         | View-only attendee.                                 |
| `ADMIN_SILENT`   | ✗          | ✓            | ✓      | ✗         | Invisible monitor. No audio/video published.        |
| `ADMIN_COACH`    | ✓          | ✓            | ✓      | ✗         | Publishes audio, hidden. **Host-only audio not enforced by grants — needs companion agent.** |
| `ADMIN_BARGE`    | ✓          | ✓            | ✗      | ✗         | Joins as visible participant.                       |
| `ADMIN_TAKEOVER` | ✓          | ✓            | ✗      | ✓         | Becomes room admin. Can kick/mute/end.              |

---

## Integration status — what works today

- ✅ `POST /api/crm/meetings/{id}/token` mints a LiveKit-spec HS256 JWT
  signed with `APIbtclpilot` / secret. Returns `{ token, wsUrl, room,
  identity, expiresAtMs }`.
- ✅ Room name derived from meeting id: `meeting-<id>`.
- ✅ Identity falls back to JWT `preferred_username` from Keycloak when
  browser doesn't send one.
- ✅ `LiveKitRoom` / `lkSession.joinSession` uses the real ws-url and
  connects to the production-path SFU.
- ✅ Backend pointed at `http://btcl.localhost:7080` (Apache freed, Espo
  back on 7080).
- ✅ Security: Spring requires a valid Keycloak JWT on `/api/crm/**`;
  unauthenticated → 401.

---

## Integration status — what's pending

### 1. Control endpoint (muting / removing / ending / admit)

The stub at `MeetingsController#control` returns 202 and echoes the
action. To make it real:

- Add `livekit-server-sdk` (or implement the Twirp RPCs directly — the
  service exposes them at the same wss URL over HTTPS).
- Map UI actions to LiveKit RPCs:
  - `END`          → `DeleteRoom`
  - `MUTE`         → `MutePublishedTrack` (per-participant)
  - `REMOVE`       → `RemoveParticipant`
  - `ADMIT`        → set participant metadata (`"admitted": true`)
  - `UPDATE_ROLE`  → `UpdateParticipant` (change permissions mid-call)

### 2. Recording (Egress)

Egress is already deployed and capped at `max_cost: 4`. Pending
**storage decision**:

- File on LXC disk + bind-mount + nginx serve — lowest setup, dev-only.
- S3/MinIO — right for prod, needs bucket + IAM. Likely the path we'll
  take.

Once decided:
- Add `START_RECORDING` / `STOP_RECORDING` actions in the control
  endpoint.
- Call `EgressClient.startRoomCompositeEgress(roomName, output)`.
- Persist `egressId` + recording URL on the Espo Meeting record (custom
  field: `recordingEgressId`, `recordingUrl`).

### 3. Coach mode true host-only audio

Requires a LiveKit agent subscribed to the admin's mic track, which
re-publishes it only to the designated host participant. Either:

- Build a small Node/Python agent using the LiveKit agents framework, or
- Use track subscription permissions (`participant.setTrackSubscriptionPermissions`)
  from the backend — needs checking against current SFU version.

### 4. Token refresh for long meetings

TTL is currently 2h (configurable via `livekit.token-ttl-seconds`).
For longer sessions, add a refresh endpoint that the client calls
before expiry (use `useConnectionState` + a timer in `MeetingRoom`).

### 5. Waiting room / admit flow

Combine:
- On token mint, issue `SUBSCRIBER` + hidden=true for un-admitted guests.
- Store "admitted" state as participant metadata.
- Host UI sees pending participants via a LiveKit event stream (the
  existing `useParticipants` hook + a metadata filter).

### 6. Data-channel chat / reactions / hand-raise

`MeetingRoom.jsx` has UI buttons wired to local state only. To make
them collaborative:
- Use LiveKit's `room.localParticipant.publishData(payload, { reliable: true })`.
- Subscribe via `RoomEvent.DataReceived` in `lkSession.joinSession`.
- Define a small message schema: `{ kind: 'chat'|'reaction'|'hand', … }`.

### 7. Egress / recording UI

When recording is wired, add:
- Recording indicator (red dot) in the top-left banner of `MeetingRoom`.
- "Download recording" link on the Meeting detail page.

---

## Resume checklist

When picking this up again:

1. Re-read §2 of `routesphere/webrtc/docs/livekit-installation-info.md`
   to confirm keys/URLs haven't rotated.
2. Smoke-test the token mint end-to-end — log into the React UI, click
   `Sidebar → Demo Room`, verify the video tile appears and
   participant count increments with a second browser tab.
3. Decide recording storage (LXC-file vs S3) — unblocks §2 above.
4. Then pick one of: control endpoint, coach agent, or recording as the
   next slice.

---

## Config reminders

- `livekit.enabled=true` gates the controller (bean won't register
  otherwise).
- `integrations.crm.base-url` must include the tenant slug as a
  subdomain (`http://btcl.localhost:7080`), else `bootstrap.php` resolves
  the request to the `master` tenant DB which has no entity data.
- `enable_api_permission.sh` (espocrm deploy post-install) prints
  `CRM_AUTH_B64` — that's what feeds `integrations.crm.admin-user` /
  `admin-password`.
