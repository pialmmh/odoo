import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, IconButton, Alert, Box, Grid, FormControl, InputLabel,
  Select, MenuItem, TextField, Button, Checkbox, FormControlLabel,
  Divider, CircularProgress, Paper, Chip,
} from '@mui/material';
import { Close as CloseIcon, Warning as WarningIcon } from '@mui/icons-material';
import {
  getConvertAttributes, convertLead,
  ACCOUNT_TYPES, OPPORTUNITY_STAGES, LEAD_SOURCES,
} from '../../services/crm';

// Mirrors EspoCRM's convert.js flow:
// 1. Fetch prefilled attributes via POST /Lead/action/getConvertAttributes
// 2. User edits/deselects sections (Account / Contact / Opportunity)
// 3. Submit via POST /Lead/action/convert
// 4. On 409 duplicate → show matches, offer to proceed with skipDuplicateCheck

export default function ConvertDialog({ open, lead, onClose, onConverted }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState(null);

  const [selected, setSelected] = useState({ Account: true, Contact: true, Opportunity: true });
  const [acc, setAcc] = useState({});
  const [con, setCon] = useState({});
  const [opp, setOpp] = useState({});

  useEffect(() => {
    if (!open || !lead?.id) return;
    setErr(null);
    setDuplicates(null);
    setSelected({ Account: true, Contact: true, Opportunity: true });
    setLoading(true);
    getConvertAttributes(lead.id)
      .then(data => {
        setAcc(data.Account || {});
        setCon(data.Contact || {});
        setOpp({
          ...(data.Opportunity || {}),
          stage: data.Opportunity?.stage || 'Prospecting',
          closeDate: data.Opportunity?.closeDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        });
      })
      .catch(e => setErr(e?.response?.data?.message || e.message || 'Failed to load convert attributes'))
      .finally(() => setLoading(false));
  }, [open, lead?.id]);

  const submit = async (skipDuplicateCheck = false) => {
    const records = {};
    if (selected.Account)     records.Account = acc;
    if (selected.Contact)     records.Contact = con;
    if (selected.Opportunity) records.Opportunity = opp;

    if (Object.keys(records).length === 0) {
      setErr('Select at least one record type to create');
      return;
    }
    setSaving(true);
    setErr(null);
    setDuplicates(null);
    try {
      await convertLead(lead.id, records, { skipDuplicateCheck });
      onConverted?.();
      onClose();
    } catch (e) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 409 && body?.reason === 'duplicate') {
        setDuplicates(body.data || []);
      } else {
        setErr(body?.message || e.message || 'Convert failed');
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontWeight: 700, fontSize: 18,
      }}>
        Convert Lead{lead?.name ? ` — ${lead.name}` : ''}
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 4, pt: 2 }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {duplicates && (
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => submit(true)} disabled={saving}>
                Proceed anyway
              </Button>
            }
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Possible duplicate{duplicates.length > 1 ? 's' : ''} found
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {duplicates.map(d => (
                <Chip key={d.id} label={`${d._entityType}: ${d.name}`} size="small" variant="outlined" />
              ))}
            </Box>
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* ── Account section ── */}
            <SectionPaper
              title="Account"
              checked={selected.Account}
              onToggle={v => setSelected(s => ({ ...s, Account: v }))}
            >
              <Grid container spacing={2}>
                <Grid item xs={8}>
                  <TextField fullWidth size="small" label="Name" required
                    value={acc.name || ''}
                    onChange={e => setAcc({ ...acc, name: e.target.value })} />
                </Grid>
                <Grid item xs={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select value={acc.type || ''} label="Type"
                      onChange={e => setAcc({ ...acc, type: e.target.value })}>
                      {ACCOUNT_TYPES.map(t => <MenuItem key={t || 'none'} value={t}>{t || '—'}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Email" type="email"
                    value={acc.emailAddress || ''}
                    onChange={e => setAcc({ ...acc, emailAddress: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Phone"
                    value={acc.phoneNumber || ''}
                    onChange={e => setAcc({ ...acc, phoneNumber: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Industry"
                    value={acc.industry || ''}
                    onChange={e => setAcc({ ...acc, industry: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Website"
                    value={acc.website || ''}
                    onChange={e => setAcc({ ...acc, website: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Billing Address (Street)"
                    value={acc.billingAddressStreet || ''}
                    onChange={e => setAcc({ ...acc, billingAddressStreet: e.target.value })} />
                </Grid>
                <Grid item xs={4}>
                  <TextField fullWidth size="small" label="City"
                    value={acc.billingAddressCity || ''}
                    onChange={e => setAcc({ ...acc, billingAddressCity: e.target.value })} />
                </Grid>
                <Grid item xs={4}>
                  <TextField fullWidth size="small" label="State"
                    value={acc.billingAddressState || ''}
                    onChange={e => setAcc({ ...acc, billingAddressState: e.target.value })} />
                </Grid>
                <Grid item xs={4}>
                  <TextField fullWidth size="small" label="Country"
                    value={acc.billingAddressCountry || ''}
                    onChange={e => setAcc({ ...acc, billingAddressCountry: e.target.value })} />
                </Grid>
              </Grid>
            </SectionPaper>

            {/* ── Contact section ── */}
            <SectionPaper
              title="Contact"
              checked={selected.Contact}
              onToggle={v => setSelected(s => ({ ...s, Contact: v }))}
            >
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="First Name"
                    value={con.firstName || ''}
                    onChange={e => setCon({ ...con, firstName: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Last Name" required
                    value={con.lastName || ''}
                    onChange={e => setCon({ ...con, lastName: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Email" type="email"
                    value={con.emailAddress || ''}
                    onChange={e => setCon({ ...con, emailAddress: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Phone"
                    value={con.phoneNumber || ''}
                    onChange={e => setCon({ ...con, phoneNumber: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Title (Job role)"
                    value={con.title || ''}
                    onChange={e => setCon({ ...con, title: e.target.value })}
                    helperText="Written to the Contact ↔ Account relationship as the role." />
                </Grid>
              </Grid>
            </SectionPaper>

            {/* ── Opportunity section ── */}
            <SectionPaper
              title="Opportunity"
              checked={selected.Opportunity}
              onToggle={v => setSelected(s => ({ ...s, Opportunity: v }))}
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Name" required
                    value={opp.name || ''}
                    onChange={e => setOpp({ ...opp, name: e.target.value })} />
                </Grid>
                <Grid item xs={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Stage</InputLabel>
                    <Select value={opp.stage || 'Prospecting'} label="Stage"
                      onChange={e => setOpp({ ...opp, stage: e.target.value })}>
                      {OPPORTUNITY_STAGES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={4}>
                  <TextField fullWidth size="small" label="Amount" type="number" required
                    value={opp.amount ?? ''}
                    onChange={e => setOpp({ ...opp, amount: e.target.value })} />
                </Grid>
                <Grid item xs={4}>
                  <TextField fullWidth size="small" label="Close Date" type="date" required
                    InputLabelProps={{ shrink: true }}
                    value={opp.closeDate || ''}
                    onChange={e => setOpp({ ...opp, closeDate: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Lead Source</InputLabel>
                    <Select value={opp.leadSource || ''} label="Lead Source"
                      onChange={e => setOpp({ ...opp, leadSource: e.target.value })}>
                      <MenuItem value="">—</MenuItem>
                      {LEAD_SOURCES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Description" multiline rows={2}
                    value={opp.description || ''}
                    onChange={e => setOpp({ ...opp, description: e.target.value })} />
                </Grid>
              </Grid>
            </SectionPaper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => submit(false)}
          disabled={saving || loading}
        >
          {saving ? 'Converting…' : 'Convert'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SectionPaper({ title, checked, onToggle, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: checked ? 2 : 0 }}>
        <FormControlLabel
          control={<Checkbox checked={checked} onChange={e => onToggle(e.target.checked)} />}
          label={<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>}
        />
      </Box>
      {checked && <><Divider sx={{ mb: 2 }} />{children}</>}
    </Paper>
  );
}
