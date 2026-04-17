import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, Avatar,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  getAccount, createAccount, updateAccount, getCurrentUser,
  ACCOUNT_TYPES,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

const EMPTY = {
  name: '', website: '', type: '', industry: '', sicCode: '',
  emailAddress: '', phoneNumber: '',
  billingAddressStreet: '', billingAddressCity: '', billingAddressState: '',
  billingAddressCountry: '', billingAddressPostalCode: '',
  shippingAddressStreet: '', shippingAddressCity: '', shippingAddressState: '',
  shippingAddressCountry: '', shippingAddressPostalCode: '',
  description: '',
  assignedUserId: '', assignedUserName: '',
};

export default function AccountEdit() {
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
      getAccount(id).then(d => {
        setForm({
          name: d.name || '', website: d.website || '', type: d.type || '',
          industry: d.industry || '', sicCode: d.sicCode || '',
          emailAddress: d.emailAddress || '', phoneNumber: d.phoneNumber || '',
          billingAddressStreet: d.billingAddressStreet || '',   billingAddressCity: d.billingAddressCity || '',
          billingAddressState: d.billingAddressState || '',     billingAddressCountry: d.billingAddressCountry || '',
          billingAddressPostalCode: d.billingAddressPostalCode || '',
          shippingAddressStreet: d.shippingAddressStreet || '', shippingAddressCity: d.shippingAddressCity || '',
          shippingAddressState: d.shippingAddressState || '',   shippingAddressCountry: d.shippingAddressCountry || '',
          shippingAddressPostalCode: d.shippingAddressPostalCode || '',
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
      const saved = isEdit ? await updateAccount(id, payload) : await createAccount(payload);
      navigate(`../${saved?.id || id}`);
    } catch (e) { setErr(e?.response?.data?.message || e.message || 'Save failed'); }
    setSaving(false);
  }, [form, id, isEdit, navigate]);

  const cancel = () => isEdit ? navigate(`../${id}`) : navigate('..');

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  const copyBillingToShipping = () => set({
    shippingAddressStreet: form.billingAddressStreet, shippingAddressCity: form.billingAddressCity,
    shippingAddressState: form.billingAddressState, shippingAddressCountry: form.billingAddressCountry,
    shippingAddressPostalCode: form.billingAddressPostalCode,
  });

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Accounts</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
        {isEdit ? `Edit ${form.name}` : 'Create Account'}
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
                <TextField fullWidth size="small" required value={form.name}
                  onChange={e => set({ name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Website</Lbl>
                <TextField fullWidth size="small" placeholder="https://" value={form.website}
                  onChange={e => set({ website: e.target.value })} />
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
                <Lbl>Billing Address</Lbl>
                <Grid container spacing={1.5}>
                  <Grid item xs={12}><TextField fullWidth size="small" placeholder="Street"
                    value={form.billingAddressStreet} onChange={e => set({ billingAddressStreet: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="City"
                    value={form.billingAddressCity} onChange={e => set({ billingAddressCity: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="State"
                    value={form.billingAddressState} onChange={e => set({ billingAddressState: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="Postal"
                    value={form.billingAddressPostalCode} onChange={e => set({ billingAddressPostalCode: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="Country"
                    value={form.billingAddressCountry} onChange={e => set({ billingAddressCountry: e.target.value })} /></Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Lbl>Shipping Address</Lbl>
                  <Button size="small" onClick={copyBillingToShipping} sx={{ fontSize: 10, minHeight: 0, py: 0 }}>
                    same as billing
                  </Button>
                </Box>
                <Grid container spacing={1.5}>
                  <Grid item xs={12}><TextField fullWidth size="small" placeholder="Street"
                    value={form.shippingAddressStreet} onChange={e => set({ shippingAddressStreet: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="City"
                    value={form.shippingAddressCity} onChange={e => set({ shippingAddressCity: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="State"
                    value={form.shippingAddressState} onChange={e => set({ shippingAddressState: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="Postal"
                    value={form.shippingAddressPostalCode} onChange={e => set({ shippingAddressPostalCode: e.target.value })} /></Grid>
                  <Grid item xs={6}><TextField fullWidth size="small" placeholder="Country"
                    value={form.shippingAddressCountry} onChange={e => set({ shippingAddressCountry: e.target.value })} /></Grid>
                </Grid>
              </Grid>
            </Grid>
          </Panel>

          <Panel title="Details">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Lbl>Type</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.type} displayEmpty onChange={e => set({ type: e.target.value })}>
                    {ACCOUNT_TYPES.map(t => <MenuItem key={t || 'n'} value={t}>{t || '—'}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Industry</Lbl>
                <TextField fullWidth size="small" value={form.industry}
                  onChange={e => set({ industry: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>SIC Code</Lbl>
                <TextField fullWidth size="small" value={form.sicCode}
                  onChange={e => set({ sicCode: e.target.value })} />
              </Grid>

              <Grid item xs={12}>
                <Lbl>Description</Lbl>
                <TextField fullWidth size="small" multiline rows={3}
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
