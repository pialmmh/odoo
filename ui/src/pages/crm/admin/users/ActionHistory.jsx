import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Tooltip, CircularProgress, Alert, Chip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { listActionHistory } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';
import { ESPO_BASE_URL } from '../adminPanelSpec';

const ACTION_COLOR = {
  create: 'success', update: 'info', delete: 'error',
  read: 'default', createRelated: 'success', updateRelated: 'info',
};

export default function ActionHistory() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listActionHistory({
        maxSize: rpp, offset: page * rpp, orderBy: 'createdAt', order: 'desc',
      });
      setRows(res.list || []); setTotal(res.total ?? 0); setErr(null);
    } catch (e) {
      setErr('Failed to load action history: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader sectionLabel="Users" title="Action History" subtitle="Log of user actions."
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
                    <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Target</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>IP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const openUrl = r.targetType && r.targetId
                      ? `${ESPO_BASE_URL}/#${r.targetType}/view/${r.targetId}` : null;
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{r.userName || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={r.action || '—'}
                            color={ACTION_COLOR[r.action] || 'default'}
                            variant="outlined" sx={{ fontSize: 11 }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          {openUrl ? (
                            <a href={openUrl} target="_blank" rel="noopener"
                               style={{ color: 'inherit' }}>
                              {r.targetType}: {r.targetId}
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{r.ipAddress || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No entries</TableCell></TableRow>}
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
