import { useEffect, useState } from 'react';
import {
  Box, Typography, Chip, Stack, Divider, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { ExpandMore as ExpandIcon } from '@mui/icons-material';
import {
  listTimeBands, listRetryIntervals, listRetryCauseCodes,
  listThrottlingRules, listEnumSmsErrors,
} from '../../../../services/campaign';

// Preview of a Policy — shows its time bands, retry intervals, retry cause
// codes, and throttling rules. Fetches all lists once and filters client-side
// by policyId (datasets are small; typical tenant has <20 rows each).

const DAY_SORT = { SUNDAY:0, MONDAY:1, TUESDAY:2, WEDNESDAY:3, THURSDAY:4, FRIDAY:5, SATURDAY:6, ALL:-1 };

export default function PolicyPreview({ policyId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ bands: [], intervals: [], causes: [], throttles: [], errors: [] });

  useEffect(() => {
    if (!policyId) return;
    setLoading(true);
    Promise.allSettled([
      listTimeBands(), listRetryIntervals(), listRetryCauseCodes(),
      listThrottlingRules(), listEnumSmsErrors(),
    ]).then(([tb, ri, rc, tr, err]) => {
      const pick = (r) => (r.status === 'fulfilled' ? (r.value?.content || r.value || []) : []);
      setData({
        bands:     pick(tb).filter(x => +x.policyId === +policyId),
        intervals: pick(ri).filter(x => +x.policyId === +policyId).sort((a,b) => a.retryCount - b.retryCount),
        causes:    pick(rc).filter(x => +x.policyId === +policyId),
        throttles: pick(tr).filter(x => +x.policyId === +policyId),
        errors:    pick(err),
      });
      setLoading(false);
    });
  }, [policyId]);

  if (!policyId) return null;

  const errName = (id) => data.errors.find(e => +e.id === +id)?.name || `#${id}`;
  const holidays = data.bands.filter(b => (b.day || '').toUpperCase() === 'SPECIFIC DATE');
  const regularBands = data.bands.filter(b => (b.day || '').toUpperCase() !== 'SPECIFIC DATE')
    .sort((a,b) => (DAY_SORT[a.day?.toUpperCase()] ?? 9) - (DAY_SORT[b.day?.toUpperCase()] ?? 9));

  return (
    <Accordion defaultExpanded sx={{ mt: 1, boxShadow: 'none', border: 1, borderColor: 'divider' }}>
      <AccordionSummary expandIcon={<ExpandIcon />} sx={{ minHeight: 40, '.MuiAccordionSummary-content': { my: 1 } }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
          Policy preview
        </Typography>
        {loading && <CircularProgress size={14} sx={{ ml: 1 }} />}
        {!loading && (
          <Stack direction="row" spacing={0.5} sx={{ ml: 2 }}>
            <Chip size="small" label={`${regularBands.length} bands`} />
            {holidays.length > 0 && <Chip size="small" color="warning" label={`${holidays.length} holidays`} />}
            <Chip size="small" label={`${data.intervals.length} retries`} />
            {data.throttles.length > 0 && <Chip size="small" color="info" label="throttled" />}
          </Stack>
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {/* Time bands */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          Allowed / restricted windows
        </Typography>
        {regularBands.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
            No time bands — unrestricted by day/time.
          </Typography>
        ) : (
          <Table size="small" sx={{ mb: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11 }}>Day</TableCell>
                <TableCell sx={{ fontSize: 11 }}>From</TableCell>
                <TableCell sx={{ fontSize: 11 }}>To</TableCell>
                <TableCell sx={{ fontSize: 11 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {regularBands.map(b => (
                <TableRow key={b.id}>
                  <TableCell sx={{ fontSize: 12 }}>{b.day}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{b.startTime}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{b.endTime}</TableCell>
                  <TableCell>
                    <Chip size="small" label={b.allowOrRestrict ? 'Allow' : 'Restrict'}
                      color={b.allowOrRestrict ? 'success' : 'error'}
                      sx={{ fontSize: 10, height: 18 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Public holidays */}
        {holidays.length > 0 && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Public holidays (specific dates)
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {holidays.map(h => (
                <Chip key={h.id} size="small"
                  label={`${h.specificDateOnly} ${h.startTime}–${h.endTime} ${h.allowOrRestrict ? '✓' : '✕'}`}
                  color={h.allowOrRestrict ? 'success' : 'warning'}
                  variant="outlined"
                  sx={{ fontSize: 10 }} />
              ))}
            </Stack>
          </>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Retry intervals */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          Retry schedule
        </Typography>
        {data.intervals.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
            No retry intervals configured.
          </Typography>
        ) : (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {data.intervals.map(r => (
              <Chip key={r.id} size="small"
                label={`#${r.retryCount} → ${r.intervalSec}s`}
                sx={{ fontSize: 10 }} />
            ))}
          </Stack>
        )}

        {/* Retry cause codes */}
        {data.causes.length > 0 && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Retry on error codes
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {data.causes.map(c => (
                <Chip key={c.id} size="small"
                  label={errName(c.causeCodeId || c.causeCode)}
                  color={c.retry ? 'primary' : 'default'}
                  variant={c.retry ? 'filled' : 'outlined'}
                  sx={{ fontSize: 10 }} />
              ))}
            </Stack>
          </>
        )}

        {/* Throttling */}
        {data.throttles.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Throttling
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              {data.throttles.map(t => (
                <Box key={t.id}>
                  <Chip size="small"
                    label={`${t.maxMessagesPerHour || '∞'}/hr · ${t.maxMessagesPerDay || '∞'}/day`}
                    sx={{ fontSize: 10 }} />
                </Box>
              ))}
            </Stack>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
