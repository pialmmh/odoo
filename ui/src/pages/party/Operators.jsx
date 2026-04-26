import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit, Delete, Launch } from '@mui/icons-material';
import { operatorsApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartySuperGuard from './PartySuperGuard';

const EMPTY = {
  shortName: '', fullName: '', operatorType: 'ISP',
  companyName: '', address1: '', city: '', country: '',
  phone: '', email: '', status: 'ACTIVE',
};

export default function Operators() {
  return (
    <PartySuperGuard>
      <OperatorsInner />
    </PartySuperGuard>
  );
}

function OperatorsInner() {
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
      setRows(await operatorsApi.list());
    } catch (e) {
      notifyError(extractError(e, 'Failed to load operators').message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      setSaving(true);
      if (dlg.initial) await operatorsApi.patch(dlg.initial.id, dlg.form);
      else await operatorsApi.create(dlg.form);
      success(dlg.initial ? 'Operator updated' : 'Operator created');
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
    if (!confirm(`Delete operator "${row.shortName}"?`)) return;
    try {
      await operatorsApi.remove(row.id);
      success('Operator deleted');
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
        <Typography variant="h6">Operators</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDlg({ open: true, form: EMPTY, initial: null })}
        >
          New Operator
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
                  <TableCell>Short name</TableCell>
                  <TableCell>Full name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No operators yet
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {r.shortName}
                    </TableCell>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell>{r.operatorType}</TableCell>
                    <TableCell>{r.country || '—'}</TableCell>
                    <TableCell><PartyStatusChip status={r.status} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => nav(`/${tenant}/party/admin/operators/${r.id}`)}>
                        <Launch fontSize="small" />
                      </IconButton>
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
          {dlg.initial ? 'Edit operator' : 'New operator'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, px: 4 }}>
          <TextField
            label="Short name" size="small" fullWidth
            value={dlg.form.shortName} onChange={setField('shortName')}
            disabled={!!dlg.initial}
            helperText="lowercase letters/digits, 2–40"
          />
          <TextField label="Full name" size="small" fullWidth required
            value={dlg.form.fullName} onChange={setField('fullName')} />
          <TextField select label="Type" size="small" fullWidth
            value={dlg.form.operatorType} onChange={setField('operatorType')}>
            {['MNO', 'MVNO', 'ISP', 'ITSP', 'ENTERPRISE', 'OTHER'].map(t =>
              <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField label="Company name" size="small" fullWidth
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
