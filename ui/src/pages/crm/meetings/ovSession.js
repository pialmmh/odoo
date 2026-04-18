// ── OpenVidu session wrapper ─────────────────────────────────────────────
// Thin facade around openvidu-browser so the React components stay clean.
// Backend integration points (to be filled in when the server is ready):
//
//   1. POST  /api/crm/meetings/{id}/token    → returns { token, wsUrl }
//   2. POST  /api/crm/meetings/{id}/control  → lifecycle actions
//
// Until those exist, `requestToken()` returns null and the UI renders a
// "waiting for backend" state while still exercising the full component tree.

import { OpenVidu } from 'openvidu-browser';
import { post } from '../../../services/crm';

export async function requestToken(meetingId, { role = 'PUBLISHER', identity } = {}) {
  try {
    // Real call (not yet implemented server-side — will return 404 today):
    const res = await post(`/meetings/${meetingId}/token`, { role, identity });
    return { token: res.token, wsUrl: res.wsUrl || null };
  } catch (e) {
    if (e?.response?.status === 404) return null; // backend not wired yet
    throw e;
  }
}

// Factory: caller creates a session, connects, then publishes/subscribes.
// Returns the openvidu `Session` + the `Publisher` once initPublish resolves.
export async function joinSession({ token, onStreamCreated, onStreamDestroyed, onSessionDisconnected }) {
  const ov = new OpenVidu();
  const session = ov.initSession();

  session.on('streamCreated', (event) => {
    const subscriber = session.subscribe(event.stream, undefined);
    onStreamCreated?.({ id: event.stream.streamId, subscriber, participant: safeMeta(event.stream) });
  });
  session.on('streamDestroyed', (event) => {
    onStreamDestroyed?.({ id: event.stream.streamId });
  });
  session.on('sessionDisconnected', () => {
    onSessionDisconnected?.();
  });

  await session.connect(token, JSON.stringify({ clientData: 'orchestrix-ui' }));

  return { ov, session };
}

export async function initPublisher(ov, { audio = true, video = true, mirror = true } = {}) {
  return ov.initPublisherAsync(undefined, {
    audioSource: audio ? undefined : false,
    videoSource: video ? undefined : false,
    publishAudio: audio,
    publishVideo: video,
    resolution: '640x480',
    frameRate: 30,
    insertMode: 'APPEND',
    mirror,
  });
}

function safeMeta(stream) {
  try {
    const raw = stream?.connection?.data || '';
    // OpenVidu appends server/client data with %/% — take the first JSON block.
    const first = raw.split('%/%')[0];
    const parsed = first ? JSON.parse(first) : {};
    return {
      connectionId: stream?.connection?.connectionId,
      ...parsed,
    };
  } catch {
    return { connectionId: stream?.connection?.connectionId };
  }
}
