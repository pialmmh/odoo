import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment, IconButton, Tooltip,
  CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listImCustomers, CHAT_CHANNELS } from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';
import ChannelChip from './_channelChip';

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'createdAt', order: 'desc' };
      let i = 0;
      if (channelFilter !== 'all') {
        params[`where[${i}][type]`] = 'equals';
        params[`where[${i}][attribute]`] = 'channel';
        params[`where[${i}][value]`] = channelFilter;
        i++;
      }
      if (search.trim()) {
        params[`where[${i}][type]`] = 'textFilter';
        params[`where[${i}][value]`] = search.trim();
      }
      const res = await listImCustomers(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setErr(null);
    } catch (e) {
      setErr('Failed to load: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, channelFilter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader
        sectionLabel="Chat & IM"
        title="IM Customers"
        subtitle="Chat-ID → CRM entity mapping (read-only)."
        actions={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
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
                    <TableCell sx={{ fontWeight: 600 }}>Channel</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Chat ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Linked Lead</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Linked Contact</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                      <TableCell><ChannelChip channel={r.channel} /></TableCell>
                      <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{r.chatId}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.phoneNumber || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.emailAddress || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.relatedLeadName || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.relatedContactName || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {fmtDate(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No customers.
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
