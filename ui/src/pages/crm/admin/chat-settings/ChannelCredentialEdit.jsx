import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField,
} from '@mui/material';
import {
  getChannelCredential, createChannelCredential, updateChannelCredential,
  CHAT_CHANNELS,
} from '../../../../services/crm';
import { Panel } from '../../LeadPanelPrimitives';

function Lbl({ children, required }) {
  return (
    <Typography sx={{
      fontSize: 10, letterSpacing: 0.8, fontWeight: 600, color: 'text.secondary',
      textTransform: 'uppercase', mb: 0.5, lineHeight: 1,
    }}>
      {children}{required && ' *'}
    </Typography>
  );
}

const EMPTY = { name: '', channel: 'facebook', credentials: '', isActive: true, description: '' };

export default function ChannelCredentialEdit() {
  const navigate = useNavigate();
  const { id, tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';
  const isEdit = !!id;

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (!isEdit) return;
    let live = true;
    getChannelCredential(id).then((r) => {
      if (!live) return;
      setForm({
        name: r.name || '',
        channel: r.channel || 'facebook',
        credentials: r.credentials || '',
        isActive: r.isActive !== false,
        description: r.description || '',
      });
    }).catch((e) => setErr(e?.response?.data?.message || e.message))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, isEdit]);

  const set = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);

  const submit = useCallback(async () => {
    setTouched({ name: true });
    if (!form.name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const payload = {
        name: form.name,
        channel: form.channel,
        credentials: form.credentials || null,
        isActive: form.isActive,
        description: form.description || null,
      };
      if (isEdit) await updateChannelCredential(id, payload);
      else        await createChannelCredential(payload);
      navigate(`${base}/crm/admin/channelCredentials`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed');
    }
    setSaving(false);
  }, [form, id, isEdit, navigate, base]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 900 }}>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to={`${base}/crm/admin`} underline="hover">Administration</MuiLink>
        <MuiLink component={RouterLink} to={`${base}/crm/admin/channelCredentials`} underline="hover">Channel Credentials</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        {isEdit ? `Edit ${form.name || 'Credential'}` : 'Create Channel Credential'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" color="primary" size="small" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outlined" size="small"
          onClick={() => navigate(`${base}/crm/admin/channelCredentials`)}>
          Cancel
        </Button>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Panel title="Overview">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <Lbl required>Name</Lbl>
            <TextField fullWidth size="small" required
              value={form.name}
              error={touched.name && !form.name.trim()}
              helperText={touched.name && !form.name.trim() ? 'Required' : ''}
              onChange={(e) => { set({ name: e.target.value }); setTouched((t) => ({ ...t, name: true })); }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Lbl required>Channel</Lbl>
            <FormControl fullWidth size="small">
              <Select value={form.channel}
                onChange={(e) => set({ channel: e.target.value })}>
                {CHAT_CHANNELS.map((c) => (
                  <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Lbl>Active</Lbl>
            <FormControl fullWidth size="small">
              <Select value={form.isActive ? 'yes' : 'no'}
                onChange={(e) => set({ isActive: e.target.value === 'yes' })}>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Lbl>Description</Lbl>
            <TextField fullWidth size="small" multiline minRows={2}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })} />
          </Grid>
        </Grid>
      </Panel>

      <Panel title="Credentials (JSON)">
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Channel-specific credentials as a JSON object. Example for WhatsApp:
          {' '}<code>{`{ "apiKey": "…", "phoneNumberId": "…" }`}</code>
        </Typography>
        <TextField fullWidth size="small" multiline minRows={6}
          value={form.credentials}
          placeholder={'{\n  "key": "value"\n}'}
          onChange={(e) => set({ credentials: e.target.value })}
          sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }} />
      </Panel>
    </Box>
  );
}
