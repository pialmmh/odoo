import { useEffect, useState } from 'react';
import {
  Box, Typography, Chip, Stack, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { ExpandMore as ExpandIcon } from '@mui/icons-material';
import { listSchedulePolicies } from '../../../../services/campaign';

// Preview of a SchedulePolicy — shows overall start/end window and the per-day
// active hours (ActiveHours children). Schedule policies control WHEN a
// campaign dials (separate from time bands which govern per-policy windows).

const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];

export default function SchedulePolicyPreview({ schedulePolicyId }) {
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    if (!schedulePolicyId) return;
    setLoading(true);
    listSchedulePolicies().then((res) => {
      const list = res?.content || res || [];
      setPolicy(list.find(p => +p.id === +schedulePolicyId) || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [schedulePolicyId]);

  if (!schedulePolicyId) return null;

  const hours = (policy?.activeHours || [])
    .slice()
    .sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));

  return (
    <Accordion defaultExpanded sx={{ mt: 1, boxShadow: 'none', border: 1, borderColor: 'divider' }}>
      <AccordionSummary expandIcon={<ExpandIcon />} sx={{ minHeight: 40, '.MuiAccordionSummary-content': { my: 1 } }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
          Schedule preview
        </Typography>
        {loading && <CircularProgress size={14} sx={{ ml: 1 }} />}
        {policy && (
          <Stack direction="row" spacing={0.5} sx={{ ml: 2 }}>
            {policy.startTime && policy.endTime && (
              <Chip size="small" label={`${policy.startTime} → ${policy.endTime}`} />
            )}
            <Chip size="small" label={`${hours.length} day windows`} />
          </Stack>
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {hours.length === 0 ? (
          <Typography variant="caption" color="text.disabled">
            No active hours defined — schedule runs full day.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11 }}>Day</TableCell>
                <TableCell sx={{ fontSize: 11 }}>Active from</TableCell>
                <TableCell sx={{ fontSize: 11 }}>Active to</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hours.map(h => (
                <TableRow key={h.id}>
                  <TableCell sx={{ fontSize: 12 }}>{h.dayOfWeek}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{h.activeStartTime}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{h.activeEndTime}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
