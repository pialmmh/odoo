import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  Radio, RadioGroup, FormControlLabel, Button, Alert, Chip,
} from '@mui/material';
import {
  Visibility as SilentIcon, RecordVoiceOver as CoachIcon,
  Login as BargeIcon, AdminPanelSettings as TakeoverIcon,
} from '@mui/icons-material';

const MODES = [
  {
    key: 'silent',
    label: 'Silent Monitor',
    icon: <SilentIcon fontSize="small" />,
    help: 'Watch and listen only. Your tile is not rendered for attendees; your mic and camera stay disabled.',
    risk: 'low',
  },
  {
    key: 'coach',
    label: 'Coach (Whisper)',
    icon: <CoachIcon fontSize="small" />,
    help: 'Speak to the host only — other attendees cannot hear you. Useful for real-time sales coaching.',
    risk: 'low',
  },
  {
    key: 'barge',
    label: 'Barge In',
    icon: <BargeIcon fontSize="small" />,
    help: 'Join as a visible participant with full audio/video. Everyone sees you enter.',
    risk: 'medium',
  },
  {
    key: 'takeover',
    label: 'Take Over Host',
    icon: <TakeoverIcon fontSize="small" />,
    help: 'Become the room moderator. The current host is demoted and notified. Use only when the host is unreachable.',
    risk: 'high',
  },
];

export default function InterceptDialog({ open, meeting, onClose, onConfirm }) {
  const [mode, setMode] = useState('silent');

  const selected = MODES.find((m) => m.key === mode);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Admin Intercept
        {meeting?.name && (
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 400, color: 'text.secondary' }}>
            {meeting.name}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
          All intercept actions are audited. Attendees are not notified except in Barge/Takeover modes.
        </Alert>
        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
          {MODES.map((m) => (
            <FormControlLabel key={m.key} value={m.key}
              sx={{
                mx: 0, mb: 1, p: 1.25, border: 1, borderRadius: 1,
                borderColor: mode === m.key ? 'primary.main' : 'divider',
                bgcolor: mode === m.key ? 'action.hover' : 'transparent',
                alignItems: 'flex-start',
              }}
              control={<Radio size="small" sx={{ mt: -0.5 }} />}
              label={
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    {m.icon}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.label}</Typography>
                    <Chip size="small" label={m.risk}
                      color={m.risk === 'high' ? 'error' : m.risk === 'medium' ? 'warning' : 'default'}
                      sx={{ height: 18, fontSize: 10, textTransform: 'capitalize' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">{m.help}</Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={selected?.risk === 'high' ? 'error' : 'primary'}
          onClick={() => { onConfirm?.(mode); onClose(); }}>
          Join as {selected?.label}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export const INTERCEPT_MODES = MODES;
