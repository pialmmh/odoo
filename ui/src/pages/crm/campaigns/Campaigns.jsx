import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Link as MuiLink,
  MenuItem, Stack,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Refresh as RefreshIcon, PlayArrow as PlayIcon, Pause as PauseIcon,
  Stop as StopIcon, Visibility as ViewIcon,
  Sms as SmsIcon, Phone as VoiceIcon, Email as EmailIcon,
  Hub as HybridIcon, SupportAgent as AgentIcon,
} from '@mui/icons-material';
import {
  listCampaigns, enableCampaign, disableCampaign, CAMPAIGN_TYPES,
} from '../../../services/campaign';

// Unified campaign list — any campaign type (SMS / Voice / Email / Hybrid)
// appears here. Type column + type filter replace the old per-channel pages.

const TYPE_META = {
  SMS:             { label: 'SMS',            icon: <SmsIcon fontSize="small" />,    color: '#1e40af', bg: '#dbeafe' },
  VOICE_AGENTLESS: { label: 'Voice · Auto',   icon: <VoiceIcon fontSize="small" />,  color: '#065f46', bg: '#dcfce7' },
  VOICE_AGENT:     { label: 'Voice · Agent',  icon: <AgentIcon fontSize="small" />,  color: '#5b21b6', bg: '#ede9fe' },
  EMAIL:           { label: 'Email',          icon: <EmailIcon fontSize="small" />,  color: '#9a3412', bg: '#ffedd5' },
  HYBRID:          { label: 'Hybrid',         icon: <HybridIcon fontSize="small" />, color: '#831843', bg: '#fce7f3' },
};

const STATUS = {
  Running:    { bg: '#eef5e0', color: '#6b8f4e', dot: '#94bc66' },
  Scheduled:  { bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
  Paused:     { bg: '#fef9c3', color: '#a16207', dot: '#ca8a04' },
  Draft:      { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  Completed:  { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  Expired:    { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
};

const deriveType = (c) => (c.campaignType || c.type || 'SMS').toUpperCase();

const deriveStatus = (c) => {
  if (c.status && typeof c.status === 'string') return c.status;
  if (c.expireAt && new Date(c.expireAt) < new Date()) return 'Expired';
  if (c.scheduledAt && new Date(c.scheduledAt) > new Date()) return 'Scheduled';
  if (c.enabled) return 'Running';
  if (c.id || c.campaignId) return 'Paused';
  return 'Draft';
};

export default function Campaigns() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listCampaigns(page, rowsPerPage);
      const list = res?.content || res?.list || res || [];
      setRows(list);
      setTotal(res?.totalElements ?? res?.total ?? list.length);
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

  const filtered = rows.filter(c => {
    if (typeFilter !== 'all' && deriveType(c) !== typeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
           (c.description || '').toLowerCase().includes(q);
  });

  return (
    <Box sx={{ px: 4, py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Campaigns</Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} of {total}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => navigate('new')}>
            New Campaign
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search name or description…"
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ width: 320 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <TextField size="small" select label="Type"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          sx={{ minWidth: 180 }}>
          <MenuItem value="all">All types</MenuItem>
          {CAMPAIGN_TYPES.map(t => (
            <MenuItem key={t} value={t}>{TYPE_META[t]?.label || t}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Tasks</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Sent / Failed</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Scheduled</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(c => {
                    const id = c.id || c.campaignId;
                    const type = deriveType(c);
                    const tm = TYPE_META[type] || TYPE_META.SMS;
                    const status = deriveStatus(c);
                    const sm = STATUS[status] || STATUS.Draft;
                    const running = status === 'Running';
                    return (
                      <TableRow key={id || Math.random()} hover>
                        <TableCell>
                          <Chip size="small"
                            icon={tm.icon}
                            label={tm.label}
                            sx={{ bgcolor: tm.bg, color: tm.color, fontSize: 11, fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small"
                            label={
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: sm.dot }} />
                                <span>{status}</span>
                              </Stack>
                            }
                            sx={{ bgcolor: sm.bg, color: sm.color, fontSize: 11, fontWeight: 600 }} />
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
                        <TableCell align="right">
                          <Typography variant="caption">
                            {c.totalTaskCount ?? c.totalTasks ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption">
                            <Box component="span" sx={{ color: 'success.main' }}>{c.sentTaskCount ?? 0}</Box>
                            {' / '}
                            <Box component="span" sx={{ color: 'error.main' }}>{c.failedTaskCount ?? 0}</Box>
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={running ? 'Pause' : 'Start'}>
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
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No campaigns found</Typography>
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
