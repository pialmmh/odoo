import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Select,
  MenuItem, FormControl, InputLabel, Switch, FormControlLabel, Grid,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon, Close as CloseIcon,
} from '@mui/icons-material';
import {
  getProductTemplates, getProductCategories, getProductVariantsByTemplate,
  getAttributeValues, updateProductTemplate, updateProductVariant,
} from '../services/odoo';

// ── Tab Panel ──
function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

// ── Product Edit/View Modal ──
function ProductModal({ open, onClose, product, categories, onSave }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        list_price: product.list_price || 0,
        categ_id: product.categ_id?.[0] || '',
        description_sale: product.description_sale || '',
        x_kb_product_name: product.x_kb_product_name || '',
        x_kb_category: product.x_kb_category || '',
      });
      setTab(0);
      loadVariants(product.id);
    }
  }, [product]);

  const loadVariants = async (tmplId) => {
    setLoadingVariants(true);
    try {
      const vars = await getProductVariantsByTemplate(tmplId);
      const allAttrIds = vars.flatMap(v => v.product_template_attribute_value_ids || []);
      const uniqueIds = [...new Set(allAttrIds)];
      const attrVals = uniqueIds.length > 0 ? await getAttributeValues(uniqueIds) : [];
      const attrMap = Object.fromEntries(attrVals.map(v => [v.id, v]));
      setVariants(vars.map(v => ({
        ...v,
        attributes: (v.product_template_attribute_value_ids || []).map(id => attrMap[id]).filter(Boolean),
      })));
    } catch (e) {
      console.error('Failed to load variants', e);
    }
    setLoadingVariants(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProductTemplate(product.id, {
        x_kb_product_name: form.x_kb_product_name,
        x_kb_category: form.x_kb_category,
        description_sale: form.description_sale,
      });
      onSave?.();
      onClose();
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  const handleVariantKbSave = async (variantId, field, value) => {
    try {
      await updateProductVariant(variantId, { [field]: value });
      loadVariants(product.id);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{product.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {product.categ_id?.[1]} &middot; ID: {product.id}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="General" />
          <Tab label={`Variants (${variants.length})`} />
          <Tab label="Billing" />
        </Tabs>
      </Box>

      <DialogContent sx={{ px: 3, pt: 0, minHeight: 350 }}>
        <TabPanel value={tab} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField fullWidth size="small" label="Product Name" value={form.name} disabled
                sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth size="small" label="Base Price (BDT)" type="number"
                value={form.list_price} disabled sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small" disabled>
                <InputLabel>Category</InputLabel>
                <Select value={form.categ_id} label="Category">
                  {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.complete_name || c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Variants" value={product.product_variant_count} disabled />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Sales Description" multiline rows={2}
                value={form.description_sale}
                onChange={e => setForm(f => ({ ...f, description_sale: e.target.value }))} />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          {loadingVariants ? <CircularProgress size={24} /> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Variant</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Attributes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>KB Plan</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Billing</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {variants.map(v => (
                    <TableRow key={v.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 200 }} noWrap>
                          {v.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {v.attributes.map(a => (
                            <Chip key={a.id} label={a.name} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>
                          ৳{v.lst_price?.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {v.x_kb_plan_name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{v.x_kb_billing_period || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            Billing catalog mapping for this product
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField fullWidth size="small" label="Billing Product Name"
                placeholder="e.g. Internet-100Mbps"
                value={form.x_kb_product_name}
                onChange={e => setForm(f => ({ ...f, x_kb_product_name: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Billing Category</InputLabel>
                <Select value={form.x_kb_category || ''} label="Billing Category"
                  onChange={e => setForm(f => ({ ...f, x_kb_category: e.target.value }))}>
                  <MenuItem value="">Not Set</MenuItem>
                  <MenuItem value="BASE">BASE</MenuItem>
                  <MenuItem value="ADD_ON">ADD_ON</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {variants.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Variant → KB Plan Mapping
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Variant</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>KB Plan Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Billing Period</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Trial</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {variants.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 180 }} noWrap>{v.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <TextField size="small" variant="standard"
                            placeholder="e.g. internet-100mbps-monthly"
                            defaultValue={v.x_kb_plan_name || ''}
                            onBlur={e => {
                              if (e.target.value !== (v.x_kb_plan_name || ''))
                                handleVariantKbSave(v.id, 'x_kb_plan_name', e.target.value);
                            }}
                            sx={{ '& input': { fontFamily: 'monospace', fontSize: 12 } }} />
                        </TableCell>
                        <TableCell>
                          <Select size="small" variant="standard"
                            value={v.x_kb_billing_period || ''}
                            onChange={e => handleVariantKbSave(v.id, 'x_kb_billing_period', e.target.value)}>
                            <MenuItem value="">-</MenuItem>
                            <MenuItem value="MONTHLY">MONTHLY</MenuItem>
                            <MenuItem value="QUARTERLY">QUARTERLY</MenuItem>
                            <MenuItem value="ANNUAL">ANNUAL</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch size="small" checked={!!v.x_kb_has_trial}
                            onChange={e => handleVariantKbSave(v.id, 'x_kb_has_trial', e.target.checked)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Products Page ──
export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [editProduct, setEditProduct] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        getProductTemplates([['sale_ok', '=', true]]),
        getProductCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setError(null);
    } catch (e) {
      setError('Failed to load products: ' + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || p.categ_id?.[1] === catFilter;
    return matchSearch && matchCat;
  });

  const usedCats = [...new Set(products.map(p => p.categ_id?.[1]).filter(Boolean))];
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const categoryColors = {
    'Bandwidth Plans': { bg: '#e3f2fd', color: '#1565c0' },
    'Dedicated Internet': { bg: '#e8f5e9', color: '#2e7d32' },
    'SMS Services': { bg: '#fff3e0', color: '#e65100' },
    'Voice Services': { bg: '#f3e5f5', color: '#7b1fa2' },
    'Value Added Services': { bg: '#fce4ec', color: '#c62828' },
    'Internet Services': { bg: '#e3f2fd', color: '#1565c0' },
  };
  const getCc = (n) => categoryColors[n] || { bg: '#f5f5f5', color: '#616161' };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Products</Typography>
          <Typography variant="body2" color="text.secondary">
            {products.length} services &middot; Odoo catalog
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search products..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Category</InputLabel>
          <Select value={catFilter} label="Category" onChange={e => { setCatFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Categories</MenuItem>
            {usedCats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
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
                    <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Base Price</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Variants</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>KB Product</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.map(product => {
                    const catName = product.categ_id?.[1] || '-';
                    const cc = getCc(catName);
                    return (
                      <TableRow key={product.id} hover sx={{ cursor: 'pointer' }}
                        onClick={() => setEditProduct(product)}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{product.name}</Typography>
                          {product.description_sale && (
                            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 250 }} noWrap component="div">
                              {product.description_sale}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={catName} size="small" sx={{ bgcolor: cc.bg, color: cc.color, fontSize: 11, fontWeight: 500 }} />
                        </TableCell>
                        <TableCell align="right">
                          {product.list_price > 0 ? (
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              ৳{product.list_price.toLocaleString()}
                            </Typography>
                          ) : '-'}
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={product.product_variant_count} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {product.x_kb_product_name || (
                              <Typography component="span" variant="caption" color="text.disabled">unmapped</Typography>
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" onClick={e => e.stopPropagation()}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => setEditProduct(product)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paged.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No products found</Typography>
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
              rowsPerPageOptions={[10, 15, 25, 50]}
            />
          </>
        )}
      </Card>

      {/* Edit Modal */}
      <ProductModal
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        product={editProduct}
        categories={categories}
        onSave={loadData}
      />
    </Box>
  );
}
