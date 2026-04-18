import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Tooltip, CircularProgress, Alert, Chip,
} from '@mui/material';
import { Refresh as RefreshIcon, Block as RevokeIcon } from '@mui/icons-material';
import { listAuthTokens, revokeAuthToken } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';

export default function AuthTokens() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuthTokens({
        maxSize: rpp, offset: page * rpp, orderBy: 'lastAccess', order: 'desc',
      });
      setRows(res.list || []); setTotal(res.total ?? 0); setErr(null);
    } catch (e) {
      setErr('Failed to load auth tokens: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp]);

  useEffect(() => { load(); }, [load]);

  const onRevoke = async (t) => {
    if (!confirm(`Revoke this session for "${t.userName}"?`)) return;
    try { await revokeAuthToken(t.id); load(); }
    catch (e) { alert('Revoke failed: ' + (e?.response?.data?.message || e.message)); }
  };

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader sectionLabel="Users" title="Auth Tokens"
        subtitle="Active auth sessions. IP address and last access date."
        actions={<Tooltip title="Refresh"><IconButton size="small" onClick={load}><RefreshIcon /></IconButton></Tooltip>}
      />
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Active</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>IP</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last access</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell sx={{ fontSize: 12 }}>{t.userName || '—'}</TableCell>
                      <TableCell>
                        {t.isActive
                          ? <Chip size="small" label="Active" color="success" variant="outlined" sx={{ fontSize: 11 }} />
                          : <Chip size="small" label="Inactive" sx={{ fontSize: 11 }} />}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{t.ipAddress || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(t.createdAt)}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(t.lastAccess)}</TableCell>
                      <TableCell align="center">
                        {t.isActive && (
                          <Tooltip title="Revoke session">
                            <IconButton size="small" onClick={() => onRevoke(t)} sx={{ color: 'error.main' }}>
                              <RevokeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No auth tokens</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rpp}
              onRowsPerPageChange={(e) => { setRpp(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[25, 50, 100, 200]} />
          </>
        )}
      </Card>
    </Box>
  );
}
