import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, Button, IconButton,
  Tooltip, Breadcrumbs, Link as MuiLink, Paper, Divider, Avatar,
  Table, TableBody, TableCell, TableHead, TableRow, Switch, FormControlLabel,
  Snackbar, TextField, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import {
  PlayArrow as StartIcon, Stop as EndIcon, Schedule as ExtendIcon,
  Lock as LockIcon, LockOpen as UnlockIcon, MicOff as MuteAllIcon,
  FiberManualRecord as RecIcon, StopCircle as RecStopIcon,
  SubtitlesOutlined as TranscribeIcon, PersonAdd as TransferIcon,
  Cancel as KickIcon, Block as BanIcon, Star as PromoteIcon,
  Mic as MicIcon, MicOff as MicOffIcon, MeetingRoom as WaitingIcon,
} from '@mui/icons-material';
import { getMeeting } from '../../../services/crm';
import { STAGES, STAGE_COLOR, deriveStage, dispatchAction, ACTIONS, fmtDT } from './lifecycle';

export default function MeetingControl() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [snack, setSnack] = useState(null);
  const [now, setNow] = useState(new Date());

  // Room-level policy toggles (local state — backend will persist once wired)
  const [locked,       setLocked]       = useState(false);
  const [waitingRoom,  setWaitingRoom]  = useState(true);
  const [muteOnEntry,  setMuteOnEntry]  = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recording,    setRecording]    = useState(false);
  const [maxParts,     setMaxParts]     = useState(50);
  const [allowGuests,  setAllowGuests]  = useState(true);

  // Mock participant roster — real list will stream from LiveKit room events.
  const [participants, setParticipants] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getMeeting(id);
      setM(d);
      // Seed mock roster from attendee ids (until LiveKit events arrive)
      const mock = [];
      (d.usersIds || []).forEach(uid => mock.push({
        id: `user-${uid}`, kind: 'User', identity: uid,
        name: d.usersNames?.[uid] || uid, muted: false, isHost: uid === d.assignedUserId,
        waiting: false, network: 'good',
      }));
      (d.contactsIds || []).forEach(cid => mock.push({
        id: `contact-${cid}`, kind: 'Contact', identity: cid,
        name: d.contactsNames?.[cid] || cid, muted: true, isHost: false,
        waiting: true, network: 'good',
      }));
      (d.leadsIds || []).forEach(lid => mock.push({
        id: `lead-${lid}`, kind: 'Lead', identity: lid,
        name: d.leadsNames?.[lid] || lid, muted: true, isHost: false,
        waiting: true, network: 'good',
      }));
      setParticipants(mock);
      setErr(null);
    } catch (e) { setErr(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const act = async (action, payload) => {
    try {
      await dispatchAction(id, action, payload);
      setSnack(`${action} dispatched`);
    } catch (e) { setSnack(`Failed: ${e.message}`); }
  };
  const pAct = async (p, action, payload) => {
    try {
      await dispatchAction(id, action, { participantId: p.id, ...payload });
      setSnack(`${action} → ${p.name}`);
      // Optimistic local update
      if (action === ACTIONS.P_MUTE)    setParticipants(ps => ps.map(x => x.id === p.id ? { ...x, muted: true }  : x));
      if (action === ACTIONS.P_UNMUTE)  setParticipants(ps => ps.map(x => x.id === p.id ? { ...x, muted: false } : x));
      if (action === ACTIONS.P_KICK)    setParticipants(ps => ps.filter(x => x.id !== p.id));
      if (action === ACTIONS.P_BAN)     setParticipants(ps => ps.filter(x => x.id !== p.id));
      if (action === ACTIONS.P_WAITING) setParticipants(ps => ps.map(x => x.id === p.id ? { ...x, waiting: true }  : x));
      if (action === ACTIONS.P_PROMOTE) setParticipants(ps => ps.map(x => x.id === p.id ? { ...x, isHost: true } : x));
    } catch (e) { setSnack(`Failed: ${e.message}`); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!m) return null;

  const stage = deriveStage(m, now);
  const inRoom    = participants.filter(p => !p.waiting);
  const inWaiting = participants.filter(p => p.waiting);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to="../dashboard" underline="hover">Dashboard</MuiLink>
        <MuiLink component={RouterLink} to=".." underline="hover">Meetings</MuiLink>
        <Typography color="text.primary">Control</Typography>
      </Breadcrumbs>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{m.name}</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
            <Chip size="small" label={stage} color={STAGE_COLOR[stage] || 'default'} />
            <Typography variant="caption" color="text.secondary">
              {fmtDT(m.dateStart)} → {fmtDT(m.dateEnd)} · Host: {m.assignedUserName || '—'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {stage !== STAGES.LIVE && (
            <Button variant="contained" color="success" size="small" startIcon={<StartIcon />}
              onClick={() => act(ACTIONS.START)}>Start</Button>
          )}
          {stage === STAGES.LIVE && (
            <>
              <Button variant="outlined" size="small" startIcon={<ExtendIcon />}
                onClick={() => act(ACTIONS.EXTEND, { minutes: 15 })}>+15m</Button>
              <Button variant="contained" color="error" size="small" startIcon={<EndIcon />}
                onClick={() => act(ACTIONS.END)}>End Meeting</Button>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, gap: 2 }}>
        {/* ── Main: roster + waiting room ── */}
        <Box>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mr: 1 }}>Room controls</Typography>
              <Button size="small" startIcon={locked ? <UnlockIcon /> : <LockIcon />}
                onClick={() => { setLocked(!locked); act(locked ? ACTIONS.UNLOCK : ACTIONS.LOCK); }}>
                {locked ? 'Unlock' : 'Lock'}
              </Button>
              <Button size="small" startIcon={<MuteAllIcon />} onClick={() => act(ACTIONS.MUTE_ALL)}>Mute all</Button>
              <Button size="small" color={recording ? 'error' : 'inherit'}
                startIcon={recording ? <RecStopIcon /> : <RecIcon />}
                onClick={() => { setRecording(!recording); act(recording ? ACTIONS.RECORD_STOP : ACTIONS.RECORD_START); }}>
                {recording ? 'Stop recording' : 'Record'}
              </Button>
              <Button size="small" startIcon={<TranscribeIcon />}
                onClick={() => { setTranscribing(!transcribing); act(ACTIONS.TRANSCRIBE, { enabled: !transcribing }); }}>
                {transcribing ? 'Transcription on' : 'Transcribe'}
              </Button>
              <Button size="small" startIcon={<TransferIcon />} onClick={() => act(ACTIONS.TRANSFER_HOST)}>Transfer host</Button>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                In room <Typography component="span" variant="caption" color="text.secondary">({inRoom.length})</Typography>
              </Typography>
            </Box>
            <ParticipantTable rows={inRoom} onAct={pAct} />
          </Paper>

          <Paper variant="outlined">
            <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Waiting room <Typography component="span" variant="caption" color="text.secondary">({inWaiting.length})</Typography>
              </Typography>
            </Box>
            <ParticipantTable rows={inWaiting} waiting onAct={pAct} />
          </Paper>
        </Box>

        {/* ── Sidebar: policy ── */}
        <Box>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Policy</Typography>
            <FormControlLabel label="Waiting room" control={
              <Switch size="small" checked={waitingRoom}
                onChange={() => { setWaitingRoom(!waitingRoom); act(ACTIONS.WAITING_ROOM, { enabled: !waitingRoom }); }} />
            } />
            <FormControlLabel label="Mute on entry" control={
              <Switch size="small" checked={muteOnEntry}
                onChange={() => { setMuteOnEntry(!muteOnEntry); act(ACTIONS.MUTE_ON_ENTRY, { enabled: !muteOnEntry }); }} />
            } />
            <FormControlLabel label="Allow guests (Contacts/Leads)" control={
              <Switch size="small" checked={allowGuests} onChange={() => setAllowGuests(!allowGuests)} />
            } />
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Max participants</Typography>
            <TextField size="small" type="number" fullWidth value={maxParts}
              onChange={(e) => setMaxParts(+e.target.value)} />
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Extend end time</Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Extend by</InputLabel>
              <Select label="Extend by" defaultValue=""
                onChange={(e) => act(ACTIONS.EXTEND, { minutes: +e.target.value })}>
                <MenuItem value="15">+15 min</MenuItem>
                <MenuItem value="30">+30 min</MenuItem>
                <MenuItem value="60">+1 hour</MenuItem>
              </Select>
            </FormControl>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Share</Typography>
            <Button size="small" fullWidth variant="outlined" onClick={() => act(ACTIONS.COPY_LINK)}>
              Copy join link
            </Button>
            <Button size="small" fullWidth variant="outlined" sx={{ mt: 1 }}
              onClick={() => act(ACTIONS.RESEND_INVITES)}>
              Resend invites
            </Button>
          </Paper>
        </Box>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack} />
    </Box>
  );
}

function ParticipantTable({ rows, waiting, onAct }) {
  if (rows.length === 0) return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary">— empty —</Typography>
    </Box>
  );
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Mic</TableCell>
          <TableCell>Net</TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(p => (
          <TableRow key={p.id} hover>
            <TableCell>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: 'primary.main' }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </Avatar>
                <Typography variant="body2">{p.name}</Typography>
                {p.isHost && <Chip size="small" label="Host" color="primary" sx={{ height: 18, fontSize: 10 }} />}
              </Box>
            </TableCell>
            <TableCell><Chip size="small" label={p.kind} variant="outlined" sx={{ height: 20, fontSize: 10 }} /></TableCell>
            <TableCell>{p.muted ? <MicOffIcon fontSize="small" color="disabled" /> : <MicIcon fontSize="small" color="success" />}</TableCell>
            <TableCell><Chip size="small" label={p.network} variant="outlined" sx={{ height: 20, fontSize: 10 }}
              color={p.network === 'good' ? 'success' : p.network === 'fair' ? 'warning' : 'error'} /></TableCell>
            <TableCell align="right">
              {waiting ? (
                <>
                  <Tooltip title="Admit"><IconButton size="small" color="success"
                    onClick={() => onAct(p, ACTIONS.P_UNMUTE, { admit: true })}>
                    <StartIcon fontSize="small" />
                  </IconButton></Tooltip>
                  <Tooltip title="Ban"><IconButton size="small" color="error"
                    onClick={() => onAct(p, ACTIONS.P_BAN)}><BanIcon fontSize="small" /></IconButton></Tooltip>
                </>
              ) : (
                <>
                  <Tooltip title={p.muted ? 'Unmute' : 'Mute'}>
                    <IconButton size="small" onClick={() => onAct(p, p.muted ? ACTIONS.P_UNMUTE : ACTIONS.P_MUTE)}>
                      {p.muted ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Send to waiting">
                    <IconButton size="small" onClick={() => onAct(p, ACTIONS.P_WAITING)}>
                      <WaitingIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {!p.isHost && (
                    <Tooltip title="Promote">
                      <IconButton size="small" onClick={() => onAct(p, ACTIONS.P_PROMOTE)}>
                        <PromoteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Kick">
                    <IconButton size="small" color="warning" onClick={() => onAct(p, ACTIONS.P_KICK)}>
                      <KickIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ban">
                    <IconButton size="small" color="error" onClick={() => onAct(p, ACTIONS.P_BAN)}>
                      <BanIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
