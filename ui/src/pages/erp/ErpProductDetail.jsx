import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Chip,
  CircularProgress, Grid, TextField, IconButton, Tooltip,
  FormControlLabel, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TablePagination,
  Drawer, Button, Breadcrumbs, Link, Stack, Snackbar, Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon, Refresh as RefreshIcon,
  Save as SaveIcon, Close as CloseIcon, Edit as EditIcon,
  ChevronLeft as PrevIcon, ChevronRight as NextIcon,
  Home as HomeIcon, NavigateNext as ChevronIcon,
} from '@mui/icons-material';
import { getProduct } from '../../services/erpProducts';
import { getTabRows, saveRow, saveRowByKeys } from '../../services/erpBundle';
import { useNotification } from '../../components/ErrorNotification';
import { evaluateDisplayLogic } from '../../lib/displayLogic';
import productWindow from './m_product_window.json';

const PRODUCT_WINDOW_ID = 140;
const TAB_ORDER = productWindow.tabs.map((t) => t.name);
const HEADER_TAB_INDEX = 0;

// Composite primary keys for tabs in the Product window. For tables not
// listed here, we use the single-PK URL form ({Table}_ID).
const COMPOSITE_KEYS = {
  'M_ProductPrice':   ['M_PriceList_Version_ID', 'M_Product_ID'],
  'M_Product_Acct':   ['M_Product_ID', 'C_AcctSchema_ID'],
  'M_Product_PO':     ['M_Product_ID', 'C_BPartner_ID'],
  'M_Replenish':      ['M_Product_ID', 'M_Warehouse_ID'],
  'M_Product_Trl':    ['M_Product_ID', 'AD_Language'],
  'M_Cost':           ['M_Product_ID', 'M_CostType_ID', 'M_CostElement_ID', 'C_AcctSchema_ID', 'AD_Org_ID', 'M_AttributeSetInstance_ID'],
  'M_Substitute':     ['M_Product_ID', 'Substitute_ID'],
  'C_UOM_Conversion': ['C_UOM_ID', 'C_UOM_To_ID'],
  'M_Storage':        ['M_Locator_ID', 'M_Product_ID', 'M_AttributeSetInstance_ID'],
};

export default function ErpProductDetail() {
  const { tenant, id } = useParams();
  const navigate = useNavigate();
  const { error: notifyError, success: notifySuccess } = useNotification();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const reload = useCallback(() => {
    let alive = true;
    setLoading(true);
    getProduct(id)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => notifyError('Failed to load product', e?.response?.data?.message || e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, notifyError]);

  useEffect(() => reload(), [reload]);

  const headerTabSpec = useMemo(
    () => productWindow.tabs.find((t) => t.name === 'Product'),
    []
  );

  return (
    <Box sx={{ px: 1, pb: 8 /* room for sticky save bar */ }}>
      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <Breadcrumbs
        separator={<ChevronIcon fontSize="small" />}
        sx={{ px: 1, py: 0.5, fontSize: 13 }}
      >
        <Link
          component={RouterLink}
          to={`/${tenant}/`}
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon sx={{ fontSize: 14 }} /> Home
        </Link>
        <Link component={RouterLink} to={`/${tenant}/erp/product`} underline="hover" color="inherit">
          ERP
        </Link>
        <Link component={RouterLink} to={`/${tenant}/erp/product`} underline="hover" color="inherit">
          Products
        </Link>
        <Typography color="text.primary" sx={{ fontSize: 13 }}>
          {data?.name || `#${id}`}
        </Typography>
      </Breadcrumbs>

      {/* ── Sticky identity header ───────────────────────────────── */}
      <Card sx={{ mb: 2, position: 'sticky', top: 0, zIndex: 5 }}>
        <CardContent sx={{ py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Back to list">
            <IconButton size="small" onClick={() => navigate(`/${tenant}/erp/product`)}>
              <BackIcon />
            </IconButton>
          </Tooltip>
          <PrevNextNav id={id} tenant={tenant} />
          <Box sx={{ flex: 1 }}>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : !data ? (
              <Typography variant="body2" color="text.secondary">Not found</Typography>
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {data.name}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    ({data.value})
                  </Typography>
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                  {data.isActive    ? <Chip label="Active"    size="small" color="success" variant="outlined" />
                                    : <Chip label="Inactive"  size="small" variant="outlined" />}
                  {data.isSummary   && <Chip label="Summary"   size="small" variant="outlined" />}
                  {data.isStocked   && <Chip label="Stocked"   size="small" variant="outlined" />}
                  {data.isSold      && <Chip label="Sold"      size="small" variant="outlined" />}
                  {data.isPurchased && <Chip label="Purchased" size="small" variant="outlined" />}
                  {data.isBOM       && <Chip label="BOM"       size="small" variant="outlined" />}
                  <Chip
                    label={`${data.productTypeLabel || data.productType || '—'} · ${data.uomName || '—'} · ${data.productCategoryName || '—'}`}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Box>
              </>
            )}
          </Box>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={reload}><RefreshIcon /></IconButton>
          </Tooltip>
        </CardContent>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <Card sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {TAB_ORDER.map((name) => <Tab key={name} label={name} />)}
        </Tabs>
        <Box sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : activeTab === HEADER_TAB_INDEX ? (
            <HeaderTab
              spec={headerTabSpec}
              data={data}
              recordId={Number(id)}
              onSaved={(updated) => {
                setData((prev) => ({ ...prev, ...mapBundleToProduct(updated) }));
                notifySuccess('Saved');
              }}
              onError={(msg) => notifyError('Save failed', msg)}
            />
          ) : (
            <ChildTab
              key={activeTab}
              tabIndex={activeTab}
              tabSpec={productWindow.tabs[activeTab]}
              parentId={data?.id ?? Number(id)}
              onSavedRow={() => notifySuccess('Saved')}
              onError={(msg) => notifyError('Save failed', msg)}
            />
          )}
        </Box>
      </Card>
    </Box>
  );
}

// ── Prev/Next record nav (browser-style for adjacent products) ──────────────
function PrevNextNav({ id, tenant }) {
  const navigate = useNavigate();
  const go = (delta) => {
    // Naive: just advance the id. Production version would query the list
    // for the actual previous/next based on current sort.
    const next = Number(id) + delta;
    if (next > 0) navigate(`/${tenant}/erp/product/${next}`);
  };
  return (
    <Box sx={{ display: 'flex' }}>
      <Tooltip title="Previous record">
        <IconButton size="small" onClick={() => go(-1)}><PrevIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Next record">
        <IconButton size="small" onClick={() => go(+1)}><NextIcon /></IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Header tab — editable form bound to the AD spec ─────────────────────────
function HeaderTab({ spec, data, recordId, onSaved, onError }) {
  // Original snapshot used to compute the dirty diff.
  const original = useMemo(() => {
    const o = {};
    for (const f of spec.fields) o[f.columnName] = readField(data, f);
    return o;
  }, [data, spec]);

  const [form, setForm] = useState(original);
  const [saving, setSaving] = useState(false);

  // Reset form when product reloads.
  useEffect(() => { setForm(original); }, [original]);

  const dirty = useMemo(() => {
    const diff = {};
    for (const k of Object.keys(form)) {
      if (!shallowEqual(form[k], original[k])) diff[k] = form[k];
    }
    return diff;
  }, [form, original]);
  const isDirty = Object.keys(dirty).length > 0;

  const fields = useMemo(() =>
    spec.fields.filter((f) => f.isDisplayed === 'Y').sort((a, b) => a.seqno - b.seqno),
    [spec]
  );

  const onChange = (col, v) => setForm((s) => ({ ...s, [col]: v }));
  const onDiscard = () => setForm(original);
  const onSave = async () => {
    setSaving(true);
    try {
      const updated = await saveRow(PRODUCT_WINDOW_ID, HEADER_TAB_INDEX, recordId, dirty);
      onSaved?.(updated);
    } catch (e) {
      onError?.(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  return (
    <>
      <Grid container spacing={1.5}>
        {fields.map((f) => {
          const visible = !f.displayLogic || evaluateDisplayLogic(f.displayLogic, form);
          if (!visible) return null;
          const span = Math.min(12, Math.max(2, f.columnSpan || 6));
          const md = span * 2;
          return (
            <Grid item xs={12} md={md} key={f.columnName}>
              <FieldRenderer
                field={f}
                value={form[f.columnName]}
                lookup={readLookup(data, f.columnName)}
                onChange={(v) => onChange(f.columnName, v)}
              />
            </Grid>
          );
        })}
      </Grid>

      {/* Sticky Save / Discard bar — slides in only when dirty. */}
      {isDirty && (
        <SaveBar
          dirtyCount={Object.keys(dirty).length}
          saving={saving}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      )}
    </>
  );
}

// ── Field renderer — editable inputs by AD reference type ───────────────────
function FieldRenderer({ field, value, lookup, onChange }) {
  const ref = field.reference;
  const editable = field.isUpdateable === 'Y' && !field.readOnlyLogic;

  if (ref === 'Yes-No') {
    return (
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={value === true || value === 'Y'}
            onChange={(e) => onChange(e.target.checked)}
            disabled={!editable}
          />
        }
        label={field.label + (field.isMandatory === 'Y' ? ' *' : '')}
      />
    );
  }

  const isFk = ref === 'Table' || ref === 'Table Direct' || ref === 'Search'
            || ref === 'Locator (WH)' || ref === 'Product Attribute';

  if (isFk) {
    // For now show the resolved name; FK typeahead picker comes later.
    const display = lookup || (value != null ? `#${value}` : '');
    return (
      <TextField
        label={field.label + (field.isMandatory === 'Y' ? ' *' : '')}
        value={display}
        fullWidth size="small" variant="outlined"
        InputProps={{ readOnly: true, endAdornment: editable
            ? <Tooltip title="Picker coming soon"><EditIcon sx={{ fontSize: 14, color: 'action.disabled' }} /></Tooltip>
            : null }}
        helperText={editable ? null : 'Read-only'}
      />
    );
  }

  if (ref === 'Integer' || ref === 'Number' || ref === 'Amount'
      || ref === 'Quantity' || ref === 'Costs+Prices') {
    return (
      <TextField
        label={field.label + (field.isMandatory === 'Y' ? ' *' : '')}
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        fullWidth size="small" variant="outlined"
        disabled={!editable}
      />
    );
  }

  if (ref === 'Date') {
    return (
      <TextField
        label={field.label + (field.isMandatory === 'Y' ? ' *' : '')}
        type="date"
        value={(value || '').toString().split('T')[0]}
        onChange={(e) => onChange(e.target.value || null)}
        fullWidth size="small" variant="outlined"
        InputLabelProps={{ shrink: true }}
        disabled={!editable}
      />
    );
  }

  if (ref === 'Button') {
    return (
      <Button variant="outlined" size="small" disabled>
        {field.label}
      </Button>
    );
  }

  // String / Text / Memo / URL / List (fallback)
  const multiline = ref === 'Text' || ref === 'Memo';
  return (
    <TextField
      label={field.label + (field.isMandatory === 'Y' ? ' *' : '')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      fullWidth size="small" variant="outlined"
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      disabled={!editable}
    />
  );
}

// ── Sticky save / discard bar ───────────────────────────────────────────────
function SaveBar({ dirtyCount, saving, onSave, onDiscard }) {
  return (
    <Box sx={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 10, p: 1.5,
      background: 'linear-gradient(0deg, rgba(0,0,0,0.04), transparent)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <Card sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, gap: 2 }}>
        <Typography variant="body2">
          {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onDiscard} disabled={saving} startIcon={<CloseIcon />} size="small">
            Discard
          </Button>
          <Button onClick={onSave} disabled={saving} variant="contained" size="small"
                  startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}>
            Save
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}

// ── Child tab — list of rows + side drawer for editing ──────────────────────
function ChildTab({ tabIndex, tabSpec, parentId, onSavedRow, onError }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [editing, setEditing] = useState(null);

  const cols = useMemo(() => {
    if (!tabSpec) return [];
    return tabSpec.fields
      .filter((f) => f.isDisplayedGrid === 'Y')
      .sort((a, b) => (a.seqNoGrid || 0) - (b.seqNoGrid || 0))
      .slice(0, 10);
  }, [tabSpec]);

  const reload = useCallback(() => {
    if (!parentId) return;
    setLoading(true); setErrorMsg(null);
    getTabRows(PRODUCT_WINDOW_ID, tabIndex, { parentId, page, size })
      .then((d) => { setRows(d.items || []); setTotal(d.total || 0); })
      .catch((e) => setErrorMsg(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [tabIndex, parentId, page, size]);

  useEffect(reload, [reload]);

  if (loading && rows.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  }
  if (errorMsg) return <Alert severity="error">{errorMsg}</Alert>;
  if (rows.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No rows for this tab.</Typography>
      </Box>
    );
  }

  // Resolve key strategy:
  //   - composite key configured → carry the whole row to the drawer; keys
  //     resolved from the row at save time
  //   - single PK → use {Table}_ID
  const compositeCols = COMPOSITE_KEYS[tabSpec.tableName];
  const isComposite = !!compositeCols;
  const singleIdCol = !isComposite
    ? (tabSpec.tableName + '_ID').toLowerCase()
    : null;
  const isRowEditable = (r) =>
    isComposite
      ? compositeCols.every((c) => r[c.toLowerCase()] != null)
      : !!(singleIdCol && r[singleIdCol]);

  return (
    <Box>
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {cols.map((col) => (
                <TableCell key={col.columnName} sx={{ fontWeight: 700 }}>{col.label}</TableCell>
              ))}
              <TableCell sx={{ fontWeight: 700, width: 60 }} align="right">Edit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover sx={{ cursor: isRowEditable(r) ? 'pointer' : 'default' }}
                        onClick={() => isRowEditable(r) && setEditing(r)}>
                {cols.map((col) => (
                  <TableCell key={col.columnName}>
                    {formatCell(r[col.columnName.toLowerCase()])}
                  </TableCell>
                ))}
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" disabled={!isRowEditable(r)} onClick={() => setEditing(r)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total} page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={size}
        onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
      />
      <ChildRowEditDrawer
        open={!!editing}
        row={editing}
        compositeCols={compositeCols}
        singleIdCol={singleIdCol}
        tabIndex={tabIndex}
        tabSpec={tabSpec}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); onSavedRow?.(); }}
        onError={onError}
      />
    </Box>
  );
}

// ── Drawer that edits a single child row ────────────────────────────────────
function ChildRowEditDrawer({ open, row, compositeCols, singleIdCol, tabIndex, tabSpec, onClose, onSaved, onError }) {
  const original = useMemo(() => {
    if (!row || !tabSpec) return {};
    const o = {};
    for (const f of tabSpec.fields) o[f.columnName] = row[f.columnName.toLowerCase()];
    return o;
  }, [row, tabSpec]);

  const [form, setForm] = useState(original);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(original); }, [original]);

  if (!row || !tabSpec) return <Drawer open={open} anchor="right" onClose={onClose} />;

  const fields = tabSpec.fields
    .filter((f) => f.isDisplayed === 'Y')
    .sort((a, b) => a.seqno - b.seqno);

  const dirty = {};
  for (const k of Object.keys(form)) {
    if (!shallowEqual(form[k], original[k])) dirty[k] = form[k];
  }
  const isDirty = Object.keys(dirty).length > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      if (compositeCols) {
        const keys = {};
        for (const c of compositeCols) keys[c] = row[c.toLowerCase()];
        await saveRowByKeys(PRODUCT_WINDOW_ID, tabIndex, keys, dirty);
      } else {
        const id = singleIdCol ? row[singleIdCol] : null;
        if (id == null) throw new Error('No primary key found for row');
        await saveRow(PRODUCT_WINDOW_ID, tabIndex, Number(id), dirty);
      }
      onSaved?.();
    } catch (e) {
      onError?.(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} anchor="right" onClose={onClose}
            PaperProps={{ sx: { width: { xs: '100%', sm: 560 } } }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
          Edit {tabSpec.name}
        </Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Grid container spacing={1.5}>
          {fields.map((f) => {
            const visible = !f.displayLogic || evaluateDisplayLogic(f.displayLogic, form);
            if (!visible) return null;
            const span = Math.min(12, Math.max(2, f.columnSpan || 6));
            const md = span * 2;
            return (
              <Grid item xs={12} md={md} key={f.columnName}>
                <FieldRenderer
                  field={f}
                  value={form[f.columnName]}
                  lookup={null}
                  onChange={(v) => setForm((s) => ({ ...s, [f.columnName]: v }))}
                />
              </Grid>
            );
          })}
        </Grid>
      </Box>
      <Box sx={{ p: 2, display: 'flex', gap: 1, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={onSave}
                disabled={!isDirty || saving}
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}>
          Save
        </Button>
      </Box>
    </Drawer>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readField(data, f) {
  const key = camelize(f.columnName);
  const v = data[key];
  if (f.reference === 'Yes-No') return v === true;
  return v;
}

function readLookup(data, columnName) {
  switch (columnName) {
    case 'M_Product_Category_ID':   return data.productCategoryName;
    case 'C_UOM_ID':                return data.uomName;
    case 'AD_Org_ID':               return data.orgName;
    case 'AD_Client_ID':            return data.clientName;
    case 'C_TaxCategory_ID':        return data.taxCategoryName;
    case 'M_FreightCategory_ID':    return data.freightCategoryName;
    case 'SalesRep_ID':             return data.salesRepName;
    case 'M_PartType_ID':           return data.partTypeName;
    case 'M_AttributeSet_ID':       return data.attributeSetName;
    case 'M_Locator_ID':            return data.locatorValue;
    case 'C_RevenueRecognition_ID': return data.revenueRecognitionName;
    case 'R_MailText_ID':           return data.mailTextName;
    case 'S_ExpenseType_ID':        return data.expenseTypeName;
    case 'S_Resource_ID':           return data.resourceName;
    default: return null;
  }
}

// Map the bundle's flat lowercase row back into the camelCase shape the
// /api/erp/products/:id endpoint returns, for in-place state updates after save.
function mapBundleToProduct(row) {
  if (!row) return {};
  const out = {};
  for (const k of Object.keys(row)) {
    out[camelize(k.replace(/^_/, '').replace(/_/g, '_'))] = row[k];
  }
  return out;
}

function camelize(adName) {
  if (!adName) return adName;
  const parts = adName.split(/_|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  let first = true;
  let out = '';
  for (const p of parts) {
    if (!p) continue;
    const low = p.toLowerCase();
    if (first) { out += low; first = false; }
    else       { out += low.charAt(0).toUpperCase() + low.slice(1); }
  }
  return out;
}

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === 'string' && v.length > 40) return v.slice(0, 40) + '…';
  return String(v);
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
