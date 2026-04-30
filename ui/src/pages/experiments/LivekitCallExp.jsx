import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, TextField, Button, Chip, Divider,
  Stack, Alert, List, ListItem, ListItemText, IconButton, Tooltip,
  ListItemSecondaryAction, Drawer, Menu, MenuItem, Checkbox,
  FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow, Grid, Collapse,
  Tabs, Tab, Paper,
} from '@mui/material';
import {
  Call, CallEnd, Mic, MicOff, Videocam, VideocamOff,
  ScreenShare, StopScreenShare, Chat as ChatIcon, Send,
  Fullscreen, FullscreenExit, VolumeOff, VolumeUp,
  Visibility, VisibilityOff, SignalCellularAlt,
  ViewSidebar, ViewSidebarOutlined, Edit, Description, Info,
  FiberManualRecord, RadioButtonChecked, Forward, Group, Email,
  NavigateBefore, NavigateNext, ExpandMore, ExpandLess, Close,
  ArrowDropDown, NoteAdd, EventAvailable,
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

  // ── workspace drawer (intercloud9-style Contact View) ─────────────────
  const [searchParams] = useSearchParams();
  const [workspaceOpen, setWorkspaceOpen] = useState(searchParams.get('workspace') === '1');
  const [contact, setContact] = useState({
    business: 'Unknown',
    firstName: '', lastName: '', company: '',
    address: '', city: '', state: '', zip: '',
    other: '', email: '', leadId: '',
    phone: '+1 (000) 000-0000',
  });
  const [contactCollapsed, setContactCollapsed] = useState(false);
  const [popupScript, setPopupScript] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [dialMode, setDialMode] = useState('Manual'); // Manual | Campaign
  const [contactLog, setContactLog] = useState([]); // [{ts, message, auto}]
  const [noteDraft, setNoteDraft] = useState('');
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [callHistory] = useState([
    { time: '16 Sep 11:25AM', phone: '+1 (877) 256-2100', duration: '02:14', mode: 'Direct' },
    { time: '15 Sep 04:49PM', phone: '+1 (877) 256-2100', duration: '00:42', mode: 'Dialer' },
  ]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [dispMenu, setDispMenu] = useState({ anchor: null, bucket: null });

  // ── matched CRM records for the current contact (Leads/Contacts/Opps) ─
  const [matches, setMatches] = useState({ leads: [], contacts: [], opportunities: [] });
  const [recordTab, setRecordTab] = useState(0);
  const isUnknown = matches.leads.length === 0 && matches.contacts.length === 0 && matches.opportunities.length === 0;
  const createRecord = (type) => {
    const stub = {
      id: `${type}-${Date.now()}`,
      name: contact.firstName || contact.lastName ? `${contact.firstName} ${contact.lastName}`.trim() : 'New ' + type,
      phone: contact.phone, email: contact.email,
    };
    setMatches((m) => ({ ...m, [type]: [...m[type], stub] }));
    addLog(`created ${type.replace(/s$/, '')} record: ${stub.name}`, true);
  };
  const createAllThree = () => {
    ['leads', 'contacts', 'opportunities'].forEach((t) => createRecord(t));
  };

  const addLog = (message, auto = false) => {
    const ts = new Date().toLocaleString();
    setContactLog((rows) => [{ ts, message, auto }, ...rows]);
  };
  const addNote = () => {
    const t = noteDraft.trim();
    if (!t) return;
    addLog(t, false);
    setNoteDraft('');
  };
  const applyDisposition = (bucket, value) => {
    addLog(`disposition: ${bucket} → ${value}`, true);
    setDispMenu({ anchor: null, bucket: null });
    if (bucket === 'Schedule Callback') setScheduleOpen(true);
  };

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
                <Tooltip title={workspaceOpen ? 'Hide workspace' : 'Open workspace'}>
                  <IconButton
                    onClick={() => setWorkspaceOpen((v) => !v)}
                    color={workspaceOpen ? 'primary' : 'default'}
                  >
                    {workspaceOpen ? <ViewSidebar /> : <ViewSidebarOutlined />}
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

      {/* Workspace drawer + dialogs — available even before joining a room
          so the sidebar entry can land directly on the workspace view. */}
      <Drawer
        anchor="right"
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        variant="persistent"
        PaperProps={{ sx: { width: 460, p: 0 } }}
      >
        <CallWorkspace
          identity={identity}
          roomName={roomName}
          connected={connected}
          dialMode={dialMode}
          setDialMode={setDialMode}
          contact={contact}
          setContact={setContact}
          contactCollapsed={contactCollapsed}
          setContactCollapsed={setContactCollapsed}
          matches={matches}
          isUnknown={isUnknown}
          recordTab={recordTab}
          setRecordTab={setRecordTab}
          createRecord={createRecord}
          createAllThree={createAllThree}
          popupScript={popupScript}
          setPopupScript={setPopupScript}
          autoNext={autoNext}
          setAutoNext={setAutoNext}
          contactLog={contactLog}
          addLog={addLog}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          addNote={addNote}
          dispMenu={dispMenu}
          setDispMenu={setDispMenu}
          applyDisposition={applyDisposition}
          onClose={() => setWorkspaceOpen(false)}
          onHangup={leave}
          onScript={() => setScriptOpen(true)}
          onHistory={() => setHistoryOpen(true)}
          onSchedule={() => setScheduleOpen(true)}
        />
      </Drawer>

      <ScriptDialog
        open={scriptOpen}
        onClose={() => setScriptOpen(false)}
        contact={contact}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        date={scheduleDate} setDate={setScheduleDate}
        time={scheduleTime} setTime={setScheduleTime}
        onSchedule={() => {
          addLog(`scheduled follow-up: ${scheduleDate} ${scheduleTime}`, true);
          setScheduleOpen(false);
        }}
      />
      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        rows={callHistory}
      />
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

// ──────────────────────────────────────────────────────────────────────────
// Workspace drawer — intercloud9-style Contact View. Local state only;
// nothing persists across reloads. See docs/dialer-wiki later when wiring
// to a real CallSession/Disposition backend.
// ──────────────────────────────────────────────────────────────────────────
const DISPOSITIONS = {
  'Custom':              ['Follow-up Needed', 'VIP', 'Escalate'],
  'Schedule Callback':   ['Open scheduler…'],
  'Made Contact':        ['Sale', 'Goal', 'Lead', 'Inbox', 'Direct Call'],
  'Unable to Contact':   ['No Contact', 'Wrong Number', 'Machine Left Msg', 'Not Interested', 'Dead'],
  'Assign to':           ['Closer', 'Specialist', 'Web Admin'],
};

function CallWorkspace({
  identity, roomName, connected, dialMode, setDialMode,
  contact, setContact, contactCollapsed, setContactCollapsed,
  matches, isUnknown, recordTab, setRecordTab, createRecord, createAllThree,
  popupScript, setPopupScript, autoNext, setAutoNext,
  contactLog, addLog, noteDraft, setNoteDraft, addNote,
  dispMenu, setDispMenu, applyDisposition,
  onClose, onHangup, onScript, onHistory, onSchedule,
}) {
  const setField = (k) => (e) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const fields = [
    ['firstName', 'First Name'], ['lastName', 'Last Name'],
    ['company', 'Company'], ['address', 'Address'],
    ['city', 'City'], ['state', 'State'],
    ['zip', 'Zip'], ['other', 'Other'],
    ['email', 'Email'], ['leadId', 'Lead ID'],
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header strip ─────────────────────────────────────────── */}
      <Box sx={{ px: 2, py: 1.25, bgcolor: 'primary.main', color: 'primary.contrastText',
                 display: 'flex', alignItems: 'center', gap: 1 }}>
        <FiberManualRecord sx={{ fontSize: 12, color: connected ? 'success.light' : 'grey.500' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {connected ? 'Connection Status' : 'Connection Status — not in a call'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 0.5,
                 borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tooltip title="Edit contact"><IconButton size="small"><Edit fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Read script"><IconButton size="small" onClick={onScript}><Description fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Connected calls"><IconButton size="small" onClick={onHistory}><Info fontSize="small" /></IconButton></Tooltip>
        <Button
          size="small"
          variant={dialMode === 'Manual' ? 'contained' : 'outlined'}
          color="warning"
          onClick={() => setDialMode('Manual')}
          sx={{ ml: 0.5, minWidth: 0, px: 1 }}
        >
          Manual Dial
        </Button>
        <Button
          size="small"
          variant={dialMode === 'Campaign' ? 'contained' : 'text'}
          endIcon={<ArrowDropDown />}
          onClick={() => setDialMode('Campaign')}
          sx={{ minWidth: 0, px: 1 }}
        >
          Campaign Dial
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{contact.phone}</Typography>
      </Box>

      {/* Action row ─────────────────────────────────────────── */}
      <Box sx={{ px: 1, py: 1, display: 'flex', justifyContent: 'space-between',
                 borderBottom: '1px solid', borderColor: 'divider' }}>
        <ActionBtn icon={<Call sx={{ color: 'success.main' }} />} label="Get" onClick={() => addLog('[stub] Get next contact', true)} />
        <ActionBtn icon={<CallEnd sx={{ color: connected ? 'error.main' : 'text.disabled' }} />} label="Hangup" onClick={onHangup} disabled={!connected} />
        <ActionBtn icon={<VolumeUp />} label="Play Msg" onClick={() => addLog('[stub] Play message', true)} />
        <ActionBtn icon={<RadioButtonChecked sx={{ color: 'error.main' }} />} label="Record" onClick={() => addLog('[stub] Recording started', true)} />
        <ActionBtn icon={<Forward />} label="Transfer" onClick={() => addLog('[stub] Transfer', true)} />
        <ActionBtn icon={<Group />} label="3-Way" onClick={() => addLog('[stub] 3-way conference', true)} />
        <ActionBtn icon={<Email />} label="Email" onClick={() => addLog('[stub] Send email', true)} />
        <ActionBtn icon={<NavigateBefore />} label="Prev" onClick={() => addLog('[stub] Previous contact', true)} />
        <ActionBtn icon={<NavigateNext />} label="Next" onClick={() => addLog('[stub] Next contact', true)} />
      </Box>

      {/* Scrollable body ─────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
        {/* Unknown banner — emphasizes that no CRM record matched */}
        {isUnknown ? (
          <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5,
                 bgcolor: 'background.default',
                 display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="UNKNOWN" color="error" size="small"
                  sx={{ fontWeight: 700, letterSpacing: 0.5 }} />
            <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
              No matching Lead, Contact, or Opportunity for {contact.phone}
            </Typography>
            <Button size="small" variant="contained" color="primary" onClick={createAllThree}>
              Create all 3
            </Button>
          </Paper>
        ) : (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip label="MATCHED" color="success" size="small" sx={{ fontWeight: 700 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {matches.leads.length} lead · {matches.contacts.length} contact · {matches.opportunities.length} opportunity
            </Typography>
          </Stack>
        )}

        {/* Records tabs ─────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={recordTab}
            onChange={(_, v) => setRecordTab(v)}
            variant="fullWidth"
            sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 36 }}
          >
            <Tab label={`Leads (${matches.leads.length})`} sx={{ minHeight: 36, py: 0 }} />
            <Tab label={`Contacts (${matches.contacts.length})`} sx={{ minHeight: 36, py: 0 }} />
            <Tab label={`Opportunities (${matches.opportunities.length})`} sx={{ minHeight: 36, py: 0 }} />
          </Tabs>
          <Box sx={{ p: 1.5 }}>
            {recordTab === 0 && <RecordPanel kind="leads" rows={matches.leads} onCreate={() => createRecord('leads')} />}
            {recordTab === 1 && <RecordPanel kind="contacts" rows={matches.contacts} onCreate={() => createRecord('contacts')} />}
            {recordTab === 2 && <RecordPanel kind="opportunities" rows={matches.opportunities} onCreate={() => createRecord('opportunities')} />}
          </Box>
        </Paper>

        {/* Contact form (collapsible) — kept below the tabs for editing */}
        <Stack direction="row" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="overline" sx={{ fontWeight: 600 }}>
            Business:{' '}
            {contact.business === 'Unknown' ? (
              <Box component="span" sx={{ color: 'error.main', fontWeight: 800, letterSpacing: 0.5 }}>
                UNKNOWN
              </Box>
            ) : contact.business}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setContactCollapsed((v) => !v)}>
            {contactCollapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
          </IconButton>
        </Stack>
        <Collapse in={!contactCollapsed}>
          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {fields.map(([k, label]) => (
              <Grid item xs={6} key={k}>
                <TextField
                  size="small" fullWidth label={label}
                  value={contact[k]} onChange={setField(k)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            ))}
          </Grid>
        </Collapse>

        {/* Disposition Bar */}
        <Typography variant="overline" sx={{ fontWeight: 600 }}>Disposition Bar</Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 0.5 }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={popupScript} onChange={(e) => setPopupScript(e.target.checked)} />}
            label={<Typography variant="caption">Popup script on connect</Typography>}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />}
            label={<Typography variant="caption">Upon disposition, load next call</Typography>}
          />
        </Stack>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {Object.keys(DISPOSITIONS).map((bucket) => (
            <Button
              key={bucket} size="small" variant="outlined" endIcon={<ArrowDropDown />}
              onClick={(e) => setDispMenu({ anchor: e.currentTarget, bucket })}
            >
              {bucket}
            </Button>
          ))}
        </Box>
        <Menu
          anchorEl={dispMenu.anchor}
          open={Boolean(dispMenu.anchor)}
          onClose={() => setDispMenu({ anchor: null, bucket: null })}
        >
          {dispMenu.bucket && DISPOSITIONS[dispMenu.bucket].map((opt) => (
            <MenuItem key={opt} onClick={() => applyDisposition(dispMenu.bucket, opt)}>
              {opt}
            </MenuItem>
          ))}
        </Menu>

        {/* Contact Log */}
        <Typography variant="overline" sx={{ fontWeight: 600 }}>Contact Log</Typography>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2,
                   maxHeight: 200, overflowY: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 140, fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contactLog.length === 0 && (
                <TableRow><TableCell colSpan={2} sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  — no entries yet —
                </TableCell></TableRow>
              )}
              {contactLog.map((row, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontSize: 12 }}>{row.ts}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {row.auto && <Chip label="auto" size="small" sx={{ mr: 0.5, height: 18 }} />}
                    {row.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* Add Note */}
        <Typography variant="overline" sx={{ fontWeight: 600 }}>Add Note</Typography>
        <TextField
          fullWidth multiline minRows={2} size="small"
          value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Type a note…"
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" variant="contained" startIcon={<NoteAdd />} onClick={addNote} disabled={!noteDraft.trim()}>
            Add Note
          </Button>
          <Button size="small" variant="outlined" startIcon={<EventAvailable />} onClick={onSchedule}>
            Schedule Callback
          </Button>
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 0.75, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          <code>{identity}</code> in <code>call-exp-{roomName}</code> — workspace state is local only (no backend yet).
        </Typography>
      </Box>
    </Box>
  );
}

function RecordPanel({ kind, rows, onCreate }) {
  const singular = { leads: 'Lead', contacts: 'Contact', opportunities: 'Opportunity' }[kind];
  if (rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          No matching {singular.toLowerCase()} for this number.
        </Typography>
        <Button size="small" variant="contained" onClick={onCreate}>
          Create {singular}
        </Button>
      </Box>
    );
  }
  return (
    <List dense disablePadding>
      {rows.map((r) => (
        <ListItem key={r.id} disableGutters sx={{ borderBottom: '1px dashed', borderColor: 'divider' }}>
          <ListItemText
            primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name}</Typography>}
            secondary={<Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {r.phone}{r.email ? ` · ${r.email}` : ''}
            </Typography>}
          />
        </ListItem>
      ))}
    </List>
  );
}

function ActionBtn({ icon, label, onClick, disabled }) {
  return (
    <Tooltip title={label}>
      <Button onClick={onClick} disabled={disabled} sx={{ flexDirection: 'column', minWidth: 0, px: 0.5, lineHeight: 1 }}>
        {icon}
        <Typography variant="caption" sx={{ fontSize: 10, mt: 0.25, color: 'text.secondary' }}>
          {label}
        </Typography>
      </Button>
    </Tooltip>
  );
}

function ScriptDialog({ open, onClose, contact }) {
  const fullName = `${contact.firstName || '[First]'} ${contact.lastName || '[Last]'}`.trim();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Read Script</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Hello, can I speak with{' '}
          <Chip label={fullName} size="small" color="warning" />{' '}please?
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Hi <Chip label={fullName} size="small" color="warning" />, this is the agent
          calling about your recent enquiry. Do you have a minute to talk?
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          (Script template — merge tags will pull from the Contact record once wired.)
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

function ScheduleDialog({ open, onClose, date, setDate, time, setTime, onSchedule }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Schedule Follow-up</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField type="date" label="Date" InputLabelProps={{ shrink: true }} fullWidth
            value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField type="time" label="Time" InputLabelProps={{ shrink: true }} fullWidth
            value={time} onChange={(e) => setTime(e.target.value)} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Time is based on your timezone.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={onSchedule} disabled={!date || !time}>
          Schedule Callback
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HistoryDialog({ open, onClose, rows }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Connected Calls</DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Phone Number</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Mode</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.time}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>{r.duration}</TableCell>
                <TableCell>{r.mode}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
          Sample rows — wire to backend to show real call history.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
