import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, Avatar, Chip, Autocomplete,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon, SupportAgent as CaseIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import {
  getCase, createCase, updateCase, getCurrentUser, get as crmGet,
  CASE_STATUSES, CASE_PRIORITIES, CASE_TYPES,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

const STATUS_COLOR = {
  'New': 'info', 'Assigned': 'primary', 'Pending': 'warning',
  'Closed': 'success', 'Rejected': 'error', 'Duplicate': 'default',
};
const PRIORITY_COLOR = {
  'Low': 'default', 'Normal': 'info', 'High': 'warning', 'Urgent': 'error',
};

const EMPTY = {
  name: '', status: 'New', priority: 'Normal', type: '',
  accountId: '', accountName: '',
  contactId: '', contactName: '',
  leadId: '',    leadName: '',
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
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (isEdit) {
      setLoad(true);
      getCase(id).then(d => {
        setForm({
          name: d.name || '', status: d.status || 'New',
          priority: d.priority || 'Normal', type: d.type || '',
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
    const missing = [];
    if (!form.name.trim()) missing.push('Name');
    if (missing.length) {
      setTouched({ name: !form.name.trim() });
      setErr(`Required: ${missing.join(', ')}`);
      return;
    }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form };
      delete payload.assignedUserName;
      delete payload.accountName;
      delete payload.contactName;
      delete payload.leadName;
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
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={(theme) => ({
          width: 40, height: 40, borderRadius: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          color: theme.palette.primary.main,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        })}>
          <CaseIcon />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {isEdit ? `Edit ${form.name || 'Case'}` : 'Create Case'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {form.status && <Chip label={form.status} size="small" color={STATUS_COLOR[form.status] || 'default'} />}
            {form.priority && (
              <Chip label={form.priority} size="small" variant="outlined"
                color={PRIORITY_COLOR[form.priority] || 'default'}
                icon={<DotIcon sx={{ fontSize: 10 }} />} />
            )}
            {form.type && <Chip label={form.type} size="small" variant="outlined" />}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, px: 1.5, py: 1, bgcolor: 'background.default', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outlined" size="small" onClick={cancel}>Cancel</Button>
        </Box>
        <IconButton size="small" onClick={cancel}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Panel title="Overview">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Lbl required>Name / Subject</Lbl>
                <TextField fullWidth size="small" required
                  placeholder="Short summary of the case"
                  value={form.name}
                  error={touched.name && !form.name.trim()}
                  helperText={touched.name && !form.name.trim() ? 'Name is required' : ''}
                  onChange={e => { set({ name: e.target.value }); setTouched(t => ({ ...t, name: true })); }} />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Lbl required>Status</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.status} onChange={e => set({ status: e.target.value })}>
                    {CASE_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Lbl>Priority</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.priority} onChange={e => set({ priority: e.target.value })}>
                    {CASE_PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Lbl>Type</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.type} displayEmpty
                    onChange={e => set({ type: e.target.value })}>
                    {CASE_TYPES.map(t => <MenuItem key={t || 'n'} value={t}>{t || '—'}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Panel>

          <Panel title="Parties">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Lbl>Account</Lbl>
                <LinkPicker entity="Account"
                  value={form.accountId ? { id: form.accountId, name: form.accountName } : null}
                  onChange={v => set({ accountId: v?.id || '', accountName: v?.name || '' })}
                  placeholder="Search accounts…" />
              </Box>
              <Box>
                <Lbl>Contact</Lbl>
                <LinkPicker entity="Contact"
                  value={form.contactId ? { id: form.contactId, name: form.contactName } : null}
                  onChange={v => set({ contactId: v?.id || '', contactName: v?.name || '' })}
                  placeholder="Search contacts…" />
              </Box>
              <Box>
                <Lbl>Lead</Lbl>
                <LinkPicker entity="Lead"
                  value={form.leadId ? { id: form.leadId, name: form.leadName } : null}
                  onChange={v => set({ leadId: v?.id || '', leadName: v?.name || '' })}
                  placeholder="Search leads…" />
              </Box>
            </Box>
          </Panel>

          <Panel title="Details">
            <Lbl>Description</Lbl>
            <TextField fullWidth size="small" multiline minRows={10} maxRows={24}
              placeholder="Describe the issue, steps to reproduce, and expected outcome…"
              value={form.description}
              onChange={e => set({ description: e.target.value })} />
          </Panel>
        </Box>

        <Box>
          <Panel title="Assignment" dense>
            <Lbl required>Assigned User</Lbl>
            {form.assignedUserName ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.75, mb: 2.5 }}>
                <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: 'primary.main' }}>
                  {form.assignedUserName.slice(0, 2).toUpperCase()}
                </Avatar>
                <Typography variant="body2" sx={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                  {form.assignedUserName}
                </Typography>
              </Box>
            ) : <TextField size="small" fullWidth disabled sx={{ mb: 2.5 }} placeholder="Not assigned" />}
            <Lbl>Teams</Lbl>
            <TextField size="small" fullWidth placeholder="Select teams" disabled sx={{ mb: 2.5 }} />
            <Lbl>Collaborators</Lbl>
            <TextField size="small" fullWidth placeholder="Add collaborators" disabled />
          </Panel>

          <Panel title="Quick Guide" dense>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <GuideRow color="info"    label="New"      desc="Just submitted, not reviewed yet" />
              <GuideRow color="primary" label="Assigned" desc="Picked up by an agent" />
              <GuideRow color="warning" label="Pending"  desc="Waiting on customer / third party" />
              <GuideRow color="success" label="Closed"   desc="Resolved" />
            </Box>
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}

// ── Single-select link picker (searchable, async) ──
function LinkPicker({ entity, value, onChange, placeholder }) {
  const [input,   setInput]   = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const q  = input.trim();
    const id = ++reqRef.current;
    setLoading(true);
    const params = { maxSize: 10, select: 'id,name' };
    if (q) params.textFilter = q;
    crmGet(`/${entity}`, params)
      .then(res => {
        if (id !== reqRef.current) return;
        setOptions((res.list || []).map(it => ({ id: it.id, name: it.name || '(unnamed)' })));
      })
      .catch(() => {})
      .finally(() => { if (id === reqRef.current) setLoading(false); });
  }, [input, entity]);

  return (
    <Autocomplete
      size="small"
      value={value}
      options={options}
      loading={loading}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, v) => onChange?.(v)}
      getOptionLabel={o => o?.name || ''}
      isOptionEqualToValue={(o, v) => o.id === v?.id}
      slotProps={{
        popper: {
          sx: { minWidth: 320, width: 'max-content !important', maxWidth: 480 },
          placement: 'bottom-start',
        },
        paper: { sx: { minWidth: 320 } },
      }}
      renderOption={(props, opt) => (
        <Box component="li" {...props} key={opt.id}
          sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Avatar sx={{ width: 22, height: 22, fontSize: 10, mr: 1, flexShrink: 0, bgcolor: 'primary.main' }}>
            {opt.name.slice(0, 2).toUpperCase()}
          </Avatar>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {opt.name}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} size="small" placeholder={placeholder} />
      )}
    />
  );
}

function GuideRow({ color, label, desc }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Chip size="small" label={label} color={color}
        sx={{ height: 20, fontSize: 10, fontWeight: 600, minWidth: 70 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, lineHeight: 1.4, pt: 0.25 }}>
        {desc}
      </Typography>
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
