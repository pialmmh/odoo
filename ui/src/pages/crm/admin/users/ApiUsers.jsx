import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment, Button, IconButton, Tooltip,
  CircularProgress, Alert, Chip,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listApiUsers, deleteUser } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';

// API Users == User with type='api'. Reuses the full-page UserEdit; new
// entries default to type='api' via the ?type=api query param.
export default function ApiUsers() {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'userName', order: 'asc' };
      if (search.trim()) {
        params['where[1][type]'] = 'textFilter';
        params['where[1][value]'] = search.trim();
      }
      const res = await listApiUsers(params);
      setRows(res.list || []); setTotal(res.total ?? 0); setErr(null);
    } catch (e) {
      setErr('Failed to load API users: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, search]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (u) => {
    if (!confirm(`Delete API user "${u.userName}"?`)) return;
    try { await deleteUser(u.id); load(); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  const openNew = () => navigate(`${base}/crm/admin/users/new?type=api`);
  const openEdit = (u) => navigate(`${base}/crm/admin/users/${u.id}/edit`);

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader sectionLabel="Users" title="API Users"
        subtitle="Separate users for integration purposes."
        actions={
          <>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNew}>
              Create API User
            </Button>
            <Tooltip title="Refresh"><IconButton size="small" onClick={load}><RefreshIcon /></IconButton></Tooltip>
          </>
        }
      />
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
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
                    <TableCell sx={{ fontWeight: 600 }}>User Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Auth Method</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Active</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last access</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => openEdit(u)}>
                      <TableCell sx={{ fontWeight: 500 }}>{u.userName}</TableCell>
                      <TableCell>
                        <Chip size="small" label={u.authMethod || '—'} variant="outlined" sx={{ fontSize: 11 }} />
                      </TableCell>
                      <TableCell>
                        {u.isActive
                          ? <Chip size="small" label="Yes" color="success" variant="outlined" sx={{ fontSize: 11 }} />
                          : <Chip size="small" label="No" sx={{ fontSize: 11 }} />}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(u.lastAccess)}</TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(u)} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No API users</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rpp}
              onRowsPerPageChange={(e) => { setRpp(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]} />
          </>
        )}
      </Card>

    </Box>
  );
}
