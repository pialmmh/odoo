import { useEffect, useState } from 'react';
import {
  Box, Grid, TextField, MenuItem, Typography, Divider, Tabs, Tab,
  FormControlLabel, Switch, InputAdornment, Button, CircularProgress, Alert,
  Autocomplete, Chip, Stack, IconButton, Tooltip,
} from '@mui/material';
import {
  Upload as UploadIcon, AudioFile as AudioIcon,
  Refresh as RefreshIcon, Info as InfoIcon, PlayArrow as PlayIcon,
} from '@mui/icons-material';
import {
  uploadAudio, listGateways, listRecordings,
  getConcurrentCall, getPartnerConcurrentLimit,
} from '../../../../../services/voiceCampaign';
import PolicyPreview from './PolicyPreview';
import SchedulePolicyPreview from './SchedulePolicyPreview';

// Step 2 — Dialer + Policies.
// Pulls live data from:
//   FreeSwitchREST : gateways (VGateway), recordings (VRecording),
//                    getConcurrentCall, getPartnerConcurrentLimit
//   SMSREST        : policies, schedule policies (via PolicyPreview panels)

const MODES = [
  { key: 'PREVIEW',     label: 'Preview',     hint: 'Small teams, manual review' },
  { key: 'PROGRESSIVE', label: 'Progressive', hint: 'Steady flow, auto-connect answered calls' },
  { key: 'PREDICTIVE',  label: 'Predictive',  hint: 'Max efficiency via lines-per-agent ratio' },
  { key: 'AGENTLESS',   label: 'Agentless',   hint: 'No agents — play audio / surveys' },
];

export default function Step2Dialer({ form, update, policies, schedulePolicies }) {
  const [gateways, setGateways] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const [liveCount, setLiveCount] = useState(null);
  const [partnerLimit, setPartnerLimit] = useState(null);

  useEffect(() => {
    Promise.allSettled([listGateways(), listRecordings()]).then(([g, r]) => {
      if (g.status === 'fulfilled') setGateways(g.value?.content || g.value || []);
      if (r.status === 'fulfilled') setRecordings(r.value?.content || r.value || []);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const c = await getConcurrentCall();
        if (alive) setLiveCount(typeof c === 'number' ? c : c?.count ?? c?.concurrentCall ?? null);
      } catch { /* endpoint optional */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!form.idPartner && !form.partnerId) { setPartnerLimit(null); return; }
    getPartnerConcurrentLimit(form.idPartner || form.partnerId)
      .then(v => setPartnerLimit(typeof v === 'number' ? v : v?.limit ?? null))
      .catch(() => setPartnerLimit(null));
  }, [form.idPartner, form.partnerId]);

  const modeIdx = Math.max(0, MODES.findIndex(m => m.key === form.dialingMode));
  const m = form.dialingMode;
  const selectedGw = gateways.find(g => String(g.gatewayUuid || g.id) === String(form.gatewayId));

  const selectedRec = recordings.find(r =>
    (r.recordingFilename || r.filename) === form.audioFilePath
  );

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadErr(null);
    try {
      const res = await uploadAudio(file);
      const path = res?.path || res?.audioFilePath || res?.recordingFilename || '';
      if (!path) throw new Error('Upload response missing path');
      update({ audioFilePath: path, audioFileName: file.name });
      // Refresh library so the new file appears in the picker
      listRecordings().then(r => setRecordings(r?.content || r || []));
    } catch (err) {
      setUploadErr('Upload failed (endpoint likely not yet deployed): ' +
        (err?.response?.data?.message || err.message));
    }
    setUploading(false);
  };

  return (
    <Box>
      <Tabs value={modeIdx} onChange={(_, i) => update({ dialingMode: MODES[i].key })} sx={{ mb: 1 }}>
        {MODES.map(mode => <Tab key={mode.key} label={mode.label} />)}
      </Tabs>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        {MODES[modeIdx].hint}
      </Typography>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Caller identity & audio
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" required label="Sender CLI"
            value={form.senderId}
            onChange={e => update({ senderId: e.target.value })}
            helperText="E.164, e.g. 09678100100" />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth size="small" select label="Outbound gateway"
            value={form.gatewayId}
            onChange={e => update({ gatewayId: e.target.value })}
            helperText={
              selectedGw
                ? `proxy: ${selectedGw.proxy || '—'} · codecs: ${selectedGw.codecPrefs || '—'} · retry: ${selectedGw.retrySeconds || '—'}s · ch: ${selectedGw.channels || '—'}`
                : 'Pick the SIP trunk FreeSWITCH will originate from.'
            }
          >
            <MenuItem value=""><em>—</em></MenuItem>
            {gateways.map(g => (
              <MenuItem key={g.gatewayUuid || g.id} value={g.gatewayUuid || g.id}>
                {g.gateway || g.username || `#${g.id}`}
                {g.enabled === false && ' (disabled)'}
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
              : o?.recordingName || o?.recordingFilename || o?.filename || '')}
            onChange={(_, val) => {
              if (typeof val === 'string') {
                update({ audioFilePath: val, audioFileName: val });
              } else if (val) {
                update({
                  audioFilePath: val.recordingFilename || val.filename || '',
                  audioFileName: val.recordingName || val.recordingFilename || '',
                });
              } else {
                update({ audioFilePath: '', audioFileName: '' });
              }
            }}
            onInputChange={(_, val, reason) => {
              if (reason === 'input') update({ audioFilePath: val, audioFileName: val });
            }}
            renderOption={(props, o) => (
              <Box component="li" {...props} sx={{ display: 'flex !important', alignItems: 'center', gap: 1 }}>
                <AudioIcon fontSize="small" color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">{o.recordingName || o.recordingFilename}</Typography>
                  {o.recordingDescription && (
                    <Typography variant="caption" color="text.secondary">{o.recordingDescription}</Typography>
                  )}
                </Box>
              </Box>
            )}
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
            <Button
              component="label" variant="outlined" size="small"
              startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />}
              disabled={uploading} sx={{ flex: 1, mt: 0.5 }}
            >
              {uploading ? 'Uploading…' : 'Upload WAV'}
              <input type="file" hidden accept=".wav,audio/wav" onChange={onUpload} />
            </Button>
            <Tooltip title="Preview (not yet wired)">
              <span>
                <IconButton size="small" disabled sx={{ mt: 0.5 }}><PlayIcon /></IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Grid>
        {uploadErr && (
          <Grid item xs={12}>
            <Alert severity="warning" sx={{ py: 0 }}>{uploadErr}</Alert>
          </Grid>
        )}
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Timing
      </Typography>
      <Grid container spacing={2}>
        {m === 'PREVIEW' && (
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" type="number" label="Preview time (s)"
              value={form.previewTime}
              onChange={e => update({ previewTime: +e.target.value })}
              helperText="Agent review window" />
          </Grid>
        )}
        {m === 'PROGRESSIVE' && (
          <>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" type="number" label="Auto-answer timeout (s)"
                value={form.autoAnswerTimeout}
                onChange={e => update({ autoAnswerTimeout: +e.target.value })} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" type="number" label="Ringing agent time (s)"
                value={form.ringingAgentTime}
                onChange={e => update({ ringingAgentTime: +e.target.value })} />
            </Grid>
          </>
        )}
        {m === 'PREDICTIVE' && (
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" type="number" label="Lines per agent"
              value={form.linesPerAgent}
              onChange={e => update({ linesPerAgent: +e.target.value })}
              helperText="Outbound : agent ratio" />
          </Grid>
        )}
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Max ring time (s)"
            value={form.maxRingTime}
            onChange={e => update({ maxRingTime: +e.target.value })} />
        </Grid>
        {m !== 'AGENTLESS' && (
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" type="number" label="Wrap-up time (s)"
              value={form.wrapUpTime}
              onChange={e => update({ wrapUpTime: +e.target.value })} />
          </Grid>
        )}
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Retry period (min)"
            value={form.defaultRetryPeriod}
            onChange={e => update({ defaultRetryPeriod: +e.target.value })} />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Max attempts per record"
            value={form.maxAttempts}
            onChange={e => update({ maxAttempts: +e.target.value })} />
        </Grid>
      </Grid>

      {m !== 'PREVIEW' && (
        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Switch checked={form.amdEnabled}
              onChange={e => update({ amdEnabled: e.target.checked })} />}
            label="Answering Machine Detection"
          />
        </Box>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Campaign policy
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" select label="Retry / disposition policy"
            value={form.policyId}
            onChange={e => update({ policyId: e.target.value })}>
            <MenuItem value=""><em>—</em></MenuItem>
            {policies.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name || `#${p.id}`}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      <PolicyPreview policyId={form.policyId} />

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Schedule policy
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" select label="Schedule policy"
            value={form.schedulePolicyId}
            onChange={e => update({ schedulePolicyId: e.target.value })}>
            <MenuItem value=""><em>—</em></MenuItem>
            {schedulePolicies.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name || `#${p.id}`}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      <SchedulePolicyPreview schedulePolicyId={form.schedulePolicyId} />

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Throughput
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Batch size"
            value={form.taskBatchSize}
            onChange={e => update({ taskBatchSize: +e.target.value })}
            helperText="Per 5s tick" />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="datetime-local" label="Expires at"
            InputLabelProps={{ shrink: true }}
            value={form.expireAt}
            onChange={e => update({ expireAt: e.target.value })} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Stack direction="row" spacing={1} alignItems="center"
            sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <InfoIcon fontSize="small" color="info" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                Live throughput
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {partnerLimit != null ? `Partner limit: ${partnerLimit} concurrent calls` : 'Partner limit: — (set Partner ID)'}
                {'  ·  '}
                {liveCount != null ? `live now: ${liveCount}` : 'live: —'}
              </Typography>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
