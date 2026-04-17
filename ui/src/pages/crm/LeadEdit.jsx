import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, InputLabel,
  Select, MenuItem, TextField, FormControlLabel, Switch, Divider,
  Avatar,
} from '@mui/material';
import {
  Close as CloseIcon, ArrowBack as BackIcon,
} from '@mui/icons-material';
import {
  getLead, createLead, updateLead,
  getCurrentUser,
  LEAD_STATUSES, LEAD_SOURCES, LEAD_SALUTATIONS,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

// Full-page Lead create / edit form. Mirrors the detail.json layout
// (Overview + Details panels) + defaultSidePanel (Assigned User, Teams,
// Converted At).
//
// Routes:
//   /crm/leads/new        → blank form (create)
//   /crm/leads/:id/edit   → pre-filled form (update)

const EMPTY = {
  salutationName: '', firstName: '', middleName: '', lastName: '',
  title: '', accountName: '',
  emailAddress: '', phoneNumber: '', website: '',
  addressStreet: '', addressCity: '', addressState: '',
  addressCountry: '', addressPostalCode: '',
  status: 'New', source: '', industry: '',
  opportunityAmount: '',
  doNotCall: false,
  description: '',
  assignedUserId: '', assignedUserName: '',
  teamsIds: [], teamsNames: {},
};

export default function LeadEdit() {
  const { id }    = useParams();   // undefined when creating
  const navigate  = useNavigate();
  const isEdit    = !!id;

  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);
  const [original, setOriginal] = useState(null);

  // Prefill: existing lead (edit) or current user as assignee (create)
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getLead(id)
        .then(lead => {
          setForm({
            salutationName: lead.salutationName || '',
            firstName: lead.firstName || '',
            middleName: lead.middleName || '',
            lastName: lead.lastName || '',
            title: lead.title || '',
            accountName: lead.accountName || '',
            emailAddress: lead.emailAddress || '',
            phoneNumber: lead.phoneNumber || '',
            website: lead.website || '',
            addressStreet: lead.addressStreet || '',
            addressCity: lead.addressCity || '',
            addressState: lead.addressState || '',
            addressCountry: lead.addressCountry || '',
            addressPostalCode: lead.addressPostalCode || '',
            status: lead.status || 'New',
            source: lead.source || '',
            industry: lead.industry || '',
            opportunityAmount: lead.opportunityAmount ?? '',
            doNotCall: !!lead.doNotCall,
            description: lead.description || '',
            assignedUserId: lead.assignedUserId || '',
            assignedUserName: lead.assignedUserName || '',
            teamsIds: lead.teamsIds || [],
            teamsNames: lead.teamsNames || {},
          });
          setOriginal(lead);
        })
        .catch(e => setErr(e?.response?.data?.message || e.message || 'Load failed'))
        .finally(() => setLoading(false));
    } else {
      // default-assign to current user on create
      getCurrentUser().then(u => {
        if (u) setForm(f => ({
          ...f,
          assignedUserId: u.id,
          assignedUserName: u.name || u.userName,
        }));
      }).catch(() => {});
    }
  }, [id, isEdit]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const submit = useCallback(async () => {
    if (!form.lastName.trim()) { setErr('Last name is required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form };
      // Drop derived/UI-only keys
      delete payload.assignedUserName;
      delete payload.teamsNames;
      payload.opportunityAmount =
        form.opportunityAmount === '' ? null : Number(form.opportunityAmount);
      const saved = isEdit
        ? await updateLead(id, payload)
        : await createLead(payload);
      const newId = saved?.id || id;
      navigate(`../${newId}`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed');
    }
    setSaving(false);
  }, [form, id, isEdit, navigate]);

  const cancel = () => isEdit ? navigate(`../${id}`) : navigate('..');

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  const displayName = (() => {
    const parts = [form.salutationName, form.firstName, form.middleName, form.lastName].filter(Boolean);
    return parts.join(' ') || (isEdit ? original?.name || 'Edit Lead' : 'Create Lead');
  })();

  return (
    <Box>
      {/* Breadcrumb */}
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Enquiries</MuiLink>
        <Typography color="text.primary">{isEdit ? displayName : 'Create'}</Typography>
      </Breadcrumbs>

      {/* Title */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {isEdit ? displayName : 'Create Lead'}
        </Typography>
      </Box>

      {/* Save / Cancel action bar */}
      <Box sx={{
        display: 'flex', gap: 1, mb: 2, px: 1.5, py: 1,
        bgcolor: 'background.default', borderRadius: 1,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small"
            onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outlined" size="small" onClick={cancel}>
            Cancel
          </Button>
        </Box>
        <IconButton size="small" onClick={cancel} title="Close"><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {/* Main + side */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        gap: 2,
      }}>
        {/* Main */}
        <Box sx={{ minWidth: 0 }}>

          {/* ── Overview ── */}
          <Panel title="Overview">
            <Grid container spacing={2}>
              {/* Name (salutation + first + middle + last) */}
              <Grid item xs={12} sm={6}>
                <Lbl required>Name</Lbl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ width: 90 }}>
                    <Select value={form.salutationName} displayEmpty
                      onChange={e => set({ salutationName: e.target.value })}>
                      {LEAD_SALUTATIONS.map(s => (
                        <MenuItem key={s || 'none'} value={s}>{s || '—'}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField size="small" placeholder="First"
                    value={form.firstName}
                    onChange={e => set({ firstName: e.target.value })} sx={{ flex: 1 }} />
                  <TextField size="small" placeholder="Last" required
                    value={form.lastName}
                    onChange={e => set({ lastName: e.target.value })} sx={{ flex: 1 }} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Account Name</Lbl>
                <TextField fullWidth size="small"
                  value={form.accountName}
                  onChange={e => set({ accountName: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Email</Lbl>
                <TextField fullWidth size="small" type="email"
                  value={form.emailAddress}
                  onChange={e => set({ emailAddress: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Phone</Lbl>
                <TextField fullWidth size="small"
                  value={form.phoneNumber}
                  onChange={e => set({ phoneNumber: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Title</Lbl>
                <TextField fullWidth size="small"
                  value={form.title}
                  onChange={e => set({ title: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Website</Lbl>
                <TextField fullWidth size="small"
                  placeholder="https://"
                  value={form.website}
                  onChange={e => set({ website: e.target.value })} />
              </Grid>

              {/* Address — full width block with sub-fields */}
              <Grid item xs={12}>
                <Lbl>Address</Lbl>
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" placeholder="Street"
                      value={form.addressStreet}
                      onChange={e => set({ addressStreet: e.target.value })} />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField fullWidth size="small" placeholder="City"
                      value={form.addressCity}
                      onChange={e => set({ addressCity: e.target.value })} />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField fullWidth size="small" placeholder="State / Region"
                      value={form.addressState}
                      onChange={e => set({ addressState: e.target.value })} />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField fullWidth size="small" placeholder="Postal Code"
                      value={form.addressPostalCode}
                      onChange={e => set({ addressPostalCode: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" placeholder="Country"
                      value={form.addressCountry}
                      onChange={e => set({ addressCountry: e.target.value })} />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Panel>

          {/* ── Details ── */}
          <Panel title="Details">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Lbl>Status</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.status}
                    onChange={e => set({ status: e.target.value })}>
                    {LEAD_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Source</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.source} displayEmpty
                    onChange={e => set({ source: e.target.value })}>
                    <MenuItem value="">—</MenuItem>
                    {LEAD_SOURCES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Opportunity Amount</Lbl>
                <TextField fullWidth size="small" type="number"
                  value={form.opportunityAmount}
                  onChange={e => set({ opportunityAmount: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Industry</Lbl>
                <TextField fullWidth size="small"
                  value={form.industry}
                  onChange={e => set({ industry: e.target.value })} />
              </Grid>

              <Grid item xs={12}>
                <Lbl>Description</Lbl>
                <TextField fullWidth size="small" multiline rows={3}
                  value={form.description}
                  onChange={e => set({ description: e.target.value })} />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch checked={form.doNotCall}
                      onChange={e => set({ doNotCall: e.target.checked })} />
                  }
                  label="Do Not Call"
                />
              </Grid>
            </Grid>
          </Panel>
        </Box>

        {/* Side */}
        <Box>
          <Panel title="Overview" dense>
            <Lbl required>Assigned User</Lbl>
            {form.assignedUserName ? (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.75,
                mb: 2.5,
              }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.main' }}>
                  {form.assignedUserName.slice(0, 2).toUpperCase()}
                </Avatar>
                <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }}>
                  {form.assignedUserName}
                </Typography>
              </Box>
            ) : (
              <TextField size="small" fullWidth placeholder="Loading…" disabled sx={{ mb: 2.5 }} />
            )}

            <Lbl>Teams</Lbl>
            <TextField size="small" fullWidth placeholder="Select" disabled sx={{ mb: 2.5 }} />

            {isEdit && original?.convertedAt && (
              <>
                <Divider sx={{ my: 1 }} />
                <Lbl>Converted At</Lbl>
                <Typography variant="body2" sx={{ fontSize: 13 }}>{original.convertedAt}</Typography>
              </>
            )}
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}

function Lbl({ children, required }) {
  return (
    <Typography sx={{
      fontSize: 10, letterSpacing: 0.8, fontWeight: 600,
      color: 'text.secondary', textTransform: 'uppercase',
      mb: 0.5, lineHeight: 1,
    }}>
      {children}{required && ' *'}
    </Typography>
  );
}
