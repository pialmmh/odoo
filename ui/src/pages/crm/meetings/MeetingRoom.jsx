import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, Tooltip, Alert, CircularProgress,
  Paper, Chip, TextField, Snackbar, Divider, Menu, MenuItem, ListItemIcon,
  ListItemText, ButtonGroup,
} from '@mui/material';
import {
  Mic as MicIcon, MicOff as MicOffIcon,
  Videocam as VideoIcon, VideocamOff as VideoOffIcon,
  ScreenShare as ShareIcon, StopScreenShare as StopShareIcon,
  CallEnd as HangupIcon, Chat as ChatIcon, People as PeopleIcon,
  FiberManualRecord as RecIcon, StopCircle as RecStopIcon,
  Settings as SettingsIcon, EmojiEmotions as ReactIcon,
  PanTool as HandIcon, MoreHoriz as MoreIcon,
  Business as ContextIcon, SubtitlesOutlined as TranscribeIcon,
  CallSplit as BreakoutIcon, ContentCopy as CopyIcon,
  ArrowDropDown as CaretIcon, Close as CloseIcon,
} from '@mui/icons-material';
import { getMeeting } from '../../../services/crm';
import { requestToken, joinSession, initPublisher } from './ovSession';
import { STAGE_COLOR, deriveStage, fmtDT } from './lifecycle';
import ContextPanel from './ContextPanel';
import { INTERCEPT_MODES } from './InterceptDialog';

// ── Intercept mode rules ────────────────────────────────────────────────
// Defines what an admin can do client-side per mode. Server enforcement is
// separate (role in OV token); these are UI guardrails.
const INTERCEPT_RULES = {
  silent:   { micAllowed: false, camAllowed: false, visible: false, bannerColor: '#7c3aed', label: 'Silent monitoring — attendees cannot see or hear you' },
  coach:    { micAllowed: true,  camAllowed: false, visible: false, bannerColor: '#0891b2', label: 'Coach mode — only the host hears you; attendees do not' },
  barge:    { micAllowed: true,  camAllowed: true,  visible: true,  bannerColor: '#f59e0b', label: 'Barge mode — you are a visible participant' },
  takeover: { micAllowed: true,  camAllowed: true,  visible: true,  bannerColor: '#dc2626', label: 'Takeover mode — you are the new host' },
};

const DEMO_MEETING = {
  id: 'demo',
  name: 'Demo Room — UI preview',
  dateStart: new Date().toISOString().slice(0, 19).replace('T', ' '),
  dateEnd:   new Date(Date.now() + 3600e3).toISOString().slice(0, 19).replace('T', ' '),
  status: 'Planned',
  assignedUserName: 'You',
  parentType: null, parentId: null,
  usersIds: [], contactsIds: [], leadsIds: [],
};

export default function MeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qp] = useSearchParams();
  const interceptMode = qp.get('mode'); // 'silent' | 'coach' | 'barge' | 'takeover' | null
  const rules = interceptMode ? INTERCEPT_RULES[interceptMode] : null;
  const interceptInfo = interceptMode ? INTERCEPT_MODES.find((m) => m.key === interceptMode) : null;

  const [phase, setPhase] = useState('loading');
  const [meeting, setMeeting] = useState(null);
  const [err, setErr] = useState(null);
  const [snack, setSnack] = useState(null);

  // Local media state — respect intercept rules
  const [micOn, setMicOn] = useState(rules ? rules.micAllowed : true);
  const [camOn, setCamOn] = useState(rules ? rules.camAllowed : true);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [displayName, setDisplayName] = useState(rules ? '(admin)' : '');
  const [elapsed, setElapsed] = useState(0);

  // OV session + participants
  const sessionRef = useRef(null);
  const publisherRef = useRef(null);
  const previewVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const [remotes, setRemotes] = useState([]);
  const [sidebar, setSidebar] = useState(null); // 'people' | 'chat' | 'context'
  const [moreAnchor, setMoreAnchor] = useState(null);

  // Load meeting (tolerate demo id)
  useEffect(() => {
    if (id === 'demo') {
      setMeeting(DEMO_MEETING);
      setPhase('lobby');
      return;
    }
    getMeeting(id).then((d) => { setMeeting(d); setPhase('lobby'); })
      .catch((e) => { setErr(e?.response?.data?.message || e.message); setPhase('lobby'); });
  }, [id]);

  // Lobby camera preview
  useEffect(() => {
    if (phase !== 'lobby') return;
    let stream = null;
    navigator.mediaDevices?.getUserMedia({ audio: micOn, video: camOn })
      .then((s) => { stream = s; if (previewVideoRef.current) previewVideoRef.current.srcObject = s; })
      .catch(() => {});
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [phase, micOn, camOn]);

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'in-room') return;
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const join = useCallback(async () => {
    if (id === 'demo') { setPhase('in-room'); return; } // skip OV for demo
    setPhase('connecting');
    try {
      const tok = await requestToken(id, {
        identity: displayName || 'guest',
        role: interceptMode ? `ADMIN_${interceptMode.toUpperCase()}` : 'PUBLISHER',
      });
      if (!tok?.token) {
        setErr('OpenVidu backend is not wired yet. UI-only mode: you can explore the room layout, but no real session will start.');
        setPhase('in-room'); // still enter for UI testing
        return;
      }
      const { session } = await joinSession({
        token: tok.token,
        onStreamCreated:   (r) => setRemotes((ps) => [...ps, r]),
        onStreamDestroyed: (r) => setRemotes((ps) => ps.filter((x) => x.id !== r.id)),
        onSessionDisconnected: () => setPhase('ended'),
      });
      sessionRef.current = session;
      if (!rules || rules.camAllowed || rules.micAllowed) {
        const publisher = await initPublisher(session.openvidu, {
          audio: rules ? rules.micAllowed && micOn : micOn,
          video: rules ? rules.camAllowed && camOn : camOn,
        });
        await session.publish(publisher);
        publisherRef.current = publisher;
      }
      setPhase('in-room');
    } catch (e) {
      setErr(e?.message || 'Failed to join');
      setPhase('lobby');
    }
  }, [id, displayName, micOn, camOn, interceptMode, rules]);

  const leave = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    publisherRef.current = null;
    setPhase('ended');
  }, []);
  useEffect(() => () => sessionRef.current?.disconnect(), []);

  useEffect(() => {
    if (phase === 'in-room' && publisherRef.current && localVideoRef.current) {
      publisherRef.current.addVideoElement(localVideoRef.current);
    }
  }, [phase]);

  const toggleMic = () => {
    if (rules && !rules.micAllowed) { setSnack('Microphone disabled in this intercept mode'); return; }
    const next = !micOn;
    publisherRef.current?.publishAudio(next);
    setMicOn(next);
  };
  const toggleCam = () => {
    if (rules && !rules.camAllowed) { setSnack('Camera disabled in this intercept mode'); return; }
    const next = !camOn;
    publisherRef.current?.publishVideo(next);
    setCamOn(next);
  };

  if (phase === 'loading') {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  if (phase === 'ended') {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', mt: 8, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>You left the meeting</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{meeting?.name}</Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => setPhase('lobby')}>Rejoin</Button>
          <Button variant="outlined" onClick={() => navigate('..')}>Back to meetings</Button>
        </Box>
      </Box>
    );
  }

  if (phase === 'lobby' || phase === 'connecting') {
    const stage = meeting ? deriveStage(meeting, new Date()) : null;
    return (
      <Box sx={{ maxWidth: 880, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{meeting?.name || 'Meeting'}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          {stage && <Chip size="small" label={stage} color={STAGE_COLOR[stage] || 'default'} />}
          {meeting && <Typography variant="caption" color="text.secondary">
            {fmtDT(meeting.dateStart)} → {fmtDT(meeting.dateEnd)}
          </Typography>}
          {interceptInfo && (
            <Chip size="small" label={`Admin: ${interceptInfo.label}`}
              sx={{ bgcolor: rules.bannerColor, color: '#fff', fontWeight: 600 }} />
          )}
        </Box>

        {err && <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, gap: 3 }}>
          <Paper variant="outlined" sx={{
            aspectRatio: '16/9', bgcolor: '#111', position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {camOn ? (
              <video ref={previewVideoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            ) : (
              <Box sx={{ color: '#fff', textAlign: 'center' }}>
                <VideoOffIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                <Typography variant="body2">Camera off</Typography>
              </Box>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Ready to join?</Typography>
            <TextField fullWidth size="small" label="Display name" sx={{ mb: 1.5 }}
              value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <ButtonGroup size="small" fullWidth sx={{ mb: 1.5 }}>
              <Button variant={micOn ? 'contained' : 'outlined'} onClick={() => setMicOn(!micOn)}
                startIcon={micOn ? <MicIcon /> : <MicOffIcon />}
                disabled={rules && !rules.micAllowed}>Mic</Button>
              <Button variant={camOn ? 'contained' : 'outlined'} onClick={() => setCamOn(!camOn)}
                startIcon={camOn ? <VideoIcon /> : <VideoOffIcon />}
                disabled={rules && !rules.camAllowed}>Camera</Button>
            </ButtonGroup>
            <Button fullWidth variant="contained" size="large" disabled={phase === 'connecting'} onClick={join}>
              {phase === 'connecting' ? 'Connecting…' : interceptMode ? `Join as ${interceptInfo.label.split(' —')[0]}` : 'Join meeting'}
            </Button>
          </Paper>
        </Box>
      </Box>
    );
  }

  // ── In-room: full-viewport dark shell ──
  const selfTile = rules && !rules.visible ? null : {
    id: 'local', isLocal: true, name: displayName || 'You',
  };
  const tiles = [
    ...(selfTile ? [selfTile] : []),
    ...remotes.map((r) => ({ id: r.id, subscriber: r.subscriber, name: r.participant?.identity || 'Participant' })),
  ];
  // Mock tiles when no real session is connected, so the grid demonstrates
  if (tiles.length === 0 || id === 'demo') {
    if (selfTile) tiles[0] = selfTile;
    tiles.push({ id: 'mock1', name: 'Alice (Contact)', mock: true });
    tiles.push({ id: 'mock2', name: 'Bob (Lead)', mock: true });
    if (id === 'demo') tiles.push({ id: 'mock3', name: 'Carol (User)', mock: true });
  }
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(tiles.length)));

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1300, bgcolor: '#0b0b0b', color: '#eee',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Admin intercept banner */}
      {rules && (
        <Box sx={{
          bgcolor: rules.bannerColor, color: '#fff', py: 0.75, px: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, fontWeight: 600,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>ADMIN INTERCEPT</Typography>
            <Typography sx={{ fontSize: 13 }}>{rules.label}</Typography>
          </Box>
          <Typography sx={{ fontSize: 12, opacity: 0.9 }}>Audited · {interceptInfo?.label}</Typography>
        </Box>
      )}

      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, borderBottom: '1px solid #222',
      }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{meeting?.name}</Typography>
          <Typography variant="caption" sx={{ color: '#888' }}>
            {tiles.length} participants · {formatElapsed(elapsed)}
            {recording && <Chip size="small" label="REC" sx={{ ml: 1, height: 16, fontSize: 10, bgcolor: '#dc2626', color: '#fff' }} icon={<RecIcon sx={{ fontSize: 10, color: '#fff !important' }} />} />}
          </Typography>
        </Box>
        <IconButton size="small" onClick={leave} sx={{ color: '#aaa' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: sidebar ? '1fr 320px' : '1fr', minHeight: 0 }}>
        {/* Video grid */}
        <Box sx={{
          p: 1.5, display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: 1.5, minHeight: 0, alignContent: 'center',
        }}>
          {tiles.map((t) => (
            <VideoTile key={t.id} tile={t}
              localVideoRef={t.isLocal ? localVideoRef : null}
              muted={t.isLocal ? !micOn : false} />
          ))}
        </Box>

        {/* Right drawer */}
        {sidebar && (
          <Box sx={{ borderLeft: '1px solid #222', bgcolor: '#121212', minHeight: 0, position: 'relative' }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 1.5, py: 1, borderBottom: '1px solid #222',
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                {sidebar === 'people' ? `Participants (${tiles.length})` : sidebar === 'chat' ? 'Chat' : 'Context'}
              </Typography>
              <IconButton size="small" onClick={() => setSidebar(null)} sx={{ color: '#aaa' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ height: 'calc(100% - 40px)', overflow: 'auto' }}>
              {sidebar === 'people' && <PeoplePanel tiles={tiles} />}
              {sidebar === 'chat'   && <ChatPanel />}
              {sidebar === 'context' && <ContextPanel meeting={meeting} onAttach={(msg) => setSnack(msg)} />}
            </Box>
          </Box>
        )}
      </Box>

      {/* Toolbar */}
      <Box sx={{
        px: 2, py: 1.25, borderTop: '1px solid #222',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
        bgcolor: '#151515',
      }}>
        <PillBtn label="Mic" active={micOn} disabled={rules && !rules.micAllowed}
          icon={micOn ? <MicIcon /> : <MicOffIcon />} onClick={toggleMic} hasCaret />
        <PillBtn label="Camera" active={camOn} disabled={rules && !rules.camAllowed}
          icon={camOn ? <VideoIcon /> : <VideoOffIcon />} onClick={toggleCam} hasCaret />
        <PillBtn label={sharing ? 'Stop share' : 'Share'} active={!sharing}
          icon={sharing ? <StopShareIcon /> : <ShareIcon />}
          onClick={() => { setSharing(!sharing); setSnack(sharing ? 'Stopped sharing' : 'Screen share — backend TBD'); }} />
        <PillBtn label={recording ? 'Stop rec' : 'Record'} active={!recording}
          danger={recording}
          icon={recording ? <RecStopIcon /> : <RecIcon />}
          onClick={() => { setRecording(!recording); setSnack(recording ? 'Recording stopped' : 'Recording started'); }} />
        <PillBtn label="React" icon={<ReactIcon />} onClick={() => setSnack('Reactions — TBD')} />
        <PillBtn label={handRaised ? 'Lower' : 'Raise hand'} active={!handRaised}
          icon={<HandIcon />} onClick={() => { setHandRaised(!handRaised); setSnack(handRaised ? 'Hand lowered' : 'Hand raised'); }} />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#333' }} />

        <PillBtn label="People" active={sidebar !== 'people'}
          icon={<PeopleIcon />} onClick={() => setSidebar(sidebar === 'people' ? null : 'people')}
          highlighted={sidebar === 'people'} />
        <PillBtn label="Chat" active={sidebar !== 'chat'}
          icon={<ChatIcon />} onClick={() => setSidebar(sidebar === 'chat' ? null : 'chat')}
          highlighted={sidebar === 'chat'} />
        <PillBtn label="Context" active={sidebar !== 'context'}
          icon={<ContextIcon />} onClick={() => setSidebar(sidebar === 'context' ? null : 'context')}
          highlighted={sidebar === 'context'} />

        <PillBtn label="More" icon={<MoreIcon />} onClick={(e) => setMoreAnchor(e.currentTarget)} />
        <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}
          transformOrigin={{ horizontal: 'center', vertical: 'bottom' }}
          anchorOrigin={{ horizontal: 'center', vertical: 'top' }}>
          <MenuItem onClick={() => { setMoreAnchor(null); setSnack('Transcription toggled'); }}>
            <ListItemIcon><TranscribeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Transcription</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreAnchor(null); setSnack('Breakouts — TBD'); }}>
            <ListItemIcon><BreakoutIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Breakout rooms</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreAnchor(null);
              navigator.clipboard?.writeText(window.location.href); setSnack('Join link copied'); }}>
            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Copy join link</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreAnchor(null); setSnack('Device settings — TBD'); }}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>
        </Menu>

        <Box sx={{ flex: 1 }} />
        <Button onClick={leave} color="error" variant="contained" startIcon={<HangupIcon />}
          sx={{ fontWeight: 700, px: 2 }}>Leave</Button>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ bottom: '90px !important' }} />
    </Box>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function PillBtn({ label, icon, onClick, active = true, disabled, danger, hasCaret, highlighted }) {
  return (
    <Box onClick={disabled ? undefined : onClick} sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25,
      px: 1.5, py: 0.75, borderRadius: 1, cursor: disabled ? 'not-allowed' : 'pointer',
      minWidth: 64, opacity: disabled ? 0.4 : 1,
      bgcolor: highlighted ? '#2c3e50' : 'transparent',
      color: danger ? '#f87171' : active ? '#eee' : '#f87171',
      '&:hover': { bgcolor: disabled ? 'transparent' : (highlighted ? '#2c3e50' : '#1f1f1f') },
      transition: 'background 0.15s',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {icon}
        {hasCaret && <CaretIcon sx={{ fontSize: 14, ml: -0.5 }} />}
      </Box>
      <Typography sx={{ fontSize: 10, fontWeight: 500, userSelect: 'none' }}>{label}</Typography>
    </Box>
  );
}

function VideoTile({ tile, localVideoRef, muted }) {
  const remoteRef = useRef(null);
  useEffect(() => {
    if (tile.subscriber && remoteRef.current) tile.subscriber.addVideoElement(remoteRef.current);
  }, [tile.subscriber]);

  return (
    <Box sx={{
      position: 'relative', bgcolor: '#1a1a1a', overflow: 'hidden',
      borderRadius: 1, aspectRatio: '16/9', minHeight: 0,
      border: '1px solid #222',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {tile.mock ? (
        <Box sx={{ textAlign: 'center', color: '#666' }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%', bgcolor: '#333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#ccc', mx: 'auto', mb: 1,
          }}>
            {tile.name.slice(0, 1)}
          </Box>
          <Typography variant="caption" sx={{ color: '#999', fontSize: 11 }}>
            {tile.name} (UI placeholder)
          </Typography>
        </Box>
      ) : (
        <video
          ref={tile.isLocal ? localVideoRef : remoteRef}
          autoPlay playsInline muted={tile.isLocal}
          style={{ width: '100%', height: '100%', objectFit: 'cover',
            transform: tile.isLocal ? 'scaleX(-1)' : 'none' }}
        />
      )}
      <Box sx={{
        position: 'absolute', bottom: 6, left: 8,
        bgcolor: 'rgba(0,0,0,0.65)', color: '#fff', px: 1, py: 0.25,
        borderRadius: 0.5, fontSize: 11, display: 'flex', alignItems: 'center', gap: 0.5,
      }}>
        {muted && <MicOffIcon sx={{ fontSize: 12, color: '#f87171' }} />}
        {tile.name}
      </Box>
    </Box>
  );
}

function PeoplePanel({ tiles }) {
  return (
    <Box sx={{ p: 1.5 }}>
      {tiles.map((t) => (
        <Box key={t.id} sx={{
          display: 'flex', alignItems: 'center', gap: 1, py: 0.75,
          borderBottom: '1px solid #222',
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }} />
          <Typography variant="body2" sx={{ flex: 1, color: '#ddd' }}>{t.name}</Typography>
          {t.isLocal && <Chip size="small" label="You" sx={{ height: 16, fontSize: 10, bgcolor: '#2a2a2a', color: '#ddd' }} />}
        </Box>
      ))}
    </Box>
  );
}

function ChatPanel() {
  const [messages, setMessages] = useState([
    { from: 'Alice', text: 'Hey, can you share the deck?', ts: '12:01' },
    { from: 'You',   text: 'Sharing now', ts: '12:01' },
  ]);
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim(); if (!t) return;
    setMessages((m) => [...m, { from: 'You', text: t, ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setText('');
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, p: 1.5, overflow: 'auto' }}>
        {messages.map((m, i) => (
          <Box key={i} sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#8cf', fontWeight: 600 }}>
              {m.from} <Typography component="span" sx={{ color: '#666', fontSize: 10, ml: 0.5 }}>{m.ts}</Typography>
            </Typography>
            <Typography variant="body2" sx={{ color: '#ddd' }}>{m.text}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 1, borderTop: '1px solid #222' }}>
        <TextField fullWidth size="small" placeholder="Type a message…"
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#1f1f1f', color: '#eee' },
            '& fieldset': { borderColor: '#333' } }}
        />
      </Box>
    </Box>
  );
}

function formatElapsed(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
