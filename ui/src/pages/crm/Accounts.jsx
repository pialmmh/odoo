import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Link as MuiLink,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listAccounts, deleteAccount } from '../../services/crm';

// Columns from layouts/Account/list.json
const COLUMNS = [
  { key: 'name',                  label: 'Name' },
  { key: 'website',               label: 'Website' },
  { key: 'type',                  label: 'Type' },
  { key: 'billingAddressCountry', label: 'Country' },
];

export default function Accounts() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rowsPerPage, offset: page * rowsPerPage, orderBy: 'createdAt', order: 'desc' };
      if (search.trim()) {
        params['where[0][type]']  = 'textFilter';
        params['where[0][value]'] = search.trim();
      }
      const res = await listAccounts(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setError(null);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, [page, rowsPerPage, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row, e) => {
    e.stopPropagation();
    if (!confirm(`Delete account "${row.name}"?`)) return;
    try { await deleteAccount(row.id); load(); }
    catch (err) { alert('Delete failed: ' + (err?.response?.data?.message || err.message)); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Accounts</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'account' : 'accounts'} total
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />}
            onClick={() => navigate('new')} sx={{ fontWeight: 600 }}>
            Create Account
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search accounts…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 280 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
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
                    {COLUMNS.map(c => <TableCell key={c.key} sx={{ fontWeight: 600 }}>{c.label}</TableCell>)}
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
                      <TableCell><Typography variant="body2" sx={{ fontSize: 12 }}>{r.website || '—'}</Typography></TableCell>
                      <TableCell>{r.type && <Chip label={r.type} size="small" variant="outlined" />}</TableCell>
                      <TableCell><Typography variant="body2">{r.billingAddressCountry || '—'}</Typography></TableCell>
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
                      <TableCell colSpan={COLUMNS.length + 1} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No accounts found</Typography>
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
