import {
  Box, Grid, TextField, Typography, Divider, Alert, Stack, Chip,
  IconButton, Card, FormControlLabel, Checkbox, Tooltip, MenuItem,
} from '@mui/material';
import {
  ArrowUpward as UpIcon, ArrowDownward as DownIcon,
  Delete as RemoveIcon, Add as AddIcon,
  Sms as SmsIcon, Phone as VoiceIcon, Email as EmailIcon,
  SupportAgent as AgentIcon,
} from '@mui/icons-material';
import { CHANNELS, HYBRID_FALLBACK_TRIGGERS } from '../../../../../services/campaign';

// Hybrid — ordered channel waterfall. For each contact:
//   1. try channel[0]
//   2. on trigger (noRoute / failure / timeout) → try channel[1]
//   3. ... until success or list exhausted.
//
// Per-channel config (sender, audio, from-address, etc.) is captured in the
// top-level form fields; this step only wires the priority + fallback rules.

const CHANNEL_META = {
  SMS:             { label: 'SMS',             icon: <SmsIcon fontSize="small" />,   color: '#1e40af', bg: '#dbeafe' },
  VOICE_AGENTLESS: { label: 'Voice · Auto',    icon: <VoiceIcon fontSize="small" />, color: '#065f46', bg: '#dcfce7' },
  VOICE_AGENT:     { label: 'Voice · Agent',   icon: <AgentIcon fontSize="small" />, color: '#5b21b6', bg: '#ede9fe' },
  EMAIL:           { label: 'Email',           icon: <EmailIcon fontSize="small" />, color: '#9a3412', bg: '#ffedd5' },
};

export default function ChannelHybrid({ form, update }) {
  const priority = form.channelPriority;
  const available = CHANNELS.filter(c => !priority.includes(c));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= priority.length) return;
    const next = priority.slice();
    [next[i], next[j]] = [next[j], next[i]];
    update({ channelPriority: next });
  };
  const remove = (i) => update({ channelPriority: priority.filter((_, idx) => idx !== i) });
  const add = (ch) => update({ channelPriority: [...priority, ch] });

  const toggleTrigger = (key) => update({
    fallbackOn: { ...form.fallbackOn, [key]: !form.fallbackOn[key] },
  });

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Hybrid campaigns try channels in order. If the active trigger fires on channel #N,
        the task advances to channel #N+1 for the same contact. The runner needs this
        waterfall logic — tracked in ui-vs-api-todo.md §19.
      </Alert>

      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Channel priority (drag-less — use ↑↓)
      </Typography>
      <Stack spacing={1} sx={{ mb: 2 }}>
        {priority.map((ch, i) => {
          const meta = CHANNEL_META[ch];
          return (
            <Card key={ch} variant="outlined"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1 }}>
              <Chip size="small" label={`#${i + 1}`} color="primary" />
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: meta.bg, color: meta.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {meta.icon}
              </Box>
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>{meta.label}</Typography>
              <Tooltip title="Move up">
                <span>
                  <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                    <UpIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Move down">
                <span>
                  <IconButton size="small" disabled={i === priority.length - 1} onClick={() => move(i, 1)}>
                    <DownIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Remove from waterfall">
                <IconButton size="small" color="error" onClick={() => remove(i)}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Card>
          );
        })}
        {priority.length === 0 && (
          <Typography variant="caption" color="text.disabled">
            No channels selected yet.
          </Typography>
        )}
      </Stack>

      {available.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <TextField size="small" select label="Add channel to waterfall"
            value="" onChange={e => add(e.target.value)}
            sx={{ minWidth: 240 }}>
            <MenuItem value="" disabled>Pick a channel…</MenuItem>
            {available.map(ch => (
              <MenuItem key={ch} value={ch}>
                {CHANNEL_META[ch].label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Advance to next channel when…
      </Typography>
      <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
        {Object.entries(HYBRID_FALLBACK_TRIGGERS).map(([key, label]) => (
          <FormControlLabel key={key}
            control={<Checkbox size="small" checked={!!form.fallbackOn[key]}
              onChange={() => toggleTrigger(key)} />}
            label={<Typography variant="body2">{label}</Typography>}
          />
        ))}
      </Stack>

      <Alert severity="warning" sx={{ mt: 1 }}>
        Per-channel settings (SMS sender + message, voice audio + gateway, email subject + body)
        can be configured by picking the campaign type individually and copying values — a
        dedicated per-channel config panel for hybrid is a follow-up item.
      </Alert>
    </Box>
  );
}
