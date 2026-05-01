import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Container, Divider, Grid,
  InputAdornment, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as BackIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  createLead, deleteLead, getLead, updateLead,
  listStages, listSalesUsers, listTeams,
  SOURCE_CHANNELS,
} from '../../services/odoo-crm';

// Odoo m2o fields are sent as a bare id when writing, returned as [id, name] on read.
const m2oId = (v) => (Array.isArray(v) ? v[0] : v || null);

const EMPTY = {
  name: '',
  type: 'lead',
  contact_name: '',
  partner_name: '',
  email_from: '',
  phone: '',
  description: '',
  stage_id: null,
  user_id: null,
  team_id: null,
  source_channel: '',
  probability: 10,
  expected_revenue: 0,
};

export default function LeadEditOdoo() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !idParam || idParam === 'new';
  const id = isNew ? null : Number(idParam);

  // Build absolute paths for navigation. We're under /:tenant/experiments/leads-odoo/...
  // so derive the base by trimming everything after that segment.
  const listBase = location.pathname.replace(/\/(new|\d+\/edit)$/, '');

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listStages(), listSalesUsers(), listTeams()]).then(([s, u, t]) => {
      if (cancelled) return;
      setStages(s); setUsers(u); setTeams(t);
    }).catch((e) => setError('Failed to load picklists: ' + (e?.message || e)));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getLead(id).then((row) => {
      if (!row) { setError(`Lead ${id} not found`); return; }
      setForm({
        name:             row.name || '',
        type:             row.type || 'lead',
        contact_name:     row.contact_name || '',
        partner_name:     row.partner_name || '',
        email_from:       row.email_from || '',
        phone:            row.phone || '',
        description:      row.description || '',
        stage_id:         m2oId(row.stage_id),
        user_id:          m2oId(row.user_id),
        team_id:          m2oId(row.team_id),
        source_channel:   row.source_channel || '',
        probability:      row.probability ?? 10,
        expected_revenue: row.expected_revenue ?? 0,
      });
    }).catch((e) => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setNum = (k) => (e) => setForm({ ...form, [k]: e.target.value === '' ? null : Number(e.target.value) });

  const onSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setError(null); setSaving(true);
    try {
      // Strip empty strings for selection fields so Odoo keeps NULL.
      const vals = { ...form };
      if (!vals.source_channel) delete vals.source_channel;
      if (!vals.stage_id)       delete vals.stage_id;
      if (!vals.user_id)        delete vals.user_id;
      if (!vals.team_id)        delete vals.team_id;

      if (isNew) {
        const newId = await createLead(vals);
        navigate(`${listBase}/${newId}/edit`, { replace: true });
      } else {
        await updateLead(id, vals);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirm(`Delete lead "${form.name}"?`)) return;
    try {
      await deleteLead(id);
      navigate(listBase);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3, px: { xs: 3, md: 6 } }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(listBase)} size="small">Back</Button>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {isNew ? 'New Lead' : `Edit ${form.type === 'opportunity' ? 'Opportunity' : 'Lead'} #${id}`}
        </Typography>
        {!isNew && (
          <Button color="error" size="small" startIcon={<DeleteIcon />} onClick={onDelete} disabled={saving}>
            Delete
          </Button>
        )}
        <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={8}>
            <TextField label="Name (subject)" value={form.name} onChange={set('name')}
                       size="small" fullWidth required />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Type" select value={form.type} onChange={set('type')}
                       size="small" fullWidth>
              <MenuItem value="lead">Lead</MenuItem>
              <MenuItem value="opportunity">Opportunity</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField label="Contact Name" value={form.contact_name} onChange={set('contact_name')}
                       size="small" fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Company" value={form.partner_name} onChange={set('partner_name')}
                       size="small" fullWidth />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField label="Email" type="email" value={form.email_from} onChange={set('email_from')}
                       size="small" fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Phone" value={form.phone} onChange={set('phone')}
                       size="small" fullWidth />
          </Grid>

          <Grid item xs={12}><Divider sx={{ my: 0.5 }}>Pipeline</Divider></Grid>

          <Grid item xs={12} sm={4}>
            <TextField label="Stage" select value={form.stage_id || ''} onChange={set('stage_id')}
                       size="small" fullWidth>
              <MenuItem value=""><em>—</em></MenuItem>
              {stages.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Salesperson" select value={form.user_id || ''} onChange={set('user_id')}
                       size="small" fullWidth>
              <MenuItem value=""><em>—</em></MenuItem>
              {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Sales Team" select value={form.team_id || ''} onChange={set('team_id')}
                       size="small" fullWidth>
              <MenuItem value=""><em>—</em></MenuItem>
              {teams.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField label="Channel" select value={form.source_channel} onChange={set('source_channel')}
                       size="small" fullWidth>
              <MenuItem value=""><em>—</em></MenuItem>
              {SOURCE_CHANNELS.map(([v, label]) => <MenuItem key={v} value={v}>{label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField label="Probability" type="number" value={form.probability ?? ''} onChange={setNum('probability')}
                       size="small" fullWidth
                       InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                       inputProps={{ min: 0, max: 100, step: 5 }} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField label="Expected Revenue" type="number" value={form.expected_revenue ?? ''} onChange={setNum('expected_revenue')}
                       size="small" fullWidth
                       inputProps={{ min: 0, step: 100 }} />
          </Grid>

          <Grid item xs={12}>
            <TextField label="Internal notes" value={form.description} onChange={set('description')}
                       size="small" fullWidth multiline minRows={3} maxRows={8} />
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        {'Phase 1 — writes go through `/api/odoo/crm.lead/{create,write,unlink}` with the active tenant header.'}
      </Typography>
    </Container>
  );
}
