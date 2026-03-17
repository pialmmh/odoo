import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CircularProgress, Alert, TextField,
  InputAdornment, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Select,
  MenuItem, FormControl, InputLabel, Button, Chip, Grid,
  FormControlLabel, Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Refresh as RefreshIcon, Close as CloseIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  getRateHistory, getProductTemplates, createRateEntry, updateRateEntry,
} from '../services/odoo';

const TIERS = [
  { value: 'standard', label: 'Standard', color: '#1565c0', bg: '#e3f2fd' },
  { value: 'enterprise', label: 'Enterprise', color: '#e65100', bg: '#fff3e0' },
  { value: 'government', label: 'Government', color: '#2e7d32', bg: '#e8f5e9' },
  { value: 'wholesale', label: 'Wholesale', color: '#7b1fa2', bg: '#f3e5f5' },
  { value: 'custom', label: 'Custom', color: '#616161', bg: '#f5f5f5' },
];

function getTierStyle(tier) {
  return TIERS.find(t => t.value === tier) || TIERS[4];
}

// ── Add/Edit Rate Modal ──
function RateModal({ open, onClose, rate, products, onSave }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rate) {
      setForm({
        product_tmpl_id: rate.product_tmpl_id?.[0] || '',
        price: rate.price || 0,
        pricelist_tier: rate.pricelist_tier || 'standard',
        effective_date: rate.effective_date || new Date().toISOString().split('T')[0],
        end_date: rate.end_date || '',
        reason: rate.reason || '',
        tax_included: rate.tax_included || false,
        notes: rate.notes || '',
      });
    } else {
      setForm({
        product_tmpl_id: '',
        price: 0,
        pricelist_tier: 'standard',
        effective_date: new Date().toISOString().split('T')[0],
        end_date: '',
        reason: '',
        tax_included: false,
        notes: '',
      });
    }
    setTab(0);
  }, [rate, open]);

  const handleSave = async () => {
    if (!form.product_tmpl_id || !form.price) {
      alert('Product and price are required');
      return;
    }
    setSaving(true);
    try {
      const vals = {
        product_tmpl_id: form.product_tmpl_id,
        price: parseFloat(form.price),
        pricelist_tier: form.pricelist_tier,
        effective_date: form.effective_date,
        end_date: form.end_date || false,
        reason: form.reason,
        tax_included: form.tax_included,
        notes: form.notes,
      };
      if (rate?.id) {
        await updateRateEntry(rate.id, vals);
      } else {
        await createRateEntry(vals);
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
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {rate?.id ? 'Edit Rate' : 'New Rate Entry'}
        </Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Rate Details" />
          <Tab label="Notes" />
        </Tabs>
      </Box>

      <DialogContent sx={{ px: 3, pt: 2, minHeight: 280 }}>
        {tab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Product</InputLabel>
                <Select value={form.product_tmpl_id} label="Product"
                  onChange={e => setForm(f => ({ ...f, product_tmpl_id: e.target.value }))}>
                  {products.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Price (BDT)" type="number"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tier</InputLabel>
                <Select value={form.pricelist_tier} label="Tier"
                  onChange={e => setForm(f => ({ ...f, pricelist_tier: e.target.value }))}>
                  {TIERS.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
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
              <TextField fullWidth size="small" label="End Date (blank = open)" type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={8}>
              <TextField fullWidth size="small" label="Reason"
                placeholder="e.g. Annual rate revision"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <FormControlLabel
                control={<Checkbox checked={form.tax_included}
                  onChange={e => setForm(f => ({ ...f, tax_included: e.target.checked }))} />}
                label="Tax incl." />
            </Grid>
          </Grid>
        )}
        {tab === 1 && (
          <TextField fullWidth multiline rows={5} label="Notes"
            placeholder="Additional notes about this rate change..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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

// ── Main Rate History Page ──
export default function RateHistory() {
  const [rates, setRates] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [editRate, setEditRate] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rateData, prodData] = await Promise.all([
        getRateHistory([], 500),
        getProductTemplates([['sale_ok', '=', true]]),
      ]);
      setRates(rateData);
      setProducts(prodData);
      setError(null);
    } catch (e) {
      setError('Failed to load rate history: ' + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = rates.filter(r => {
    const matchSearch = !search ||
      (r.variant_display || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.product_tmpl_id?.[1] || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.reason || '').toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || r.pricelist_tier === tierFilter;
    const matchActive = activeFilter === 'all' ||
      (activeFilter === 'active' && r.is_active) ||
      (activeFilter === 'expired' && !r.is_active);
    return matchSearch && matchTier && matchActive;
  });

  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          <Box>
            <Typography variant="h6">Rate History</Typography>
            <Typography variant="body2" color="text.secondary">
              {rates.length} entries &middot; price changes preserved forever
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => { setEditRate(null); setShowModal(true); }}>
            New Rate
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search product, variant, reason..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Tier</InputLabel>
          <Select value={tierFilter} label="Tier" onChange={e => { setTierFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Tiers</MenuItem>
            {TIERS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={activeFilter} label="Status" onChange={e => { setActiveFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
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
                    <TableCell sx={{ fontWeight: 600 }}>Product / Variant</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tier</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Effective</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>End</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.map(rate => {
                    const ts = getTierStyle(rate.pricelist_tier);
                    return (
                      <TableRow key={rate.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {rate.product_tmpl_id?.[1]}
                          </Typography>
                          {rate.variant_display && rate.variant_display !== rate.product_tmpl_id?.[1] && (
                            <Typography variant="caption" color="text.secondary" component="div">
                              {rate.variant_display}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={ts.label} size="small"
                            sx={{ bgcolor: ts.bg, color: ts.color, fontWeight: 500, fontSize: 11 }} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            ৳{rate.price?.toLocaleString()}
                          </Typography>
                          {rate.tax_included && (
                            <Typography variant="caption" color="text.secondary">incl. tax</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{rate.effective_date}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color={rate.end_date ? 'text.secondary' : 'success.main'}>
                            {rate.end_date || 'Open'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={rate.is_active ? 'Active' : 'Expired'}
                            size="small"
                            sx={{
                              bgcolor: rate.is_active ? '#e8f5e9' : '#f5f5f5',
                              color: rate.is_active ? '#2e7d32' : '#9e9e9e',
                              fontWeight: 500, fontSize: 11,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200 }} noWrap component="div">
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
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No rate entries found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[15, 25, 50, 100]}
            />
          </>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <RateModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditRate(null); }}
        rate={editRate}
        products={products}
        onSave={loadData}
      />
    </Box>
  );
}
