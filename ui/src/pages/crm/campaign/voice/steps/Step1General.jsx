import {
  Box, Grid, TextField, MenuItem, Typography, Divider,
  FormControlLabel, Switch, Checkbox, IconButton, Chip, Stack, Tooltip,
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon, Info as InfoIcon } from '@mui/icons-material';
import { useState } from 'react';

// Step 1 — General Settings. Fields sourced from dialer wiki general-settings.md.
// Business numbers, hours, timezone etc. are all local-only until SMSREST adds
// the corresponding columns (tracked in campaign/ui-vs-api-todo.md §9).

const TIMEZONES = [
  'UTC-12:00',  'UTC-11:00',  'UTC-10:00',  'UTC-09:00',
  'UTC-08:00 Pacific Time (US & Canada)',
  'UTC-07:00 Mountain Time (US & Canada)',
  'UTC-06:00 Central Time (US & Canada)',
  'UTC-05:00 Eastern Time (US & Canada)',
  'UTC+00:00 UTC',
  'UTC+01:00 Central European Time',
  'UTC+05:30 India Standard Time',
  'UTC+06:00 Bangladesh Standard Time',
  'UTC+08:00 China / Singapore',
  'UTC+09:00 Japan / Korea',
];

const DAYS = [
  ['mon','Monday'], ['tue','Tuesday'], ['wed','Wednesday'],
  ['thu','Thursday'], ['fri','Friday'], ['sat','Saturday'], ['sun','Sunday'],
];

export default function Step1General({ form, update }) {
  const [newNumLabel, setNewNumLabel] = useState('');
  const [newNumValue, setNewNumValue] = useState('');

  const addNumber = () => {
    const num = newNumValue.trim();
    if (!num) return;
    update({
      businessNumbers: [...form.businessNumbers, {
        label: newNumLabel.trim() || num, number: num,
      }],
    });
    setNewNumLabel(''); setNewNumValue('');
  };
  const removeNumber = (i) => update({
    businessNumbers: form.businessNumbers.filter((_, idx) => idx !== i),
  });

  const updateDay = (d, patch) => update({
    businessHours: { ...form.businessHours, [d]: { ...form.businessHours[d], ...patch } },
  });

  const daysRemaining = () => {
    if (!form.startDate) return null;
    const diff = Math.ceil((new Date(form.startDate) - new Date()) / 86400000);
    return diff > 0 ? `${diff} days` : null;
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Identity
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" required label="Campaign name"
            value={form.name} onChange={e => update({ name: e.target.value })} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" select label="Timezone"
            value={form.timezone} onChange={e => update({ timezone: e.target.value })}>
            {TIMEZONES.map(tz => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth size="small" multiline rows={2}
            label="Description"
            inputProps={{ maxLength: 200 }}
            value={form.description}
            onChange={e => update({ description: e.target.value })}
            helperText={`${form.description.length}/200`}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Schedule
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth size="small" type="date" label="Start date"
            InputLabelProps={{ shrink: true }}
            value={form.startDate}
            onChange={e => update({ startDate: e.target.value })}
            helperText={daysRemaining()}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth size="small" type="date" label="End date"
            InputLabelProps={{ shrink: true }}
            value={form.endDate}
            onChange={e => update({ endDate: e.target.value })}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Business hours
        </Typography>
        <Stack spacing={0.5}>
          {DAYS.map(([d, label]) => {
            const row = form.businessHours[d];
            return (
              <Box key={d} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FormControlLabel
                  sx={{ minWidth: 120, m: 0 }}
                  control={
                    <Checkbox size="small" checked={row.enabled}
                      onChange={e => updateDay(d, { enabled: e.target.checked })} />
                  }
                  label={<Typography variant="body2">{label}</Typography>}
                />
                <TextField size="small" type="time"
                  value={row.from} disabled={!row.enabled || row.fullDay}
                  onChange={e => updateDay(d, { from: e.target.value })}
                  sx={{ width: 120 }} />
                <Typography variant="caption" color="text.secondary">to</Typography>
                <TextField size="small" type="time"
                  value={row.to} disabled={!row.enabled || row.fullDay}
                  onChange={e => updateDay(d, { to: e.target.value })}
                  sx={{ width: 120 }} />
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox size="small" checked={row.fullDay}
                      disabled={!row.enabled}
                      onChange={e => updateDay(d, { fullDay: e.target.checked })} />
                  }
                  label={<Typography variant="caption">Full day</Typography>}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Business numbers
        <Tooltip title="Caller IDs used when placing calls. Multiple numbers can be rotated.">
          <InfoIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: 'text.disabled' }} />
        </Tooltip>
      </Typography>
      <Grid container spacing={1} alignItems="center">
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" label="Label (optional)"
            value={newNumLabel} onChange={e => setNewNumLabel(e.target.value)} />
        </Grid>
        <Grid item xs={12} md={5}>
          <TextField fullWidth size="small" label="Phone number"
            placeholder="+1 713 647 2453"
            value={newNumValue} onChange={e => setNewNumValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNumber())} />
        </Grid>
        <Grid item xs={12} md={3}>
          <IconButton onClick={addNumber} size="small" color="primary"><AddIcon /></IconButton>
        </Grid>
      </Grid>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
        {form.businessNumbers.map((n, i) => (
          <Chip key={i} label={`${n.label} · ${n.number}`}
            onDelete={() => removeNumber(i)} size="small" />
        ))}
        {form.businessNumbers.length === 0 && (
          <Typography variant="caption" color="text.disabled">
            No numbers yet. Add at least one.
          </Typography>
        )}
      </Stack>

      <Divider sx={{ my: 3 }} />
      <Stack direction="row" spacing={4}>
        <FormControlLabel
          control={<Switch checked={form.autoRotate}
            onChange={e => update({ autoRotate: e.target.checked })} />}
          label="Auto-rotate business numbers"
        />
        <FormControlLabel
          control={<Switch checked={form.localPresence}
            onChange={e => update({ localPresence: e.target.checked })} />}
          label="Local presence (match caller ID to contact area code)"
        />
      </Stack>
    </Box>
  );
}
