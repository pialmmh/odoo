import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, CircularProgress, Alert,
} from '@mui/material';
import { Add as AddIcon, Edit, Delete } from '@mui/icons-material';
import { operatorsApi, partyTenantsApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartySuperGuard from './PartySuperGuard';

const EMPTY = {
  operatorId: '', shortName: '', fullName: '',
  companyName: '', address1: '', city: '', country: '',
  phone: '', email: '',
  dbHost: '127.0.0.1', dbPort: 3306, dbUser: '', dbPassRef: '',
  status: 'ACTIVE',
};

export default function PartyTenants() {
  return (
    <PartySuperGuard>
      <Inner />
    </PartySuperGuard>
  );
}

function Inner() {
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState({ open: false, form: EMPTY, initial: null });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [t, o] = await Promise.all([
        partyTenantsApi.listAll(),
        operatorsApi.list(),
      ]);
      setRows(t);
      setOps(o);
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      setSaving(true);
      if (dlg.initial) {
        await partyTenantsApi.patch(dlg.initial.id, dlg.form);
      } else {
        await partyTenantsApi.create(Number(dlg.form.operatorId), dlg.form);
      }
      success(dlg.initial ? 'Tenant updated' : 'Tenant created (provisioning)');
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
    if (!confirm(`Delete tenant "${row.shortName}"?`)) return;
    try {
      await partyTenantsApi.remove(row.id);
      success('Tenant deleted');
      load();
    } catch (e) {
      notifyError(extractError(e).message);
    }
  };

  const setField = (f) => (e) =>
    setDlg(d => ({ ...d, form: { ...d.form, [f]: e.target.value } }));

  const opName = (id) => ops.find(o => o.id === id)?.shortName || `#${id}`;

  const previewDb = () => {
    const op = ops.find(o => o.id === Number(dlg.form.operatorId));
    if (!op || !dlg.form.shortName) return '—';
    return `${op.shortName}_${op.id}_${dlg.form.shortName}_?`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tenants (Party)</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDlg({ open: true, form: EMPTY, initial: null })}
          disabled={ops.length === 0}
        >
          New Tenant
        </Button>
      </Box>

      {ops.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Create an operator first before adding tenants.
        </Alert>
      )}

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
                  <TableCell>Short name</TableCell>
                  <TableCell>Full name</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell>DB</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No tenants yet
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {r.shortName}
                    </TableCell>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>{opName(r.operatorId)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {r.dbName}
                    </TableCell>
                    <TableCell><PartyStatusChip status={r.status} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setDlg({ open: true, form: r, initial: r })}>
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

      <Dialog
        open={dlg.open}
        onClose={() => setDlg({ open: false, form: EMPTY, initial: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 'var(--font-size-md)' }}>
          {dlg.initial ? 'Edit tenant' : 'New tenant'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, px: 4 }}>
          {!dlg.initial && (
            <TextField select label="Operator" size="small" fullWidth required
              value={dlg.form.operatorId} onChange={setField('operatorId')}>
              {ops.map(o => (
                <MenuItem key={o.id} value={o.id}>{o.shortName} — {o.fullName}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Short name" size="small" fullWidth required
            value={dlg.form.shortName} onChange={setField('shortName')}
            disabled={!!dlg.initial}
            helperText="lowercase letters/digits, 2–40"
          />
          <TextField label="Full name" size="small" fullWidth required
            value={dlg.form.fullName} onChange={setField('fullName')} />
          <TextField label="Company" size="small" fullWidth
            value={dlg.form.companyName || ''} onChange={setField('companyName')} />
          <TextField label="Address" size="small" fullWidth
            value={dlg.form.address1 || ''} onChange={setField('address1')} />
          <TextField label="City" size="small" fullWidth
            value={dlg.form.city || ''} onChange={setField('city')} />
          <TextField label="Country (ISO-2)" size="small" fullWidth
            value={dlg.form.country || ''} onChange={setField('country')} />
          <TextField label="Phone" size="small" fullWidth
            value={dlg.form.phone || ''} onChange={setField('phone')} />
          <TextField label="Email" size="small" fullWidth type="email"
            value={dlg.form.email || ''} onChange={setField('email')} />

          <Typography variant="caption" sx={{ mt: 1, fontWeight: 600 }}>Database</Typography>
          <TextField label="DB host" size="small" fullWidth
            value={dlg.form.dbHost} onChange={setField('dbHost')}
            disabled={!!dlg.initial} />
          <TextField label="DB port" size="small" fullWidth type="number"
            value={dlg.form.dbPort} onChange={setField('dbPort')}
            disabled={!!dlg.initial} />
          <TextField label="DB user" size="small" fullWidth
            value={dlg.form.dbUser} onChange={setField('dbUser')}
            disabled={!!dlg.initial} />
          <TextField
            label="DB password ref"
            size="small" fullWidth
            value={dlg.form.dbPassRef} onChange={setField('dbPassRef')}
            disabled={!!dlg.initial}
            helperText="Env var name or vault path — NOT the password itself"
          />
          {!dlg.initial && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Will create database: <code>{previewDb()}</code>
            </Typography>
          )}

          <TextField select label="Status" size="small" fullWidth
            value={dlg.form.status} onChange={setField('status')}>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="SUSPENDED">Suspended</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg({ open: false, form: EMPTY, initial: null })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
