import { useEffect, useState, useCallback } from 'react';
import {
  Alert, Box, Chip, CircularProgress, IconButton, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon, Download as DownloadIcon,
  PlayCircleOutlined as PlayIcon,
} from '@mui/icons-material';
import { listRecordings, recordingFileUrl } from '../../../services/crm';

const STATUS_COLOR = {
  STARTING: 'warning',
  ACTIVE:   'success',
  ENDING:   'warning',
  COMPLETED: 'default',
  FAILED:    'error',
  ABORTED:   'error',
};

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDuration(ms) {
  if (ms == null || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

/**
 * Renders the list of recordings for a meeting. Host-or-admin auth is
 * enforced server-side — we only surface the list; errors bubble up.
 */
export default function RecordingsList({ meetingId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listRecordings(meetingId);
      // Backend returns { recordings: {list:[...]}} or {recordings:[...]} depending on shape;
      // normalise here.
      const raw = r?.recordings;
      const list = Array.isArray(raw) ? raw
                 : Array.isArray(raw?.list) ? raw.list
                 : [];
      setRows(list);
      setErr(null);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Recordings</Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No recordings yet.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Started</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Size</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const playable = r.status === 'COMPLETED' && (r.fileSizeBytes ?? 0) > 0;
              const fileUrl = r.id ? recordingFileUrl(r.id) : null;
              return (
                <TableRow key={r.id} hover>
                  <TableCell>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>{fmtDuration(r.durationMs)}</TableCell>
                  <TableCell>{fmtBytes(r.fileSizeBytes)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={playable ? 'Open in new tab' : 'Not ready'}>
                      <span>
                        <IconButton
                          size="small" disabled={!playable}
                          component="a" href={fileUrl} target="_blank" rel="noreferrer"
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={playable ? 'Download MP4' : 'Not ready'}>
                      <span>
                        <IconButton size="small" disabled={!playable} component="a" href={fileUrl} download>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
