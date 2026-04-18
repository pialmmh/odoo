import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress, Alert,
  Button, IconButton, Tooltip, Snackbar, Menu, MenuItem, Divider,
  Link as MuiLink, TextField,
} from '@mui/material';
import {
  Refresh as RefreshIcon, PlayArrow as StartIcon, Stop as EndIcon,
  Schedule as ExtendIcon, Block as ExpireIcon, Settings as ControlIcon,
  ContentCopy as CopyIcon, Videocam as VideoIcon, OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { listMeetings } from '../../../services/crm';
import { STAGES, STAGE_COLOR, TERMINAL, ACTIONS, deriveStage, dispatchAction, fmtDT } from './lifecycle';

const REFRESH_MS = 30_000;

export default function MeetingsDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [snack, setSnack] = useState(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMeetings({
        maxSize: 200, orderBy: 'dateStart', order: 'asc',
        // Pull a generous window so we can bucket them client-side
      });
      setRows(res.list || []);
      setErr(null);
    } catch (e) { setErr(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const iv = setInterval(load, REFRESH_MS);
    return () => clearInterval(iv);
  }, [load]);

  const bucketed = useMemo(() => {
    const live = [], upcoming = [], recent = [];
    rows.forEach(m => {
      const stage = deriveStage(m, now);
      const item = { ...m, _stage: stage };
      if (stage === STAGES.LIVE || stage === STAGES.LOBBY_OPEN || stage === STAGES.ON_HOLD) {
        live.push(item);
      } else if (!TERMINAL.has(stage)) {
        upcoming.push(item);
      } else {
        recent.push(item);
      }
    });
    // Sort: live by roomStartedAt desc; upcoming by dateStart asc; recent by dateEnd desc
    recent.sort((a, b) => new Date(b.dateEnd || 0) - new Date(a.dateEnd || 0));
    return { live, upcoming, recent: recent.slice(0, 20) };
  }, [rows, now]);

  const act = async (m, action, payload) => {
    try {
      await dispatchAction(m.id, action, payload);
      setSnack(`${action} → ${m.name}`);
      load();
    } catch (e) {
      setSnack(`Failed: ${e.message}`);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Meeting Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Live operations view · refreshed {fmtDT(now.toISOString())}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small" startIcon={<VideoIcon />}
            onClick={() => navigate('../meetings/new')}>Schedule</Button>
          <Tooltip title="Refresh"><IconButton size="small" onClick={load}><RefreshIcon /></IconButton></Tooltip>
        </Box>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {loading && rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}>
          <Column title="Live / Lobby" empty="No active rooms" items={bucketed.live}
            renderCard={(m) => <MeetingCard m={m} now={now} onAct={act} navigate={navigate} variant="live" />} />
          <Column title="Upcoming" empty="Nothing scheduled" items={bucketed.upcoming}
            renderCard={(m) => <MeetingCard m={m} now={now} onAct={act} navigate={navigate} variant="upcoming" />} />
          <Column title="Recently ended" empty="No recent meetings" items={bucketed.recent}
            renderCard={(m) => <MeetingCard m={m} now={now} onAct={act} navigate={navigate} variant="ended" />} />
        </Box>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} message={snack} />
    </Box>
  );
}

function Column({ title, items, empty, renderCard }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8 }}>
        {title} <Typography component="span" variant="caption" color="text.secondary">({items.length})</Typography>
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {items.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 2, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1, textAlign: 'center' }}>
            {empty}
          </Typography>
        ) : items.map(renderCard)}
      </Box>
    </Box>
  );
}

function MeetingCard({ m, now, onAct, navigate, variant }) {
  const [anchor, setAnchor] = useState(null);
  const stage = m._stage;
  const participants = m.roomParticipantCount ?? '—';

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
          <MuiLink component={RouterLink} to={`../meetings/${m.id}`} underline="hover"
            sx={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.name || '(untitled)'}
          </MuiLink>
          <Chip size="small" label={stage} color={STAGE_COLOR[stage] || 'default'}
            sx={{ fontSize: 10, height: 20 }} />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {fmtDT(m.dateStart)} → {fmtDT(m.dateEnd)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Host: {m.assignedUserName || '—'} · {participants} participants
        </Typography>

        {/* Action row */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {variant === 'live' && (
            <>
              <Button size="small" variant="contained" color="success" startIcon={<VideoIcon />}
                onClick={() => navigate(`../meetings/${m.id}/room`)}>Join</Button>
              <Button size="small" startIcon={<ControlIcon />}
                onClick={() => navigate(`../meetings/${m.id}/control`)}>Control</Button>
              <Button size="small" color="error" startIcon={<EndIcon />}
                onClick={() => onAct(m, ACTIONS.END)}>End</Button>
              <Button size="small" startIcon={<ExtendIcon />}
                onClick={() => onAct(m, ACTIONS.EXTEND, { minutes: 15 })}>+15m</Button>
            </>
          )}
          {variant === 'upcoming' && (
            <>
              <Button size="small" variant="contained" startIcon={<StartIcon />}
                onClick={async () => { await onAct(m, ACTIONS.START); navigate(`../meetings/${m.id}/room`); }}>Start</Button>
              <Button size="small" startIcon={<CopyIcon />}
                onClick={() => onAct(m, ACTIONS.COPY_LINK)}>Copy link</Button>
              <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
                <OpenIcon fontSize="small" />
              </IconButton>
              <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => { setAnchor(null); onAct(m, ACTIONS.RESEND_INVITES); }}>Resend invites</MenuItem>
                <MenuItem onClick={() => { setAnchor(null); onAct(m, ACTIONS.EXTEND, { minutes: 30 }); }}>Extend +30m</MenuItem>
                <Divider />
                <MenuItem onClick={() => { setAnchor(null); onAct(m, ACTIONS.CANCEL); }}>Cancel meeting</MenuItem>
                <MenuItem onClick={() => { setAnchor(null); onAct(m, ACTIONS.EXPIRE); }}>Mark expired</MenuItem>
              </Menu>
            </>
          )}
          {variant === 'ended' && (
            <Typography variant="caption" color="text.secondary">
              Duration: {durationText(m.dateStart, m.roomEndedAt || m.dateEnd)}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function durationText(a, b) {
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return '—';
  const min = Math.max(0, Math.round((db - da) / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? `${h}h ` : '') + `${m}m`;
}
