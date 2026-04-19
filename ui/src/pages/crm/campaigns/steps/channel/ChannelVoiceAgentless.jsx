import { useEffect, useState } from 'react';
import {
  Box, Grid, TextField, MenuItem, Typography, FormControlLabel, Switch,
  Button, CircularProgress, Alert, InputAdornment, Autocomplete, Stack,
  IconButton, Tooltip,
} from '@mui/material';
import {
  Upload as UploadIcon, AudioFile as AudioIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import {
  uploadAudio, listGateways, listRecordings,
} from '../../../../../services/campaign';

// Voice · Agentless — play audio to each dialed number, no agent involved.

export default function ChannelVoiceAgentless({ form, update }) {
  const [gateways, setGateways] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);

  useEffect(() => {
    Promise.allSettled([listGateways(), listRecordings()]).then(([g, r]) => {
      if (g.status === 'fulfilled') setGateways(g.value?.content || g.value || []);
      if (r.status === 'fulfilled') setRecordings(r.value?.content || r.value || []);
    });
  }, []);

  const selectedGw = gateways.find(g => String(g.gatewayUuid || g.id) === String(form.gatewayId));
  const selectedRec = recordings.find(r => (r.recordingFilename || r.filename) === form.audioFilePath);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadErr(null);
    try {
      const res = await uploadAudio(file);
      const path = res?.path || res?.audioFilePath || res?.recordingFilename || '';
      if (!path) throw new Error('Upload response missing path');
      update({ audioFilePath: path, audioFileName: file.name });
      listRecordings().then(r => setRecordings(r?.content || r || []));
    } catch (err) {
      setUploadErr('Upload failed: ' + (err?.response?.data?.message || err.message));
    }
    setUploading(false);
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" required label="Sender CLI"
            value={form.senderId}
            onChange={e => update({ senderId: e.target.value })}
            helperText="E.164, e.g. 09678100100" />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField fullWidth size="small" select label="Outbound gateway"
            value={form.gatewayId}
            onChange={e => update({ gatewayId: e.target.value })}
            helperText={selectedGw
              ? `proxy: ${selectedGw.proxy || '—'} · codecs: ${selectedGw.codecPrefs || '—'} · ch: ${selectedGw.channels || '—'}`
              : 'SIP trunk FreeSWITCH will originate from'}>
            <MenuItem value=""><em>—</em></MenuItem>
            {gateways.map(g => (
              <MenuItem key={g.gatewayUuid || g.id} value={g.gatewayUuid || g.id}>
                {g.gateway || g.username || `#${g.id}`}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} md={8}>
          <Autocomplete
            size="small" freeSolo
            options={recordings}
            value={selectedRec || form.audioFilePath || null}
            getOptionLabel={(o) => (typeof o === 'string' ? o
              : o?.recordingName || o?.recordingFilename || '')}
            onChange={(_, val) => {
              if (typeof val === 'string') update({ audioFilePath: val, audioFileName: val });
              else if (val) update({
                audioFilePath: val.recordingFilename || val.filename || '',
                audioFileName: val.recordingName || val.recordingFilename || '',
              });
              else update({ audioFilePath: '', audioFileName: '' });
            }}
            onInputChange={(_, val, reason) => {
              if (reason === 'input') update({ audioFilePath: val, audioFileName: val });
            }}
            renderInput={(params) => (
              <TextField {...params} required label="Audio file"
                placeholder="Pick from library or type path"
                helperText={selectedRec?.recordingDescription || 'Relative to freeswitch sounds dir'}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <InputAdornment position="start"><AudioIcon fontSize="small" /></InputAdornment>,
                }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack direction="row" spacing={1}>
            <Button component="label" variant="outlined" size="small"
              startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />}
              disabled={uploading} sx={{ flex: 1, mt: 0.5 }}>
              {uploading ? 'Uploading…' : 'Upload WAV'}
              <input type="file" hidden accept=".wav,audio/wav" onChange={onUpload} />
            </Button>
            <Tooltip title="Preview (not yet wired)">
              <span><IconButton size="small" disabled sx={{ mt: 0.5 }}><PlayIcon /></IconButton></span>
            </Tooltip>
          </Stack>
        </Grid>
        {uploadErr && <Grid item xs={12}><Alert severity="warning" sx={{ py: 0 }}>{uploadErr}</Alert></Grid>}

        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Max ring time (s)"
            value={form.maxRingTime}
            onChange={e => update({ maxRingTime: +e.target.value })} />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Retry period (min)"
            value={form.defaultRetryPeriod}
            onChange={e => update({ defaultRetryPeriod: +e.target.value })} />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Max attempts"
            value={form.maxAttempts}
            onChange={e => update({ maxAttempts: +e.target.value })} />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControlLabel sx={{ mt: 0.5 }}
            control={<Switch checked={form.amdEnabled}
              onChange={e => update({ amdEnabled: e.target.checked })} />}
            label={<Typography variant="body2">AMD detection</Typography>}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
