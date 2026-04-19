import {
  Box, Typography, Card, Grid, TextField, Button, Stack, Chip, Divider,
  CircularProgress, Alert,
} from '@mui/material';
import {
  Save as DraftIcon, PlayArrow as StartIcon, Schedule as ScheduleIcon,
  Sms as SmsIcon, Phone as VoiceIcon, Email as EmailIcon,
  SupportAgent as AgentIcon, Hub as HybridIcon,
} from '@mui/icons-material';

// Step 5 — Launch. Pick one of three actions:
//   · Save as draft       — persists without dispatching
//   · Start now           — saves + enables immediately
//   · Schedule            — saves + stores scheduledAt (requires backend scheduler)

const TYPE_ICON = {
  SMS: <SmsIcon />, VOICE_AGENTLESS: <VoiceIcon />, VOICE_AGENT: <AgentIcon />,
  EMAIL: <EmailIcon />, HYBRID: <HybridIcon />,
};

export default function Step5Launch({ form, update, onLaunch, saving }) {
  const t = form.campaignType;
  const phones = form.phoneNumbers.split(/[\s,;]+/).filter(Boolean).length;
  const emails = form.emails.split(/[\s,;]+/).filter(Boolean).length;
  const total = (t === 'EMAIL') ? emails
              : (t === 'HYBRID') ? Math.max(phones, emails)
              : phones;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Review & launch
      </Typography>

      <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ color: 'primary.main' }}>{TYPE_ICON[t]}</Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Type</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t.replaceAll('_', ' · ')}
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">Name</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{form.name || '—'}</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" color="text.secondary">Contacts</Typography>
            <Typography variant="body2">{total.toLocaleString()}</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" color="text.secondary">Policy</Typography>
            <Typography variant="body2">{form.policyId ? `#${form.policyId}` : '—'}</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" color="text.secondary">Schedule policy</Typography>
            <Typography variant="body2">{form.schedulePolicyId ? `#${form.schedulePolicyId}` : '—'}</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" color="text.secondary">Timezone</Typography>
            <Typography variant="body2">{form.timezone}</Typography>
          </Grid>
          {t === 'HYBRID' && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Waterfall
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {form.channelPriority.map((ch, i) => (
                  <Chip key={ch} size="small" label={`${i + 1}. ${ch.replaceAll('_', ' · ')}`} />
                ))}
              </Stack>
            </Grid>
          )}
        </Grid>
      </Card>

      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Throughput & expiry
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Batch size (per 5s)"
            value={form.taskBatchSize}
            onChange={e => update({ taskBatchSize: +e.target.value })} />
        </Grid>
        <Grid item xs={6} md={4}>
          <TextField fullWidth size="small" type="datetime-local" label="Expires at"
            InputLabelProps={{ shrink: true }}
            value={form.expireAt}
            onChange={e => update({ expireAt: e.target.value })}
            helperText="Tasks not yet dispatched by this time are dropped" />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Launch action
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined"
            sx={{ p: 2, height: '100%',
              borderColor: form.launchAction === 'draft' ? 'primary.main' : 'divider',
              borderWidth: form.launchAction === 'draft' ? 2 : 1, cursor: 'pointer' }}
            onClick={() => update({ launchAction: 'draft' })}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <DraftIcon color="action" />
              <Typography variant="subtitle2">Save as draft</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Persist the campaign without dispatching. You can start it later from the list.
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined"
            sx={{ p: 2, height: '100%',
              borderColor: form.launchAction === 'start' ? 'success.main' : 'divider',
              borderWidth: form.launchAction === 'start' ? 2 : 1, cursor: 'pointer' }}
            onClick={() => update({ launchAction: 'start' })}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <StartIcon color="success" />
              <Typography variant="subtitle2">Start now</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Save and enable immediately — runner picks up tasks on the next tick.
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined"
            sx={{ p: 2, height: '100%',
              borderColor: form.launchAction === 'schedule' ? 'info.main' : 'divider',
              borderWidth: form.launchAction === 'schedule' ? 2 : 1, cursor: 'pointer' }}
            onClick={() => update({ launchAction: 'schedule' })}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <ScheduleIcon color="info" />
              <Typography variant="subtitle2">Schedule</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Save and auto-start at a future time.
            </Typography>
            <TextField fullWidth size="small" type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={form.scheduledAt}
              onChange={e => update({ scheduledAt: e.target.value })}
              disabled={form.launchAction !== 'schedule'}
            />
          </Card>
        </Grid>
      </Grid>

      {form.launchAction === 'schedule' && !form.scheduledAt && (
        <Alert severity="warning" sx={{ mt: 2 }}>Pick a scheduled start time.</Alert>
      )}

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button
          variant="contained"
          color={form.launchAction === 'start' ? 'success'
               : form.launchAction === 'schedule' ? 'info' : 'primary'}
          size="large"
          startIcon={saving ? <CircularProgress size={16} />
                  : form.launchAction === 'start' ? <StartIcon />
                  : form.launchAction === 'schedule' ? <ScheduleIcon />
                  : <DraftIcon />}
          onClick={() => onLaunch(form.launchAction)}
          disabled={saving}
        >
          {form.launchAction === 'start'    ? 'Save & Start now'
         : form.launchAction === 'schedule' ? 'Save & Schedule'
         : 'Save as draft'}
        </Button>
      </Stack>
    </Box>
  );
}
