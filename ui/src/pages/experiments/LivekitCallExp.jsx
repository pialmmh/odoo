import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Chip, Divider,
  Stack, Alert, List, ListItem, ListItemText, IconButton, Tooltip,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Call, CallEnd, Mic, MicOff, Videocam, VideocamOff,
  ScreenShare, StopScreenShare, Chat as ChatIcon, Send,
  Fullscreen, FullscreenExit, VolumeOff, VolumeUp,
  Visibility, VisibilityOff, SignalCellularAlt,
} from '@mui/icons-material';
import {
  Room, RoomEvent, Track, ConnectionQuality,
} from 'livekit-client';
import { post as crmPost } from '../../services/crm';

/**
 * Experimental app-to-app call + meeting on LiveKit.
 *
 * Scope: WebRTC ↔ WebRTC only. Two (or more) agents enter the same room
 * name; they talk audio, can escalate to video + screenshare + chat, and
 * moderate each other locally (mute this person in my ears, hide their
 * video from my screen). PSTN/SIP via livekit-sip is deliberately out.
 *
 * The page is self-contained — it never touches the production CallPanel
 * / CallHost / JanusCallAdapter. Sidebar link: Experimental → LiveKit Call.
 */
export default function LivekitCallExp() {
  // ── connection state ──────────────────────────────────────────────────
  const [roomName, setRoomName] = useState('spike-1');
  const [status, setStatus] = useState('idle'); // idle | joining | connected | leaving | error
  const [err, setErr] = useState(null);
  const [identity, setIdentity] = useState(null);

  // ── media state (local) ────────────────────────────────────────────────
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  // ── remote state — re-derived on every RoomEvent so React re-renders ──
  const [participants, setParticipants] = useState([]); // [{sid,identity,isLocal,audioTrack?,videoTrack?,screenTrack?,quality}]
  const [localVol, setLocalVol] = useState({});          // sid → 1 | 0  (per-remote mute in my ears)
  const [localHide, setLocalHide] = useState({});        // sid → true (hide their video from my view)

  // ── chat ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]); // [{id,from,text,ts,self}]
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  // ── timers / ui ───────────────────────────────────────────────────────
  const [startedAt, setStartedAt] = useState(null);
  const [nowTick, setNowTick] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── refs ──────────────────────────────────────────────────────────────
  const roomRef = useRef(null);
  const videoAreaRef = useRef(null);

  // ── derived ───────────────────────────────────────────────────────────
  const connected = status === 'connected';
  const anyVideo = participants.some((p) => p.videoTrack || p.screenTrack);
  const mode = anyVideo ? 'video' : 'audio';
  const duration = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  // ── 1-second tick so the duration label updates ───────────────────────
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  // ── track fullscreen state off document listener so ESC updates UI ────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Participants snapshot: build from the current room on every event─
  const refreshParticipants = useCallback((room) => {
    if (!room) { setParticipants([]); return; }
    const rows = [];
    const addRow = (p, isLocal) => {
      const audioPub = Array.from(p.audioTrackPublications.values())[0];
      const videoPubs = Array.from(p.videoTrackPublications.values());
      const camPub = videoPubs.find((v) => v.source === Track.Source.Camera);
      const screenPub = videoPubs.find((v) => v.source === Track.Source.ScreenShare);
      rows.push({
        sid: p.sid || (isLocal ? 'local' : p.identity),
        identity: p.identity,
        isLocal,
        audioTrack: audioPub?.track || null,
        videoTrack: camPub?.track || null,
        screenTrack: screenPub?.track || null,
        quality: p.connectionQuality,
      });
    };
    addRow(room.localParticipant, true);
    for (const p of room.remoteParticipants.values()) addRow(p, false);
    setParticipants(rows);
  }, []);

  // ── Chat: data channel send/receive ───────────────────────────────────
  const sendChat = useCallback(() => {
    const room = roomRef.current;
    const text = chatInput.trim();
    if (!room || !text) return;
    const payload = { kind: 'chat', text, from: room.localParticipant.identity, ts: Date.now() };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant.publishData(bytes, { reliable: true, topic: 'chat' });
    setMessages((m) => [...m, { id: `${Date.now()}-self`, from: payload.from, text, ts: payload.ts, self: true }]);
    setChatInput('');
  }, [chatInput]);

  // ── Join ──────────────────────────────────────────────────────────────
  const join = async () => {
    setErr(null);
    setStatus('joining');
    try {
      const tok = await crmPost('/call-room-exp/token', { roomName });
      if (!tok?.token || !tok?.wsUrl) throw new Error('Missing token/wsUrl in response');
      setIdentity(tok.identity);

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected,    () => refreshParticipants(room))
        .on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room))
        .on(RoomEvent.TrackSubscribed,        () => refreshParticipants(room))
        .on(RoomEvent.TrackUnsubscribed,      () => refreshParticipants(room))
        .on(RoomEvent.LocalTrackPublished,    () => refreshParticipants(room))
        .on(RoomEvent.LocalTrackUnpublished,  () => refreshParticipants(room))
        .on(RoomEvent.TrackMuted,             () => refreshParticipants(room))
        .on(RoomEvent.TrackUnmuted,           () => refreshParticipants(room))
        .on(RoomEvent.ConnectionQualityChanged, () => refreshParticipants(room))
        .on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
          if (topic && topic !== 'chat') return;
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload));
            if (msg?.kind !== 'chat') return;
            setMessages((m) => [...m, {
              id: `${msg.ts}-${participant?.sid || 'srv'}`,
              from: msg.from || participant?.identity || '?',
              text: msg.text,
              ts: msg.ts,
              self: false,
            }]);
            setChatOpen(true);
          } catch { /* ignore malformed */ }
        })
        .on(RoomEvent.Disconnected, () => {
          setStatus('idle');
          setParticipants([]);
          setStartedAt(null);
          setMicOn(false); setCamOn(false); setScreenOn(false);
        });

      await room.connect(tok.wsUrl, tok.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicOn(true);
      setStartedAt(Date.now());
      refreshParticipants(room);
      setStatus('connected');
    } catch (e) {
      console.error('[livekit-exp] join failed:', e);
      setErr(e?.response?.data?.message || e.message || 'Failed to join');
      setStatus('error');
    }
  };

  // ── Leave ─────────────────────────────────────────────────────────────
  const leave = async () => {
    setStatus('leaving');
    try {
      const room = roomRef.current;
      if (room) await room.disconnect();
    } finally {
      roomRef.current = null;
      setParticipants([]);
      setStatus('idle');
      setStartedAt(null);
      setMicOn(false); setCamOn(false); setScreenOn(false);
    }
  };

  // ── Local media toggles ───────────────────────────────────────────────
  const toggleMic = async () => {
    const room = roomRef.current; if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };
  const toggleCam = async () => {
    const room = roomRef.current; if (!room) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };
  const toggleScreen = async () => {
    const room = roomRef.current; if (!room) return;
    const next = !screenOn;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenOn(next);
    } catch (e) {
      // User may have cancelled the browser picker — roll back silently.
      console.warn('[livekit-exp] screenshare toggle cancelled:', e?.message);
      setScreenOn(false);
    }
  };

  // ── Moderation (LOCAL ONLY — see comment in UI footer) ────────────────
  const toggleRemoteMute = (sid) => {
    const room = roomRef.current; if (!room) return;
    const next = !localVol[sid];
    setLocalVol((v) => ({ ...v, [sid]: next }));
    const p = Array.from(room.remoteParticipants.values()).find((rp) => rp.sid === sid);
    if (p && typeof p.setVolume === 'function') p.setVolume(next ? 0 : 1);
  };
  const toggleRemoteHide = (sid) => {
    setLocalHide((h) => ({ ...h, [sid]: !h[sid] }));
  };

  // ── Fullscreen on the video grid ──────────────────────────────────────
  const toggleFullscreen = async () => {
    const el = videoAreaRef.current; if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  };

  // ── Unmount: always disconnect ────────────────────────────────────────
  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  const statusChip = useMemo(() => {
    if (status === 'idle')      return { label: 'Idle',       color: 'default' };
    if (status === 'joining')   return { label: 'Connecting…', color: 'warning' };
    if (status === 'leaving')   return { label: 'Leaving…',   color: 'warning' };
    if (status === 'error')     return { label: 'Error',      color: 'error' };
    return {
      label: mode === 'video' ? 'Video call' : 'Audio call',
      color: 'success',
    };
  }, [status, mode]);

  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 1280 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>LiveKit Call — Experiment</Typography>
        <Chip label="experimental" size="small" color="warning" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <Chip size="small" {...statusChip} />
        {connected && (
          <Chip size="small" variant="outlined" label={formatDuration(duration)} />
        )}
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        App-to-app audio/video via LiveKit. Two people joining the same room
        name are in the same call. Switch to video to enable camera/screenshare.
      </Typography>

      {/* ── Room input + connect ────────────────────────────────────── */}
      {!connected && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField size="small" label="Room name" value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                disabled={status === 'joining'} sx={{ width: 260 }}
                helperText='Server prefixes "call-exp-" on the room name.' />
              <Button variant="contained" startIcon={<Call />} onClick={join}
                disabled={status === 'joining' || !roomName.trim()}>
                {status === 'joining' ? 'Joining…' : 'Join'}
              </Button>
            </Stack>
            {err && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setErr(null)}>{err}</Alert>}
          </CardContent>
        </Card>
      )}

      {/* ── Active call: controls + (video area) + side panels ────── */}
      {connected && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ py: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title={micOn ? 'Mute' : 'Unmute'}>
                  <IconButton onClick={toggleMic} color={micOn ? 'primary' : 'default'}>
                    {micOn ? <Mic /> : <MicOff />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={camOn ? 'Stop video' : 'Start video'}>
                  <IconButton onClick={toggleCam} color={camOn ? 'primary' : 'default'}>
                    {camOn ? <Videocam /> : <VideocamOff />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={screenOn ? 'Stop sharing' : 'Share screen'}>
                  <IconButton onClick={toggleScreen} color={screenOn ? 'primary' : 'default'}>
                    {screenOn ? <StopScreenShare /> : <ScreenShare />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={chatOpen ? 'Hide chat' : 'Show chat'}>
                  <IconButton onClick={() => setChatOpen((v) => !v)} color={chatOpen ? 'primary' : 'default'}>
                    <ChatIcon />
                  </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  <code>{identity}</code> @ <code>call-exp-{roomName}</code>
                </Typography>
                <Button size="small" variant="outlined" color="error" startIcon={<CallEnd />} onClick={leave}>
                  Leave
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* ── Video grid: only renders when someone has video/screen ─ */}
          {mode === 'video' && (
            <Card
              ref={videoAreaRef}
              sx={{
                mb: 2,
                bgcolor: '#0b0d10',
                color: 'white',
                overflow: 'hidden',
                position: 'relative',
                ...(isFullscreen
                  ? { width: '100vw', height: '100vh', m: 0, borderRadius: 0 }
                  : { minHeight: 360 }),
              }}
            >
              <VideoGrid
                participants={participants}
                localHide={localHide}
                fullscreen={isFullscreen}
              />
              <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                <IconButton
                  onClick={toggleFullscreen}
                  sx={{
                    position: 'absolute', top: 8, right: 8,
                    bgcolor: 'rgba(0,0,0,0.45)', color: 'white',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
                  }}
                >
                  {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
              </Tooltip>
            </Card>
          )}

          {/* ── Side-by-side: participants + (optional) chat ─────────── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Card sx={{ flex: '1 1 360px', minWidth: 320 }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Participants ({participants.length})
                </Typography>
                <List dense>
                  {participants.map((p) => (
                    <ParticipantRow
                      key={p.sid}
                      p={p}
                      localMuted={!!localVol[p.sid]}
                      localHidden={!!localHide[p.sid]}
                      onToggleMute={() => toggleRemoteMute(p.sid)}
                      onToggleHide={() => toggleRemoteHide(p.sid)}
                    />
                  ))}
                </List>
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                  Mute/hide here are LOCAL — they affect only your browser. Server-side
                  remove/mute needs admin grants (not wired in the spike).
                </Typography>
              </CardContent>
            </Card>

            {chatOpen && (
              <Card sx={{ flex: '1 1 360px', minWidth: 320, display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 320 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Chat</Typography>
                  <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 200, maxHeight: 360, mb: 1,
                             border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    {messages.length === 0 && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        — no messages yet —
                      </Typography>
                    )}
                    {messages.map((m) => (
                      <Box key={m.id} sx={{ mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: m.self ? 'primary.main' : 'text.secondary', fontWeight: 600 }}>
                          {m.self ? 'you' : m.from}
                        </Typography>
                        <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                          {m.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" fullWidth placeholder="Type a message…"
                      value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }} />
                    <IconButton color="primary" onClick={sendChat} disabled={!chatInput.trim()}>
                      <Send />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Video grid — tiles auto-arrange. Dedicated <video> per track via .attach()
// ──────────────────────────────────────────────────────────────────────────
function VideoGrid({ participants, localHide, fullscreen }) {
  // Collect one tile per visible video/screen track. Screenshare takes
  // priority if both are present for the same participant.
  const tiles = [];
  for (const p of participants) {
    if (p.screenTrack && !localHide[p.sid]) {
      tiles.push({ key: `${p.sid}-screen`, track: p.screenTrack, label: `${p.identity} (screen)`, isScreen: true });
    }
    if (p.videoTrack && !localHide[p.sid]) {
      tiles.push({ key: `${p.sid}-cam`, track: p.videoTrack, label: p.identity + (p.isLocal ? ' (you)' : ''), isScreen: false });
    }
  }

  if (tiles.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                 height: fullscreen ? '100vh' : 360, color: 'rgba(255,255,255,0.6)' }}>
        Waiting for video…
      </Box>
    );
  }

  // Simple auto-grid: up to 2 per row below 800px, up to 3 per row otherwise.
  const gridCols = tiles.length === 1 ? '1fr' : tiles.length <= 2 ? '1fr 1fr' : '1fr 1fr 1fr';

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: gridCols,
      gap: 1,
      p: 1,
      ...(fullscreen
        ? { height: '100vh', alignContent: 'center' }
        : { minHeight: 360 }),
    }}>
      {tiles.map((t) => <VideoTile key={t.key} track={t.track} label={t.label} isScreen={t.isScreen} />)}
    </Box>
  );
}

function VideoTile({ track, label, isScreen }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el || !track) return;
    track.attach(el);
    return () => track.detach(el);
  }, [track]);
  return (
    <Box sx={{
      position: 'relative', bgcolor: '#000', borderRadius: 1, overflow: 'hidden',
      aspectRatio: '16 / 9', minHeight: 180,
    }}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={false}
        style={{
          width: '100%', height: '100%',
          objectFit: isScreen ? 'contain' : 'cover',
        }}
      />
      <Box sx={{
        position: 'absolute', bottom: 6, left: 6,
        px: 1, py: 0.25, bgcolor: 'rgba(0,0,0,0.55)',
        borderRadius: 0.75, color: 'white',
      }}>
        <Typography variant="caption">{label}</Typography>
      </Box>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────
function ParticipantRow({ p, localMuted, localHidden, onToggleMute, onToggleHide }) {
  const q = p.quality;
  const qColor = q === ConnectionQuality.Excellent ? 'success.main'
             : q === ConnectionQuality.Good ? 'primary.main'
             : q === ConnectionQuality.Poor ? 'warning.main'
             : 'text.disabled';
  return (
    <ListItem disableGutters sx={{ pr: 12 }}>
      <ListItemText
        primary={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.identity}</Typography>
            {p.isLocal && <Chip label="you" size="small" />}
            {p.videoTrack && <Chip label="video" size="small" color="success" variant="outlined" />}
            {p.screenTrack && <Chip label="screen" size="small" color="info" variant="outlined" />}
            {p.audioTrack?.isMuted && <Chip label="muted" size="small" color="default" />}
          </Stack>
        }
        secondary={
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
            <SignalCellularAlt sx={{ fontSize: 13, color: qColor }} />
            <Typography variant="caption" sx={{ color: qColor }}>
              {q || 'unknown'}
            </Typography>
          </Stack>
        }
      />
      {!p.isLocal && (
        <ListItemSecondaryAction>
          <Tooltip title={localMuted ? 'Unmute in my ears' : 'Mute in my ears'}>
            <IconButton size="small" onClick={onToggleMute}>
              {localMuted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={localHidden ? 'Show their video' : 'Hide their video'}>
            <IconButton size="small" onClick={onToggleHide}>
              {localHidden ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </Tooltip>
        </ListItemSecondaryAction>
      )}
    </ListItem>
  );
}

function formatDuration(s) {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${ss}`;
}
