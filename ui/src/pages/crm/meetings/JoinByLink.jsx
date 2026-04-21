import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Stack,
  TextField, Typography, IconButton, Tooltip,
} from '@mui/material';
import {
  Mic as MicIcon, MicOff as MicOffIcon,
  Videocam as VideoIcon, VideocamOff as VideoOffIcon,
  CallEnd as HangupIcon,
} from '@mui/icons-material';
import { Room, RoomEvent, Track } from 'livekit-client';
import { resolveMagicLink, joinByMagicLink } from '../../../services/crm';

/**
 * Public meeting guest page — renders at /:tenant/join/:token.
 *
 * No Keycloak auth (see keycloak.js isPublicRoute). Two stages:
 *
 *   Pre-join : resolve the link, show meeting info, collect display name.
 *   In-call  : connect to LiveKit with a guest JWT, render local preview
 *              + remote tiles, mic/cam/leave controls.
 *
 * The in-call UI here is intentionally minimal and standalone from
 * MeetingRoom.jsx because MeetingRoom uses auth-gated helpers (requestToken
 * via /api/crm) and assumes a logged-in Keycloak identity. A fancier guest
 * room can ship later.
 */
export default function JoinByLink() {
  const { tenant, token } = useParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  const [creds, setCreds] = useState(null); // {token, wsUrl, room, identity, meetingId}

  useEffect(() => {
    resolveMagicLink(tenant, token)
      .then((r) => { setInvite(r); setDisplayName(r.invitedName || ''); })
      .catch((e) => setErr(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [tenant, token]);

  const onJoin = async () => {
    setJoining(true);
    setErr(null);
    try {
      const r = await joinByMagicLink(tenant, token, displayName);
      setCreds(r);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <FullScreen>
        <CircularProgress />
      </FullScreen>
    );
  }

  if (err && !creds) {
    return (
      <FullScreen>
        <Card sx={{ width: 420 }}>
          <CardContent sx={{ p: 4 }}>
            <Alert severity="error">{err}</Alert>
          </CardContent>
        </Card>
      </FullScreen>
    );
  }

  if (creds) {
    return <GuestRoom creds={creds} onLeave={() => navigate('/')} />;
  }

  // Pre-join form
  return (
    <FullScreen>
      <Card sx={{ width: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>Meeting invite</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            You've been invited to join this meeting. Confirm the name to use
            below.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Your name" fullWidth size="small" required autoFocus
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            />
            {err && <Alert severity="error">{err}</Alert>}
            <Button
              variant="contained" disabled={!displayName.trim() || joining}
              onClick={onJoin}
            >
              {joining ? 'Joining…' : 'Join meeting'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </FullScreen>
  );
}

function FullScreen({ children }) {
  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: 'background.default',
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
    }}>
      {children}
    </Box>
  );
}

// ── in-call guest room ────────────────────────────────────────────────────
function GuestRoom({ creds, onLeave }) {
  const [connected, setConnected] = useState(false);
  const [err, setErr] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remotes, setRemotes] = useState([]);

  const roomRef = useRef(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Video) {
        setRemotes((rs) => [
          ...rs.filter((r) => r.id !== pub.trackSid),
          { id: pub.trackSid, identity: participant.identity, track },
        ]);
      } else if (track.kind === Track.Kind.Audio) {
        track.attach();
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (_t, pub) => {
      setRemotes((rs) => rs.filter((r) => r.id !== pub.trackSid));
    });
    room.on(RoomEvent.Disconnected, () => onLeave?.());

    (async () => {
      try {
        await room.connect(creds.wsUrl, creds.token);
        if (cancelled) return;
        await room.localParticipant.enableCameraAndMicrophone();
        const vTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
        if (vTrack && localVideoRef.current) vTrack.attach(localVideoRef.current);
        setConnected(true);
      } catch (e) {
        setErr(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
    };
  }, [creds]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = async () => {
    if (!roomRef.current) return;
    const next = !micOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };
  const toggleCam = async () => {
    if (!roomRef.current) return;
    const next = !camOn;
    await roomRef.current.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };
  const leave = () => roomRef.current?.disconnect();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, display: 'grid', gap: 1, p: 1,
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <Tile label="You">
          <video ref={localVideoRef} autoPlay playsInline muted
                 style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Tile>
        {remotes.map((r) => (
          <Tile key={r.id} label={r.identity}>
            <RemoteVideo track={r.track} />
          </Tile>
        ))}
      </Box>
      <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center', gap: 1.5, bgcolor: '#111' }}>
        <Tooltip title={micOn ? 'Mute mic' : 'Unmute mic'}>
          <IconButton onClick={toggleMic} sx={{ color: 'white' }}>
            {micOn ? <MicIcon /> : <MicOffIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title={camOn ? 'Turn off camera' : 'Turn on camera'}>
          <IconButton onClick={toggleCam} sx={{ color: 'white' }}>
            {camOn ? <VideoIcon /> : <VideoOffIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Leave">
          <IconButton onClick={leave} sx={{ color: '#f87171' }}>
            <HangupIcon />
          </IconButton>
        </Tooltip>
      </Box>
      {!connected && !err && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.7)' }}>
          <Stack alignItems="center" spacing={1}>
            <CircularProgress />
            <Typography color="white">Connecting…</Typography>
          </Stack>
        </Box>
      )}
      {err && (
        <Box sx={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)' }}>
          <Alert severity="error">{err}</Alert>
        </Box>
      )}
    </Box>
  );
}

function Tile({ label, children }) {
  return (
    <Box sx={{
      position: 'relative', bgcolor: '#222', borderRadius: 1, overflow: 'hidden',
      aspectRatio: '16/9',
    }}>
      {children}
      <Box sx={{
        position: 'absolute', bottom: 8, left: 8,
        bgcolor: 'rgba(0,0,0,0.6)', px: 1, py: 0.25, borderRadius: 0.5,
        fontSize: 12, color: 'white',
      }}>{label}</Box>
    </Box>
  );
}

function RemoteVideo({ track }) {
  const ref = useRef(null);
  useEffect(() => {
    if (track && ref.current) track.attach(ref.current);
    return () => { track?.detach(); };
  }, [track]);
  return (
    <video ref={ref} autoPlay playsInline
      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  );
}
