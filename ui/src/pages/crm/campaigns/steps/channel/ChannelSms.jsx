import { useEffect, useState } from 'react';
import {
  Box, Grid, TextField, Typography, FormControlLabel, Switch, Stack, Chip,
  MenuItem,
} from '@mui/material';

// SMS channel config. Mirrors the SOFTSWITCH_DASHBOARD SMS form:
// senderId, message, encoding flags, forbidden-word group.

// Rough segment counter: 160 for GSM-7, 70 for unicode (UCS-2). Concatenated
// SMS loses 7 chars per segment after the first (UDH).
const segmentInfo = (msg, isUnicode) => {
  const len = msg.length;
  const single = isUnicode ? 70 : 160;
  const multi  = isUnicode ? 67 : 153;
  if (len === 0) return { segments: 0, used: 0, max: single };
  if (len <= single) return { segments: 1, used: len, max: single };
  const segments = Math.ceil(len / multi);
  return { segments, used: len, max: segments * multi };
};

export default function ChannelSms({ form, update }) {
  const [forbidden, setForbidden] = useState([]);

  useEffect(() => {
    // /api/ForbiddenWords/getall — pending service binding; skip silently.
  }, []);

  const seg = segmentInfo(form.message, form.isUnicode);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Message identity
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" required label="Sender ID"
            value={form.senderId}
            onChange={e => update({ senderId: e.target.value })}
            helperText="Alphanumeric or numeric, as assigned" />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" select label="Forbidden-word group"
            value={form.forbiddenWordGroupId}
            onChange={e => update({ forbiddenWordGroupId: e.target.value })}>
            <MenuItem value=""><em>— none —</em></MenuItem>
            {forbidden.map(g => (
              <MenuItem key={g.id} value={g.id}>{g.name || `#${g.id}`}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <Typography variant="subtitle2" sx={{ mb: 1, mt: 3, color: 'text.secondary' }}>
        Message body
      </Typography>
      <TextField
        fullWidth multiline rows={5}
        value={form.message}
        onChange={e => update({ message: e.target.value })}
        placeholder="Type your message…"
      />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Chip size="small" label={`${seg.segments} segment${seg.segments === 1 ? '' : 's'}`} />
        <Chip size="small" label={`${seg.used}/${seg.max} chars`} variant="outlined" />
        <Chip size="small"
          label={form.isUnicode ? 'UCS-2 (unicode)' : 'GSM-7'}
          color={form.isUnicode ? 'warning' : 'default'} variant="outlined" />
      </Stack>

      <Stack direction="row" spacing={3} sx={{ mt: 3 }}>
        <FormControlLabel
          control={<Switch checked={form.isUnicode}
            onChange={e => update({ isUnicode: e.target.checked })} />}
          label="Unicode (Bangla / Arabic / etc.)"
        />
        <FormControlLabel
          control={<Switch checked={form.isLongSms}
            onChange={e => update({ isLongSms: e.target.checked })} />}
          label="Allow concatenated (long) SMS"
        />
        <FormControlLabel
          control={<Switch checked={form.isFlash}
            onChange={e => update({ isFlash: e.target.checked })} />}
          label="Flash SMS (Class 0)"
        />
      </Stack>
    </Box>
  );
}
