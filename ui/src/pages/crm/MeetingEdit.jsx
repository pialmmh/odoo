import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, Avatar,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  getMeeting, createMeeting, updateMeeting, getCurrentUser, MEETING_STATUSES,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';
import AttendeePicker from './AttendeePicker';
import ParentPicker from './ParentPicker';

// ── datetime helpers ──
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toEspoDT = (date, time) => (date ? `${date} ${time || '00:00'}:00` : null);
const parseLocalDT = (date, time) => {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};
// Split Espo's "YYYY-MM-DD HH:MM:SS" into date+time parts
const splitEspoDT = (s) => {
  if (!s) return ['', ''];
  // Accept either space- or T-separated; Espo's native is space + seconds.
  const norm = s.replace('T', ' ');
  const [date = '', time = ''] = norm.split(' ');
  return [date, time.slice(0, 5)];
};
const defaultStart = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};

const DURATIONS = [
  { v: 900,   l: '15m' },
  { v: 1800,  l: '30m' },
  { v: 2700,  l: '45m' },
  { v: 3600,  l: '1h' },
  { v: 5400,  l: '1.5h' },
  { v: 7200,  l: '2h' },
  { v: 14400, l: '4h' },
  { v: 28800, l: '8h' },
  { v: 86400, l: '1d' },
];

function buildInitial() {
  const s = defaultStart();
  const e = new Date(s.getTime() + 3600 * 1000);
  return {
    name: '', status: 'Planned',
    startDate: fmtDate(s), startTime: fmtTime(s),
    endDate: fmtDate(e),   endTime: fmtTime(e),
    duration: 3600,
    description: '',
    parent: null,                              // { type, id, name }
    users: [], contacts: [], leads: [],         // [{id, name}]
    assignedUserId: '', assignedUserName: '',
  };
}

export default function MeetingEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm]     = useState(buildInitial);
  const [loading, setLoad]  = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  useEffect(() => {
    if (isEdit) {
      setLoad(true);
      getMeeting(id).then(d => {
        const [sd, st] = splitEspoDT(d.dateStart);
        const [ed, et] = splitEspoDT(d.dateEnd);
        const dur = (parseLocalDT(ed, et) && parseLocalDT(sd, st))
          ? Math.max(0, Math.round((parseLocalDT(ed, et) - parseLocalDT(sd, st)) / 1000))
          : 3600;
        setForm({
          name: d.name || '',
          status: d.status || 'Planned',
          startDate: sd, startTime: st,
          endDate: ed,   endTime: et,
          duration: dur,
          description: d.description || '',
          parent: d.parentId ? { type: d.parentType, id: d.parentId, name: d.parentName } : null,
          users:    objIdsToList(d.usersIds,    d.usersNames),
          contacts: objIdsToList(d.contactsIds, d.contactsNames),
          leads:    objIdsToList(d.leadsIds,    d.leadsNames),
          assignedUserId: d.assignedUserId || '',
          assignedUserName: d.assignedUserName || '',
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

  // When start moves, preserve duration → shift end.
  const setStart = (date, time) => {
    setForm(f => {
      const next = { ...f, startDate: date, startTime: time };
      const s = parseLocalDT(date, time);
      if (s && f.duration != null) {
        const e = new Date(s.getTime() + f.duration * 1000);
        next.endDate = fmtDate(e);
        next.endTime = fmtTime(e);
      }
      return next;
    });
  };
  const setDuration = (v) => {
    setForm(f => {
      const next = { ...f, duration: v };
      const s = parseLocalDT(f.startDate, f.startTime);
      if (s) {
        const e = new Date(s.getTime() + v * 1000);
        next.endDate = fmtDate(e);
        next.endTime = fmtTime(e);
      }
      return next;
    });
  };
  const setEnd = (date, time) => {
    setForm(f => {
      const next = { ...f, endDate: date, endTime: time };
      const s = parseLocalDT(f.startDate, f.startTime);
      const e = parseLocalDT(date, time);
      if (s && e) next.duration = Math.max(0, Math.round((e - s) / 1000));
      return next;
    });
  };

  const submit = useCallback(async () => {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (!form.startDate)    { setErr('Date Start is required'); return; }
    if (!form.endDate)      { setErr('Date End is required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        status: form.status,
        dateStart: toEspoDT(form.startDate, form.startTime),
        dateEnd:   toEspoDT(form.endDate,   form.endTime),
        description: form.description || '',
        parentType: form.parent?.type || null,
        parentId:   form.parent?.id   || null,
        parentName: form.parent?.name || null,
        usersIds:     form.users.map(u => u.id),
        usersNames:   listToNameMap(form.users),
        contactsIds:  form.contacts.map(c => c.id),
        contactsNames: listToNameMap(form.contacts),
        leadsIds:     form.leads.map(l => l.id),
        leadsNames:   listToNameMap(form.leads),
        assignedUserId:   form.assignedUserId || null,
        assignedUserName: form.assignedUserName || null,
      };
      const saved = isEdit ? await updateMeeting(id, payload) : await createMeeting(payload);
      navigate(`../${saved?.id || id}`);
    } catch (e) { setErr(e?.response?.data?.message || e.message || 'Save failed'); }
    setSaving(false);
  }, [form, id, isEdit, navigate]);

  const cancel = () => isEdit ? navigate(`../${id}`) : navigate('..');

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Meetings</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
        {isEdit ? `Edit ${form.name}` : 'Create Meeting'}
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
        {/* ── Main column ── */}
        <Box sx={{ minWidth: 0 }}>
          <Panel title="Overview">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Lbl required>Name</Lbl>
                <TextField fullWidth size="small" required value={form.name}
                  onChange={e => set({ name: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Lbl required>Status</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.status} onChange={e => set({ status: e.target.value })}>
                    {MEETING_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl required>Date Start</Lbl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField size="small" type="date" sx={{ flex: 1 }}
                    InputLabelProps={{ shrink: true }}
                    value={form.startDate} onChange={e => setStart(e.target.value, form.startTime)} />
                  <TextField size="small" type="time" sx={{ width: 120 }}
                    InputLabelProps={{ shrink: true }}
                    value={form.startTime} onChange={e => setStart(form.startDate, e.target.value)} />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl required>Date End</Lbl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField size="small" type="date" sx={{ flex: 1 }}
                    InputLabelProps={{ shrink: true }}
                    value={form.endDate} onChange={e => setEnd(e.target.value, form.endTime)} />
                  <TextField size="small" type="time" sx={{ width: 120 }}
                    InputLabelProps={{ shrink: true }}
                    value={form.endTime} onChange={e => setEnd(form.endDate, e.target.value)} />
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Duration</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.duration}
                    onChange={e => setDuration(+e.target.value)}>
                    {DURATIONS.map(d => <MenuItem key={d.v} value={d.v}>{d.l}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Parent</Lbl>
                <ParentPicker value={form.parent} onChange={v => set({ parent: v })} />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Lbl>Description</Lbl>
                <TextField fullWidth size="small" multiline minRows={4} maxRows={15}
                  value={form.description} onChange={e => set({ description: e.target.value })} />
              </Grid>
            </Grid>
          </Panel>

        </Box>

        {/* ── Side column ── */}
        <Box>
          <Panel title="Assignment" dense>
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

          <Panel title="Attendees" dense>
            <Lbl>Users</Lbl>
            <Box sx={{ mb: 1.5 }}>
              <AttendeePicker entity="User" value={form.users}
                onChange={v => set({ users: v })} placeholder="Add users" />
            </Box>
            <Lbl>Contacts</Lbl>
            <Box sx={{ mb: 1.5 }}>
              <AttendeePicker entity="Contact" value={form.contacts}
                onChange={v => set({ contacts: v })} placeholder="Add contacts" />
            </Box>
            <Lbl>Leads</Lbl>
            <AttendeePicker entity="Lead" value={form.leads}
              onChange={v => set({ leads: v })} placeholder="Add leads" />
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

// Espo link-multiple hydrate: ids = [id], names = {id: name} → [{id, name}]
function objIdsToList(ids, names) {
  if (!Array.isArray(ids)) return [];
  const map = names || {};
  return ids.map(id => ({ id, name: map[id] || id }));
}
function listToNameMap(list) {
  return Object.fromEntries((list || []).map(x => [x.id, x.name]));
}
