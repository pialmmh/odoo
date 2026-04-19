import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Grid,
  MenuItem, Divider,
} from '@mui/material';
import {
  Search as SearchIcon, Edit as EditIcon, Refresh as RefreshIcon,
  ArrowBack as BackIcon, Download as DownloadIcon,
} from '@mui/icons-material';
import {
  listCampaignTasks, DISPOSITIONS, DISPOSITION_COLOR,
} from '../../../services/campaign';

// Campaign detail + tasks table.
// Top: summary stats card. Bottom: paginated task list with filters.
// Disposition/hangup_cause/answered_at/duration columns are pending backend
// schema additions — see ui-vs-api-todo.md. Cells fall back to '—' until wired.

const stateLabel = (s) => ({
  1: 'In-flight',
  2: 'Success',
  3: 'Failed',
  6: 'Pending',
  16: 'Timed out',
}[s] ?? String(s ?? '—'));

const stateChip = (s) => {
  const c = {
    1: { bg: 'info.light',    color: 'info.dark'    },
    2: { bg: 'success.light', color: 'success.dark' },
    3: { bg: 'error.light',   color: 'error.dark'   },
    6: { bg: 'grey.200',      color: 'text.secondary' },
    16:{ bg: 'warning.light', color: 'warning.dark' },
  }[s] || { bg: 'grey.100', color: 'text.secondary' };
  return <Chip size="small" label={stateLabel(s)} sx={{ ...c, fontSize: 11, fontWeight: 500 }} />;
};

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [phoneFilter, setPhoneFilter] = useState('');
  const [dispoFilter, setDispoFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignTasks(id, {
        page, size: rowsPerPage,
        phoneNumber: phoneFilter.trim() || undefined,
      });
      const list = res?.content || res?.list || res || [];
      setTasks(list);
      setTotal(res?.totalElements ?? res?.total ?? list.length);
    } catch (e) {
      setError('Failed to load tasks: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [id, page, rowsPerPage, phoneFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side disposition filter — backend has no disposition column yet.
  const visible = dispoFilter === 'all'
    ? tasks
    : tasks.filter(t => (t.disposition || '').toUpperCase() === dispoFilter);

  // Derive summary counts from loaded page (coarse — ideally a /stats endpoint).
  const counts = tasks.reduce((acc, t) => {
    const d = t.disposition || (t.state === 6 ? 'PENDING' : 'UNKNOWN');
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box sx={{ px: 4, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('..')}><BackIcon /></IconButton>
        <Typography variant="h6">Campaign #{id}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<EditIcon />} onClick={() => navigate('edit')}>
          Edit
        </Button>
        <Tooltip title="Export CSV (pending backend)">
          <span>
            <IconButton size="small" disabled><DownloadIcon fontSize="small" /></IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ px: 3, py: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
          Disposition summary (current page)
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3} md={2}>
            <Typography variant="caption" color="text.secondary">Total loaded</Typography>
            <Typography variant="h6">{tasks.length}</Typography>
          </Grid>
          {['ANSWERED_HUMAN','ANSWERED_MACHINE','BUSY','NO_ANSWER','PENDING','UNKNOWN'].map(k => (
            <Grid item xs={6} sm={3} md={2} key={k}>
              <Typography variant="caption" color="text.secondary">{k.replace('_',' ')}</Typography>
              <Typography variant="h6">{counts[k] || 0}</Typography>
            </Grid>
          ))}
        </Grid>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
          Accurate per-campaign totals require a backend stats endpoint — see ui-vs-api-todo.md.
        </Typography>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Filter by phone…"
          value={phoneFilter}
          onChange={e => { setPhoneFilter(e.target.value); setPage(0); }}
          sx={{ width: 240 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <TextField
          size="small" select label="Disposition" value={dispoFilter}
          onChange={e => setDispoFilter(e.target.value)} sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All dispositions</MenuItem>
          {DISPOSITIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
        </TextField>
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
                    <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>State</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Disposition</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Hangup cause</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Attempts</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Answered</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Next retry</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map(t => {
                    const dc = DISPOSITION_COLOR[(t.disposition || '').toUpperCase()];
                    return (
                      <TableRow key={t.uniqueId || t.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {t.phoneNumber || t.recipient || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>{stateChip(t.state)}</TableCell>
                        <TableCell>
                          {t.disposition ? (
                            <Chip size="small" label={t.disposition}
                              sx={{ ...(dc || { bg: 'grey.100', color: 'text.secondary' }),
                                    fontSize: 11, fontWeight: 500 }} />
                          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {t.hangupCause || t.statusExternal || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption">
                            {t.durationSec != null ? `${t.durationSec}s` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption">{t.retryCount ?? 0}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {t.answeredAt ? new Date(t.answeredAt).toLocaleString() : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {t.nextRetryTime ? new Date(t.nextRetryTime).toLocaleString() : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visible.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No tasks match filters</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[25, 50, 100, 250]}
            />
          </>
        )}
      </Card>
    </Box>
  );
}
