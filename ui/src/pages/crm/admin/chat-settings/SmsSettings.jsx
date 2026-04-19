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
import { listSmsSettings, deleteSmsSetting } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';

export default function SmsSettings() {
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
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'createdAt', order: 'desc' };
      if (search.trim()) {
        params['where[0][type]'] = 'textFilter';
        params['where[0][value]'] = search.trim();
      }
      const res = await listSmsSettings(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setErr(null);
    } catch (e) {
      setErr('Failed to load: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, search]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (r) => {
    if (!confirm(`Delete "${r.name}"?`)) return;
    try { await deleteSmsSetting(r.id); load(); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader
        sectionLabel="Chat & IM"
        title="SMS Settings"
        subtitle="Sender ID configuration for outbound SMS."
        actions={
          <>
            <Button variant="contained" startIcon={<AddIcon />} size="small"
              onClick={() => navigate(`${base}/crm/admin/smsSettings/new`)}>
              Create
            </Button>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
            </Tooltip>
          </>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
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
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Sender ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Default Sender</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Active</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`${base}/crm/admin/smsSettings/${r.id}/edit`)}>
                      <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                      <TableCell>{r.senderId || '—'}</TableCell>
                      <TableCell>{r.defaultSender || '—'}</TableCell>
                      <TableCell>
                        {r.isActive
                          ? <Chip size="small" label="Yes" color="success" variant="outlined" sx={{ fontSize: 11 }} />
                          : <Chip size="small" label="No" sx={{ fontSize: 11 }} />}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {fmtDate(r.createdAt)}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Edit">
                          <IconButton size="small"
                            onClick={() => navigate(`${base}/crm/admin/smsSettings/${r.id}/edit`)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => onDelete(r)} sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No SMS settings configured.
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
