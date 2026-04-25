import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Chip,
  CircularProgress, Alert, Grid, TextField, IconButton, Tooltip, Divider,
  FormControlLabel, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TablePagination,
} from '@mui/material';
import {
  ArrowBack as BackIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getProduct } from '../../services/erpProducts';
import { getTabRows } from '../../services/erpBundle';
import { useNotification } from '../../components/ErrorNotification';
import { evaluateDisplayLogic } from '../../lib/displayLogic';
import productWindow from './m_product_window.json';

const PRODUCT_WINDOW_ID = 140;

// Tab definitions match the AD window order. Header tab ('Product') is wired
// to a generated form below; child tabs are placeholders until writes/expand
// land via the iDempiere REST plugin.
const TAB_ORDER = productWindow.tabs.map((t) => t.name);

export default function ErpProductDetail() {
  const { tenant, id } = useParams();
  const navigate = useNavigate();
  const { error: notifyError } = useNotification();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getProduct(id)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        notifyError('Failed to load product', e?.response?.data?.message || e.message);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, notifyError]);

  const headerTabSpec = useMemo(
    () => productWindow.tabs.find((t) => t.name === 'Product'),
    []
  );

  return (
    <Box sx={{ px: 1 }}>
      {/* ── Sticky header with identity + key flags ── */}
      <Card sx={{ mb: 2, position: 'sticky', top: 0, zIndex: 5 }}>
        <CardContent sx={{ py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Back to list">
            <IconButton size="small" onClick={() => navigate(`/${tenant}/erp/product`)}>
              <BackIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }}>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : !data ? (
              <Typography variant="body2" color="text.secondary">Not found</Typography>
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {data.name} <Typography component="span" variant="caption" color="text.secondary">({data.value})</Typography>
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                  {data.isActive    && <Chip label="Active"    size="small" color="success" variant="outlined" />}
                  {!data.isActive   && <Chip label="Inactive"  size="small" color="default" variant="outlined" />}
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
            <IconButton size="small" onClick={() => getProduct(id).then(setData)}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mb: 2 }}>
        Read-only experimental view. Editing, child tabs, and document actions will be enabled
        when the underlying engine's API plugin is provisioned.
      </Alert>

      {/* ── Tab strip ── */}
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
          ) : activeTab === 0 ? (
            <HeaderTab spec={headerTabSpec} data={data} />
          ) : (
            <ChildTab
              key={activeTab}
              tabIndex={activeTab}
              tabSpec={productWindow.tabs[activeTab]}
              parentId={data?.id ?? Number(id)}
            />
          )}
        </Box>
      </Card>
    </Box>
  );
}

// ── Header tab — generated from the AD field spec ───────────────────────────
function HeaderTab({ spec, data }) {
  if (!data || !spec) return null;
  const fields = spec.fields
    .filter((f) => f.isDisplayed === 'Y')
    .sort((a, b) => a.seqno - b.seqno);

  return (
    <Grid container spacing={1.5}>
      {fields.map((f) => {
        const visible = !f.displayLogic || evaluateDisplayLogic(f.displayLogic, data);
        if (!visible) return null;
        const span = Math.min(12, Math.max(2, f.columnSpan || 6));
        // 2-col grid: each form field uses 6 cols (=half row); columnSpan
        // 5 (full text rows) takes 12. Map the AD 6-col layout to MUI 12-col.
        const md = span * 2;
        return (
          <Grid item xs={12} md={md} key={f.columnName}>
            <FieldRenderer field={f} data={data} />
          </Grid>
        );
      })}
    </Grid>
  );
}

function FieldRenderer({ field, data }) {
  const valueKey = camelize(field.columnName);
  const lookupKey = camelizeLookup(field.columnName);
  const raw = data[valueKey];
  const lookup = lookupKey ? data[lookupKey] : null;
  const ref = field.reference;

  // Yes-No → checkbox
  if (ref === 'Yes-No') {
    return (
      <FormControlLabel
        control={<Checkbox size="small" checked={!!raw} disabled />}
        label={field.label}
      />
    );
  }

  // FK references — show the resolved name + raw id as helper
  const isFk = (ref === 'Table' || ref === 'Table Direct' || ref === 'Search'
                || ref === 'Locator (WH)' || ref === 'Product Attribute');
  const display = isFk ? (lookup || (raw != null ? `#${raw}` : '')) : formatValue(raw, ref);

  return (
    <TextField
      label={field.label}
      value={display ?? ''}
      fullWidth
      size="small"
      InputProps={{ readOnly: true }}
      variant="outlined"
      multiline={ref === 'Text' || ref === 'Memo'}
      minRows={ref === 'Text' ? 2 : undefined}
    />
  );
}

function formatValue(v, ref) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (ref === 'Date' && typeof v === 'string') return v.split('T')[0];
  return String(v);
}

function camelize(adName) {
  // Mirror IdempiereProductService.camelFromAd().
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

// FK column → its display key. Mirrors the BFF's hand-rolled lookups.
function camelizeLookup(col) {
  switch (col) {
    case 'M_Product_Category_ID':   return 'productCategoryName';
    case 'C_UOM_ID':                return 'uomName';
    case 'AD_Org_ID':               return 'orgName';
    case 'AD_Client_ID':            return 'clientName';
    case 'C_TaxCategory_ID':        return 'taxCategoryName';
    case 'M_FreightCategory_ID':    return 'freightCategoryName';
    case 'SalesRep_ID':             return 'salesRepName';
    case 'M_PartType_ID':           return 'partTypeName';
    case 'M_AttributeSet_ID':       return 'attributeSetName';
    case 'M_Locator_ID':            return 'locatorValue';
    case 'C_RevenueRecognition_ID': return 'revenueRecognitionName';
    case 'R_MailText_ID':           return 'mailTextName';
    case 'S_ExpenseType_ID':        return 'expenseTypeName';
    case 'S_Resource_ID':           return 'resourceName';
    default:                        return null;
  }
}

// ── Child tab — fetches parent-filtered rows from /erp-api ──────────────────
function ChildTab({ tabIndex, tabSpec, parentId }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cols = useMemo(() => {
    if (!tabSpec) return [];
    return tabSpec.fields
      .filter((f) => f.isDisplayedGrid === 'Y')
      .sort((a, b) => (a.seqNoGrid || 0) - (b.seqNoGrid || 0))
      .slice(0, 10);
  }, [tabSpec]);

  useEffect(() => {
    if (!parentId) return;
    setLoading(true);
    setError(null);
    getTabRows(PRODUCT_WINDOW_ID, tabIndex, { parentId, page, size })
      .then((d) => { setRows(d.items || []); setTotal(d.total || 0); })
      .catch((e) => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [tabIndex, parentId, page, size]);

  if (loading && rows.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (rows.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No rows for this tab.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {cols.map((col) => (
                <TableCell key={col.columnName} sx={{ fontWeight: 700 }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                {cols.map((col) => (
                  <TableCell key={col.columnName}>
                    {formatCell(r[col.columnName.toLowerCase()])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={size}
        onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Box>
  );
}

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  if (typeof v === 'string' && v.length > 40) return v.slice(0, 40) + '…';
  return String(v);
}
