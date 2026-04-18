import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Tooltip, CircularProgress, Alert, Chip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { listAuthLog } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';

export default function AuthLog() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuthLog({
        maxSize: rpp, offset: page * rpp, orderBy: 'createdAt', order: 'desc',
      });
      setRows(res.list || []); setTotal(res.total ?? 0); setErr(null);
    } catch (e) {
      setErr('Failed to load auth log: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader sectionLabel="Users" title="Auth Log" subtitle="Login history."
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
                    <TableCell sx={{ fontWeight: 600 }}>When</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>IP</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Agent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell sx={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.userName || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.username || '—'}</TableCell>
                      <TableCell>
                        {r.isDenied
                          ? <Chip size="small" label="Denied" color="error" variant="outlined" sx={{ fontSize: 11 }} />
                          : <Chip size="small" label="Success" color="success" variant="outlined" sx={{ fontSize: 11 }} />}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.authenticationMethod || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.ipAddress || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 11, color: 'text.secondary', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.requestUrl || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No entries</TableCell></TableRow>}
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
