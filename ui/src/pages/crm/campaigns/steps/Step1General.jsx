import {
  Box, Grid, TextField, MenuItem, Typography, Divider,
  FormControlLabel, Checkbox, Stack,
} from '@mui/material';

// Step 1 — General settings. Localized for BD / South-Asian markets.
// Dropped: Business numbers, Local presence, Coverage score (US-centric).

const TIMEZONES = [
  'UTC+06:00 Bangladesh Standard Time',
  'UTC+05:30 India Standard Time',
  'UTC+05:00 Pakistan Standard Time',
  'UTC+07:00 Indochina Time',
  'UTC+08:00 China / Singapore / Malaysia',
  'UTC+09:00 Japan / Korea',
  'UTC+04:00 Gulf Standard Time',
  'UTC+03:00 Arabia Standard Time',
  'UTC+01:00 Central European Time',
  'UTC+00:00 UTC',
  'UTC-05:00 Eastern Time (US)',
  'UTC-08:00 Pacific Time (US)',
];

const DAYS = [
  ['sun','Sunday'], ['mon','Monday'], ['tue','Tuesday'], ['wed','Wednesday'],
  ['thu','Thursday'], ['fri','Friday'], ['sat','Saturday'],
];

export default function Step1General({ form, update }) {
  const updateDay = (d, patch) => update({
    businessHours: { ...form.businessHours, [d]: { ...form.businessHours[d], ...patch } },
  });

  const daysRemaining = () => {
    if (!form.startDate) return null;
    const diff = Math.ceil((new Date(form.startDate) - new Date()) / 86400000);
    return diff > 0 ? `Starts in ${diff} days` : null;
  };

  return (
    <Box>
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
      </Grid>

      <Box sx={{ mt: 2 }}>
        <TextField
          fullWidth size="small" multiline rows={3}
          label="Description"
          inputProps={{ maxLength: 200 }}
          value={form.description}
          onChange={e => update({ description: e.target.value })}
          helperText={`${form.description.length}/200`}
        />
      </Box>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Active window
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
          Operating hours (when tasks can be dispatched)
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
                  sx={{ width: 170 }} />
                <Typography variant="caption" color="text.secondary">to</Typography>
                <TextField size="small" type="time"
                  value={row.to} disabled={!row.enabled || row.fullDay}
                  onChange={e => updateDay(d, { to: e.target.value })}
                  sx={{ width: 170 }} />
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox size="small" checked={row.fullDay}
                      disabled={!row.enabled}
                      onChange={e => updateDay(d, { fullDay: e.target.checked })} />
                  }
                  label={<Typography variant="caption">24h</Typography>}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
