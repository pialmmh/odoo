import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit, Delete, LockReset } from '@mui/icons-material';
import { operatorsApi, operatorUsersApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartySuperGuard from './PartySuperGuard';

const EMPTY = {
  email: '', password: '', passwordConfirm: '',
  firstName: '', lastName: '', phone: '',
  role: 'OPERATOR_ADMIN', operatorId: '', status: 'ACTIVE',
};

export default function OperatorUsers() {
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
  const [pwDlg, setPwDlg] = useState({ open: false, user: null, pw: '', pw2: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [u, o] = await Promise.all([operatorUsersApi.list(), operatorsApi.list()]);
      setRows(u);
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
      if (!dlg.initial && dlg.form.password !== dlg.form.passwordConfirm) {
        notifyError('Passwords do not match');
        return;
      }
      setSaving(true);
      if (dlg.initial) {
        await operatorUsersApi.patch(dlg.initial.id, {
          firstName: dlg.form.firstName || undefined,
          lastName: dlg.form.lastName || undefined,
          phone: dlg.form.phone || undefined,
          role: dlg.form.role,
          operatorId: dlg.form.role === 'OPERATOR_ADMIN' ? Number(dlg.form.operatorId) : null,
          status: dlg.form.status,
        });
      } else {
        await operatorUsersApi.create({
          email: dlg.form.email,
          password: dlg.form.password,
          firstName: dlg.form.firstName || undefined,
          lastName: dlg.form.lastName || undefined,
          phone: dlg.form.phone || undefined,
          role: dlg.form.role,
          operatorId: dlg.form.role === 'OPERATOR_ADMIN' ? Number(dlg.form.operatorId) : null,
          status: dlg.form.status,
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

  const resetPw = async () => {
    if (pwDlg.pw !== pwDlg.pw2) { notifyError('Passwords do not match'); return; }
    if (pwDlg.pw.length < 10) { notifyError('Password must be at least 10 characters'); return; }
    try {
      await operatorUsersApi.resetPassword(pwDlg.user.id, pwDlg.pw);
      success('Password reset');
      setPwDlg({ open: false, user: null, pw: '', pw2: '' });
    } catch (e) {
      notifyError(extractError(e).message);
    }
  };

  const del = async (row) => {
    if (!confirm(`Delete user "${row.email}"?`)) return;
    try {
      await operatorUsersApi.remove(row.id);
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
        <Typography variant="h6">Operator users</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDlg({ open: true, form: EMPTY, initial: null })}
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
                  <TableCell>Role</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No users yet
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      {`${r.firstName || ''} ${r.lastName || ''}`.trim() || '—'}
                    </TableCell>
                    <TableCell>{r.role}</TableCell>
                    <TableCell>{r.operatorId ? `#${r.operatorId}` : '—'}</TableCell>
                    <TableCell><PartyStatusChip status={r.status} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setPwDlg({ open: true, user: r, pw: '', pw2: '' })}>
                        <LockReset fontSize="small" />
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
          {dlg.initial ? 'Edit user' : 'New operator user'}
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
            </>
          )}
          <TextField label="First name" size="small" fullWidth
            value={dlg.form.firstName || ''} onChange={setField('firstName')} />
          <TextField label="Last name" size="small" fullWidth
            value={dlg.form.lastName || ''} onChange={setField('lastName')} />
          <TextField label="Phone" size="small" fullWidth
            value={dlg.form.phone || ''} onChange={setField('phone')} />
          <TextField select label="Role" size="small" fullWidth
            value={dlg.form.role} onChange={setField('role')}>
            <MenuItem value="SYS_ADMIN">System admin</MenuItem>
            <MenuItem value="OPERATOR_ADMIN">Operator admin</MenuItem>
          </TextField>
          {dlg.form.role === 'OPERATOR_ADMIN' && (
            <TextField select label="Operator" size="small" fullWidth
              value={dlg.form.operatorId || ''} onChange={setField('operatorId')}>
              {ops.map(o => (
                <MenuItem key={o.id} value={o.id}>{o.shortName} — {o.fullName}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField select label="Status" size="small" fullWidth
            value={dlg.form.status} onChange={setField('status')}>
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

      <Dialog
        open={pwDlg.open}
        onClose={() => setPwDlg({ open: false, user: null, pw: '', pw2: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 'var(--font-size-md)' }}>
          Reset password — {pwDlg.user?.email}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, px: 4 }}>
          <TextField label="New password" type="password" size="small" fullWidth
            value={pwDlg.pw} onChange={e => setPwDlg(d => ({ ...d, pw: e.target.value }))} />
          <TextField label="Confirm" type="password" size="small" fullWidth
            value={pwDlg.pw2} onChange={e => setPwDlg(d => ({ ...d, pw2: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwDlg({ open: false, user: null, pw: '', pw2: '' })}>Cancel</Button>
          <Button variant="contained" onClick={resetPw}>Reset</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
