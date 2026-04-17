import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, Avatar,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  getOpportunity, createOpportunity, updateOpportunity, getCurrentUser,
  OPPORTUNITY_STAGES, OPPORTUNITY_PROBABILITY_MAP,
  LEAD_SOURCES,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

const EMPTY = {
  name: '', stage: 'Prospecting', probability: 10,
  amount: '', amountCurrency: 'USD',
  closeDate: '', accountName: '',
  leadSource: '', description: '',
  assignedUserId: '', assignedUserName: '',
};

export default function OpportunityEdit() {
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
      getOpportunity(id).then(d => {
        setForm({
          name: d.name || '', stage: d.stage || 'Prospecting',
          probability: d.probability ?? 10,
          amount: d.amount ?? '', amountCurrency: d.amountCurrency || 'USD',
          closeDate: d.closeDate || '',
          accountId: d.accountId || '', accountName: d.accountName || '',
          leadSource: d.leadSource || '', description: d.description || '',
          assignedUserId: d.assignedUserId || '', assignedUserName: d.assignedUserName || '',
        });
      }).catch(e => setErr(e?.response?.data?.message || e.message))
        .finally(() => setLoad(false));
    } else {
      // 14 days out as default close date
      const cd = new Date(); cd.setDate(cd.getDate() + 14);
      const iso = cd.toISOString().slice(0, 10);
      setForm(f => ({ ...f, closeDate: iso }));
      getCurrentUser().then(u => {
        if (u) setForm(f => ({ ...f, assignedUserId: u.id, assignedUserName: u.name || u.userName }));
      }).catch(() => {});
    }
  }, [id, isEdit]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  // Auto-set probability when stage changes (mirrors Probability hook on server).
  const setStage = (stage) => {
    const prob = OPPORTUNITY_PROBABILITY_MAP[stage];
    set({ stage, probability: prob != null ? prob : form.probability });
  };

  const submit = useCallback(async () => {
    if (!form.name.trim())  { setErr('Name is required');  return; }
    if (form.amount === '') { setErr('Amount is required'); return; }
    if (!form.closeDate)    { setErr('Close Date is required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form };
      delete payload.assignedUserName;
      payload.amount = Number(form.amount);
      const saved = isEdit ? await updateOpportunity(id, payload) : await createOpportunity(payload);
      navigate(`../${saved?.id || id}`);
    } catch (e) { setErr(e?.response?.data?.message || e.message || 'Save failed'); }
    setSaving(false);
  }, [form, id, isEdit, navigate]);

  const cancel = () => isEdit ? navigate(`../${id}`) : navigate('..');

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Opportunities</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
        {isEdit ? `Edit ${form.name}` : 'Create Opportunity'}
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
          <Panel>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Lbl required>Name</Lbl>
                <TextField fullWidth size="small" required value={form.name}
                  onChange={e => set({ name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Account</Lbl>
                <TextField fullWidth size="small" placeholder="Account name (free text for now)"
                  value={form.accountName}
                  onChange={e => set({ accountName: e.target.value })}
                  helperText="Account link-picker coming soon." />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl required>Stage</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.stage} onChange={e => setStage(e.target.value)}>
                    {OPPORTUNITY_STAGES.map(s => (
                      <MenuItem key={s} value={s}>
                        {s} — {OPPORTUNITY_PROBABILITY_MAP[s]}%
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl required>Amount</Lbl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ width: 90 }}>
                    <Select value={form.amountCurrency}
                      onChange={e => set({ amountCurrency: e.target.value })}>
                      <MenuItem value="USD">USD</MenuItem>
                      <MenuItem value="EUR">EUR</MenuItem>
                      <MenuItem value="GBP">GBP</MenuItem>
                      <MenuItem value="BDT">BDT</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField size="small" type="number" required value={form.amount}
                    onChange={e => set({ amount: e.target.value })} sx={{ flex: 1 }} />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Probability (%)</Lbl>
                <TextField fullWidth size="small" type="number"
                  inputProps={{ min: 0, max: 100 }}
                  value={form.probability}
                  onChange={e => set({ probability: Number(e.target.value) })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl required>Close Date</Lbl>
                <TextField fullWidth size="small" type="date" required
                  InputLabelProps={{ shrink: true }}
                  value={form.closeDate}
                  onChange={e => set({ closeDate: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Lead Source</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.leadSource} displayEmpty
                    onChange={e => set({ leadSource: e.target.value })}>
                    <MenuItem value="">—</MenuItem>
                    {LEAD_SOURCES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
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
          <Panel dense>
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
