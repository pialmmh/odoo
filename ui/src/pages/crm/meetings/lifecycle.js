// ── Meeting lifecycle model ─────────────────────────────────────────────
// Native EspoCRM status is the coarse Planned/Held/Not Held enum. This
// module derives a richer lifecycleStage used by the dashboards.
// When the LiveKit + control-plane backend lands, replace `deriveStage()`
// with the server-side value and make `dispatchAction()` hit real endpoints.

export const STAGES = {
  SCHEDULED:     'Scheduled',
  LOBBY_OPEN:    'Lobby Open',
  LIVE:          'Live',
  ON_HOLD:       'On Hold',
  ENDED:         'Ended',
  ADMIN_ENDED:   'Admin Ended',
  EXPIRED:       'Expired',
  NO_SHOW:       'No Show',
  CANCELLED:     'Cancelled',
};

export const STAGE_COLOR = {
  [STAGES.SCHEDULED]:   'default',
  [STAGES.LOBBY_OPEN]:  'info',
  [STAGES.LIVE]:        'success',
  [STAGES.ON_HOLD]:     'warning',
  [STAGES.ENDED]:       'primary',
  [STAGES.ADMIN_ENDED]: 'error',
  [STAGES.EXPIRED]:     'default',
  [STAGES.NO_SHOW]:     'default',
  [STAGES.CANCELLED]:   'default',
};

// Terminal stages cannot transition.
export const TERMINAL = new Set([
  STAGES.ENDED, STAGES.ADMIN_ENDED, STAGES.EXPIRED,
  STAGES.NO_SHOW, STAGES.CANCELLED,
]);

// Minutes before dateStart when the lobby opens.
const LOBBY_WINDOW_MIN = 15;
// Minutes after dateStart with nobody joined → No Show.
const NO_SHOW_GRACE_MIN = 10;

function parseDT(s) {
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
  return isNaN(d) ? null : d;
}

// Best-effort derivation from the Meeting row fields available today.
// Once we add roomStartedAt/roomEndedAt/joinCount columns to our fork,
// this will be much more accurate.
export function deriveStage(m, now = new Date()) {
  if (!m) return STAGES.SCHEDULED;
  const status = m.status;
  if (status === 'Not Held' && m.cancelledAt) return STAGES.CANCELLED;
  if (status === 'Not Held')                  return STAGES.EXPIRED;
  if (status === 'Held' && m.adminEnded)      return STAGES.ADMIN_ENDED;
  if (status === 'Held')                      return STAGES.ENDED;
  const start = parseDT(m.dateStart);
  const end   = parseDT(m.dateEnd);
  if (!start || !end) return STAGES.SCHEDULED;
  const live = m.roomStartedAt && !m.roomEndedAt;
  if (live) return STAGES.LIVE;
  const msPre = (start - now) / 60000;
  if (msPre <= LOBBY_WINDOW_MIN && msPre > 0)        return STAGES.LOBBY_OPEN;
  if (msPre <= 0 && (now - start) / 60000 < NO_SHOW_GRACE_MIN) return STAGES.LOBBY_OPEN;
  if (now > end)                                      return STAGES.EXPIRED;
  return STAGES.SCHEDULED;
}

// Actions are enumerated — UI buttons reference these by key so we have one
// place to plug real endpoints when the backend is ready.
export const ACTIONS = {
  START:          'start',            // → Live
  END:            'end',              // → Ended
  ADMIN_END:      'adminEnd',         // → Admin Ended
  EXTEND:         'extend',           // adds minutes to dateEnd
  EXPIRE:         'expire',           // → Expired (manual)
  CANCEL:         'cancel',           // → Cancelled
  LOCK:           'lock',             // disallow new joins
  UNLOCK:         'unlock',
  MUTE_ALL:       'muteAll',
  WAITING_ROOM:   'toggleWaitingRoom',
  MUTE_ON_ENTRY:  'toggleMuteOnEntry',
  RECORD_START:   'recordStart',
  RECORD_STOP:    'recordStop',
  TRANSCRIBE:     'toggleTranscription',
  TRANSFER_HOST:  'transferHost',
  RESEND_INVITES: 'resendInvites',
  COPY_LINK:      'copyLink',
  // Participant-scoped
  P_MUTE:         'participantMute',
  P_UNMUTE:       'participantUnmute',
  P_KICK:         'participantKick',
  P_BAN:          'participantBan',
  P_PROMOTE:      'participantPromote',
  P_WAITING:      'participantToWaiting',
};

// Central dispatcher. Today: logs + resolves. Tomorrow: POST /api/crm/meetings/{id}/control.
export async function dispatchAction(meetingId, action, payload = {}) {
  // eslint-disable-next-line no-console
  console.log('[meeting-lifecycle] dispatch', { meetingId, action, payload });
  // TODO: return post(`/meetings/${meetingId}/control`, { action, ...payload });
  await new Promise(r => setTimeout(r, 250));
  return { ok: true, action, meetingId };
}

export function fmtDT(s) {
  if (!s) return '—';
  const d = parseDT(s);
  if (!d) return s;
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
