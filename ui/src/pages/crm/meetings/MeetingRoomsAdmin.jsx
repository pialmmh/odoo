import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress, Alert,
  Button, IconButton, Tooltip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Switch, FormControlLabel, Paper, Divider, Link as MuiLink,
  Snackbar,
} from '@mui/material';
import {
  Refresh as RefreshIcon, Stop as ForceEndIcon, Block as ExpireIcon,
  Settings as ControlIcon, Shield as LockdownIcon,
} from '@mui/icons-material';
import { listMeetings } from '../../../services/crm';
import { STAGES, STAGE_COLOR, TERMINAL, ACTIONS, deriveStage, dispatchAction, fmtDT } from './lifecycle';

export default function MeetingRoomsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [snack, setSnack] = useState(null);
  const [now, setNow] = useState(new Date());
  const [lockdown, setLockdown] = useState(false);

  // Quota placeholders — will come from /api/crm/meetings/quota once backend is ready.
  const quota = {
    concurrentRoomsMax: 50, concurrentRoomsUsed: 0,       // populated below
    participantsMax: 500,    participantsUsed: 0,
    recordingGbMax: 100,     recordingGbUsed: 4.2,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMeetings({ maxSize: 300, orderBy: 'dateStart', order: 'desc' });
      setRows(res.list || []);
      setErr(null);
    } catch (e) { setErr(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const a = setInterval(() => setNow(new Date()), 15_000);
    const b = setInterval(load, 30_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [load]);

  const live = useMemo(() => rows.map(m => ({ ...m, _stage: deriveStage(m, now) }))
    .filter(m => !TERMINAL.has(m._stage) && m._stage !== STAGES.SCHEDULED),
    [rows, now]);

  quota.concurrentRoomsUsed = live.filter(m => m._stage === STAGES.LIVE).length;
  quota.participantsUsed = live.reduce((s, m) => s + (m.roomParticipantCount || 0), 0);

  const act = async (m, action) => {
    try {
      await dispatchAction(m.id, action);
      setSnack(`${action} → ${m.name}`);
      load();
    } catch (e) { setSnack(`Failed: ${e.message}`); }
  };

  const tenantAct = async (action) => {
    try {
      await dispatchAction('*', action);
      setSnack(`Tenant action: ${action}`);
    } catch (e) { setSnack(`Failed: ${e.message}`); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Rooms — Tenant Admin</Typography>
          <Typography variant="body2" color="text.secondary">
            Live rooms across the tenant. Destructive actions are audited.
          </Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton size="small" onClick={load}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {/* Quota + tenant-level switches */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2, mb: 2 }}>
        <QuotaCard label="Live rooms" used={quota.concurrentRoomsUsed} max={quota.concurrentRoomsMax} />
        <QuotaCard label="Active participants" used={quota.participantsUsed} max={quota.participantsMax} />
        <QuotaCard label="Recording storage (GB)" used={quota.recordingGbUsed} max={quota.recordingGbMax} precision={1} />
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
            Emergency
          </Typography>
          <FormControlLabel sx={{ mt: 0.5 }} label="Tenant lockdown (block new rooms)" control={
            <Switch size="small" checked={lockdown}
              onChange={() => { setLockdown(!lockdown); tenantAct(lockdown ? 'lockdownOff' : 'lockdownOn'); }} />
          } />
          <Divider sx={{ my: 1 }} />
          <Button fullWidth size="small" variant="outlined" color="warning" startIcon={<ExpireIcon />}
            onClick={() => tenantAct('expireStale')}>
            Expire stale rooms
          </Button>
        </Paper>
      </Box>

      {loading && rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Meeting</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Stage</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Host</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Started</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Scheduled End</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Participants</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {live.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No live rooms right now
                    </TableCell>
                  </TableRow>
                )}
                {live.map(m => (
                  <TableRow key={m.id} hover>
                    <TableCell>
                      <MuiLink component={RouterLink} to={`../meetings/${m.id}`} underline="hover"
                        sx={{ fontWeight: 600 }}>{m.name}</MuiLink>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={m._stage} color={STAGE_COLOR[m._stage] || 'default'}
                        sx={{ fontSize: 10, height: 20 }} />
                    </TableCell>
                    <TableCell><Typography variant="caption">{m.assignedUserName || '—'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{fmtDT(m.roomStartedAt || m.dateStart)}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{fmtDT(m.dateEnd)}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{m.roomParticipantCount ?? '—'}</Typography></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Open control panel">
                        <IconButton size="small" component={RouterLink} to={`../meetings/${m.id}/control`}>
                          <ControlIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Force end (Admin Ended)">
                        <IconButton size="small" color="error" onClick={() => act(m, ACTIONS.ADMIN_END)}>
                          <ForceEndIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Expire">
                        <IconButton size="small" color="warning" onClick={() => act(m, ACTIONS.EXPIRE)}>
                          <ExpireIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack} />
    </Box>
  );
}

function QuotaCard({ label, used, max, precision = 0 }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const color = pct > 90 ? 'error.main' : pct > 70 ? 'warning.main' : 'success.main';
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
        {used.toFixed(precision)} <Typography component="span" variant="caption" color="text.secondary">/ {max}</Typography>
      </Typography>
      <Box sx={{ mt: 0.5, height: 4, bgcolor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color }} />
      </Box>
    </Paper>
  );
}
