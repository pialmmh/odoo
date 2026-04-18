import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Link as MuiLink,
  Avatar, AvatarGroup, FormControlLabel, Switch, Stack,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Refresh as RefreshIcon, PlayArrow as PlayIcon, Pause as PauseIcon,
  Stop as StopIcon, Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  listCampaigns, enableCampaign, disableCampaign,
} from '../../../../services/voiceCampaign';

// Voice campaigns list. Columns modelled on the MightyCall dialer wiki:
// Status · Name · Description · Agents · Records · Coverage · Actions.
//
// Backend doesn't carry most of these yet — values fall back to em-dash and
// the gaps are tracked in campaign/ui-vs-api-todo.md.

const STATUS = {
  Running:    { bg: '#dcfce7', color: '#15803d', dot: '#16a34a' },
  Paused:     { bg: '#fef9c3', color: '#a16207', dot: '#ca8a04' },
  Ready:      { bg: '#fef9c3', color: '#a16207', dot: '#ca8a04' },
  Scheduled:  { bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
  Incomplete: { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626' },
  Completed:  { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  Preparing:  { bg: '#f3f4f6', color: '#9ca3af', dot: '#d1d5db' },
  Expired:    { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
};

const deriveStatus = (c) => {
  if (c.expireAt && new Date(c.expireAt) < new Date()) return 'Expired';
  if (c.status) return c.status;
  if (c.enabled) return 'Running';
  return 'Paused';
};

const isVoice = (c) =>
  (c.campaignType || c.type || '').toUpperCase() === 'VOICE' || !!c.audioFilePath;

const initials = (name) => (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

const coveragePill = (cov) => {
  if (!cov) return null;
  const [done, total] = cov.split('/').map(Number);
  const pct = total ? Math.round(100 * done / total) : 0;
  const good = pct >= 80;
  return (
    <Chip
      size="small"
      label={`${cov} · ${pct}%`}
      sx={{
        fontSize: 11, fontWeight: 600,
        bgcolor: good ? '#dcfce7' : '#fef9c3',
        color:   good ? '#15803d' : '#a16207',
      }}
    />
  );
};

export default function VoiceCampaigns() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dncScrubber, setDncScrubber] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listCampaigns(page, rowsPerPage);
      const list = res?.content || res?.list || res || [];
      const count = res?.totalElements ?? res?.total ?? list.length;
      setRows(list.filter(isVoice));
      setTotal(count);
    } catch (e) {
      setError('Failed to load campaigns: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rowsPerPage]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (c) => {
    try {
      if (c.enabled) await disableCampaign(c); else await enableCampaign(c);
      await load();
    } catch (e) {
      alert('Action failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  const filtered = rows.filter(c =>
    !search.trim() ||
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ px: 4, py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Voice Campaigns</Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} of {total} campaigns
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small"
            startIcon={<AddIcon />} onClick={() => navigate('new')}>
            New Campaign
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ px: 2, py: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
          DNC compliance
        </Typography>
        <FormControlLabel
          control={<Switch size="small" checked={dncScrubber} onChange={e => setDncScrubber(e.target.checked)} />}
          label={<Typography variant="body2">National DNC scrubber</Typography>}
        />
        <MuiLink component="button" variant="body2" onClick={() => alert('Local DNC list — not yet wired')}>
          Local DNC list (0)
        </MuiLink>
      </Card>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search by name or description…"
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ width: 320 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
      </Box>

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Agents</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Records</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Coverage</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(c => {
                    const id = c.id || c.campaignId;
                    const status = deriveStatus(c);
                    const s = STATUS[status] || STATUS.Preparing;
                    const agents = c.agents || [];
                    const recordCount = c.totalTasks ?? c.taskCount ?? c.recordCount ?? '—';
                    const recordList = c.recordListName || c.listName;
                    const cov = c.coverageScore;
                    const running = status === 'Running';
                    return (
                      <TableRow key={id} hover>
                        <TableCell>
                          <Chip
                            size="small"
                            label={
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.dot }} />
                                <span>{status}</span>
                              </Stack>
                            }
                            sx={{ bgcolor: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <MuiLink component={RouterLink} to={`${id}`}
                            underline="hover" sx={{ fontWeight: 600 }}>
                            {c.name || '—'}
                          </MuiLink>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary"
                            sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.description || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {agents.length > 0 ? (
                            <AvatarGroup max={4} sx={{ justifyContent: 'flex-start' }}>
                              {agents.map((a, i) => (
                                <Avatar key={i} sx={{ width: 26, height: 26, fontSize: 10 }}>
                                  {initials(a.name || a)}
                                </Avatar>
                              ))}
                            </AvatarGroup>
                          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>
                          {recordList ? (
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 500 }}>
                                {recordList}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {recordCount} records
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption">{recordCount}</Typography>
                          )}
                        </TableCell>
                        <TableCell>{coveragePill(cov) || <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                        <TableCell align="center">
                          <Tooltip title={running ? 'Pause' : 'Play'}>
                            <IconButton size="small" onClick={() => toggle(c)}
                              sx={{ color: running ? 'warning.main' : 'success.main' }}>
                              {running ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Stop">
                            <IconButton size="small" disabled sx={{ color: 'error.main' }}>
                              <StopIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => navigate(`${id}`)}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => navigate(`${id}/edit`)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No voice campaigns found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div" count={total}
              page={page} onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Card>
    </Box>
  );
}
