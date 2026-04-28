import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, IconButton, CircularProgress, Alert, Tooltip,
} from '@mui/material';
import { Replay } from '@mui/icons-material';
import { syncJobsApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartyTenantGate from './PartyTenantGate';

const POLL_MS = 15_000;

function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function SyncJobs() {
  return <PartyTenantGate render={tenantId => <Inner tenantId={tenantId} />} />;
}

function Inner({ tenantId }) {
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const r = await syncJobsApi.list(tenantId, { status: status || undefined, limit: 200 });
      setRows(r || []);
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, status]);

  // Poll while any PENDING/RUNNING
  useEffect(() => {
    const active = rows.some(j => j.status === 'PENDING' || j.status === 'RUNNING');
    if (!active) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [rows]);

  const failedRecent = useMemo(() => {
    const hourAgo = Date.now() - 3600_000;
    return rows.filter(j =>
      j.status === 'FAILED' && new Date(j.createdAt).getTime() >= hourAgo,
    ).length;
  }, [rows]);

  const retry = async (id) => {
    try {
      await syncJobsApi.retry(tenantId, id);
      success('Retry queued');
      load();
    } catch (e) {
      notifyError(extractError(e).message);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Sync jobs</Typography>
        <TextField select label="Status" size="small" sx={{ width: 160 }}
          value={status} onChange={e => setStatus(e.target.value)}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
          <MenuItem value="RUNNING">Running</MenuItem>
          <MenuItem value="SUCCESS">Success</MenuItem>
          <MenuItem value="FAILED">Failed</MenuItem>
        </TextField>
      </Box>

      {failedRecent > 10 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {failedRecent} jobs failed in the last hour.
          <Button size="small" sx={{ ml: 2 }} onClick={() => setStatus('FAILED')}>
            Show failed
          </Button>
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Entity ID</TableCell>
                  <TableCell>Op</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Attempts</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Finished</TableCell>
                  <TableCell>Error</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No sync jobs
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.entityType}</TableCell>
                    <TableCell>{r.entityId}</TableCell>
                    <TableCell>{r.operation}</TableCell>
                    <TableCell><PartyStatusChip status={r.status} /></TableCell>
                    <TableCell>{r.attempts}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>{fmt(r.startedAt)}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>{fmt(r.finishedAt)}</TableCell>
                    <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.error ? (
                        <Tooltip title={r.error}>
                          <span style={{ color: 'var(--color-danger-text)' }}>
                            {r.error.slice(0, 50)}{r.error.length > 50 ? '…' : ''}
                          </span>
                        </Tooltip>
                      ) : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {r.status === 'FAILED' && (
                        <IconButton size="small" onClick={() => retry(r.id)}>
                          <Replay fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
