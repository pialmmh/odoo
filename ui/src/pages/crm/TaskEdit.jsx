import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, Avatar,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  getTask, createTask, updateTask, getCurrentUser,
  TASK_STATUSES, TASK_PRIORITIES,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

const EMPTY = {
  name: '', status: 'Not Started', priority: 'Normal',
  dateStart: '', dateEnd: '',
  description: '',
  assignedUserId: '', assignedUserName: '',
};

// 7 days out default due date
function defaultDueDate() {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function TaskEdit() {
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
      getTask(id).then(d => {
        setForm({
          name: d.name || '', status: d.status || 'Not Started',
          priority: d.priority || 'Normal',
          dateStart: d.dateStart || d.dateStartDate || '',
          dateEnd: d.dateEnd || d.dateEndDate || '',
          description: d.description || '',
          assignedUserId: d.assignedUserId || '', assignedUserName: d.assignedUserName || '',
        });
      }).catch(e => setErr(e?.response?.data?.message || e.message))
        .finally(() => setLoad(false));
    } else {
      setForm(f => ({ ...f, dateEnd: defaultDueDate() }));
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
      // Date-only values → store via dateStartDate / dateEndDate so Espo treats as all-day
      if (payload.dateStart && !payload.dateStart.includes(' ')) {
        payload.dateStartDate = payload.dateStart;
        delete payload.dateStart;
      }
      if (payload.dateEnd && !payload.dateEnd.includes(' ')) {
        payload.dateEndDate = payload.dateEnd;
        delete payload.dateEnd;
      }
      const saved = isEdit ? await updateTask(id, payload) : await createTask(payload);
      navigate(`../${saved?.id || id}`);
    } catch (e) { setErr(e?.response?.data?.message || e.message || 'Save failed'); }
    setSaving(false);
  }, [form, id, isEdit, navigate]);

  const cancel = () => isEdit ? navigate(`../${id}`) : navigate('..');

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Tasks</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
        {isEdit ? `Edit ${form.name}` : 'Create Task'}
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
                    {TASK_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Priority</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.priority} onChange={e => set({ priority: e.target.value })}>
                    {TASK_PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Lbl>Date Start</Lbl>
                <TextField fullWidth size="small" type="date"
                  InputLabelProps={{ shrink: true }}
                  value={form.dateStart}
                  onChange={e => set({ dateStart: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Lbl>Due Date</Lbl>
                <TextField fullWidth size="small" type="date"
                  InputLabelProps={{ shrink: true }}
                  value={form.dateEnd}
                  onChange={e => set({ dateEnd: e.target.value })} />
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
