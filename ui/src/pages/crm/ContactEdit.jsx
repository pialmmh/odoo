import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, FormControlLabel, Switch, Avatar, Divider,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  getContact, createContact, updateContact, getCurrentUser,
  LEAD_SALUTATIONS,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

const EMPTY = {
  salutationName: '', firstName: '', middleName: '', lastName: '',
  title: '', accountName: '',
  emailAddress: '', phoneNumber: '',
  addressStreet: '', addressCity: '', addressState: '', addressCountry: '', addressPostalCode: '',
  doNotCall: false, description: '',
  assignedUserId: '', assignedUserName: '',
};

export default function ContactEdit() {
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
      getContact(id).then(d => {
        setForm({
          salutationName: d.salutationName || '', firstName: d.firstName || '',
          middleName: d.middleName || '',        lastName: d.lastName || '',
          title: d.title || '',                   accountName: d.accountName || '',
          emailAddress: d.emailAddress || '',     phoneNumber: d.phoneNumber || '',
          addressStreet: d.addressStreet || '',   addressCity: d.addressCity || '',
          addressState: d.addressState || '',     addressCountry: d.addressCountry || '',
          addressPostalCode: d.addressPostalCode || '',
          doNotCall: !!d.doNotCall, description: d.description || '',
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
    if (!form.lastName.trim()) { setErr('Last name is required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form };
      delete payload.assignedUserName;
      const saved = isEdit ? await updateContact(id, payload) : await createContact(payload);
      navigate(`../${saved?.id || id}`);
    } catch (e) { setErr(e?.response?.data?.message || e.message || 'Save failed'); }
    setSaving(false);
  }, [form, id, isEdit, navigate]);

  const cancel = () => isEdit ? navigate(`../${id}`) : navigate('..');

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Contacts</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
        {isEdit ? `Edit ${[form.firstName, form.lastName].filter(Boolean).join(' ')}` : 'Create Contact'}
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
              <Grid item xs={12} sm={6}>
                <Lbl required>Name</Lbl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ width: 90 }}>
                    <Select value={form.salutationName} displayEmpty
                      onChange={e => set({ salutationName: e.target.value })}>
                      {LEAD_SALUTATIONS.map(s => <MenuItem key={s || 'n'} value={s}>{s || '—'}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField size="small" placeholder="First" value={form.firstName}
                    onChange={e => set({ firstName: e.target.value })} sx={{ flex: 1 }} />
                  <TextField size="small" placeholder="Last" required value={form.lastName}
                    onChange={e => set({ lastName: e.target.value })} sx={{ flex: 1 }} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Account Name</Lbl>
                <TextField fullWidth size="small" value={form.accountName}
                  onChange={e => set({ accountName: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Email</Lbl>
                <TextField fullWidth size="small" type="email" value={form.emailAddress}
                  onChange={e => set({ emailAddress: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Phone</Lbl>
                <TextField fullWidth size="small" value={form.phoneNumber}
                  onChange={e => set({ phoneNumber: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Title</Lbl>
                <TextField fullWidth size="small" value={form.title}
                  onChange={e => set({ title: e.target.value })} />
              </Grid>

              <Grid item xs={12}>
                <Lbl>Address</Lbl>
                <Grid container spacing={1.5}>
                  <Grid item xs={12}><TextField fullWidth size="small" placeholder="Street"
                    value={form.addressStreet} onChange={e => set({ addressStreet: e.target.value })} /></Grid>
                  <Grid item xs={6} sm={4}><TextField fullWidth size="small" placeholder="City"
                    value={form.addressCity} onChange={e => set({ addressCity: e.target.value })} /></Grid>
                  <Grid item xs={6} sm={4}><TextField fullWidth size="small" placeholder="State"
                    value={form.addressState} onChange={e => set({ addressState: e.target.value })} /></Grid>
                  <Grid item xs={6} sm={4}><TextField fullWidth size="small" placeholder="Postal Code"
                    value={form.addressPostalCode} onChange={e => set({ addressPostalCode: e.target.value })} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" placeholder="Country"
                    value={form.addressCountry} onChange={e => set({ addressCountry: e.target.value })} /></Grid>
                </Grid>
              </Grid>

              <Grid item xs={12}>
                <Lbl>Description</Lbl>
                <TextField fullWidth size="small" multiline rows={3}
                  value={form.description} onChange={e => set({ description: e.target.value })} />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel control={<Switch checked={form.doNotCall}
                  onChange={e => set({ doNotCall: e.target.checked })} />} label="Do Not Call" />
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
            ) : (
              <TextField size="small" fullWidth disabled sx={{ mb: 2.5 }} />
            )}
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
