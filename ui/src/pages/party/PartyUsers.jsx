import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit, Delete, Launch } from '@mui/icons-material';
import { partnersApi, partyUsersApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartyTenantGate from './PartyTenantGate';

const EMPTY = {
  email: '', password: '', passwordConfirm: '',
  firstName: '', lastName: '', phone: '',
  userStatus: 'ACTIVE',
  partnerId: '',
  resellerDbName: '',
  pbxUuid: '',
};

export default function PartyUsers() {
  return <PartyTenantGate render={tenantId => <Inner tenantId={tenantId} />} />;
}

function Inner({ tenantId }) {
  const nav = useNavigate();
  const { tenant } = useParams();
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState({ open: false, form: EMPTY, initial: null });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [u, p] = await Promise.all([
        partyUsersApi.list(tenantId),
        partnersApi.list(tenantId),
      ]);
      setRows(u);
      setPartners(p);
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const save = async () => {
    try {
      if (!dlg.initial && dlg.form.password !== dlg.form.passwordConfirm) {
        notifyError('Passwords do not match');
        return;
      }
      setSaving(true);
      if (dlg.initial) {
        await partyUsersApi.patch(tenantId, dlg.initial.id, {
          firstName: dlg.form.firstName || undefined,
          lastName: dlg.form.lastName || undefined,
          phone: dlg.form.phone || undefined,
          userStatus: dlg.form.userStatus,
          resellerDbName: dlg.form.resellerDbName || undefined,
          pbxUuid: dlg.form.pbxUuid || undefined,
        });
      } else {
        await partyUsersApi.create(tenantId, Number(dlg.form.partnerId), {
          email: dlg.form.email,
          password: dlg.form.password,
          firstName: dlg.form.firstName || undefined,
          lastName: dlg.form.lastName || undefined,
          phone: dlg.form.phone || undefined,
          userStatus: dlg.form.userStatus,
          resellerDbName: dlg.form.resellerDbName || undefined,
          pbxUuid: dlg.form.pbxUuid || undefined,
        });
      }
      success(dlg.initial ? 'User updated' : 'User created');
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
    if (!confirm(`Delete user "${row.email}"?`)) return;
    try {
      await partyUsersApi.remove(tenantId, row.id);
      success('User deleted');
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
        <Typography variant="h6">Users (Party)</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDlg({ open: true, form: EMPTY, initial: null })}
          disabled={partners.length === 0}
        >
          New User
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
                  <TableCell>Email</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Partner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No users yet
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{`${r.firstName || ''} ${r.lastName || ''}`.trim() || '—'}</TableCell>
                    <TableCell>#{r.partnerId}</TableCell>
                    <TableCell><PartyStatusChip status={r.userStatus} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => nav(`/${tenant}/party/users/${r.id}`)}>
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

      <Dialog
        open={dlg.open}
        onClose={() => setDlg({ open: false, form: EMPTY, initial: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 'var(--font-size-md)' }}>
          {dlg.initial ? 'Edit user' : 'New user'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, px: 4 }}>
          <TextField label="Email" size="small" fullWidth type="email" required
            value={dlg.form.email} onChange={setField('email')}
            disabled={!!dlg.initial} />
          {!dlg.initial && (
            <>
              <TextField label="Password" size="small" fullWidth type="password" required
                value={dlg.form.password} onChange={setField('password')}
                helperText="Min 10 chars, 1 uppercase, 1 digit, 1 special" />
              <TextField label="Confirm password" size="small" fullWidth type="password" required
                value={dlg.form.passwordConfirm} onChange={setField('passwordConfirm')} />
              <TextField select label="Partner" size="small" fullWidth required
                value={dlg.form.partnerId} onChange={setField('partnerId')}>
                {partners.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.partnerName}</MenuItem>
                ))}
              </TextField>
            </>
          )}
          <TextField label="First name" size="small" fullWidth
            value={dlg.form.firstName || ''} onChange={setField('firstName')} />
          <TextField label="Last name" size="small" fullWidth
            value={dlg.form.lastName || ''} onChange={setField('lastName')} />
          <TextField label="Phone" size="small" fullWidth
            value={dlg.form.phone || ''} onChange={setField('phone')} />
          <TextField label="Reseller DB name" size="small" fullWidth
            value={dlg.form.resellerDbName || ''} onChange={setField('resellerDbName')}
            helperText="Only for reseller-mode tenants" />
          <TextField label="PBX UUID" size="small" fullWidth
            value={dlg.form.pbxUuid || ''} onChange={setField('pbxUuid')} />
          <TextField select label="Status" size="small" fullWidth
            value={dlg.form.userStatus} onChange={setField('userStatus')}>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="SUSPENDED">Suspended</MenuItem>
          </TextField>
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
