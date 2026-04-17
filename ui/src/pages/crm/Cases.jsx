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
import { listCases, deleteCase, CASE_STATUSES, CASE_PRIORITIES } from '../../services/crm';

const STATUS_COLOR = {
  'New': 'info', 'Assigned': 'primary', 'Pending': 'warning',
  'Closed': 'success', 'Rejected': 'error', 'Duplicate': 'default',
};
const PRIORITY_COLOR = {
  'Low': 'default', 'Normal': 'info', 'High': 'warning', 'Urgent': 'error',
};

export default function Cases() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [statusF, setStatusF] = useState('all');
  const [priorityF, setPriorityF] = useState('all');
  const [page, setPage]       = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rowsPerPage, offset: page * rowsPerPage, orderBy: 'createdAt', order: 'desc' };
      let idx = 0;
      if (statusF !== 'all') {
        params[`where[${idx}][type]`]      = 'equals';
        params[`where[${idx}][attribute]`] = 'status';
        params[`where[${idx}][value]`]     = statusF;
        idx++;
      }
      if (priorityF !== 'all') {
        params[`where[${idx}][type]`]      = 'equals';
        params[`where[${idx}][attribute]`] = 'priority';
        params[`where[${idx}][value]`]     = priorityF;
        idx++;
      }
      if (search.trim()) {
        params[`where[${idx}][type]`]  = 'textFilter';
        params[`where[${idx}][value]`] = search.trim();
      }
      const res = await listCases(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setError(null);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, [page, rowsPerPage, search, statusF, priorityF]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row, e) => {
    e.stopPropagation();
    if (!confirm(`Delete case "${row.name}"?`)) return;
    try { await deleteCase(row.id); load(); }
    catch (err) { alert('Delete failed: ' + (err?.response?.data?.message || err.message)); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Cases</Typography>
          <Typography variant="body2" color="text.secondary">{total} total</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />}
            onClick={() => navigate('new')} sx={{ fontWeight: 600 }}>
            Create Case
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
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusF} label="Status"
            onChange={e => { setStatusF(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {CASE_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Priority</InputLabel>
          <Select value={priorityF} label="Priority"
            onChange={e => { setPriorityF(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Priorities</MenuItem>
            {CASE_PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
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
                    <TableCell sx={{ fontWeight: 600 }}>Number</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assigned</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>#{r.number || '—'}</Typography></TableCell>
                      <TableCell>
                        <MuiLink component={RouterLink} to={r.id} underline="hover" sx={{ fontWeight: 600 }}>
                          {r.name || '—'}
                        </MuiLink>
                      </TableCell>
                      <TableCell>{r.status && <Chip label={r.status} size="small" color={STATUS_COLOR[r.status] || 'default'} />}</TableCell>
                      <TableCell>{r.priority && <Chip label={r.priority} size="small" variant="outlined" color={PRIORITY_COLOR[r.priority] || 'default'} />}</TableCell>
                      <TableCell><Typography variant="body2">{r.accountName || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.assignedUserName || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{r.createdAt || '—'}</Typography></TableCell>
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
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No cases found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]} />
          </>
        )}
      </Card>
    </Box>
  );
}
