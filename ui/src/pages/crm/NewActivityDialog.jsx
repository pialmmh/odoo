import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, IconButton, Alert, Grid, FormControl, InputLabel,
  Select, MenuItem, TextField, Button,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  createMeeting, createCall, createTask, getCurrentUser,
} from '../../services/crm';

// One dialog handling Meeting / Call / Task creates. Mirrors EspoCRM's
// quick-create views; required fields come from entityDefs:
//   Meeting — name, dateStart, dateEnd, status, assignedUser
//   Call    — name, dateStart, dateEnd, direction, status, assignedUser
//   Task    — name, priority, status, assignedUser (dates optional)

const MEETING_STATUS = ['Planned', 'Held', 'Not Held'];
const CALL_STATUS    = ['Planned', 'Held', 'Not Held'];
const CALL_DIRECTION = ['Outbound', 'Inbound'];
const TASK_STATUS    = ['Not Started', 'Started', 'Completed', 'Canceled', 'Deferred'];
const TASK_PRIORITY  = ['Low', 'Normal', 'High', 'Urgent'];

// ISO format helpers for EspoCRM datetime fields: "YYYY-MM-DD HH:mm:ss"
const toDT = (d) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};
const defaultStart = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};
const addMinutes = (d, m) => { const c = new Date(d); c.setMinutes(c.getMinutes() + m); return c; };
const toInputDT = (d) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function NewActivityDialog({ open, kind, parentType, parentId, onClose, onCreated }) {
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const start = defaultStart();
    if (kind === 'Meeting') {
      setForm({
        name: '',
        dateStart: toInputDT(start),
        dateEnd: toInputDT(addMinutes(start, 30)),
        status: 'Planned',
        description: '',
      });
    } else if (kind === 'Call') {
      setForm({
        name: '',
        dateStart: toInputDT(start),
        dateEnd: toInputDT(addMinutes(start, 15)),
        direction: 'Outbound',
        status: 'Planned',
        description: '',
      });
    } else if (kind === 'Task') {
      setForm({
        name: '',
        dateDue: '',
        priority: 'Normal',
        status: 'Not Started',
        description: '',
      });
    }
  }, [open, kind]);

  const submit = async () => {
    if (!form.name?.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    setErr(null);
    try {
      const user = await getCurrentUser();
      const base = {
        name: form.name.trim(),
        parentType,
        parentId,
        assignedUserId: user?.id,
        description: form.description || '',
        status: form.status,
      };
      if (kind === 'Meeting') {
        await createMeeting({
          ...base,
          dateStart: toDT(new Date(form.dateStart)),
          dateEnd:   toDT(new Date(form.dateEnd)),
        });
      } else if (kind === 'Call') {
        await createCall({
          ...base,
          dateStart: toDT(new Date(form.dateStart)),
          dateEnd:   toDT(new Date(form.dateEnd)),
          direction: form.direction,
        });
      } else if (kind === 'Task') {
        const payload = { ...base, priority: form.priority };
        if (form.dateDue) payload.dateDue = form.dateDue; // YYYY-MM-DD is fine
        await createTask(payload);
      }
      onCreated?.();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || `Create ${kind} failed`);
    }
    setSaving(false);
  };

  const title = kind === 'Meeting' ? 'Schedule Meeting'
              : kind === 'Call'    ? 'Log Call'
              :                      'New Task';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Name" required
              value={form.name || ''}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </Grid>

          {(kind === 'Meeting' || kind === 'Call') && (
            <>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Start" type="datetime-local" required
                  InputLabelProps={{ shrink: true }}
                  value={form.dateStart || ''}
                  onChange={e => setForm({ ...form, dateStart: e.target.value })} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="End" type="datetime-local" required
                  InputLabelProps={{ shrink: true }}
                  value={form.dateEnd || ''}
                  onChange={e => setForm({ ...form, dateEnd: e.target.value })} />
              </Grid>
            </>
          )}

          {kind === 'Call' && (
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Direction</InputLabel>
                <Select value={form.direction || 'Outbound'} label="Direction"
                  onChange={e => setForm({ ...form, direction: e.target.value })}>
                  {CALL_DIRECTION.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}

          {kind === 'Task' && (
            <>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Due Date" type="date"
                  InputLabelProps={{ shrink: true }}
                  value={form.dateDue || ''}
                  onChange={e => setForm({ ...form, dateDue: e.target.value })} />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select value={form.priority || 'Normal'} label="Priority"
                    onChange={e => setForm({ ...form, priority: e.target.value })}>
                    {TASK_PRIORITY.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          <Grid item xs={kind === 'Call' ? 6 : 12}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={form.status || ''} label="Status"
                onChange={e => setForm({ ...form, status: e.target.value })}>
                {(kind === 'Meeting' ? MEETING_STATUS
                : kind === 'Call'    ? CALL_STATUS
                :                      TASK_STATUS).map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Description" multiline rows={3}
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
