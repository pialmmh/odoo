import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Chip, Divider, IconButton,
  Tooltip, Alert, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import {
  OpenInNew as OpenIcon, Add as AddIcon, NoteAdd as NoteIcon,
  Task as TaskIcon, TrendingUp as AdvanceIcon, SwapHoriz as ConvertIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { postNote, getStream, createTask, OPPORTUNITY_STAGES, CASE_STATUSES } from '../../../services/crm';

// Renders inside the meeting room right-drawer when the "Context" tab is active.
// Everything here operates on the Meeting's parent entity (Lead / Contact /
// Account / Opportunity / Case). If there is no parent, show a gentle nudge.
export default function ContextPanel({ meeting, onAttach }) {
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';

  const parent = meeting?.parentType && meeting?.parentId ? {
    type: meeting.parentType,
    id: meeting.parentId,
    name: meeting.parentName || meeting.parentId,
  } : null;

  const [note, setNote] = useState('');
  const [snack, setSnack] = useState(null);
  const [recent, setRecent] = useState([]);

  // Follow-up task quick form
  const [showTask, setShowTask] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDue, setTaskDue] = useState('');

  useEffect(() => {
    if (!parent) return;
    getStream(parent.type, parent.id, { maxSize: 5 })
      .then((r) => setRecent(r.list || []))
      .catch(() => {});
  }, [parent?.type, parent?.id]);

  if (!parent) {
    return (
      <Box sx={{ p: 2, color: '#ddd' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#fff' }}>Context</Typography>
        <Alert severity="info" sx={{ bgcolor: '#2a2a2a', color: '#ddd', '.MuiAlert-icon': { color: '#6cb' } }}>
          This meeting has no linked parent record. Edit the meeting to link a Lead, Contact, Opportunity, or Case so you can log notes to it from here.
        </Alert>
      </Box>
    );
  }

  const submitNote = async () => {
    const text = note.trim();
    if (!text) return;
    try {
      await postNote(parent.type, parent.id, `[Meeting: ${meeting.name}] ${text}`);
      setNote('');
      setSnack('Note posted');
      onAttach?.(`Posted note to ${parent.type}: ${parent.name}`);
    } catch (e) {
      setSnack(`Failed: ${e?.message || 'unknown error'}`);
    }
  };

  const submitTask = async () => {
    if (!taskName.trim()) return;
    try {
      await createTask({
        name: taskName.trim(),
        parentType: parent.type, parentId: parent.id, parentName: parent.name,
        dateEnd: taskDue || null,
        status: 'Not Started', priority: 'Normal',
      });
      setTaskName(''); setTaskDue(''); setShowTask(false);
      setSnack('Task created');
      onAttach?.(`Task created on ${parent.type}: ${parent.name}`);
    } catch (e) {
      setSnack(`Failed: ${e?.message || 'unknown error'}`);
    }
  };

  const parentUrl = `${base}/crm/${pluralize(parent.type)}/${parent.id}`;

  return (
    <Box sx={{ p: 1.5, color: '#ddd', overflow: 'auto', height: '100%' }}>
      {/* Parent card */}
      <Box sx={{ border: 1, borderColor: '#333', borderRadius: 1, p: 1.25, mb: 1.5, bgcolor: '#1f1f1f' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Chip size="small" label={parent.type} sx={{ height: 18, fontSize: 10, bgcolor: '#3a3a3a', color: '#ddd' }} />
          <Tooltip title="Open in CRM">
            <IconButton size="small" component={RouterLink} to={parentUrl} target="_blank"
              sx={{ color: '#8cf' }}>
              <OpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>{parent.name}</Typography>
      </Box>

      {/* Quick note */}
      <SectionLabel>Log note to parent</SectionLabel>
      <TextField fullWidth size="small" multiline rows={3} placeholder="Jot down what was discussed…"
        value={note} onChange={(e) => setNote(e.target.value)}
        sx={{ mb: 1, '& .MuiOutlinedInput-root': { bgcolor: '#1f1f1f', color: '#eee' },
          '& fieldset': { borderColor: '#333' }, '& textarea::placeholder': { color: '#777' } }}
      />
      <Button fullWidth size="small" startIcon={<NoteIcon />} variant="contained" disabled={!note.trim()}
        onClick={submitNote} sx={{ mb: 2 }}>
        Post to {parent.type}
      </Button>

      {/* Conditional one-click actions */}
      <SectionLabel>Quick actions</SectionLabel>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
        <Button size="small" startIcon={<TaskIcon />} variant="outlined"
          onClick={() => setShowTask((v) => !v)}
          sx={{ justifyContent: 'flex-start', color: '#ddd', borderColor: '#444' }}>
          Create follow-up task
        </Button>
        {parent.type === 'Lead' && (
          <Button size="small" startIcon={<ConvertIcon />} variant="outlined" component={RouterLink}
            to={`${parentUrl}?convert=1`} target="_blank"
            sx={{ justifyContent: 'flex-start', color: '#ddd', borderColor: '#444' }}>
            Convert Lead
          </Button>
        )}
        {parent.type === 'Opportunity' && (
          <StageBumper parent={parent} onDone={(s) => setSnack(`Stage → ${s}`)} />
        )}
        {parent.type === 'Case' && (
          <StatusBumper parent={parent} onDone={(s) => setSnack(`Status → ${s}`)} />
        )}
      </Box>

      {showTask && (
        <Box sx={{ border: 1, borderColor: '#333', borderRadius: 1, p: 1.25, mb: 2, bgcolor: '#1f1f1f' }}>
          <TextField fullWidth size="small" placeholder="Task name"
            value={taskName} onChange={(e) => setTaskName(e.target.value)}
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', color: '#eee' }, '& fieldset': { borderColor: '#333' } }}
          />
          <TextField fullWidth size="small" type="date"
            value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', color: '#eee' }, '& fieldset': { borderColor: '#333' } }}
          />
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" onClick={() => setShowTask(false)} sx={{ color: '#aaa' }}>Cancel</Button>
            <Button size="small" variant="contained" onClick={submitTask} disabled={!taskName.trim()}>Save</Button>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 1.5, borderColor: '#333' }} />

      {/* Recent activity on parent */}
      <SectionLabel>Recent activity</SectionLabel>
      {recent.length === 0 ? (
        <Typography variant="caption" sx={{ color: '#888' }}>No stream entries yet</Typography>
      ) : (
        recent.map((n) => (
          <Box key={n.id} sx={{ borderLeft: 2, borderColor: '#444', pl: 1, mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#8cf', fontWeight: 600 }}>{n.createdByName || 'System'}</Typography>
            <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>{truncate(n.post || n.data?.fields?.join?.(', ') || n.type, 90)}</Typography>
          </Box>
        ))
      )}

      {snack && (
        <Alert severity="success" onClose={() => setSnack(null)}
          sx={{ position: 'absolute', bottom: 8, left: 8, right: 8, fontSize: 12 }}>
          {snack}
        </Alert>
      )}
    </Box>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{
      fontSize: 10, letterSpacing: 0.8, fontWeight: 700, color: '#888',
      textTransform: 'uppercase', mb: 0.5, mt: 0.5,
    }}>{children}</Typography>
  );
}

function StageBumper({ parent, onDone }) {
  const [stage, setStage] = useState('');
  return (
    <FormControl size="small" fullWidth sx={{
      '& .MuiOutlinedInput-root': { bgcolor: '#1f1f1f', color: '#eee' },
      '& fieldset': { borderColor: '#444' }, '& .MuiSvgIcon-root': { color: '#ccc' },
    }}>
      <InputLabel sx={{ color: '#888' }}>Advance stage</InputLabel>
      <Select label="Advance stage" value={stage}
        onChange={(e) => { setStage(e.target.value); onDone?.(e.target.value); }}
        startAdornment={<AdvanceIcon sx={{ mr: 0.5, fontSize: 16, color: '#ccc' }} />}>
        {OPPORTUNITY_STAGES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
      </Select>
    </FormControl>
  );
}
function StatusBumper({ parent, onDone }) {
  const [status, setStatus] = useState('');
  return (
    <FormControl size="small" fullWidth sx={{
      '& .MuiOutlinedInput-root': { bgcolor: '#1f1f1f', color: '#eee' },
      '& fieldset': { borderColor: '#444' }, '& .MuiSvgIcon-root': { color: '#ccc' },
    }}>
      <InputLabel sx={{ color: '#888' }}>Change status</InputLabel>
      <Select label="Change status" value={status}
        onChange={(e) => { setStatus(e.target.value); onDone?.(e.target.value); }}>
        {CASE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function pluralize(t) {
  const map = { Lead: 'leads', Contact: 'contacts', Account: 'accounts',
    Opportunity: 'opportunities', Case: 'cases' };
  return map[t] || t.toLowerCase() + 's';
}
function truncate(s, n) { if (!s) return ''; return s.length > n ? s.slice(0, n) + '…' : s; }
