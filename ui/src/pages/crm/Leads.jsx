import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Select,
  MenuItem, FormControl, InputLabel, FormControlLabel, Switch, Grid,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon, Close as CloseIcon,
} from '@mui/icons-material';
import {
  listLeads, createLead, updateLead, deleteLead,
  LEAD_STATUSES, LEAD_SOURCES, LEAD_SALUTATIONS,
} from '../../services/crm';
import { useRBAC } from '../../hooks/useRBAC';

// ── Status chip colors ──
const STATUS_COLORS = {
  'New':        { bg: '#e3f2fd', color: '#1565c0' },
  'Assigned':   { bg: '#fff3e0', color: '#e65100' },
  'In Process': { bg: '#e8f5e9', color: '#2e7d32' },
  'Converted':  { bg: '#f1f8e9', color: '#558b2f' },
  'Recycled':   { bg: '#f5f5f5', color: '#616161' },
  'Dead':       { bg: '#fafafa', color: '#9e9e9e' },
};

const EMPTY_FORM = {
  salutationName: '',
  firstName: '',
  lastName: '',
  title: '',
  accountName: '',
  emailAddress: '',
  phoneNumber: '',
  status: 'New',
  source: '',
  industry: '',
  opportunityAmount: '',
  doNotCall: false,
  website: '',
  description: '',
};

// ── Create / Edit Dialog ──
function LeadDialog({ open, onClose, lead, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const isEdit = !!lead?.id;

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        salutationName: lead.salutationName || '',
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        title: lead.title || '',
        accountName: lead.accountName || '',
        emailAddress: lead.emailAddress || '',
        phoneNumber: lead.phoneNumber || '',
        status: lead.status || 'New',
        source: lead.source || '',
        industry: lead.industry || '',
        opportunityAmount: lead.opportunityAmount ?? '',
        doNotCall: !!lead.doNotCall,
        website: lead.website || '',
        description: lead.description || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErr(null);
  }, [open, lead]);

  const handleSave = async () => {
    if (!form.lastName.trim()) {
      setErr('Last name is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        opportunityAmount: form.opportunityAmount === '' ? null : Number(form.opportunityAmount),
      };
      if (isEdit) await updateLead(lead.id, payload);
      else        await createLead(payload);
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isEdit ? 'Edit Lead' : 'New Lead'}
        </Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 4, pt: 2 }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Title</InputLabel>
              <Select
                value={form.salutationName}
                label="Title"
                onChange={e => setForm(f => ({ ...f, salutationName: e.target.value }))}
              >
                {LEAD_SALUTATIONS.map(s => <MenuItem key={s || 'none'} value={s}>{s || '—'}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={5}>
            <TextField fullWidth size="small" label="First Name"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </Grid>
          <Grid item xs={5}>
            <TextField fullWidth size="small" label="Last Name" required
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Job Title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Account / Company"
              value={form.accountName}
              onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} />
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Email" type="email"
              value={form.emailAddress}
              onChange={e => setForm(f => ({ ...f, emailAddress: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Phone"
              value={form.phoneNumber}
              onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
          </Grid>

          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status"
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {LEAD_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Source</InputLabel>
              <Select value={form.source} label="Source"
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {LEAD_SOURCES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <TextField fullWidth size="small" label="Industry"
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Opportunity Amount" type="number"
              value={form.opportunityAmount}
              onChange={e => setForm(f => ({ ...f, opportunityAmount: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Website"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </Grid>

          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Description" multiline rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch checked={form.doNotCall}
                  onChange={e => setForm(f => ({ ...f, doNotCall: e.target.checked }))} />
              }
              label="Do Not Call"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save' : 'Create Lead')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Leads Page ──
export default function Leads() {
  const { canAction } = useRBAC();
  const canEdit = canAction('crm.edit');

  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        maxSize: rowsPerPage,
        offset: page * rowsPerPage,
        orderBy: 'createdAt',
        order: 'desc',
      };
      if (statusFilter !== 'all') {
        params['where[0][type]']      = 'equals';
        params['where[0][attribute]'] = 'status';
        params['where[0][value]']     = statusFilter;
      }
      if (search.trim()) {
        const idx = statusFilter !== 'all' ? 1 : 0;
        params[`where[${idx}][type]`]      = 'textFilter';
        params[`where[${idx}][value]`]     = search.trim();
      }
      const res = await listLeads(params);
      setLeads(res.list || []);
      setTotal(res.total ?? (res.list?.length || 0));
      setError(null);
    } catch (e) {
      setError('Failed to load leads: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rowsPerPage, statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (lead, e) => {
    e.stopPropagation();
    const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    if (!confirm(`Delete lead "${name}"? This cannot be undone.`)) return;
    try {
      await deleteLead(lead.id);
      loadData();
    } catch (err) {
      alert('Delete failed: ' + (err?.response?.data?.message || err.message));
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (lead) => { setEditing(lead); setDialogOpen(true); };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Leads</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'lead' : 'leads'} total
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEdit && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNew}>
              New Lead
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search leads…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status"
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {LEAD_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assigned</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leads.map(lead => {
                    const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—';
                    const sc = STATUS_COLORS[lead.status] || { bg: '#f5f5f5', color: '#616161' };
                    return (
                      <TableRow key={lead.id} hover sx={{ cursor: canEdit ? 'pointer' : 'default' }}
                        onClick={() => canEdit && openEdit(lead)}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{name}</Typography>
                          {lead.title && (
                            <Typography variant="caption" color="text.secondary">{lead.title}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{lead.accountName || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: 12 }}>{lead.emailAddress || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: 12 }}>{lead.phoneNumber || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={lead.status || 'New'} size="small"
                            sx={{ bgcolor: sc.bg, color: sc.color, fontSize: 11, fontWeight: 500 }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">{lead.source || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{lead.assignedUserName || '—'}</Typography>
                        </TableCell>
                        <TableCell align="center" onClick={e => e.stopPropagation()}>
                          {canEdit && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => openEdit(lead)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={e => handleDelete(lead, e)}
                                  sx={{ color: 'error.main' }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No leads found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </Card>

      <LeadDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        lead={editing}
        onSaved={loadData}
      />
    </Box>
  );
}
