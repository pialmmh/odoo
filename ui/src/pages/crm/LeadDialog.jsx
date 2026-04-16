import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, IconButton, Alert, Grid, FormControl, InputLabel,
  Select, MenuItem, TextField, FormControlLabel, Switch, Button,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  createLead, updateLead,
  LEAD_STATUSES, LEAD_SOURCES, LEAD_SALUTATIONS,
} from '../../services/crm';

const EMPTY_FORM = {
  salutationName: '', firstName: '', lastName: '',
  title: '', accountName: '',
  emailAddress: '', phoneNumber: '',
  status: 'New', source: '', industry: '',
  opportunityAmount: '',
  doNotCall: false, website: '',
  description: '',
};

export default function LeadDialog({ open, onClose, lead, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const isEdit = !!lead?.id;

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        salutationName: lead.salutationName || '',
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        title: lead.title || '',
        accountName: lead.accountName || '',
        emailAddress: lead.emailAddress || '',
        phoneNumber: lead.phoneNumber || '',
        status: lead.status || 'New',
        source: lead.source || '',
        industry: lead.industry || '',
        opportunityAmount: lead.opportunityAmount ?? '',
        doNotCall: !!lead.doNotCall,
        website: lead.website || '',
        description: lead.description || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErr(null);
  }, [open, lead]);

  const handleSave = async () => {
    if (!form.lastName.trim()) {
      setErr('Last name is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        opportunityAmount: form.opportunityAmount === '' ? null : Number(form.opportunityAmount),
      };
      if (isEdit) await updateLead(lead.id, payload);
      else        await createLead(payload);
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isEdit ? 'Edit Lead' : 'New Lead'}
        </Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 4, pt: 2 }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Title</InputLabel>
              <Select value={form.salutationName} label="Title"
                onChange={e => setForm(f => ({ ...f, salutationName: e.target.value }))}>
                {LEAD_SALUTATIONS.map(s => <MenuItem key={s || 'none'} value={s}>{s || '—'}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={5}>
            <TextField fullWidth size="small" label="First Name"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </Grid>
          <Grid item xs={5}>
            <TextField fullWidth size="small" label="Last Name" required
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Job Title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Account / Company"
              value={form.accountName}
              onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} />
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Email" type="email"
              value={form.emailAddress}
              onChange={e => setForm(f => ({ ...f, emailAddress: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Phone"
              value={form.phoneNumber}
              onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
          </Grid>

          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status"
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {LEAD_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Source</InputLabel>
              <Select value={form.source} label="Source"
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {LEAD_SOURCES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <TextField fullWidth size="small" label="Industry"
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Opportunity Amount" type="number"
              value={form.opportunityAmount}
              onChange={e => setForm(f => ({ ...f, opportunityAmount: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Website"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </Grid>

          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Description" multiline rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch checked={form.doNotCall}
                  onChange={e => setForm(f => ({ ...f, doNotCall: e.target.checked }))} />
              }
              label="Do Not Call"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save' : 'Create Lead')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
