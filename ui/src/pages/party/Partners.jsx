import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, CircularProgress,
  FormControlLabel, Switch,
} from '@mui/material';
import { Add as AddIcon, Edit, Delete, Launch } from '@mui/icons-material';
import { partnersApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartyTenantGate from './PartyTenantGate';

const EMPTY = {
  partnerName: '',
  partnerType: 'DIRECT',
  alternateNameInvoice: '',
  address1: '', city: '', state: '', postalCode: '', country: '',
  telephone: '', email: '',
  customerPrepaid: true,
  defaultCurrency: 1,
  vatRegistrationNo: '',
  status: 'ACTIVE',
};

export default function Partners() {
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
      setRows(await partnersApi.list(tenantId));
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
      if (dlg.initial) await partnersApi.patch(tenantId, dlg.initial.id, dlg.form);
      else await partnersApi.create(tenantId, dlg.form);
      success(dlg.initial ? 'Partner updated' : 'Partner created');
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
    if (!confirm(`Delete partner "${row.partnerName}"?`)) return;
    try {
      await partnersApi.remove(tenantId, row.id);
      success('Partner deleted');
      load();
    } catch (e) {
      notifyError(extractError(e).message);
    }
  };

  const setField = (f) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDlg(d => ({ ...d, form: { ...d.form, [f]: v } }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Partners</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDlg({ open: true, form: EMPTY, initial: null })}
        >
          New Partner
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
                  <TableCell>Partner</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No partners yet
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.partnerName}</TableCell>
                    <TableCell>{r.partnerType}</TableCell>
                    <TableCell>{r.email || '—'}</TableCell>
                    <TableCell>{r.telephone || '—'}</TableCell>
                    <TableCell>{r.country || '—'}</TableCell>
                    <TableCell><PartyStatusChip status={r.status} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => nav(`/${tenant}/party/partners/${r.id}`)}>
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
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 'var(--font-size-md)' }}>
          {dlg.initial ? 'Edit partner' : 'New partner'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, px: 4 }}>
          <TextField label="Partner name" size="small" fullWidth required
            value={dlg.form.partnerName} onChange={setField('partnerName')} />
          <TextField select label="Type" size="small" fullWidth
            value={dlg.form.partnerType} onChange={setField('partnerType')}>
            <MenuItem value="DIRECT">Direct</MenuItem>
            <MenuItem value="RESELLER">Reseller</MenuItem>
            <MenuItem value="SUB_RESELLER">Sub-reseller</MenuItem>
            <MenuItem value="AGENT">Agent</MenuItem>
          </TextField>
          <TextField label="Alternate invoice name" size="small" fullWidth
            value={dlg.form.alternateNameInvoice || ''} onChange={setField('alternateNameInvoice')} />
          <TextField label="Address" size="small" fullWidth
            value={dlg.form.address1 || ''} onChange={setField('address1')} />
          <TextField label="City" size="small" fullWidth
            value={dlg.form.city || ''} onChange={setField('city')} />
          <TextField label="State" size="small" fullWidth
            value={dlg.form.state || ''} onChange={setField('state')} />
          <TextField label="Postal code" size="small" fullWidth
            value={dlg.form.postalCode || ''} onChange={setField('postalCode')} />
          <TextField label="Country" size="small" fullWidth
            value={dlg.form.country || ''} onChange={setField('country')} />
          <TextField label="Telephone" size="small" fullWidth
            value={dlg.form.telephone || ''} onChange={setField('telephone')} />
          <TextField label="Email" size="small" fullWidth type="email"
            value={dlg.form.email || ''} onChange={setField('email')} />
          <FormControlLabel
            control={
              <Switch
                checked={!!dlg.form.customerPrepaid}
                onChange={setField('customerPrepaid')}
              />
            }
            label="Prepaid customer"
            sx={{ '.MuiFormControlLabel-label': { fontSize: 'var(--font-size-sm)' } }}
          />
          <TextField label="Default currency (ISO 4217 numeric)" size="small" fullWidth type="number"
            value={dlg.form.defaultCurrency || 1} onChange={setField('defaultCurrency')} />
          <TextField label="VAT registration" size="small" fullWidth
            value={dlg.form.vatRegistrationNo || ''} onChange={setField('vatRegistrationNo')} />
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
    </Box>
  );
}
