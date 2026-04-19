import { useEffect, useState, useMemo } from 'react';
import {
  Box, Grid, TextField, MenuItem, Typography, FormControlLabel, Switch,
  Button, CircularProgress, Alert, InputAdornment, Autocomplete, Stack,
  IconButton, Tooltip, Tabs, Tab, Divider, Checkbox, Avatar, Chip,
} from '@mui/material';
import {
  Upload as UploadIcon, AudioFile as AudioIcon,
  PlayArrow as PlayIcon, Search as SearchIcon,
} from '@mui/icons-material';
import {
  uploadAudio, listGateways, listRecordings,
} from '../../../../../services/campaign';

// Voice · Agent-assisted — system dials contacts and bridges to an agent.
// Adds dialing-mode tabs + agent selector on top of the agentless fields.

const MODES = [
  { key: 'PREVIEW',     label: 'Preview',     hint: 'Agent reviews contact before dialing' },
  { key: 'PROGRESSIVE', label: 'Progressive', hint: 'Auto-connect answered calls' },
  { key: 'PREDICTIVE',  label: 'Predictive',  hint: 'Dial multiple lines per agent' },
];

// Agent roster endpoint is still mocked — tracked in ui-vs-api-todo.md §11.1
const MOCK_AGENTS = [
  { id: 1, name: 'Sarah Johnson', email: 'sarah@example.com', status: 'Available' },
  { id: 2, name: 'Michael Chen',  email: 'michael@example.com', status: 'On call' },
  { id: 3, name: 'Priya Patel',   email: 'priya@example.com', status: 'Available' },
  { id: 4, name: 'David Kim',     email: 'david@example.com', status: 'Away' },
  { id: 5, name: 'Lisa Garcia',   email: 'lisa@example.com', status: 'Available' },
  { id: 6, name: 'Omar Ahmed',    email: 'omar@example.com', status: 'Available' },
];

const initials = (n) => n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

export default function ChannelVoiceAgent({ form, update }) {
  const [gateways, setGateways] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    Promise.allSettled([listGateways(), listRecordings()]).then(([g, r]) => {
      if (g.status === 'fulfilled') setGateways(g.value?.content || g.value || []);
      if (r.status === 'fulfilled') setRecordings(r.value?.content || r.value || []);
    });
  }, []);

  const modeIdx = Math.max(0, MODES.findIndex(m => m.key === form.dialingMode));
  const m = form.dialingMode;
  const selectedGw = gateways.find(g => String(g.gatewayUuid || g.id) === String(form.gatewayId));
  const selectedRec = recordings.find(r => (r.recordingFilename || r.filename) === form.audioFilePath);

  const agents = useMemo(
    () => MOCK_AGENTS.filter(a => !q.trim() ||
      a.name.toLowerCase().includes(q.toLowerCase()) ||
      a.email.toLowerCase().includes(q.toLowerCase())),
    [q]
  );
  const selectedAgents = MOCK_AGENTS.filter(a => form.agentIds.includes(a.id));
  const toggleAgent = (id) => {
    const s = new Set(form.agentIds);
    s.has(id) ? s.delete(id) : s.add(id);
    update({ agentIds: [...s] });
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadErr(null);
    try {
      const res = await uploadAudio(file);
      const path = res?.path || res?.audioFilePath || res?.recordingFilename || '';
      if (!path) throw new Error('Upload response missing path');
      update({ audioFilePath: path, audioFileName: file.name });
    } catch (err) {
      setUploadErr('Upload failed: ' + (err?.response?.data?.message || err.message));
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

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" required label="Sender CLI"
            value={form.senderId}
            onChange={e => update({ senderId: e.target.value })} />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField fullWidth size="small" select label="Outbound gateway"
            value={form.gatewayId}
            onChange={e => update({ gatewayId: e.target.value })}
            helperText={selectedGw
              ? `proxy: ${selectedGw.proxy || '—'} · ch: ${selectedGw.channels || '—'}`
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
              <TextField {...params} required label="Greeting / hold audio"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <InputAdornment position="start"><AudioIcon fontSize="small" /></InputAdornment>,
                }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Button component="label" variant="outlined" size="small"
            startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />}
            disabled={uploading} sx={{ width: '100%', mt: 0.5 }}>
            {uploading ? 'Uploading…' : 'Upload WAV'}
            <input type="file" hidden accept=".wav,audio/wav" onChange={onUpload} />
          </Button>
        </Grid>
        {uploadErr && <Grid item xs={12}><Alert severity="warning" sx={{ py: 0 }}>{uploadErr}</Alert></Grid>}

        {m === 'PREVIEW' && (
          <Grid item xs={6} md={3}>
            <TextField fullWidth size="small" type="number" label="Preview time (s)"
              value={form.previewTime}
              onChange={e => update({ previewTime: +e.target.value })} />
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
              onChange={e => update({ linesPerAgent: +e.target.value })} />
          </Grid>
        )}
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Max ring time (s)"
            value={form.maxRingTime}
            onChange={e => update({ maxRingTime: +e.target.value })} />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField fullWidth size="small" type="number" label="Wrap-up time (s)"
            value={form.wrapUpTime}
            onChange={e => update({ wrapUpTime: +e.target.value })} />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControlLabel sx={{ mt: 0.5 }}
            control={<Switch checked={form.amdEnabled}
              onChange={e => update({ amdEnabled: e.target.checked })} />}
            label={<Typography variant="body2">AMD detection</Typography>}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Agents ({selectedAgents.length} selected)
      </Typography>
      {selectedAgents.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
          {selectedAgents.map(a => (
            <Chip key={a.id} label={a.name} size="small"
              onDelete={() => toggleAgent(a.id)}
              avatar={<Avatar>{initials(a.name)}</Avatar>}
            />
          ))}
        </Stack>
      )}
      <TextField size="small" fullWidth placeholder="Search agents…"
        value={q} onChange={e => setQ(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
        sx={{ mb: 1 }}
      />
      <Grid container spacing={1}>
        {agents.map(a => {
          const checked = form.agentIds.includes(a.id);
          return (
            <Grid item xs={12} md={6} key={a.id}>
              <FormControlLabel
                sx={{ width: '100%', m: 0, px: 1.5, py: 0.5, borderRadius: 1,
                  border: 1, borderColor: checked ? 'primary.main' : 'divider',
                  bgcolor: checked ? 'action.hover' : 'transparent' }}
                control={<Checkbox size="small" checked={checked} onChange={() => toggleAgent(a.id)} />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 11 }}>{initials(a.name)}</Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{a.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{a.email}</Typography>
                    </Box>
                    <Chip size="small" label={a.status}
                      sx={{ fontSize: 10, height: 18 }} />
                  </Box>
                }
              />
            </Grid>
          );
        })}
      </Grid>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
        Agent roster is a placeholder — comes from admin/team endpoint once wired.
      </Typography>
    </Box>
  );
}
