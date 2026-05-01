import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, ToggleButton, ToggleButtonGroup,
  Tooltip, Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon, Search as SearchIcon, Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { listLeads, deleteLead } from '../../services/odoo-crm';

// odoo m2o fields come back as [id, "Display Name"] tuples
const m2oName = (v) => (Array.isArray(v) ? v[1] : v || '');

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d) ? s : d.toLocaleString();
};

const fmtMoney = (n) =>
  n == null ? '' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LeadsOdoo() {
  const navigate = useNavigate();
  const [type, setType] = useState('lead');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLeads({
        type, search, limit: rowsPerPage, offset: page * rowsPerPage,
      });
      setRows(res.rows || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [type, search, page, rowsPerPage]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (e, row) => {
    e.stopPropagation();
    if (!confirm(`Delete "${row.name}"?`)) return;
    try {
      await deleteLead(row.id);
      load();
    } catch (err) {
      alert('Delete failed: ' + (err?.response?.data?.message || err.message));
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ flex: 1 }}>
          {type === 'lead' ? 'Leads' : 'Opportunities'} <Chip size="small" label="Odoo · spike" sx={{ ml: 1 }} />
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={type}
          onChange={(_, v) => { if (v) { setType(v); setPage(0); } }}
        >
          <ToggleButton value="lead">Leads</ToggleButton>
          <ToggleButton value="opportunity">Opportunities</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="Search name / contact / email / phone"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 320 }}
        />
        <Tooltip title="Reload">
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => navigate('new')}>
          New
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Salesperson</TableCell>
                <TableCell align="right">Probability</TableCell>
                <TableCell align="right">Expected Rev.</TableCell>
                <TableCell>Created</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={10} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={10} align="center"><Typography color="text.secondary" sx={{ py: 4 }}>No records</Typography></TableCell></TableRow>
              )}
              {!loading && rows.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`${r.id}/edit`)}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.contact_name || r.partner_name || ''}</TableCell>
                  <TableCell>{r.email_from || ''}</TableCell>
                  <TableCell>{r.phone || ''}</TableCell>
                  <TableCell>{m2oName(r.stage_id)}</TableCell>
                  <TableCell>{m2oName(r.user_id)}</TableCell>
                  <TableCell align="right">{r.probability != null ? `${r.probability}%` : ''}</TableCell>
                  <TableCell align="right">{fmtMoney(r.expected_revenue)}</TableCell>
                  <TableCell>{fmtDate(r.create_date)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={(e) => onDelete(e, r)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Phase 0 spike — talks directly to Odoo `crm.lead` via `/api/odoo` proxy. Espo path untouched.
      </Typography>
    </Box>
  );
}
