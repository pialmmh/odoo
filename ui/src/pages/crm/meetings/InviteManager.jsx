import { useEffect, useState, useCallback } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography, Snackbar,
} from '@mui/material';
import {
  Add as AddIcon, ContentCopy as CopyIcon, Delete as DeleteIcon,
  Email as EmailIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listInvites, createInvite, revokeInvite } from '../../../services/crm';

const TTL_PRESETS = [
  { label: '1 hour',   seconds: 3600 },
  { label: '24 hours', seconds: 24 * 3600 },
  { label: '7 days',   seconds: 7 * 24 * 3600 },
  { label: '30 days',  seconds: 30 * 24 * 3600 },
];

export default function InviteManager({ meetingId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snack, setSnack] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listInvites(meetingId);
      setRows(r?.invites || []);
      setErr(null);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const onRevoke = async (token) => {
    if (!confirm('Revoke this invite link?')) return;
    try {
      await revokeInvite(meetingId, token);
      setSnack({ sev: 'success', msg: 'Invite revoked' });
      load();
    } catch (e) {
      setSnack({ sev: 'error', msg: e?.response?.data?.error || e.message });
    }
  };

  const copy = async (text, label = 'Link copied') => {
    try {
      await navigator.clipboard.writeText(text);
      setSnack({ sev: 'success', msg: label });
    } catch {
      setSnack({ sev: 'error', msg: 'Could not copy — select manually' });
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Invites</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh"><IconButton size="small" onClick={load}><RefreshIcon /></IconButton></Tooltip>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            New invite
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No invites yet. Create one and share the link.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((l) => {
              const expired = l.expiresAt && new Date(l.expiresAt) < new Date();
              const used    = !!l.usedAt && l.linkType !== 'SHARE';
              return (
                <TableRow key={l.token} hover>
                  <TableCell>{l.invitedEmail || '—'}</TableCell>
                  <TableCell>{l.invitedName || <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                  <TableCell><Chip size="small" label={l.linkType || 'PERSONAL'} /></TableCell>
                  <TableCell>{l.expiresAt ? new Date(l.expiresAt).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    {used    ? <Chip size="small" label="Used"    /> :
                     expired ? <Chip size="small" label="Expired" color="warning" /> :
                               <Chip size="small" label="Active"  color="success" />}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Copy link">
                      <IconButton size="small" onClick={() => copy(l.url)}><CopyIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Send email (SMTP not configured yet)">
                      <span>
                        <IconButton size="small" disabled><EmailIcon fontSize="small" /></IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Revoke">
                      <IconButton size="small" onClick={() => onRevoke(l.token)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <CreateInviteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(link) => {
          setDialogOpen(false);
          copy(link.url, 'Invite created — link copied');
          load();
        }}
        meetingId={meetingId}
      />

      <Snackbar
        open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack && <Alert severity={snack.sev} onClose={() => setSnack(null)}>{snack.msg}</Alert>}
      </Snackbar>
    </Box>
  );
}

function CreateInviteDialog({ open, onClose, onCreated, meetingId }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [ttl, setTtl] = useState(7 * 24 * 3600);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setEmail(''); setName(''); setTtl(7 * 24 * 3600); setErr(null); }
  }, [open]);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const link = await createInvite(meetingId, {
        invitedEmail: email,
        invitedName: name || null,
        expiresInSeconds: ttl,
      });
      onCreated(link);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New invite</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Email" type="email" required fullWidth size="small" autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Name (optional — pre-fills on the join page)" fullWidth size="small"
            value={name} onChange={(e) => setName(e.target.value)} />
          <TextField select label="Expires in" fullWidth size="small"
            value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>
            {TTL_PRESETS.map((p) => (
              <MenuItem key={p.seconds} value={p.seconds}>{p.label}</MenuItem>
            ))}
          </TextField>
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!email || busy}>
          {busy ? 'Creating…' : 'Create link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
