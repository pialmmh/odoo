import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment, Button, IconButton, Tooltip,
  CircularProgress, Alert, Chip, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listUsers, deleteUser, USER_TYPES } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';

const TYPE_COLOR = {
  admin: 'error',
  'super-admin': 'error',
  regular: 'primary',
  portal: 'info',
  api: 'warning',
  system: 'default',
};

export default function Users() {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('active');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'userName', order: 'asc' };
      let i = 0;
      if (typeFilter !== 'all') {
        params[`where[${i}][type]`] = 'equals';
        params[`where[${i}][attribute]`] = 'type';
        params[`where[${i}][value]`] = typeFilter;
        i++;
      }
      if (activeFilter !== 'all') {
        params[`where[${i}][type]`] = 'equals';
        params[`where[${i}][attribute]`] = 'isActive';
        params[`where[${i}][value]`] = activeFilter === 'active';
        i++;
      }
      if (search.trim()) {
        params[`where[${i}][type]`] = 'textFilter';
        params[`where[${i}][value]`] = search.trim();
      }
      const res = await listUsers(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setErr(null);
    } catch (e) {
      setErr('Failed to load users: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, typeFilter, activeFilter, search]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (u) => {
    if (!confirm(`Delete user "${u.userName}"?`)) return;
    try { await deleteUser(u.id); load(); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader
        sectionLabel="Users"
        title="Users"
        subtitle="Users management."
        actions={
          <>
            <Button variant="contained" startIcon={<AddIcon />} size="small"
              onClick={() => navigate(`${base}/crm/admin/users/new`)}>
              Create User
            </Button>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
            </Tooltip>
          </>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Search…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All</MenuItem>
            {USER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={activeFilter} label="Status" onChange={(e) => { setActiveFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
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
                    <TableCell sx={{ fontWeight: 600 }}>User Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Active</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Teams</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last login</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`${base}/crm/admin/users/${u.id}/edit`)}>
                      <TableCell sx={{ fontWeight: 500 }}>{u.userName}</TableCell>
                      <TableCell>{u.name || '—'}</TableCell>
                      <TableCell>{u.emailAddress || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={u.type} color={TYPE_COLOR[u.type] || 'default'}
                          variant="outlined" sx={{ fontSize: 11 }} />
                      </TableCell>
                      <TableCell>
                        {u.isActive
                          ? <Chip size="small" label="Yes" color="success" variant="outlined" sx={{ fontSize: 11 }} />
                          : <Chip size="small" label="No" sx={{ fontSize: 11 }} />}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>
                        {(u.teamsNames && Object.values(u.teamsNames).join(', ')) || '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {u.lastAccess ? fmtDate(u.lastAccess) : '—'}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => navigate(`${base}/crm/admin/users/${u.id}/edit`)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => onDelete(u)} sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rpp}
              onRowsPerPageChange={(e) => { setRpp(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </Card>

    </Box>
  );
}
