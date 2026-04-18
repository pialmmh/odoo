import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Link as MuiLink,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listMeetings, deleteMeeting, MEETING_STATUSES } from '../../services/crm';

const STATUS_COLOR = { Planned: 'default', Held: 'success', 'Not Held': 'warning' };

function fmtDT(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Meetings() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [statusF, setStatusF] = useState('all');
  const [page, setPage]       = useState(0);
  const [rpp, setRpp]         = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'dateStart', order: 'desc' };
      let i = 0;
      if (statusF !== 'all') {
        params[`where[${i}][type]`]      = 'equals';
        params[`where[${i}][attribute]`] = 'status';
        params[`where[${i}][value]`]     = statusF;
        i++;
      }
      if (search.trim()) {
        params[`where[${i}][type]`]  = 'textFilter';
        params[`where[${i}][value]`] = search.trim();
      }
      const res = await listMeetings(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setError(null);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, [page, rpp, search, statusF]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row, e) => {
    e.stopPropagation();
    if (!confirm(`Delete meeting "${row.name}"?`)) return;
    try { await deleteMeeting(row.id); load(); }
    catch (err) { alert('Delete failed: ' + (err?.response?.data?.message || err.message)); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Meetings</Typography>
          <Typography variant="body2" color="text.secondary">{total} total</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />}
            onClick={() => navigate('new')} sx={{ fontWeight: 600 }}>
            Create Meeting
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField size="small" placeholder="Search…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 280 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusF} label="Status"
            onChange={e => { setStatusF(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {MEETING_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
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
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Start</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>End</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Parent</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assigned</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <MuiLink component={RouterLink} to={r.id} underline="hover" sx={{ fontWeight: 600 }}>
                          {r.name || '—'}
                        </MuiLink>
                      </TableCell>
                      <TableCell>{r.status && <Chip label={r.status} size="small" color={STATUS_COLOR[r.status] || 'default'} />}</TableCell>
                      <TableCell><Typography variant="caption">{fmtDT(r.dateStart)}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{fmtDT(r.dateEnd)}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.parentName ? `${r.parentType || ''}: ${r.parentName}` : '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.assignedUserName || '—'}</Typography></TableCell>
                      <TableCell align="center">
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={e => handleDelete(r, e)} sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No meetings found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rpp}
              onRowsPerPageChange={e => { setRpp(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]} />
          </>
        )}
      </Card>
    </Box>
  );
}
