import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Tooltip, CircularProgress, Alert, Chip,
  Button, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Refresh as RefreshIcon, Check as CheckIcon, Close as CloseIcon,
} from '@mui/icons-material';
import {
  listImDeletionRequests, updateImDeletionRequest,
  IM_DELETION_STATUS,
} from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';
import ChannelChip from './_channelChip';

const STATUS_COLOR = { pending: 'warning', processed: 'success', rejected: 'default' };

export default function DeletionRequests() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'requestedAt', order: 'desc' };
      if (statusFilter !== 'all') {
        params['where[0][type]'] = 'equals';
        params['where[0][attribute]'] = 'status';
        params['where[0][value]'] = statusFilter;
      }
      const res = await listImDeletionRequests(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setErr(null);
    } catch (e) {
      setErr('Failed to load: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (r, status) => {
    try {
      await updateImDeletionRequest(r.id, { status, processedAt: new Date().toISOString() });
      load();
    } catch (e) {
      alert('Update failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader
        sectionLabel="Chat & IM"
        title="Data Deletion Requests"
        subtitle="GDPR-style deletion requests from customers. Approve or reject to update status."
        actions={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All</MenuItem>
            {IM_DELETION_STATUS.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
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
                    <TableCell sx={{ fontWeight: 600 }}>Requested</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Chat ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Channel</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Processed</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(r.requestedAt)}</TableCell>
                      <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{r.chatId}</TableCell>
                      <TableCell><ChannelChip channel={r.channel} /></TableCell>
                      <TableCell>
                        <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || 'default'}
                          variant="outlined" sx={{ fontSize: 11, textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{r.reason || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {r.processedAt ? fmtDate(r.processedAt) : '—'}
                      </TableCell>
                      <TableCell align="center">
                        {r.status === 'pending' ? (
                          <>
                            <Tooltip title="Approve">
                              <IconButton size="small" color="success" onClick={() => setStatus(r, 'processed')}>
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" color="error" onClick={() => setStatus(r, 'rejected')}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <Box component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>—</Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No deletion requests.
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
