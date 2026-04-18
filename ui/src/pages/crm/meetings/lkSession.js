// ── LiveKit session wrapper ──────────────────────────────────────────────
// Thin facade around livekit-client so React components stay clean.
// Backend integration points (to be filled in when the LiveKit server is live):
//
//   1. POST  /api/crm/meetings/{id}/token    → { token, wsUrl }
//   2. POST  /api/crm/meetings/{id}/control  → lifecycle actions
//
// Until those exist, `requestToken()` returns null on 404 and the UI renders
// a "waiting for backend" state while still exercising the full component tree.

import {
  Room, RoomEvent, Track, ConnectionState,
} from 'livekit-client';
import { post } from '../../../services/crm';

/**
 * Ask the server for a LiveKit access token for this meeting.
 *
 *   role: 'PUBLISHER' | 'SUBSCRIBER' | 'ADMIN_SILENT' | 'ADMIN_COACH' |
 *         'ADMIN_BARGE' | 'ADMIN_TAKEOVER'
 *   identity: stable LiveKit participant identity (user/contact/lead id or guest name)
 *
 * Returns: { token, wsUrl } or null when the backend is not wired yet.
 */
export async function requestToken(meetingId, { role = 'PUBLISHER', identity } = {}) {
  try {
    const res = await post(`/meetings/${meetingId}/token`, { role, identity });
    return { token: res.token, wsUrl: res.wsUrl || null };
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

/**
 * Connect to a LiveKit room.
 *
 *  onTrackSubscribed:    (tile) => ...   — new remote video/audio track arrived
 *  onTrackUnsubscribed:  ({id}) => ...   — track went away
 *  onDisconnected:       () => ...       — room closed / we were kicked
 *  onParticipantConnected / Disconnected — roster updates (presence, mic state)
 *
 * Returns { room }. Caller owns the Room and is responsible for disconnecting.
 */
export async function joinSession({
  token, wsUrl,
  onTrackSubscribed, onTrackUnsubscribed,
  onParticipantConnected, onParticipantDisconnected,
  onDisconnected,
  adaptiveStream = true, dynacast = true,
}) {
  const room = new Room({ adaptiveStream, dynacast });

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    // Only surface camera video + mic audio to the UI. Screen-share handled
    // separately so it can be rendered in a full-width tile.
    onTrackSubscribed?.({
      id: publication.trackSid,
      kind: track.kind,                          // 'video' | 'audio'
      source: track.source,                      // Track.Source.Camera, .ScreenShare, .Microphone
      track,
      participant: {
        identity: participant.identity,
        sid: participant.sid,
        metadata: parseMeta(participant.metadata),
      },
    });
  });

  room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
    onTrackUnsubscribed?.({ id: publication.trackSid });
  });

  room.on(RoomEvent.ParticipantConnected, (p) => {
    onParticipantConnected?.({
      identity: p.identity, sid: p.sid, metadata: parseMeta(p.metadata),
    });
  });
  room.on(RoomEvent.ParticipantDisconnected, (p) => {
    onParticipantDisconnected?.({ identity: p.identity, sid: p.sid });
  });

  room.on(RoomEvent.Disconnected, () => onDisconnected?.());

  await room.connect(wsUrl, token);
  return { room };
}

/**
 * Enable local audio/video according to the intercept rules.
 * Returns the pair of local publications so the caller can attach to a <video>.
 */
export async function enableLocalMedia(room, { audio = true, video = true } = {}) {
  await room.localParticipant.setMicrophoneEnabled(!!audio);
  await room.localParticipant.setCameraEnabled(!!video);
  return {
    micPublication: audioPublication(room),
    camPublication: videoPublication(room),
  };
}

export async function setMic(room, on) {
  await room.localParticipant.setMicrophoneEnabled(!!on);
}
export async function setCam(room, on) {
  await room.localParticipant.setCameraEnabled(!!on);
}
export async function setScreenShare(room, on) {
  await room.localParticipant.setScreenShareEnabled(!!on);
}

/**
 * Attach a local camera track to a <video> element. Call after
 * enableLocalMedia resolves. Returns the track so the caller can detach later.
 */
export function attachLocalCamera(room, videoEl) {
  const pub = videoPublication(room);
  const track = pub?.track;
  if (track && videoEl) track.attach(videoEl);
  return track;
}

export function audioPublication(room) {
  return findPub(room, Track.Source.Microphone);
}
export function videoPublication(room) {
  return findPub(room, Track.Source.Camera);
}
function findPub(room, source) {
  const pubs = Array.from(room.localParticipant.trackPublications.values());
  return pubs.find((p) => p.source === source);
}

function parseMeta(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { raw }; }
}

export { RoomEvent, Track, ConnectionState };
