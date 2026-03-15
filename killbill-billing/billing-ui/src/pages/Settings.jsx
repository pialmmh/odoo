import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, CircularProgress, Alert, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, Button, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Grid, FormControlLabel, Checkbox, InputAdornment, Divider,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Refresh as RefreshIcon,
  Close as CloseIcon, Search as SearchIcon,
  Settings as SettingsIcon, AttachFile as AttachIcon,
} from '@mui/icons-material';
import {
  getTaxRates, createTaxRate, updateTaxRate, getOdooTaxes,
  getJournals, getAccounts, getProductTemplates, getProductCategories,
  createDocument, createDocMapping, getDocMappings, deleteDocMapping,
} from '../services/odoo';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

// ─── Tax Rate Modal ───
function TaxRateModal({ open, onClose, rate, categories, products, odooTaxes, onSave }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (rate) {
      setForm({
        tax_type: rate.tax_type || 'vat',
        rate: rate.rate || 0,
        is_deduction: rate.is_deduction || false,
        categ_id: rate.categ_id?.[0] || '',
        product_tmpl_id: rate.product_tmpl_id?.[0] || '',
        effective_date: rate.effective_date || new Date().toISOString().split('T')[0],
        end_date: rate.end_date || '',
        gazette_ref: rate.gazette_ref || '',
        reason: rate.reason || '',
        odoo_tax_id: rate.odoo_tax_id?.[0] || '',
        notes: rate.notes || '',
      });
    } else {
      setForm({
        tax_type: 'vat', rate: 15, is_deduction: false,
        categ_id: '', product_tmpl_id: '',
        effective_date: new Date().toISOString().split('T')[0],
        end_date: '', gazette_ref: '', reason: '', odoo_tax_id: '', notes: '',
      });
    }
    setTab(0);
    setDocs([]);
    if (rate?.id) loadDocs(rate.id);
  }, [rate, open]);

  const loadDocs = async (rateId) => {
    try {
      const mappings = await getDocMappings('product.tax.rate', rateId);
      setDocs(mappings);
    } catch (e) {
      console.error('Failed to load docs', e);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !rate?.id) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const docId = await createDocument({
          name: file.name.replace(/\.[^.]+$/, ''),
          filename: file.name,
          file_upload: base64,
          doc_type: 'sro',
        });
        await createDocMapping({
          document_id: docId,
          res_model: 'product.tax.rate',
          res_id: rate.id,
          link_type: 'sro',
        });
        loadDocs(rate.id);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Upload failed: ' + err.message);
      setUploading(false);
    }
  };

  const handleRemoveDoc = async (mappingId) => {
    try {
      await deleteDocMapping(mappingId);
      if (rate?.id) loadDocs(rate.id);
    } catch (e) {
      alert('Remove failed: ' + e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = {
        tax_type: form.tax_type,
        rate: parseFloat(form.rate),
        is_deduction: form.is_deduction,
        categ_id: form.categ_id || false,
        product_tmpl_id: form.product_tmpl_id || false,
        effective_date: form.effective_date,
        end_date: form.end_date || false,
        gazette_ref: form.gazette_ref,
        reason: form.reason,
        odoo_tax_id: form.odoo_tax_id || false,
        notes: form.notes,
      };
      if (rate?.id) {
        await updateTaxRate(rate.id, vals);
      } else {
        await createTaxRate(vals);
      }
      onSave?.();
      onClose();
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {rate?.id ? 'Edit Tax Rate' : 'New Tax Rate'}
        </Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Tax Details" />
          <Tab label={`Documents (${docs.length})`} />
          <Tab label="Legal / Notes" />
        </Tabs>
      </Box>
      <DialogContent sx={{ px: 3, pt: 2, minHeight: 300 }}>
        {tab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tax Type</InputLabel>
                <Select value={form.tax_type} label="Tax Type"
                  onChange={e => setForm(f => ({ ...f, tax_type: e.target.value }))}>
                  <MenuItem value="vat">VAT</MenuItem>
                  <MenuItem value="ait">AIT (Advanced Income Tax)</MenuItem>
                  <MenuItem value="sd">Supplementary Duty</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth size="small" label="Rate (%)" type="number"
                value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
            </Grid>
            <Grid item xs={3}>
              <FormControlLabel
                control={<Checkbox checked={form.is_deduction}
                  onChange={e => setForm(f => ({ ...f, is_deduction: e.target.checked }))} />}
                label="Deduction" />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Product Category</InputLabel>
                <Select value={form.categ_id} label="Product Category"
                  onChange={e => setForm(f => ({ ...f, categ_id: e.target.value }))}>
                  <MenuItem value="">All (Default)</MenuItem>
                  {categories.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.complete_name || c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Product Override</InputLabel>
                <Select value={form.product_tmpl_id} label="Product Override"
                  onChange={e => setForm(f => ({ ...f, product_tmpl_id: e.target.value }))}>
                  <MenuItem value="">None</MenuItem>
                  {products.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Effective Date" type="date"
                value={form.effective_date}
                onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="End Date" type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Leave blank for open-ended" />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Linked Odoo Tax</InputLabel>
                <Select value={form.odoo_tax_id} label="Linked Odoo Tax"
                  onChange={e => setForm(f => ({ ...f, odoo_tax_id: e.target.value }))}>
                  <MenuItem value="">None</MenuItem>
                  {odooTaxes.map(t => (
                    <MenuItem key={t.id} value={t.id}>{t.name} ({t.amount}%)</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Reason"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </Grid>
          </Grid>
        )}
        {tab === 1 && (
          <Box>
            {rate?.id ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Attached SRO/gazette documents
                  </Typography>
                  <Button variant="outlined" size="small" component="label" startIcon={<AttachIcon />}
                    disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload Document'}
                    <input type="file" hidden onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" />
                  </Button>
                </Box>
                {docs.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Document</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Uploaded</TableCell>
                        <TableCell align="center">Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {docs.map(d => (
                        <TableRow key={d.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {d.document_id?.[1]}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={d.link_type} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">linked</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => handleRemoveDoc(d.id)} color="error">
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No documents attached. Upload SRO/gazette PDFs above.
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Save the tax rate first, then attach documents.
              </Typography>
            )}
          </Box>
        )}
        {tab === 2 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Gazette / SRO Reference"
                placeholder="e.g. SRO-2025/VAT-001"
                value={form.gazette_ref}
                onChange={e => setForm(f => ({ ...f, gazette_ref: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Notes" multiline rows={4}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : rate?.id ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Tax Rates Tab ───
function TaxRatesTab({ taxRates, categories, products, odooTaxes, onRefresh }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [editRate, setEditRate] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const typeColors = {
    vat: { bg: '#e3f2fd', color: '#1565c0', label: 'VAT' },
    ait: { bg: '#fff3e0', color: '#e65100', label: 'AIT' },
    sd: { bg: '#f3e5f5', color: '#7b1fa2', label: 'SD' },
    other: { bg: '#f5f5f5', color: '#616161', label: 'Other' },
  };

  const filtered = taxRates.filter(r => {
    const matchSearch = !search ||
      (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.gazette_ref || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || r.tax_type === typeFilter;
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && r.is_active) ||
      (statusFilter === 'expired' && !r.is_active);
    return matchSearch && matchType && matchStatus;
  });

  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField size="small" placeholder="Search..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ width: 240 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} label="Type" onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="vat">VAT</MenuItem>
              <MenuItem value="ait">AIT</MenuItem>
              <MenuItem value="sd">SD</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => { setEditRate(null); setShowModal(true); }}>
          New Tax Rate
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#fafafa' }}>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Rate</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Applies To</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Effective</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>End</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Gazette/SRO</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Docs</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map(rate => {
                const tc = typeColors[rate.tax_type] || typeColors.other;
                return (
                  <TableRow key={rate.id} hover>
                    <TableCell>
                      <Chip label={tc.label} size="small" sx={{ bgcolor: tc.bg, color: tc.color, fontWeight: 600, fontSize: 11 }} />
                      {rate.is_deduction && <Chip label="TDS" size="small" variant="outlined" sx={{ ml: 0.5, fontSize: 10 }} />}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {rate.is_deduction ? '-' : ''}{rate.rate}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {rate.product_tmpl_id?.[1] || rate.categ_id?.[1] || 'Default (all)'}
                      </Typography>
                      {rate.product_tmpl_id && (
                        <Typography variant="caption" color="text.secondary">Product override</Typography>
                      )}
                    </TableCell>
                    <TableCell><Typography variant="body2">{rate.effective_date}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" color={rate.end_date ? 'text.secondary' : 'success.main'}>
                        {rate.end_date || 'Open'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={rate.is_active ? 'Active' : 'Expired'} size="small"
                        sx={{ bgcolor: rate.is_active ? '#e8f5e9' : '#f5f5f5', color: rate.is_active ? '#2e7d32' : '#9e9e9e', fontSize: 11 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {rate.gazette_ref || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {rate.document_count > 0 ? (
                        <Chip icon={<AttachIcon sx={{ fontSize: 14 }} />}
                          label={rate.document_count}
                          size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 160 }} noWrap component="div">
                        {rate.reason || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditRate(rate); setShowModal(true); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No tax rates found</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={filtered.length} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 15, 25, 50]} />
      </Card>

      <TaxRateModal open={showModal} onClose={() => { setShowModal(false); setEditRate(null); }}
        rate={editRate} categories={categories} products={products}
        odooTaxes={odooTaxes} onSave={onRefresh} />
    </Box>
  );
}

// ─── Journals Tab ───
function JournalsTab({ journals }) {
  const typeColors = {
    sale: { label: 'Sales', color: '#1565c0' },
    purchase: { label: 'Purchase', color: '#e65100' },
    bank: { label: 'Bank', color: '#2e7d32' },
    cash: { label: 'Cash', color: '#7b1fa2' },
    general: { label: 'General', color: '#616161' },
  };
  return (
    <Card>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Journal Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {journals.map(j => {
              const tc = typeColors[j.type] || typeColors.general;
              return (
                <TableRow key={j.id} hover>
                  <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{j.code}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{j.name}</Typography></TableCell>
                  <TableCell><Chip label={tc.label} size="small" sx={{ color: tc.color, fontWeight: 500, fontSize: 11 }} variant="outlined" /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

// ─── Revenue Accounts Tab ───
function AccountsTab({ accounts }) {
  const [search, setSearch] = useState('');
  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)
  );
  return (
    <Box>
      <TextField size="small" placeholder="Search accounts..." value={search}
        onChange={e => setSearch(e.target.value)} sx={{ mb: 2, width: 280 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#fafafa' }}>
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Account Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.code}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{a.name}</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{a.account_type}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

// ─── Odoo Taxes Tab ───
function OdooTaxesTab({ odooTaxes }) {
  return (
    <Card>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              <TableCell sx={{ fontWeight: 600 }}>Tax Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Rate</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {odooTaxes.map(t => (
              <TableRow key={t.id} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{t.name}</Typography></TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: t.amount < 0 ? 'error.main' : 'primary.main' }}>
                    {t.amount}%
                  </Typography>
                </TableCell>
                <TableCell><Typography variant="caption">{t.amount_type}</Typography></TableCell>
                <TableCell><Typography variant="caption" color="text.secondary">{t.description || '-'}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

// ─── Main Settings Page ───
export default function Settings() {
  const [mainTab, setMainTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taxRates, setTaxRates] = useState([]);
  const [odooTaxes, setOdooTaxes] = useState([]);
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, ot, jn, ac, cat, prod] = await Promise.all([
        getTaxRates(),
        getOdooTaxes(),
        getJournals(),
        getAccounts([['account_type', 'in', ['income', 'income_other']]]),
        getProductCategories(),
        getProductTemplates([['sale_ok', '=', true]]),
      ]);
      setTaxRates(tr);
      setOdooTaxes(ot);
      setJournals(jn);
      setAccounts(ac);
      setCategories(cat);
      setProducts(prod);
      setError(null);
    } catch (e) {
      setError('Failed to load settings: ' + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="primary" />
          <Box>
            <Typography variant="h6">Settings</Typography>
            <Typography variant="body2" color="text.secondary">
              Tax rates, journals, revenue accounts
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh all">
          <IconButton onClick={loadData} size="small"><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 2 }}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Tax Rates (${taxRates.length})`} />
          <Tab label={`Odoo Taxes (${odooTaxes.length})`} />
          <Tab label={`Journals (${journals.length})`} />
          <Tab label={`Revenue Accounts (${accounts.length})`} />
        </Tabs>
      </Card>

      <TabPanel value={mainTab} index={0}>
        <TaxRatesTab taxRates={taxRates} categories={categories} products={products}
          odooTaxes={odooTaxes} onRefresh={loadData} />
      </TabPanel>
      <TabPanel value={mainTab} index={1}>
        <OdooTaxesTab odooTaxes={odooTaxes} />
      </TabPanel>
      <TabPanel value={mainTab} index={2}>
        <JournalsTab journals={journals} />
      </TabPanel>
      <TabPanel value={mainTab} index={3}>
        <AccountsTab accounts={accounts} />
      </TabPanel>
    </Box>
  );
}
