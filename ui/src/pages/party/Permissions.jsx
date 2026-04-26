import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, CircularProgress,
  FormControlLabel, Switch,
} from '@mui/material';
import { Add as AddIcon, Delete } from '@mui/icons-material';
import { permissionsApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyTenantGate from './PartyTenantGate';

const EMPTY = { name: '', description: '' };
const PERM_REGEX = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*(:[a-z][a-z0-9_]*)?$/;

export default function Permissions() {
  return <PartyTenantGate render={tenantId => <Inner tenantId={tenantId} />} />;
}

function Inner({ tenantId }) {
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState({ open: false, form: EMPTY });
  const [strict, setStrict] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setRows(await permissionsApi.list(tenantId));
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tenantId]);

  const save = async () => {
    if (strict && !PERM_REGEX.test(dlg.form.name)) {
      notifyError('Name must match domain:action[:scope] (lowercase)');
      return;
    }
    try {
      setSaving(true);
      await permissionsApi.create(tenantId, dlg.form);
      success('Permission created');
      setDlg({ open: false, form: EMPTY });
      load();
    } catch (e) {
      notifyError(extractError(e, 'Save failed').message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (row) => {
    if (!confirm(`Delete permission "${row.name}"?`)) return;
    try {
      await permissionsApi.remove(tenantId, row.id);
      success('Permission deleted');
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
        <Typography variant="h6">Permissions</Typography>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => setDlg({ open: true, form: EMPTY })}>
          New Permission
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
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No permissions yet
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {r.name}
                    </TableCell>
                    <TableCell>{r.description || '—'}</TableCell>
                    <TableCell align="right">
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

      <Dialog open={dlg.open} onClose={() => setDlg({ open: false, form: EMPTY })}
        maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 'var(--font-size-md)' }}>New permission</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, px: 4 }}>
          <TextField label="Name" size="small" fullWidth required
            value={dlg.form.name} onChange={setField('name')}
            helperText="Convention: domain:action[:scope] — e.g. partner:read:own" />
          <TextField label="Description" size="small" fullWidth multiline rows={2}
            value={dlg.form.description || ''} onChange={setField('description')} />
          <FormControlLabel
            control={<Switch checked={!strict} onChange={e => setStrict(!e.target.checked)} />}
            label="I know what I'm doing — skip naming convention"
            sx={{ '.MuiFormControlLabel-label': { fontSize: 'var(--font-size-sm)' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg({ open: false, form: EMPTY })}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
