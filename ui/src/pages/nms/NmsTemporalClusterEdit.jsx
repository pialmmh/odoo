import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Checkbox, FormControl, FormControlLabel,
  Grid, IconButton, InputLabel, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { getCluster, saveCluster, emptyCluster } from '../../services/temporal';

const COLOR_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error',   label: 'Error' },
  { value: 'info',    label: 'Info' },
  { value: 'default', label: 'Neutral' },
];

export default function NmsTemporalClusterEdit() {
  const navigate = useNavigate();
  const { tenant, id } = useParams();
  const base = tenant ? `/${tenant}` : '';
  const isNew = !id;

  const [form, setForm] = useState(emptyCluster());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getCluster(id).then(c => { if (c) setForm(c); });
  }, [id, isNew]);

  function set(patch) { setForm(prev => ({ ...prev, ...patch })); }

  function setEndpoint(idx, patch) {
    setForm(prev => ({
      ...prev,
      endpoints: prev.endpoints.map((e, i) => i === idx ? { ...e, ...patch } : e),
    }));
  }
  function addEndpoint() {
    setForm(prev => ({ ...prev, endpoints: [...prev.endpoints, { host: '', port: 7233, tls: false }] }));
  }
  function removeEndpoint(idx) {
    setForm(prev => ({ ...prev, endpoints: prev.endpoints.filter((_, i) => i !== idx) }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (form.notes && form.notes.length > 1024) errs.notes = 'Max 1 KB';
    if (!form.endpoints.length) errs.endpoints = 'At least one node required';
    form.endpoints.forEach((e, i) => {
      if (!e.host.trim()) errs[`ep_${i}_host`] = 'Required';
      const p = Number(e.port);
      if (!Number.isInteger(p) || p < 1 || p > 65535) errs[`ep_${i}_port`] = '1–65535';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await saveCluster({
        ...form,
        endpoints: form.endpoints.map(e => ({ ...e, port: Number(e.port) })),
      });
      navigate(`${base}/nms/temporal`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ px: 2, py: 1.5, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton size="small" onClick={() => navigate(`${base}/nms/temporal`)}>
          <BackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          {isNew ? 'Add Cluster' : 'Edit Cluster'}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Only the information required to connect for monitoring. The UI probes each node over gRPC — no credentials needed unless the cluster enforces them.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Cluster</Typography>
        <Grid container spacing={2} sx={{ px: 1 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth size="small" required
              label="Name"
              placeholder="e.g. BTCL prod"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              error={!!errors.name}
              helperText={errors.name || ' '}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              fullWidth size="small"
              label="Tag"
              placeholder="prod / dev / staging"
              value={form.tag}
              onChange={(e) => set({ tag: e.target.value })}
              helperText=" "
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Tag color</InputLabel>
              <Select
                label="Tag color"
                value={form.color || 'primary'}
                onChange={(e) => set({ color: e.target.value })}
              >
                {COLOR_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small"
              label="Web UI URL (optional)"
              placeholder="https://temporal.example.com"
              value={form.webuiBaseUrl}
              onChange={(e) => set({ webuiBaseUrl: e.target.value })}
              helperText="Used for 'Open in Temporal Web UI' links on workflow detail pages"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline minRows={2} maxRows={5}
              label="Notes"
              placeholder="Anything the on-call should know"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              error={!!errors.notes}
              helperText={errors.notes || `${(form.notes || '').length} / 1024`}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2">Nodes (frontend endpoints)</Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<AddIcon />} onClick={addEndpoint}>Add node</Button>
        </Stack>
        {errors.endpoints && (
          <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>{errors.endpoints}</Typography>
        )}
        <Stack spacing={1.5} sx={{ px: 1 }}>
          {form.endpoints.map((e, i) => (
            <Grid key={i} container spacing={1.5} alignItems="flex-start">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth size="small" required
                  label={`Host #${i + 1}`}
                  placeholder="10.10.199.20"
                  value={e.host}
                  onChange={(ev) => setEndpoint(i, { host: ev.target.value })}
                  error={!!errors[`ep_${i}_host`]}
                  helperText={errors[`ep_${i}_host`] || ' '}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  fullWidth size="small" required
                  label="Port"
                  type="number"
                  value={e.port}
                  onChange={(ev) => setEndpoint(i, { port: ev.target.value })}
                  error={!!errors[`ep_${i}_port`]}
                  helperText={errors[`ep_${i}_port`] || ' '}
                  inputProps={{ min: 1, max: 65535 }}
                />
              </Grid>
              <Grid item xs={4} md={3}>
                <FormControlLabel
                  sx={{ mt: 0.5 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={!!e.tls}
                      onChange={(ev) => setEndpoint(i, { tls: ev.target.checked })}
                    />
                  }
                  label={<Typography variant="body2">TLS (grpcs)</Typography>}
                />
              </Grid>
              <Grid item xs={2} md={1}>
                <Tooltip title="Remove node">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeEndpoint(i)}
                      disabled={form.endpoints.length === 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Grid>
            </Grid>
          ))}
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button onClick={() => navigate(`${base}/nms/temporal`)} disabled={saving}>Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={onSave} disabled={saving}>
          {isNew ? 'Create cluster' : 'Save changes'}
        </Button>
      </Stack>
    </Box>
  );
}
