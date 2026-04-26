import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit, Delete, Launch } from '@mui/icons-material';
import { rolesApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyTenantGate from './PartyTenantGate';

const EMPTY = { name: '', description: '' };

export default function Roles() {
  return <PartyTenantGate render={tenantId => <Inner tenantId={tenantId} />} />;
}

function Inner({ tenantId }) {
  const nav = useNavigate();
  const { tenant } = useParams();
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState({ open: false, form: EMPTY, initial: null });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setRows(await rolesApi.list(tenantId));
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tenantId]);

  const save = async () => {
    try {
      setSaving(true);
      if (dlg.initial) await rolesApi.patch(tenantId, dlg.initial.id, dlg.form);
      else await rolesApi.create(tenantId, dlg.form);
      success(dlg.initial ? 'Role updated' : 'Role created');
      setDlg({ open: false, form: EMPTY, initial: null });
      load();
    } catch (e) {
      const { message, detail } = extractError(e, 'Save failed');
      notifyError(message, detail);
    } finally {
      setSaving(false);
    }
  };

  const del = async (row) => {
    if (!confirm(`Delete role "${row.name}"?`)) return;
    try {
      await rolesApi.remove(tenantId, row.id);
      success('Role deleted');
      load();
    } catch (e) {
      notifyError(extractError(e).message);
    }
  };

  const setField = (f) => (e) =>
    setDlg(d => ({ ...d, form: { ...d.form, [f]: e.target.value } }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Roles</Typography>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => setDlg({ open: true, form: EMPTY, initial: null })}>
          New Role
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No roles yet
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {r.name}
                    </TableCell>
                    <TableCell>{r.description || '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => nav(`/${tenant}/party/roles/${r.id}`)}>
                        <Launch fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDlg({ open: true, form: { ...EMPTY, ...r }, initial: r })}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => del(r)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dlg.open} onClose={() => setDlg({ open: false, form: EMPTY, initial: null })}
        maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 'var(--font-size-md)' }}>
          {dlg.initial ? 'Edit role' : 'New role'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, px: 4 }}>
          <TextField label="Name" size="small" fullWidth required
            value={dlg.form.name} onChange={setField('name')}
            disabled={!!dlg.initial}
            helperText="lowercase letters/digits/underscore" />
          <TextField label="Description" size="small" fullWidth multiline rows={2}
            value={dlg.form.description || ''} onChange={setField('description')} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg({ open: false, form: EMPTY, initial: null })}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
