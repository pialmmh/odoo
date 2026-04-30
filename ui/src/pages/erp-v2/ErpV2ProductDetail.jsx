import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  makeStyles, mergeClasses, tokens, Text, Spinner, Button, Tooltip, Badge,
  Field, Input, Textarea, Switch, Checkbox, Radio, RadioGroup,
  TabList, Tab, Divider, Caption1, MessageBar, MessageBarBody, MessageBarTitle,
  MessageBarActions, Combobox, Option,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions, DialogTrigger,
} from '@fluentui/react-components';
import {
  ArrowLeft20Regular, ArrowClockwise20Regular, Box20Regular,
  Star20Filled, Star20Regular, Image20Regular, MoreHorizontal20Regular,
  TextBulletList20Regular, Document20Regular, Globe20Regular,
  ArrowSwap20Regular, Branch20Regular,
  Send20Regular, Note20Regular, Chat20Regular, Calendar20Regular,
  Save20Regular, ArrowUndo20Regular, Archive20Regular,
} from '@fluentui/react-icons';
import {
  getProduct, updateProduct, archiveProduct,
  listCategories, listUoms, listTaxCategories, listProductTypes,
  getPrice, setPrice,
} from '../../services/erpV2';
import { useNotification } from '../../components/ErrorNotification';

// Product detail — faithful clone of the Odoo 17 product form (wiki spec
// at video-extractor/wiki/odoo-product-*.md, screenshots frame_0069..0838).
// Backed by iDempiere through the ErpAdapter (slice 1 read-only). Fields
// the wiki shows that iDempiere can't supply render as empty inputs so the
// structural layout stays accurate.

// ── Tokens that recur ───────────────────────────────────────────────────
// Brand-driven accents pull from Fluent's active theme (tokens.colorBrand*)
// so the screen follows whatever theme the user has selected. The only
// hard-coded colour is the favourite-star yellow, which is a universal
// affordance regardless of brand.
const STAR_YELLOW = '#f5b700';

const useStyles = makeStyles({
  page: {
    paddingBottom: tokens.spacingVerticalXXL,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },

  // ── Top toolbar (back arrow + breadcrumb) ─────────────────────────────
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  breadcrumbLink: { color: tokens.colorBrandForeground1, cursor: 'pointer', fontWeight: 600 },

  // ── Status-bar row (Replenish / Print Labels + smart buttons) ─────────
  statusBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
  },
  statusButtons: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  smartButtons: { display: 'flex', alignItems: 'stretch', gap: 0 },
  smartButton: {
    display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS,
    paddingTop: '6px', paddingBottom: '6px',
    paddingLeft: tokens.spacingHorizontalM, paddingRight: tokens.spacingHorizontalM,
    border: '1px solid #e0e0e0',
    borderRadius: 0,
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#222',
    minWidth: '96px',
    ':hover': { backgroundColor: tokens.colorNeutralBackground2 },
  },
  smartButtonFirst: { borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' },
  smartButtonLast:  { borderTopRightRadius: '4px', borderBottomRightRadius: '4px' },
  smartButtonContent: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  smartButtonLabel: { color: '#555', fontSize: '12px', lineHeight: '14px' },
  smartButtonCount: { fontWeight: 700, color: tokens.colorBrandForeground1, fontSize: '13px', lineHeight: '15px' },

  // ── Sheet (centred white card) ────────────────────────────────────────
  sheetWrap: {
    paddingTop: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    maxWidth: '1280px',
    marginLeft: 'auto', marginRight: 'auto',
  },
  sheet: {
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    paddingTop: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
  },

  // ── Title row (caption + name + favorite + EN + image) ────────────────
  titleRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 160px',
    gap: tokens.spacingHorizontalL,
    alignItems: 'flex-start',
    marginBottom: tokens.spacingVerticalL,
  },
  titleLeft: { minWidth: 0 },
  titleCaption: { color: '#888', fontSize: '13px' },
  titleNameRow: {
    display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM,
    marginTop: '2px',
  },
  titleStar: {
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    color: STAR_YELLOW,
    fontSize: '24px',
  },
  titleStarOff: { color: '#ccc' },
  titleName: {
    fontSize: '28px', fontWeight: 700, color: '#1a1a1a',
    lineHeight: 1.2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    flex: 1, minWidth: 0,
  },
  titleEn: { color: tokens.colorBrandForeground1, fontSize: '13px', fontWeight: 600 },
  imagePlaceholder: {
    width: '140px', height: '120px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#aaa', fontSize: '32px',
    cursor: 'pointer',
    ':hover': { backgroundColor: '#f5f5f5', borderTopColor: '#ccc', borderRightColor: '#ccc', borderBottomColor: '#ccc', borderLeftColor: '#ccc' },
  },

  // ── Scope checkboxes row ──────────────────────────────────────────────
  scopeRow: {
    display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXL,
    marginBottom: tokens.spacingVerticalL,
  },

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabsRow: {
    borderBottom: '1px solid #e0e0e0',
    marginBottom: tokens.spacingVerticalL,
  },

  // ── Two-column form grid (most tabs) ──────────────────────────────────
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: tokens.spacingHorizontalXXL,
    rowGap: tokens.spacingVerticalM,
  },
  twoColFull: { gridColumn: '1 / -1' },

  // ── Section heading (UPSELL & CROSS-SELL etc.) ────────────────────────
  sectionHeading: {
    fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#1a1a1a',
    backgroundColor: tokens.colorBrandBackground2,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    borderBottom: `1px solid ${tokens.colorBrandStroke2}`,
    paddingTop: '6px', paddingBottom: '6px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalM,
    gridColumn: '1 / -1',
  },

  // ── Inline italic context-help paragraph (under Product Type) ─────────
  contextHelp: {
    fontStyle: 'italic',
    color: '#888',
    fontSize: '13px',
    lineHeight: 1.4,
    marginTop: '-4px',
    marginBottom: tokens.spacingVerticalS,
    gridColumn: '1 / -1',
  },

  // ── Compact field row (label + value with help question mark) ─────────
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
  },
  fieldLabel: {
    fontSize: '13px', color: '#555',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  helpMark: { color: tokens.colorBrandForeground1, fontSize: '11px', cursor: 'help' },
  fieldValueText: { fontSize: '14px', color: '#1a1a1a' },
  pricedSuffix: { color: '#888', fontSize: '13px', marginLeft: tokens.spacingHorizontalS },

  // ── Tax / category chip ───────────────────────────────────────────────
  chip: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    border: `1px solid ${tokens.colorBrandStroke2}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: '#555',
    fontSize: '12px',
    marginRight: '4px',
  },

  // ── Attributes table ──────────────────────────────────────────────────
  attrTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  attrTh: {
    fontSize: '13px', fontWeight: 600, color: '#555',
    borderBottom: '1px solid #ddd',
    paddingBottom: '8px',
    textAlign: 'left',
  },
  attrTd: {
    paddingTop: '10px', paddingBottom: '10px',
    fontSize: '14px', color: '#222',
    borderBottom: '1px solid #f2f2f2',
  },
  attrChipGroup: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  attrChip: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#fff',
    fontWeight: 500,
  },
  warning: {
    backgroundColor: '#fff8e6',
    border: '1px solid #f0d27a',
    color: '#7a5a10',
    fontSize: '13px',
    padding: '8px 12px',
    borderRadius: '4px',
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalM,
  },

  // ── Vendor table ──────────────────────────────────────────────────────
  table: {
    width: '100%', borderCollapse: 'collapse',
    border: '1px solid #e8e8e8', borderRadius: '3px',
    overflow: 'hidden',
  },
  th: {
    backgroundColor: '#f8f8f8', color: '#555',
    fontSize: '13px', fontWeight: 600, textAlign: 'left',
    padding: '8px 12px', borderBottom: '1px solid #ddd',
  },
  td: {
    padding: '8px 12px', fontSize: '14px',
    borderBottom: '1px solid #f2f2f2', color: '#222',
  },
  addLine: {
    color: tokens.colorBrandForeground1, fontSize: '13px', cursor: 'pointer',
    marginTop: '6px',
    ':hover': { textDecoration: 'underline' },
  },

  // ── Chatter mock ──────────────────────────────────────────────────────
  chatter: {
    marginTop: tokens.spacingVerticalXXL,
    paddingTop: tokens.spacingVerticalL,
    borderTop: '1px solid #e8e8e8',
  },
  chatterRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalM,
  },
  chatterLeft: { display: 'flex', gap: tokens.spacingHorizontalS },
  chatterRight: {
    display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM,
    color: '#555', fontSize: '13px',
  },
  followingMark: { color: tokens.colorBrandForeground1, fontWeight: 600 },
  chatterFooter: {
    color: '#888', fontSize: '12px', textAlign: 'center',
    marginTop: tokens.spacingVerticalM,
  },

  // ── Loader / empty ────────────────────────────────────────────────────
  loaderWrap: { display: 'flex', justifyContent: 'center', paddingTop: 64, paddingBottom: 64 },
  empty: { padding: '64px', textAlign: 'center', color: '#888' },
});

const dash = '—';

const PRODUCT_TYPES = [
  'Consumable', 'Service', 'Storable Product', 'Booking Fees',
  'Combo', 'Event Ticket', 'Event Booth', 'Course',
];

// Map iDempiere productTypeLabel/code → wiki label (best-effort).
function mapProductType(p) {
  if (!p) return '';
  if (p.productTypeLabel) return p.productTypeLabel;
  switch (p.productType) {
    case 'I': return 'Storable Product';
    case 'S': return 'Service';
    case 'R': return 'Storable Product';
    case 'E': return 'Service';
    case 'O': return 'Service';
    default:  return p.productType || '';
  }
}

// listProductTypes() returns NamedRef with synthetic Long ids (1..6) and
// the iDempiere-side enum names. The patch field `productTypeCode` is a
// single letter — translate via this table.
const PT_NAME_TO_CODE = {
  'Item': 'I', 'Service': 'S', 'Resource': 'R',
  'Expense type': 'E', 'Online': 'O', 'Asset': 'A',
};
const PT_CODE_TO_NAME = Object.fromEntries(
  Object.entries(PT_NAME_TO_CODE).map(([k, v]) => [v, k])
);

// Patch-key (what we send on PATCH) → DTO-key (what the server returns
// in ProductDto). Necessary because some fields drop a prefix on the way
// out (`productCategoryId` → `categoryId`) or change shape entirely
// (`productTypeCode` → `productType`). Used to dedupe edits against the
// server value in setField.
const PATCH_TO_DTO_KEY = {
  productTypeCode:   'productType',
  productCategoryId: 'categoryId',
  uomId:             'uomId',
  taxCategoryId:     'taxCategoryId',
};

// Italic context paragraph shown under Product Type — mirrors what the
// screenshots show for Consumable / Service / Storable.
function contextHelpFor(productTypeLabel) {
  switch (productTypeLabel) {
    case 'Consumable':
      return 'Consumables are physical products for which you don\'t manage the inventory level: they are always available. You can invoice them before they are delivered.';
    case 'Service':
      return 'A service is a non-material product you provide.';
    case 'Storable Product':
      return 'A storable product is a product for which you manage stock. The Inventory app has to be installed.';
    default:
      return null;
  }
}

// Static palette of attribute-value chip colours, keyed by lowercased name.
const ATTR_VALUE_COLOURS = {
  white: '#7fc28e', black: '#d65a45', green: '#e07a4a', pink: '#e98ac1',
  'dark blue': '#3a5a9c', grey: '#9a9a9a', blue: '#4a82c4', yellow: '#e6c454',
  rainbow: '#888888',
};
function chipColour(name) {
  return ATTR_VALUE_COLOURS[(name || '').toLowerCase()] || '#9a9a9a';
}

// ── Smart button cell ────────────────────────────────────────────────────
function SmartButton({ icon, label, count, link, first, last, styles }) {
  return (
    <div className={mergeClasses(
      styles.smartButton,
      first && styles.smartButtonFirst,
      last && styles.smartButtonLast,
    )}>
      {icon}
      <div className={styles.smartButtonContent}>
        <Text className={styles.smartButtonLabel}>{label}</Text>
        {count != null && <Text className={styles.smartButtonCount}>{count}</Text>}
      </div>
    </div>
  );
}

// ── A single label/value field row ──────────────────────────────────────
function FieldRow({ label, help, children, styles }) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLabel}>
        {label}
        {help && <Tooltip content={help} relationship="label">
          <span className={styles.helpMark}>?</span>
        </Tooltip>}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── A read-only displayed value (mimics Odoo's flat read view) ──────────
function ReadValue({ value, suffix, styles }) {
  return (
    <span>
      <span className={styles.fieldValueText}>{value || dash}</span>
      {suffix && <span className={styles.pricedSuffix}>{suffix}</span>}
    </span>
  );
}

export default function ErpV2ProductDetail() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { tenant, id } = useParams();
  const { error: notifyError } = useNotification();

  const [product, setProduct] = useState(null);   // last-loaded server state
  const [edit, setEdit] = useState({});           // per-field local edits (overlay on `product`)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('general');
  const [favorite, setFavorite] = useState(false);
  const [staleAlert, setStaleAlert] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Lookups (slice 2c/2d) — fetched once per session via _lookupCache in erpV2.js.
  const [cats, setCats]   = useState([]);
  const [uoms, setUoms]   = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [ptypes, setPtypes] = useState([]);

  // Pricing (slice 2b) — separate from the product PATCH stream because
  // it lands on M_ProductPrice, not M_Product.
  const [priceList, setPriceList]       = useState('');     // string while editing
  const [priceStandard, setPriceStandard] = useState('');
  const [priceDirty, setPriceDirty]     = useState(false);
  const [priceSaving, setPriceSaving]   = useState(false);

  // Editable field whitelist matches the BFF's iDempiereProductService.update.
  // Anything not in this set stays read-only in the UI.
  const EDITABLE_FIELDS = useMemo(() => new Set([
    'name', 'value', 'sku', 'description', 'upc',
    'isActive', 'isStocked', 'isSold', 'isPurchased',
    'productCategoryId', 'uomId', 'taxCategoryId', 'productTypeCode',
  ]), []);

  // Resolved view of a field — local edit if present, else server value.
  // Patch-keys that don't 1:1 match the DTO read through the alias map.
  const v = (k) => {
    if (k in edit) return edit[k];
    const dtoKey = PATCH_TO_DTO_KEY[k] || k;
    return product?.[dtoKey];
  };

  // Update one field locally; null/'' allowed.
  const setField = (k, val) => {
    setEdit((prev) => {
      const next = { ...prev, [k]: val };
      // If user reverted to server value, drop the override.
      const dtoKey = PATCH_TO_DTO_KEY[k] || k;
      const serverVal = product ? (product[dtoKey] ?? null) : null;
      if (Object.is(serverVal, val ?? null)) delete next[k];
      return next;
    });
  };

  const dirtyKeys = Object.keys(edit);
  const isDirty = dirtyKeys.length > 0;

  const reload = () => {
    setLoading(true);
    setStaleAlert(false);
    Promise.all([getProduct(id), getPrice(id).catch(() => null)])
      .then(([p, pr]) => {
        setProduct(p);
        setEdit({});
        // localStorage favourite — slice 2a stores client-side; server
        // persistence deferred (needs JWT→AD_User resolver). Per-browser-user.
        try {
          const k = `erp-v2:product:${id}:favorite`;
          setFavorite(localStorage.getItem(k) === '1');
        } catch (_) { setFavorite(false); }
        const lp = pr?.listPrice;
        const sp = pr?.standardPrice;
        setPriceList(lp == null ? '' : String(lp));
        setPriceStandard(sp == null ? '' : String(sp));
        setPriceDirty(false);
      })
      .catch((e) => notifyError('Failed to load product', e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  };

  // Lookups load once. _lookupCache inside erpV2 keeps them sticky across mounts.
  useEffect(() => {
    listCategories().then(setCats).catch(() => {});
    listUoms().then(setUoms).catch(() => {});
    listTaxCategories().then(setTaxes).catch(() => {});
    listProductTypes().then(setPtypes).catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [id]);

  const handleSave = () => {
    if (!isDirty || saving) return;
    const patch = {};
    for (const k of dirtyKeys) patch[k] = edit[k];
    setSaving(true);
    setStaleAlert(false);
    updateProduct(id, patch, product?.updatedMs)
      .then((fresh) => {
        setProduct(fresh);
        setEdit({});
      })
      .catch((e) => {
        if (e.status === 409) {
          // Server gave us its current row — adopt it as the new baseline,
          // keep the user's pending edits so they can retry/discard.
          if (e.current) setProduct(e.current);
          setStaleAlert(true);
        } else {
          notifyError('Failed to save', e?.response?.data?.message || e.message);
        }
      })
      .finally(() => setSaving(false));
  };

  const handleDiscard = () => {
    setEdit({});
    setStaleAlert(false);
  };

  const handleArchive = () => {
    setConfirmArchive(false);
    setSaving(true);
    archiveProduct(id, product?.updatedMs)
      .then((fresh) => {
        setProduct(fresh);
        setEdit({});
      })
      .catch((e) => {
        if (e.status === 409) {
          if (e.current) setProduct(e.current);
          setStaleAlert(true);
        } else {
          notifyError('Failed to archive', e?.response?.data?.message || e.message);
        }
      })
      .finally(() => setSaving(false));
  };

  const handleSavePrice = () => {
    if (!priceDirty || priceSaving) return;
    const lp = priceList === '' ? null : Number(priceList);
    const sp = priceStandard === '' ? null : Number(priceStandard);
    if ((priceList !== '' && Number.isNaN(lp)) || (priceStandard !== '' && Number.isNaN(sp))) {
      notifyError('Invalid price', 'Sales Price and Cost must be numeric.');
      return;
    }
    setPriceSaving(true);
    setPrice(id, lp, sp)
      .then(() => {
        setPriceDirty(false);
        // Reload product so list-page-cached listPrice refreshes too.
        reload();
      })
      .catch((e) => notifyError('Failed to save price', e?.response?.data?.message || e.message))
      .finally(() => setPriceSaving(false));
  };

  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);
    try {
      const k = `erp-v2:product:${id}:favorite`;
      if (next) localStorage.setItem(k, '1');
      else localStorage.removeItem(k);
    } catch (_) { /* no-op */ }
  };

  const fmtMoney = (mv) => (mv == null ? null : `$ ${Number(mv).toFixed(2)}`);

  const productTypeLabel = mapProductType(product);
  const ctxHelp = contextHelpFor(productTypeLabel);

  const variantsCount = 0; // iDempiere maps attribute-set instances per document, not template variants.

  return (
    <div className={styles.page}>
      {/* Top toolbar */}
      <div className={styles.topBar}>
        <div className={styles.breadcrumb}>
          <Tooltip content="Back to Products" relationship="label">
            <Button appearance="subtle" icon={<ArrowLeft20Regular />}
              onClick={() => navigate(`/${tenant}/erp-v2/products`)} />
          </Tooltip>
          <Box20Regular />
          <Text className={styles.breadcrumbLink}
            onClick={() => navigate(`/${tenant}/erp-v2/products`)}>Products</Text>
          <Text>/</Text>
          <Text>{loading ? 'Loading…' : (product?.name || `#${id}`)}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!loading && product && product.isActive !== false && (
            <Tooltip content="Archive (soft-delete) this product" relationship="label">
              <Button appearance="subtle" icon={<Archive20Regular />}
                onClick={() => setConfirmArchive(true)} disabled={saving}>
                Archive
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Refresh" relationship="label">
            <Button appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={reload} />
          </Tooltip>
        </div>
      </div>

      {/* Archive confirm dialog */}
      <Dialog open={confirmArchive} onOpenChange={(_, d) => setConfirmArchive(!!d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Archive this product?</DialogTitle>
            <DialogContent>
              {product?.name} will be set inactive. It can be restored from the
              detail page (toggle Active back on, then Save).
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Cancel</Button>
              </DialogTrigger>
              <Button appearance="primary" icon={<Archive20Regular />} onClick={handleArchive}>
                Archive
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Save bar — appears when there are unsaved edits. Persistent at top
          so it stays visible while the user scrolls and switches tabs. */}
      {!loading && product && (isDirty || staleAlert) && (
        <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8 }}>
          {staleAlert ? (
            <MessageBar intent="warning">
              <MessageBarBody>
                <MessageBarTitle>Someone else updated this product.</MessageBarTitle>
                {' '}The latest values have been loaded. Review your pending edits and Save again, or Discard to drop them.
              </MessageBarBody>
              <MessageBarActions>
                <Button appearance="primary" icon={<Save20Regular />} onClick={handleSave} disabled={saving || !isDirty}>
                  Save anyway
                </Button>
                <Button appearance="secondary" icon={<ArrowUndo20Regular />} onClick={handleDiscard}>Discard</Button>
              </MessageBarActions>
            </MessageBar>
          ) : (
            <MessageBar intent="info">
              <MessageBarBody>
                <MessageBarTitle>You have unsaved changes</MessageBarTitle>
                {' '}{dirtyKeys.length} field{dirtyKeys.length === 1 ? '' : 's'} pending: {dirtyKeys.join(', ')}.
              </MessageBarBody>
              <MessageBarActions>
                <Button appearance="primary" icon={saving ? <Spinner size="tiny" /> : <Save20Regular />}
                  onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button appearance="secondary" icon={<ArrowUndo20Regular />} onClick={handleDiscard} disabled={saving}>
                  Discard
                </Button>
              </MessageBarActions>
            </MessageBar>
          )}
        </div>
      )}

      {/* Status bar — Replenish / Print Labels (left) + smart buttons (right) */}
      {!loading && product && (
        <div className={styles.statusBar}>
          <div className={styles.statusButtons}>
            <Button appearance="secondary" disabled>Replenish</Button>
            <Button appearance="secondary" disabled>Print Labels</Button>
          </div>
          <div className={styles.smartButtons}>
            <SmartButton first icon={<TextBulletList20Regular />} label="Extra Prices" count={0} styles={styles} />
            <SmartButton icon={<Document20Regular />} label="Documents" count={0} styles={styles} />
            <SmartButton icon={<Globe20Regular />} label="Go to Website" styles={styles} />
            <SmartButton icon={<ArrowSwap20Regular />} label="In: 0 / Out: 0" styles={styles} />
            <SmartButton icon={<Branch20Regular />} label="Variants" count={variantsCount} styles={styles} />
            <SmartButton last icon={<MoreHorizontal20Regular />} label="More" styles={styles} />
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loaderWrap}><Spinner /></div>
      ) : !product ? (
        <div className={styles.empty}>Product #{id} not found.</div>
      ) : (
        <div className={styles.sheetWrap}>
          <div className={styles.sheet}>
            {/* Title block */}
            <div className={styles.titleRow}>
              <div className={styles.titleLeft}>
                <Caption1 className={styles.titleCaption}>Product Name</Caption1>
                <div className={styles.titleNameRow}>
                  <span
                    className={mergeClasses(styles.titleStar, !favorite && styles.titleStarOff)}
                    onClick={toggleFavorite}
                    title={favorite ? 'Unfavourite (saved per-browser; server persistence in slice 2a-ext)' : 'Favorite'}
                  >
                    {favorite ? <Star20Filled /> : <Star20Regular />}
                  </span>
                  <Input
                    appearance="filled-lighter"
                    className={styles.titleName}
                    value={v('name') || ''}
                    onChange={(_, d) => setField('name', d.value)}
                    style={{ fontSize: 28, fontWeight: 700, border: 'none', background: 'transparent' }}
                  />
                  <Text className={styles.titleEn}>EN</Text>
                </div>
              </div>
              <div className={styles.imagePlaceholder} title="Upload image">
                <Image20Regular />
              </div>
            </div>

            {/* Scope checkboxes — frame_0069 row.
                Sold / Purchased / Active / Stocked are editable in slice 2a;
                Expensed / Recurring / Rented are wiki-only fields with no
                iDempiere binding and stay disabled until those slices land. */}
            <div className={styles.scopeRow}>
              <Checkbox label="Active"           checked={!!v('isActive')}
                onChange={(_, d) => setField('isActive', !!d.checked)} />
              <Checkbox label="Stocked"          checked={!!v('isStocked')}
                onChange={(_, d) => setField('isStocked', !!d.checked)} />
              <Checkbox label="Can be Sold"      checked={!!v('isSold')}
                onChange={(_, d) => setField('isSold', !!d.checked)} />
              <Checkbox label="Can be Purchased" checked={!!v('isPurchased')}
                onChange={(_, d) => setField('isPurchased', !!d.checked)} />
              <Checkbox label="Can be Expensed"  checked={false} disabled />
              <Checkbox label="Recurring"        checked={false} disabled />
              <Checkbox label="Can be Rented"    checked={false} disabled />
            </div>

            {/* Tabs */}
            <div className={styles.tabsRow}>
              <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value)}>
                <Tab value="general">General Information</Tab>
                <Tab value="variants">Attributes &amp; Variants</Tab>
                <Tab value="sales">Sales</Tab>
                <Tab value="purchase">Purchase</Tab>
                <Tab value="inventory">Inventory</Tab>
                <Tab value="accounting">Accounting</Tab>
                <Tab value="ebay">eBay</Tab>
              </TabList>
            </div>

            {tab === 'general' && (
              <div className={styles.twoCol}>
                {/* Left col */}
                <div>
                  <FieldRow label="Product Type" help="Storable, Consumable, Service, etc." styles={styles}>
                    <Combobox
                      value={PT_CODE_TO_NAME[v('productTypeCode')] || ''}
                      selectedOptions={[v('productTypeCode') || '']}
                      onOptionSelect={(_, d) => {
                        if (d.optionValue) setField('productTypeCode', d.optionValue);
                      }}
                    >
                      {ptypes.map((t) => (
                        <Option key={t.id} value={PT_NAME_TO_CODE[t.name] || ''} text={t.name}>{t.name}</Option>
                      ))}
                    </Combobox>
                  </FieldRow>
                  <FieldRow label="Invoicing Policy" help="Ordered or delivered quantities" styles={styles}>
                    <ReadValue value="Ordered quantities" styles={styles} />
                  </FieldRow>
                  {ctxHelp && (
                    <Text className={styles.contextHelp}>{ctxHelp}</Text>
                  )}
                  <FieldRow label="Unit of Measure" styles={styles}>
                    <Combobox
                      value={uoms.find((u) => u.id === v('uomId'))?.name ?? (product.uomName || '')}
                      selectedOptions={[String(v('uomId') ?? '')]}
                      onOptionSelect={(_, d) => {
                        if (d.optionValue) setField('uomId', Number(d.optionValue));
                      }}
                    >
                      {uoms.map((u) => (
                        <Option key={u.id} value={String(u.id)} text={u.name}>{u.name}</Option>
                      ))}
                    </Combobox>
                  </FieldRow>
                  <FieldRow label="Purchase UoM" styles={styles}>
                    <ReadValue value={uoms.find((u) => u.id === v('uomId'))?.name ?? (product.uomName || '')} styles={styles} />
                  </FieldRow>
                  <FieldRow label="Create Repair" help="Auto-create a repair order on receipt of return" styles={styles}>
                    <Switch checked={false} disabled />
                  </FieldRow>
                </div>

                {/* Right col */}
                <div>
                  <FieldRow label="Sales Price" help="Customer-facing price excl. tax" styles={styles}>
                    <Input
                      appearance="outline"
                      type="number"
                      step="0.01"
                      value={priceList}
                      onChange={(_, d) => { setPriceList(d.value); setPriceDirty(true); }}
                      contentBefore="$"
                    />
                  </FieldRow>
                  <FieldRow label="Customer Taxes" styles={styles}>
                    <Combobox
                      value={taxes.find((t) => t.id === v('taxCategoryId'))?.name ?? (product.taxCategoryName || '')}
                      selectedOptions={[String(v('taxCategoryId') ?? '')]}
                      onOptionSelect={(_, d) => {
                        if (d.optionValue) setField('taxCategoryId', Number(d.optionValue));
                      }}
                    >
                      {taxes.map((t) => (
                        <Option key={t.id} value={String(t.id)} text={t.name}>{t.name}</Option>
                      ))}
                    </Combobox>
                  </FieldRow>
                  <FieldRow label="TaxCloud Category"
                    help="TIC code; prevails over the value set on the product category." styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                  <FieldRow label="Avatax Category" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                  <FieldRow label="Cost"
                    help="Used to value stock when purchase cost is unknown, and to compute sale-order margins." styles={styles}>
                    <Input
                      appearance="outline"
                      type="number"
                      step="0.01"
                      value={priceStandard}
                      onChange={(_, d) => { setPriceStandard(d.value); setPriceDirty(true); }}
                      contentBefore="$"
                      contentAfter={`per ${(uoms.find((u) => u.id === v('uomId'))?.name) || product.uomName || 'Units'}`}
                    />
                  </FieldRow>
                  <FieldRow label="Product Category" styles={styles}>
                    <Combobox
                      value={cats.find((c) => c.id === v('productCategoryId'))?.name ?? (product.categoryName || '')}
                      selectedOptions={[String(v('productCategoryId') ?? '')]}
                      onOptionSelect={(_, d) => {
                        if (d.optionValue) setField('productCategoryId', Number(d.optionValue));
                      }}
                    >
                      {cats.map((c) => (
                        <Option key={c.id} value={String(c.id)} text={c.name}>{c.name}</Option>
                      ))}
                    </Combobox>
                  </FieldRow>

                  {/* Pricing save action — separate from the field-PATCH save bar
                      because this lands on M_ProductPrice, not M_Product. */}
                  {priceDirty && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Button appearance="primary"
                        icon={priceSaving ? <Spinner size="tiny" /> : <Save20Regular />}
                        onClick={handleSavePrice} disabled={priceSaving}>
                        {priceSaving ? 'Saving price…' : 'Save price'}
                      </Button>
                    </div>
                  )}

                  {/* Part Number + Version row */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Part Number</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <Input
                        appearance="outline"
                        value={v('value') || ''}
                        onChange={(_, d) => setField('value', d.value)}
                        style={{ flex: 1 }}
                      />
                      <span className={styles.fieldLabel}>
                        Version <Tooltip content="Default 1; defer to slice 2-ext" relationship="label"><span className={styles.helpMark}>?</span></Tooltip>
                      </span>
                      <span className={styles.fieldValueText}>1</span>
                    </div>
                  </div>

                  <FieldRow label="OEM No." help="Manufacturer SKU (M_Product.SKU)" styles={styles}>
                    <Input
                      appearance="outline"
                      value={v('sku') || ''}
                      onChange={(_, d) => setField('sku', d.value)}
                    />
                  </FieldRow>
                  <FieldRow label="UPC / EAN Code" styles={styles}>
                    <Input
                      appearance="outline"
                      value={v('upc') || ''}
                      onChange={(_, d) => setField('upc', d.value)}
                    />
                  </FieldRow>
                  <FieldRow label="Product Template Tags" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                  <FieldRow label="Brands" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                  <FieldRow label="Company" styles={styles}>
                    <ReadValue value={product.orgName} styles={styles} />
                  </FieldRow>
                </div>

                {/* Internal Notes — full width, editable */}
                <div className={styles.twoColFull}>
                  <Field label="Internal Notes">
                    <Textarea
                      value={v('description') || ''}
                      onChange={(_, d) => setField('description', d.value)}
                      rows={3}
                      placeholder="This note is only for internal purposes."
                    />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'variants' && (
              <div>
                <table className={styles.attrTable}>
                  <thead>
                    <tr>
                      <th className={styles.attrTh} style={{ width: '30%' }}>Attribute</th>
                      <th className={styles.attrTh}>Values</th>
                      <th className={styles.attrTh} style={{ width: '160px', textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.attributeSetName ? (
                      <tr>
                        <td className={styles.attrTd}>{product.attributeSetName}</td>
                        <td className={styles.attrTd}>
                          <div className={styles.attrChipGroup}>
                            {/* Without explicit value list, surface the set name as a single chip. */}
                            <span className={styles.attrChip} style={{ backgroundColor: chipColour(product.attributeSetName) }}>
                              {product.attributeSetName}
                            </span>
                          </div>
                        </td>
                        <td className={styles.attrTd} style={{ textAlign: 'right' }}>
                          <Button appearance="secondary" size="small" disabled>Configure</Button>
                        </td>
                      </tr>
                    ) : (
                      <tr><td className={styles.attrTd} colSpan={3}>
                        <Text style={{ color: '#888' }}>No attribute set assigned.</Text>
                      </td></tr>
                    )}
                  </tbody>
                </table>
                <Text className={styles.addLine}>+ Add a line</Text>

                <div className={styles.warning}>
                  <strong>Warning:</strong> adding or deleting attributes will delete and recreate
                  existing variants and lead to the loss of their possible customizations.
                </div>

                <div className={styles.sectionHeading}>Sales Variant Selection</div>
                <RadioGroup value="configurator">
                  <Radio value="configurator" label="Product Configurator" disabled />
                  <Radio value="grid"         label="Order Grid Entry"     disabled />
                </RadioGroup>
              </div>
            )}

            {tab === 'sales' && (
              <div className={styles.twoCol}>
                <div className={styles.sectionHeading}>Upsell &amp; Cross-Sell</div>
                <div>
                  <FieldRow label="Optional Products"
                    help="Suggested whenever the customer hits 'Add to Cart' (cross-sell)." styles={styles}>
                    <Text style={{ color: '#888', fontSize: 13 }}>
                      Recommend when 'Adding to Cart' or quotation
                    </Text>
                  </FieldRow>
                  <FieldRow label="Accessory Products" styles={styles}>
                    <Text style={{ color: '#888', fontSize: 13 }}>
                      Suggested accessories in the eCommerce cart
                    </Text>
                  </FieldRow>
                  <FieldRow label="Alternative Products" styles={styles}>
                    <Text style={{ color: '#888', fontSize: 13 }}>
                      Displayed in bottom of product pages
                    </Text>
                  </FieldRow>
                </div>
                <div>
                  <Field label="Product Description for Self Order">
                    <Textarea value="" readOnly rows={3}
                      placeholder="Information about your product for Self Order and Kiosk" />
                  </Field>
                </div>

                <div className={styles.sectionHeading}>Point of Sale</div>
                <div>
                  <FieldRow label="Available in POS" styles={styles}>
                    <Switch checked={false} disabled />
                  </FieldRow>
                  <FieldRow label="To Weigh With Scale" styles={styles}>
                    <Switch checked={false} disabled />
                  </FieldRow>
                  <FieldRow label="Category" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                  <FieldRow label="Available in Self Order" styles={styles}>
                    <Switch checked={false} disabled />
                  </FieldRow>
                </div>
                <div>
                  <FieldRow label="Sales Description" styles={styles}>
                    {' '}
                  </FieldRow>
                  <Textarea value={product.salesDescription || ''} readOnly rows={3}
                    placeholder="This note is added to sales orders and invoices." />
                </div>

                <div className={styles.sectionHeading}>eCommerce Shop</div>
                <div>
                  <FieldRow label="Website" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                  <FieldRow label="Categories" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                </div>
                <div></div>

                <div className={styles.sectionHeading}>Extra Product Media</div>
                <div className={styles.twoColFull}>
                  <Button appearance="secondary" icon={<Image20Regular />} disabled>Add a Media</Button>
                </div>
              </div>
            )}

            {tab === 'purchase' && (
              <div>
                {/* Vendors table */}
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Vendor</th>
                      <th className={styles.th}>Price</th>
                      <th className={styles.th}>Currency</th>
                      <th className={styles.th}>Delivery Lead Time</th>
                      <th className={styles.th}>Min Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className={styles.td} colSpan={5}>
                      <Text style={{ color: '#888' }}>No vendors recorded.</Text>
                    </td></tr>
                  </tbody>
                </table>
                <Text className={styles.addLine}>+ Add a line</Text>

                <div className={styles.twoCol} style={{ marginTop: 24 }}>
                  <div className={styles.sectionHeading}>Vendor Bills</div>
                  <div></div>
                  <FieldRow label="Vendor Taxes" styles={styles}>
                    {product.taxCategoryName
                      ? <span className={styles.chip}>{product.taxCategoryName} ×</span>
                      : <span className={styles.fieldValueText}>{dash}</span>}
                  </FieldRow>
                  <div></div>
                  <FieldRow label="Control Policy"
                    help="On ordered: control bills based on ordered qty. On received: control bills based on received qty." styles={styles}>
                    <RadioGroup value="received">
                      <Radio value="ordered"  label="On ordered quantities"  disabled />
                      <Radio value="received" label="On received quantities" disabled />
                    </RadioGroup>
                  </FieldRow>
                  <div></div>

                  <div className={styles.sectionHeading}>Purchase Description</div>
                  <div className={styles.twoColFull}>
                    <Textarea value={product.purchaseDescription || ''} readOnly rows={3}
                      placeholder="This note is added to purchase orders." />
                  </div>
                </div>

                {/* Chatter — only on Purchase tab in the screenshots */}
                <div className={styles.chatter}>
                  <div className={styles.chatterRow}>
                    <div className={styles.chatterLeft}>
                      <Button icon={<Send20Regular />} appearance="primary" disabled>
                        Send message
                      </Button>
                      <Button icon={<Note20Regular />} appearance="secondary" disabled>Log note</Button>
                      <Button icon={<Chat20Regular />} appearance="secondary" disabled>WhatsApp</Button>
                      <Button icon={<Calendar20Regular />} appearance="secondary" disabled>Activities</Button>
                    </div>
                    <div className={styles.chatterRight}>
                      <Text>👤 1</Text>
                      <Text className={styles.followingMark}>✓ Following</Text>
                    </div>
                  </div>
                  <div className={styles.chatterFooter}>Today</div>
                </div>
              </div>
            )}

            {tab === 'inventory' && (
              <div className={styles.twoCol}>
                <div className={styles.sectionHeading}>Operations</div>
                <div>
                  <FieldRow label="Routes" help="Procurement routes that drive replenishment" styles={styles}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Checkbox label="Dropship Subcontractor on Order" disabled />
                      <Checkbox label="Buy" checked={!!product.isPurchased} disabled />
                      <Checkbox label="Replenish on Order (MTO)" disabled />
                      <Checkbox label="Manufacture" disabled />
                      <Checkbox label="Resupply Subcontractor on Order" disabled />
                      <Checkbox label="Dropship" disabled />
                      <Checkbox label={`${product.orgName || 'Company'}: Cross-Dock`} disabled />
                    </div>
                  </FieldRow>
                  <div style={{ marginTop: 8 }}>
                    <Text style={{ color: tokens.colorBrandForeground1, cursor: 'pointer', fontSize: 13 }}>
                      → View Diagram
                    </Text>
                  </div>
                </div>

                <div className={styles.sectionHeading}>Logistics</div>
                <div>
                  <FieldRow label="Responsible" styles={styles}>
                    <ReadValue value={product.salesRepName} styles={styles} />
                  </FieldRow>
                  <FieldRow label="Customer Lead Time" help="In days" styles={styles}>
                    <ReadValue value="0" suffix="days" styles={styles} />
                  </FieldRow>
                  <FieldRow label="HS Code" help="International shipping (FedEx)" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                  <FieldRow label="Origin of Goods" help="Economic nationality of goods" styles={styles}>
                    <ReadValue value="" styles={styles} />
                  </FieldRow>
                </div>

                <div className={styles.sectionHeading}>Description for Receipts</div>
                <div className={styles.twoColFull}>
                  <Textarea value="" readOnly rows={2}
                    placeholder="This note is added to receipt orders (e.g. where to store the product in the warehouse)." />
                </div>

                <div className={styles.sectionHeading}>Description for Delivery Orders</div>
                <div className={styles.twoColFull}>
                  <Textarea value="" readOnly rows={2}
                    placeholder="This note is added to delivery orders." />
                </div>

                <div className={styles.sectionHeading}>Description for Internal Transfers</div>
                <div className={styles.twoColFull}>
                  <Textarea value="" readOnly rows={2} placeholder="" />
                </div>
              </div>
            )}

            {tab === 'accounting' && (
              <div style={{ padding: 32, color: '#888', textAlign: 'center' }}>
                <Text>Accounting tab — not demonstrated in the source video; iDempiere accounting bindings are out of scope for this slice.</Text>
              </div>
            )}

            {tab === 'ebay' && (
              <div style={{ padding: 32, color: '#888', textAlign: 'center' }}>
                <Text>eBay tab — not demonstrated in the source video. Requires an eBay-integration module.</Text>
              </div>
            )}

            <Divider style={{ marginTop: 32 }} />
            <Caption1 style={{ display: 'block', marginTop: 12, color: '#888' }}>
              Product #{product.id} · iDempiere backend · spec: video-extractor/wiki/odoo-product-*.md
            </Caption1>
          </div>
        </div>
      )}
    </div>
  );
}
