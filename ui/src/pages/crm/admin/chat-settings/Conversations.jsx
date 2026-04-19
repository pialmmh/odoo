import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment, IconButton, Tooltip,
  CircularProgress, Alert, Chip, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  listImConversations, CHAT_CHANNELS, IM_CONVERSATION_STATUS,
} from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';
import ChannelChip from './_channelChip';

const STATUS_COLOR = { open: 'success', closed: 'default', archived: 'info' };

export default function Conversations() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'lastMessageAt', order: 'desc' };
      let i = 0;
      if (channelFilter !== 'all') {
        params[`where[${i}][type]`] = 'equals';
        params[`where[${i}][attribute]`] = 'channel';
        params[`where[${i}][value]`] = channelFilter;
        i++;
      }
      if (statusFilter !== 'all') {
        params[`where[${i}][type]`] = 'equals';
        params[`where[${i}][attribute]`] = 'status';
        params[`where[${i}][value]`] = statusFilter;
        i++;
      }
      if (search.trim()) {
        params[`where[${i}][type]`] = 'textFilter';
        params[`where[${i}][value]`] = search.trim();
      }
      const res = await listImConversations(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setErr(null);
    } catch (e) {
      setErr('Failed to load: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, channelFilter, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader
        sectionLabel="Chat & IM"
        title="Conversations"
        subtitle="Runtime conversation records (read-only; written by the chat service)."
        actions={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Search…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Channel</InputLabel>
          <Select value={channelFilter} label="Channel"
            onChange={(e) => { setChannelFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All</MenuItem>
            {CHAT_CHANNELS.map((c) => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All</MenuItem>
            {IM_CONVERSATION_STATUS.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
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
                    <TableCell sx={{ fontWeight: 600 }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Channel</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Chat ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Unread</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Msg</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assigned</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{r.customerName || r.name}</TableCell>
                      <TableCell><ChannelChip channel={r.channel} /></TableCell>
                      <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{r.chatId}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || 'default'}
                          variant="outlined" sx={{ fontSize: 11, textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>
                        {r.unreadCount > 0
                          ? <Chip size="small" label={r.unreadCount} color="error" sx={{ fontSize: 11 }} />
                          : <Box component="span" sx={{ color: 'text.secondary' }}>—</Box>}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {fmtDate(r.lastMessageAt)}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.assignedUserName || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No conversations.
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
