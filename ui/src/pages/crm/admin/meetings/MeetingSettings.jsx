import { useState } from 'react';
import {
  Box, Typography, Paper, Stack, Divider, FormControlLabel, Switch,
  TextField, MenuItem, Button, Alert, Breadcrumbs, Link as MuiLink,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * Tenant-scoped meeting defaults. Values currently live in component state
 * (client-only); a future commit will persist via EspoCRM Settings (or a
 * dedicated MeetingSettings entity) and load them from the server.
 *
 * We surface these knobs now so the admin UI + data shape stabilise before
 * backend plumbing lands.
 */
export default function MeetingSettings() {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';

  const [form, setForm] = useState({
    defaultRecordingEnabled: false,
    defaultAllowSelfRegister: false,
    recordingRetentionDays: 0,          // 0 = forever
    shareLinkTtlDays: 30,
    maxMeetingDurationMinutes: 240,
    interceptSilent:   true,
    interceptCoach:    true,
    interceptBarge:    true,
    interceptTakeover: true,
  });
  const [saved, setSaved] = useState(false);
  const set = (patch) => setForm((s) => ({ ...s, ...patch }));

  const onSave = () => {
    // TODO: POST /api/crm/Settings (or a dedicated MeetingSetting entity).
    // Client-side-only for now — flag visually so it's clear this doesn't persist yet.
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 900 }}>
      <Breadcrumbs sx={{ mb: 1.5 }}>
        <MuiLink component="button" onClick={() => navigate(`${base}/crm/admin`)}
          underline="hover" sx={{ color: 'text.secondary', fontSize: 13 }}>
          Administration
        </MuiLink>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Meetings</Typography>
        <Typography variant="body2">Meeting Settings</Typography>
      </Breadcrumbs>

      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Meeting Settings</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        Tenant-scoped defaults applied to newly-created meetings. Individual
        meetings can override these values on their edit page.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Defaults</Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch checked={form.defaultRecordingEnabled}
              onChange={(e) => set({ defaultRecordingEnabled: e.target.checked })} />}
            label="Recording on by default for new meetings"
          />
          <FormControlLabel
            control={<Switch checked={form.defaultAllowSelfRegister}
              onChange={(e) => set({ defaultAllowSelfRegister: e.target.checked })} />}
            label="Allow guest self-register via share link by default"
          />
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Retention</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small" type="number"
            label="Recording retention (days, 0 = forever)"
            value={form.recordingRetentionDays}
            onChange={(e) => set({ recordingRetentionDays: Number(e.target.value) })}
            sx={{ maxWidth: 320 }}
          />
          <TextField
            size="small" type="number"
            label="Share link TTL (days)"
            value={form.shareLinkTtlDays}
            onChange={(e) => set({ shareLinkTtlDays: Number(e.target.value) })}
            sx={{ maxWidth: 320 }}
          />
          <TextField
            size="small" type="number"
            label="Max meeting duration (minutes)"
            value={form.maxMeetingDurationMinutes}
            onChange={(e) => set({ maxMeetingDurationMinutes: Number(e.target.value) })}
            sx={{ maxWidth: 320 }}
          />
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Admin intercept modes
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          Individually enable which admin-observation modes are available to
          super admins in this tenant's meetings.
        </Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch checked={form.interceptSilent}
              onChange={(e) => set({ interceptSilent: e.target.checked })} />}
            label="Silent monitoring (invisible, admin can't be seen or heard)"
          />
          <FormControlLabel
            control={<Switch checked={form.interceptCoach}
              onChange={(e) => set({ interceptCoach: e.target.checked })} />}
            label="Coach (only the host hears admin; attendees don't)"
          />
          <FormControlLabel
            control={<Switch checked={form.interceptBarge}
              onChange={(e) => set({ interceptBarge: e.target.checked })} />}
            label="Barge (admin joins as a visible participant)"
          />
          <FormControlLabel
            control={<Switch checked={form.interceptTakeover}
              onChange={(e) => set({ interceptTakeover: e.target.checked })} />}
            label="Takeover (admin replaces the host)"
          />
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {saved && <Alert severity="success" sx={{ flex: 1 }}>
            Saved (client-side only for now — persistence lands in a follow-up commit).
          </Alert>}
          <Button variant="contained" onClick={onSave}>Save settings</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
