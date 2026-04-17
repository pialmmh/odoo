import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, Avatar,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  getCase, createCase, updateCase, getCurrentUser,
  CASE_STATUSES, CASE_PRIORITIES, CASE_TYPES,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

const EMPTY = {
  name: '', status: 'New', priority: 'Normal', type: '',
  accountName: '', contactName: '', leadName: '',
  description: '',
  assignedUserId: '', assignedUserName: '',
};

export default function CaseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm]     = useState(EMPTY);
  const [loading, setLoad]  = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  useEffect(() => {
    if (isEdit) {
      setLoad(true);
      getCase(id).then(d => {
        setForm({
          name: d.name || '', status: d.status || 'New', priority: d.priority || 'Normal',
          type: d.type || '',
          accountId: d.accountId || '', accountName: d.accountName || '',
          contactId: d.contactId || '', contactName: d.contactName || '',
          leadId: d.leadId || '',       leadName: d.leadName || '',
          description: d.description || '',
          assignedUserId: d.assignedUserId || '', assignedUserName: d.assignedUserName || '',
        });
      }).catch(e => setErr(e?.response?.data?.message || e.message))
        .finally(() => setLoad(false));
    } else {
      getCurrentUser().then(u => {
        if (u) setForm(f => ({ ...f, assignedUserId: u.id, assignedUserName: u.name || u.userName }));
      }).catch(() => {});
    }
  }, [id, isEdit]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const submit = useCallback(async () => {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form };
      delete payload.assignedUserName;
      const saved = isEdit ? await updateCase(id, payload) : await createCase(payload);
      navigate(`../${saved?.id || id}`);
    } catch (e) { setErr(e?.response?.data?.message || e.message || 'Save failed'); }
    setSaving(false);
  }, [form, id, isEdit, navigate]);

  const cancel = () => isEdit ? navigate(`../${id}`) : navigate('..');

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Cases</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
        {isEdit ? `Edit ${form.name}` : 'Create Case'}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, px: 1.5, py: 1, bgcolor: 'background.default', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outlined" size="small" onClick={cancel}>Cancel</Button>
        </Box>
        <IconButton size="small" onClick={cancel}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Panel title="Overview">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Lbl required>Name</Lbl>
                <TextField fullWidth size="small" required value={form.name}
                  onChange={e => set({ name: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl required>Status</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.status} onChange={e => set({ status: e.target.value })}>
                    {CASE_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Priority</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.priority} onChange={e => set({ priority: e.target.value })}>
                    {CASE_PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Type</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.type} displayEmpty
                    onChange={e => set({ type: e.target.value })}>
                    {CASE_TYPES.map(t => <MenuItem key={t || 'n'} value={t}>{t || '—'}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Account</Lbl>
                <TextField fullWidth size="small" placeholder="Account name (free text for now)"
                  value={form.accountName}
                  onChange={e => set({ accountName: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Contact</Lbl>
                <TextField fullWidth size="small" placeholder="Contact name (free text for now)"
                  value={form.contactName}
                  onChange={e => set({ contactName: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Lead</Lbl>
                <TextField fullWidth size="small" placeholder="Lead name (free text for now)"
                  value={form.leadName}
                  onChange={e => set({ leadName: e.target.value })} />
              </Grid>

              <Grid item xs={12}>
                <Lbl>Description</Lbl>
                <TextField fullWidth size="small" multiline minRows={6} maxRows={15}
                  value={form.description} onChange={e => set({ description: e.target.value })} />
              </Grid>
            </Grid>
          </Panel>
        </Box>

        <Box>
          <Panel title="Overview" dense>
            <Lbl required>Assigned User</Lbl>
            {form.assignedUserName ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.75, mb: 2.5 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.main' }}>
                  {form.assignedUserName.slice(0, 2).toUpperCase()}
                </Avatar>
                <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }}>{form.assignedUserName}</Typography>
              </Box>
            ) : <TextField size="small" fullWidth disabled sx={{ mb: 2.5 }} />}
            <Lbl>Teams</Lbl>
            <TextField size="small" fullWidth placeholder="Select" disabled />
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}

function Lbl({ children, required }) {
  return (
    <Typography sx={{ fontSize: 10, letterSpacing: 0.8, fontWeight: 600, color: 'text.secondary',
      textTransform: 'uppercase', mb: 0.5, lineHeight: 1 }}>
      {children}{required && ' *'}
    </Typography>
  );
}
