import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert, Chip,
} from '@mui/material';
import {
  listPolicies, listTimeBands, listRetryIntervals,
  listRetryCauseCodes, listSchedulePolicies,
} from '../../../../services/voiceCampaign';

// Read-only view of the four policy axes + schedule policies.
// Full CRUD (create/edit dialogs) is pending — see ui-vs-api-todo.md.

const TABS = [
  { key: 'policies',         label: 'Policies',       loader: listPolicies },
  { key: 'timeBands',        label: 'Time Bands',     loader: listTimeBands },
  { key: 'retryIntervals',   label: 'Retry Intervals',loader: listRetryIntervals },
  { key: 'retryCauseCodes',  label: 'Retry Causes',   loader: listRetryCauseCodes },
  { key: 'schedulePolicies', label: 'Schedules',      loader: listSchedulePolicies },
];

export default function VoicePolicies() {
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    TABS[tab].loader()
      .then(res => setRows(res?.content || res?.list || res || []))
      .catch(e => setError('Failed to load: ' + (e?.response?.data?.message || e.message)))
      .finally(() => setLoading(false));
  }, [tab]);

  // Columns derived from the first row's keys — keeps the page flexible
  // while the exact DTO shapes are confirmed against the backend.
  const columns = rows.length > 0 ? Object.keys(rows[0]).slice(0, 8) : [];

  return (
    <Box sx={{ px: 4, py: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Voice Policies</Typography>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {TABS.map(t => <Tab key={t.key} label={t.label} />)}
        </Tabs>

        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map(c => (
                    <TableCell key={c} sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {c.replace(/([A-Z])/g, ' $1').trim()}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id ?? i} hover>
                    {columns.map(c => (
                      <TableCell key={c}>
                        {renderCell(r[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length || 1} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No records</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Typography variant="caption" color="text.disabled" sx={{ mt: 2, display: 'block' }}>
        Create/edit is not yet wired — tracked in ui-vs-api-todo.md.
      </Typography>
    </Box>
  );
}

function renderCell(v) {
  if (v == null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  if (typeof v === 'boolean') {
    return <Chip size="small" label={v ? 'Yes' : 'No'}
      sx={{ bgcolor: v ? 'success.light' : 'grey.200', fontSize: 11 }} />;
  }
  if (typeof v === 'object') return <code style={{ fontSize: 11 }}>{JSON.stringify(v)}</code>;
  return <Typography variant="body2" sx={{ fontSize: 12 }}>{String(v)}</Typography>;
}
