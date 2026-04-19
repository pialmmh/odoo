import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { listImHandoffs } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';

export default function Handoffs() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'handoffAt', order: 'desc' };
      const res = await listImHandoffs(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setErr(null);
    } catch (e) {
      setErr('Failed to load: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader
        sectionLabel="Chat & IM"
        title="Handoffs"
        subtitle="Agent-to-agent conversation handoffs (read-only)."
        actions={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        }
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
                    <TableCell sx={{ fontWeight: 600 }}>Conversation</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>From</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>To</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Note</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(r.handoffAt)}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.conversationName || r.conversationId || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.fromUserName || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>{r.toUserName || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.note || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No handoffs recorded.
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
