import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment, IconButton, Tooltip,
  CircularProgress, Alert, Chip,
} from '@mui/material';
import {
  Search as SearchIcon, Edit as EditIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listPbxExtensions } from '../../../../services/crm';
import { AdminPageHeader } from '../_shared';

// Pull the extension token out of `user/<ext>@<domain>`.
function extFromContact(contact) {
  if (!contact) return null;
  const m = String(contact).match(/^user\/([^@]+)@/);
  return m ? m[1] : null;
}

export default function Agents() {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';

  const [data, setData] = useState({ extensions: [], agents: [], domainName: '' });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPbxExtensions();
      setData({
        extensions: res.extensions || [],
        agents: res.agents || [],
        domainName: res.domainName || '',
      });
      setErr(null);
    } catch (e) {
      setErr('Failed to load: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // extension number → extension object, for CID lookup.
  const extByNumber = useMemo(() => {
    const m = {};
    for (const e of data.extensions) m[e.extension] = e;
    return m;
  }, [data.extensions]);

  const rows = useMemo(() => {
    return data.agents
      .slice()
      .sort((a, b) => (a.agent_name || '').localeCompare(b.agent_name || ''));
  }, [data.agents]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((a) => {
      const ext = extFromContact(a.agent_contact) || '';
      return (
        (a.agent_name || '').toLowerCase().includes(needle) ||
        ext.toLowerCase().includes(needle) ||
        (a.agent_status || '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q]);

  const pageRows = useMemo(
    () => filtered.slice(page * rpp, page * rpp + rpp),
    [filtered, page, rpp],
  );

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader
        sectionLabel="Telephony"
        title="Extension Management"
        subtitle={`Call-center agents and their assigned SIP extensions (${data.domainName || '…'}).`}
        actions={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Search agent / extension / status"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          sx={{ width: 320 }}
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
                    <TableCell sx={{ fontWeight: 600 }}>Agent</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assigned Extension</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Caller ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Queues</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map((a) => {
                    const ext = extFromContact(a.agent_contact);
                    const extObj = ext ? extByNumber[ext] : null;
                    return (
                      <TableRow key={a.call_center_agent_uuid} hover sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`${base}/crm/admin/pbxExtensions/${a.call_center_agent_uuid}/edit`)}>
                        <TableCell sx={{ fontWeight: 500 }}>{a.agent_name}</TableCell>
                        <TableCell>
                          {ext
                            ? <Chip size="small" label={ext} color="primary" variant="outlined" sx={{ fontSize: 11 }} />
                            : <Box sx={{ color: 'text.disabled' }}>— unassigned —</Box>}
                        </TableCell>
                        <TableCell>{extObj?.effectiveCallerIdName || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={a.agent_status}
                            color={a.agent_status === 'Available' ? 'success' : 'default'}
                            variant="outlined" sx={{ fontSize: 11 }} />
                        </TableCell>
                        <TableCell>{a.queue_count ?? 0}</TableCell>
                        <TableCell align="center" onClick={(ev) => ev.stopPropagation()}>
                          <Tooltip title="Change extension">
                            <IconButton size="small"
                              onClick={() => navigate(`${base}/crm/admin/pbxExtensions/${a.call_center_agent_uuid}/edit`)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No agents found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={filtered.length} page={page}
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
