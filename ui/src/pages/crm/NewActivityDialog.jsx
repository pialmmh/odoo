import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, IconButton,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Button, Avatar, Paper, Chip, Divider,
} from '@mui/material';
import {
  Close as CloseIcon, Minimize as MinimizeIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  createMeeting, createCall, createTask, getCurrentUser,
} from '../../services/crm';

// Mirrors EspoCRM's quick-create modal for Meeting / Call / Task — see
// application/Espo/Modules/Crm/Resources/layouts/{Meeting,Call,Task}/detailSmall.json
// + clientDefs/{Meeting,Call}.json sidePanels.editSmall.
//
// Layout (matches screenshot of Create Meeting):
//   Header row: title + minimize/close
//   Toolbar:    Save (primary) / Full Form / Cancel
//   Two-column body:
//     Left main card:  name, status(+direction for Call / +priority for Task),
//                      dateStart (date+time split), duration, dateEnd
//                      (date+time split), parent (readonly), reminders (+),
//                      description
//     Right side card: assigned user (avatar), teams, attendees (leads
//                      pre-filled with current lead)

const MEETING_STATUS = ['Planned', 'Held', 'Not Held'];
const CALL_STATUS    = ['Planned', 'Held', 'Not Held'];
const CALL_DIRECTION = ['Outbound', 'Inbound'];
const TASK_STATUS    = ['Not Started', 'Started', 'Completed', 'Canceled', 'Deferred'];
const TASK_PRIORITY  = ['Low', 'Normal', 'High', 'Urgent'];

// Minutes
const DURATIONS = [
  { v: 900,   l: '15m' },
  { v: 1800,  l: '30m' },
  { v: 2700,  l: '45m' },
  { v: 3600,  l: '1h' },
  { v: 5400,  l: '1.5h' },
  { v: 7200,  l: '2h' },
  { v: 14400, l: '4h' },
  { v: 28800, l: '8h' },
];

// ── date/time helpers ──
const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toEspoDT = (date, time) => `${date} ${time}:00`;
const parseLocalDT = (date, time) => {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};
const defaultStart = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};

export default function NewActivityDialog({
  open, kind, parentType, parentId, parentName,
  onClose, onCreated,
}) {
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState(null);
  const [user, setUser]       = useState(null);

  // Reset form on open
  useEffect(() => {
    if (!open) return;
    setErr(null);
    getCurrentUser().then(setUser).catch(() => {});
    const start = defaultStart();
    const end   = new Date(start); end.setHours(end.getHours() + 1);
    if (kind === 'Meeting') {
      setForm({
        name: '', status: 'Planned',
        startDate: fmtDate(start), startTime: fmtTime(start),
        endDate:   fmtDate(end),   endTime:   fmtTime(end),
        duration: 3600,
        description: '',
      });
    } else if (kind === 'Call') {
      const ed = new Date(start); ed.setMinutes(ed.getMinutes() + 15);
      setForm({
        name: '', status: 'Planned', direction: 'Outbound',
        startDate: fmtDate(start), startTime: fmtTime(start),
        endDate:   fmtDate(ed),    endTime:   fmtTime(ed),
        duration: 900,
        description: '',
      });
    } else if (kind === 'Task') {
      setForm({
        name: '', status: 'Not Started', priority: 'Normal',
        dateDue: '',
        description: '',
      });
    }
  }, [open, kind]);

  // When dateStart changes, preserve duration and recompute dateEnd
  const setStart = (date, time) => {
    setForm(f => {
      const next = { ...f, startDate: date, startTime: time };
      const s = parseLocalDT(date, time);
      if (s && f.duration) {
        const e = new Date(s.getTime() + f.duration * 1000);
        next.endDate = fmtDate(e);
        next.endTime = fmtTime(e);
      }
      return next;
    });
  };

  // When duration changes, recompute dateEnd from dateStart
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

  // When dateEnd changes, derive duration from (end - start)
  const setEnd = (date, time) => {
    setForm(f => {
      const next = { ...f, endDate: date, endTime: time };
      const s = parseLocalDT(f.startDate, f.startTime);
      const e = parseLocalDT(date, time);
      if (s && e) {
        const d = Math.max(0, Math.round((e - s) / 1000));
        next.duration = d;
      }
      return next;
    });
  };

  const submit = useCallback(async () => {
    if (!form.name?.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr(null);
    try {
      const base = {
        name: form.name.trim(),
        parentType, parentId,
        assignedUserId: user?.id,
        description: form.description || '',
        status: form.status,
      };
      if (kind === 'Meeting') {
        await createMeeting({
          ...base,
          dateStart: toEspoDT(form.startDate, form.startTime),
          dateEnd:   toEspoDT(form.endDate,   form.endTime),
        });
      } else if (kind === 'Call') {
        await createCall({
          ...base,
          dateStart: toEspoDT(form.startDate, form.startTime),
          dateEnd:   toEspoDT(form.endDate,   form.endTime),
          direction: form.direction,
        });
      } else if (kind === 'Task') {
        const payload = { ...base, priority: form.priority };
        if (form.dateDue) payload.dateDue = form.dateDue;
        await createTask(payload);
      }
      onCreated?.();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || `Create ${kind} failed`);
    }
    setSaving(false);
  }, [form, kind, parentType, parentId, user, onClose, onCreated]);

  const title = kind === 'Meeting' ? 'Create Meeting'
              : kind === 'Call'    ? 'Create Call'
              :                      'Create Task';

  const statusOptions =
      kind === 'Meeting' ? MEETING_STATUS
    : kind === 'Call'    ? CALL_STATUS
    :                      TASK_STATUS;

  const hasDuration = kind === 'Meeting' || kind === 'Call';

  return (
    <Dialog key={kind} open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: 'background.default' } }}>
      <DialogTitle sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontWeight: 700, fontSize: 18,
        bgcolor: 'primary.50', color: 'text.primary',
        borderBottom: 1, borderColor: 'divider', py: 1.25,
      }}>
        {title}
        <Box>
          <IconButton size="small" disabled><MinimizeIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>

      {/* Save / Full Form / Cancel toolbar */}
      <Box sx={{
        display: 'flex', gap: 1, px: 2, py: 1.25,
        borderBottom: 1, borderColor: 'divider',
        bgcolor: 'background.default',
      }}>
        <Button variant="contained" size="small" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outlined" size="small" disabled title="Not yet wired">
          Full Form
        </Button>
        <Button variant="outlined" size="small" onClick={onClose}>Cancel</Button>
      </Box>

      <DialogContent sx={{ p: 2, bgcolor: 'background.default' }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' },
          gap: 2,
        }}>
          {/* ── Main / Left ── */}
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 1.5 }}>
            <Field label="Name" required>
              <TextField fullWidth size="small" required
                value={form.name || ''}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>

            {/* Status row — Meeting just status; Call status+direction; Task status+priority */}
            {kind === 'Meeting' && (
              <Field label="Status">
                <FormControl fullWidth size="small">
                  <Select value={form.status || ''}
                    onChange={e => setForm({ ...form, status: e.target.value })}>
                    {statusOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Field>
            )}
            {kind === 'Call' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Field label="Status" sx={{ flex: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select value={form.status || ''}
                      onChange={e => setForm({ ...form, status: e.target.value })}>
                      {statusOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Field>
                <Field label="Direction" sx={{ flex: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select value={form.direction || 'Outbound'}
                      onChange={e => setForm({ ...form, direction: e.target.value })}>
                      {CALL_DIRECTION.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Field>
              </Box>
            )}
            {kind === 'Task' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Field label="Status" sx={{ flex: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select value={form.status || ''}
                      onChange={e => setForm({ ...form, status: e.target.value })}>
                      {statusOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Field>
                <Field label="Priority" sx={{ flex: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select value={form.priority || 'Normal'}
                      onChange={e => setForm({ ...form, priority: e.target.value })}>
                      {TASK_PRIORITY.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Field>
              </Box>
            )}

            {hasDuration && (
              <>
                <Field label="Date Start" required>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" type="date" required sx={{ flex: 2 }}
                      InputLabelProps={{ shrink: true }}
                      value={form.startDate || ''}
                      onChange={e => setStart(e.target.value, form.startTime)} />
                    <TextField size="small" type="time" required sx={{ flex: 1 }}
                      InputLabelProps={{ shrink: true }}
                      value={form.startTime || ''}
                      onChange={e => setStart(form.startDate, e.target.value)} />
                  </Box>
                </Field>

                <Field label="Duration">
                  <FormControl size="small" sx={{ maxWidth: 200 }}>
                    <Select value={form.duration || 3600}
                      onChange={e => setDuration(Number(e.target.value))}>
                      {DURATIONS.map(d => <MenuItem key={d.v} value={d.v}>{d.l}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Field>

                <Field label="Date End" required>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" type="date" required sx={{ flex: 2 }}
                      InputLabelProps={{ shrink: true }}
                      value={form.endDate || ''}
                      onChange={e => setEnd(e.target.value, form.endTime)} />
                    <TextField size="small" type="time" required sx={{ flex: 1 }}
                      InputLabelProps={{ shrink: true }}
                      value={form.endTime || ''}
                      onChange={e => setEnd(form.endDate, e.target.value)} />
                  </Box>
                </Field>
              </>
            )}

            {kind === 'Task' && (
              <Field label="Date Due">
                <TextField size="small" type="date" sx={{ maxWidth: 220 }}
                  InputLabelProps={{ shrink: true }}
                  value={form.dateDue || ''}
                  onChange={e => setForm({ ...form, dateDue: e.target.value })} />
              </Field>
            )}

            <Field label="Parent">
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" sx={{ width: 140 }}>
                  <Select value={parentType || ''} disabled>
                    <MenuItem value={parentType}>{parentType}</MenuItem>
                  </Select>
                </FormControl>
                <TextField size="small" fullWidth
                  value={parentName || parentId || ''} disabled />
              </Box>
            </Field>

            <Field label="Reminders">
              <IconButton size="small" disabled sx={{ border: 1, borderColor: 'divider' }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Field>

            <Field label="Description" last>
              <TextField fullWidth size="small" multiline rows={3}
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
          </Paper>

          {/* ── Side / Right ── */}
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 1.5, alignSelf: 'start' }}>
            <Field label="Assigned User" required>
              {user ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,
                  border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.main' }}>
                    {(user.name || user.userName || '?').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }}>
                    {user.name || user.userName}
                  </Typography>
                </Box>
              ) : (
                <TextField size="small" fullWidth placeholder="Loading…" disabled />
              )}
            </Field>

            <Field label="Teams">
              <TextField size="small" fullWidth placeholder="Select" disabled />
            </Field>

            {(kind === 'Meeting' || kind === 'Call') && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: 13 }}>
                  Attendees
                </Typography>

                <Field label="Users">
                  <TextField size="small" fullWidth placeholder="Select" disabled />
                </Field>
                <Field label="Contacts">
                  <TextField size="small" fullWidth placeholder="Select" disabled />
                </Field>
                <Field label={`${parentType === 'Lead' ? 'Leads' : 'Related'}`} last>
                  {parentType === 'Lead' && parentName ? (
                    <Chip label={parentName} size="small" sx={{ mb: 0.5 }} />
                  ) : (
                    <TextField size="small" fullWidth placeholder="Select" disabled />
                  )}
                </Field>
              </>
            )}
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── tiny field wrapper: uppercase label above input ──
function Field({ label, required, children, last, sx }) {
  return (
    <Box sx={{ mb: last ? 0 : 2.5, ...sx }}>
      <Typography sx={{
        fontSize: 10, letterSpacing: 0.8, fontWeight: 600,
        color: 'text.secondary', textTransform: 'uppercase',
        mb: 0.5, lineHeight: 1,
      }}>
        {label}{required && ' *'}
      </Typography>
      {children}
    </Box>
  );
}
