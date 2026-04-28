import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles, tokens, Text, Subtitle2, TabList, Tab, Spinner, Badge,
  Button, Tooltip, Input, Field, Textarea,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger,
  Table, TableHeader, TableHeaderCell, TableRow, TableCell, TableBody,
} from '@fluentui/react-components';
import {
  ArrowClockwise20Regular, ChevronLeft20Regular, Edit20Regular,
  EditArrowBack20Regular, ArrowDownload20Regular, ArrowSwap20Regular, Delete20Regular,
} from '@fluentui/react-icons';
import { getProduct } from '../../services/erpProducts';
import { getTabRows } from '../../services/erpBundle';
import { adjustStock } from '../../services/erpInventory';
import { useNotification } from '../../components/ErrorNotification';
import { ReceiveStockDialog, MoveStockDialog, IssueStockDialog } from './components/InventoryDialogs';

const PRODUCT_WINDOW_ID = 140;
const STORAGE_TAB = 10;
const PRICE_TAB = 8;
const TRANSACTION_TAB = 9;

const useStyles = makeStyles({
  page: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalXXL,
    maxWidth: '960px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorBrandForeground1,
    cursor: 'pointer',
    fontSize: tokens.fontSizeBase200,
    marginBottom: tokens.spacingVerticalXS,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalS,
  },
  title: {
    fontSize: tokens.fontSizeBase600,
    lineHeight: tokens.lineHeightBase600,
    fontWeight: tokens.fontWeightSemibold,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    marginBottom: tokens.spacingVerticalM,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    marginBottom: tokens.spacingVerticalM,
    overflow: 'hidden',
  },
  cardHead: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  cardBody: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  // Identity grid: two columns of label/value pairs
  identity: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalXXL,
    rowGap: tokens.spacingVerticalM,
    '@media (max-width: 639px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  identityFull: { gridColumn: '1 / -1' },
  fieldLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginBottom: '2px',
  },
  fieldValue: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  fieldLink: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorBrandForeground1,
  },
  // Stock-at-a-glance tiles — 6 metrics per the EspoCRM layout
  stockGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 639px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  stockTile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  stockNumber: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  stockLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  // Bottom tabs
  bottomTabs: {
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
  },
  emptyTab: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
});

export default function ErpProductSimpleDetail({ idOverride }) {
  const styles = useStyles();
  const params = useParams();
  const { tenant } = params;
  const id = idOverride ?? params.id;
  const navigate = useNavigate();
  const { error: notifyError, success: notifySuccess } = useNotification();
  const notifyErrorRef = useRef(notifyError);
  const notifySuccessRef = useRef(notifySuccess);
  notifyErrorRef.current = notifyError;
  notifySuccessRef.current = notifySuccess;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [storageRows, setStorageRows] = useState([]);
  const [priceRows, setPriceRows] = useState([]);
  const [txnRows, setTxnRows] = useState([]);
  const [extra, setExtra] = useState({});  // raw row from BFF for fields not in legacy service (manufacturer, weight, volume)
  const [activeChild, setActiveChild] = useState('inventory');
  const [adjustRow, setAdjustRow] = useState(null);   // dialog: adjust on-hand
  const [moveRow, setMoveRow] = useState(null);       // dialog: move between locators
  const [issueRow, setIssueRow] = useState(null);     // dialog: scrap / internal use
  const [showReceive, setShowReceive] = useState(false);  // dialog: vendor receive / initial stock

  const reload = useCallback(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      getProduct(id),
      // Pull the raw M_Product row from the BFF too — surfaces Manufacturer
      // (= Brand), Weight, Volume etc. that the legacy service trims out.
      getProductRowRaw(id).catch(() => null),
      getTabRows(PRODUCT_WINDOW_ID, STORAGE_TAB,     { parentId: id, size: 50 }).catch(() => ({ items: [] })),
      getTabRows(PRODUCT_WINDOW_ID, PRICE_TAB,       { parentId: id, size: 50 }).catch(() => ({ items: [] })),
      getTabRows(PRODUCT_WINDOW_ID, TRANSACTION_TAB, { parentId: id, size: 25, sort: 'movementdate', dir: 'desc' }).catch(() => ({ items: [] })),
    ])
      .then(([prod, raw, storage, prices, txns]) => {
        if (!alive) return;
        setData(prod);
        setExtra(raw || {});
        setStorageRows(storage.items || []);
        setPriceRows(prices.items || []);
        setTxnRows(txns.items || []);
      })
      .catch((e) => notifyErrorRef.current('Failed to load product', e?.response?.data?.message || e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => reload(), [reload]);

  // Inventory tab is hidden for non-stocked products (services, resources).
  // If we're parked on it, fall back to prices.
  useEffect(() => {
    if (data && !data.isStocked && activeChild === 'inventory') {
      setActiveChild('prices');
    }
  }, [data, activeChild]);

  // The Edit button hands off to the full Product detail page where the
  // existing AD-spec form handles the long tail of fields (BOM, Components,
  // Replenishment, Purchasing, …). Keeps this view minimal.
  const onEdit = () => navigate(`/${tenant}/erp/product/${id}`);

  const stock = useMemo(() => aggregateStock(storageRows), [storageRows]);

  if (loading && !data) {
    return <div className={styles.page}><div style={{ textAlign: 'center', padding: '64px 0' }}><Spinner size="medium" /></div></div>;
  }
  if (!data) return null;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb} onClick={() => navigate(`/${tenant}/erp/product-simple`)}>
        <ChevronLeft20Regular />
        <Text size={200} weight="medium">Products</Text>
      </div>

      <div className={styles.titleRow}>
        <Text className={styles.title} truncate wrap={false}>{data.name || `#${id}`}</Text>
        <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS }}>
          <Tooltip content="Refresh" relationship="label" withArrow={false}>
            <Button appearance="subtle" size="small" icon={<ArrowClockwise20Regular />} onClick={reload} />
          </Tooltip>
          <Button appearance="primary" size="small" icon={<Edit20Regular />} onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>

      <div className={styles.chips}>
        {data.isActive
          ? <Badge appearance="outline" color="success" size="small">Active</Badge>
          : <Badge appearance="outline" size="small">Inactive</Badge>}
        {data.isStocked && <Badge appearance="outline" size="small">Stocked</Badge>}
        {data.isSold && <Badge appearance="outline" size="small">Sold</Badge>}
        {data.isPurchased && <Badge appearance="outline" size="small">Purchased</Badge>}
        {data.productType && <Badge appearance="outline" size="small">{data.productTypeLabel || data.productType}</Badge>}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}><Subtitle2>Identity</Subtitle2></div>
        <div className={styles.cardBody}>
          <div className={styles.identity}>
            <FieldRO label="Name" value={data.name} />
            <FieldRO label="Status" value={data.isActive ? 'Active' : 'Inactive'} />
            <FieldRO label="Search Key" value={data.value} />
            <FieldRO label="Type" value={data.productTypeLabel || data.productType} />
            <FieldRO label="Category" value={data.productCategoryName} link />
            <FieldRO label="Brand" value={extra.manufacturer} />
            <FieldRO label="SKU" value={data.sku} />
            <FieldRO label="Unit of Measure" value={data.uomName} />
            {(extra.weight || extra.volume) ? (
              <>
                <FieldRO label="Weight" value={formatMeasure(extra.weight, 'kg')} />
                <FieldRO label="Volume" value={formatMeasure(extra.volume, 'm³')} />
              </>
            ) : null}
            {data.description && (
              <div className={styles.identityFull}>
                <div className={styles.fieldLabel}>Description</div>
                <div className={styles.fieldValue}>{data.description}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.isStocked && (
        <div className={styles.card}>
          <div className={styles.cardHead}><Subtitle2>Stock at a glance</Subtitle2></div>
          <div className={styles.cardBody}>
            <div className={styles.stockGrid}>
              <Tile label="Available" value={stock.available} hint="On Hand − Reserved" />
              <Tile label="Reserved" value={stock.reserved} />
              <Tile label="On Hand" value={stock.onHand} />
              <Tile label="Soft-Reserved" value={0} hint="Quote pipeline" />
              <Tile label="In Transit" value={0} hint="Open shipments" />
              <Tile label="On Order" value={stock.ordered} />
            </div>
            {storageRows.length === 0 && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS, display: 'block' }}>
                No stock records on file for this product.
              </Text>
            )}
          </div>
        </div>
      )}

      <div className={styles.bottomTabs}>
        <TabList
          size="small"
          selectedValue={activeChild}
          onTabSelect={(_e, d) => setActiveChild(d.value)}
        >
          {data.isStocked && <Tab value="inventory">Inventory</Tab>}
          <Tab value="prices">Prices</Tab>
          <Tab value="activity">Activity</Tab>
        </TabList>
      </div>
      <div className={styles.card}>
        <div className={styles.cardBody}>
          {activeChild === 'inventory' && data.isStocked && (
            <InventoryPanel
              rows={storageRows}
              onAdjust={setAdjustRow}
              onMove={setMoveRow}
              onIssue={setIssueRow}
              onReceive={() => setShowReceive(true)}
            />
          )}
          {activeChild === 'prices' && <PricesPanel rows={priceRows} />}
          {activeChild === 'activity' && <ActivityPanel rows={txnRows} />}
        </div>
      </div>

      {adjustRow && (
        <AdjustStockDialog
          productId={Number(id)}
          row={adjustRow}
          onClose={() => setAdjustRow(null)}
          onSuccess={(result) => {
            setAdjustRow(null);
            notifySuccessRef.current?.(
              'Stock adjusted',
              `Document ${result.documentNo} completed (${result.docStatus})`,
            );
            reload();
          }}
          onError={(msg) => notifyErrorRef.current('Stock adjustment failed', msg)}
        />
      )}
      {moveRow && (
        <MoveStockDialog
          productId={Number(id)}
          fromRow={moveRow}
          onClose={() => setMoveRow(null)}
          onSuccess={(result) => {
            setMoveRow(null);
            notifySuccessRef.current?.(
              'Stock moved',
              `Document ${result.documentNo} completed (${result.docStatus})`,
            );
            reload();
          }}
          onError={(msg) => notifyErrorRef.current('Stock move failed', msg)}
        />
      )}
      {issueRow && (
        <IssueStockDialog
          productId={Number(id)}
          row={issueRow}
          onClose={() => setIssueRow(null)}
          onSuccess={(result) => {
            setIssueRow(null);
            notifySuccessRef.current?.(
              'Stock issued',
              `Document ${result.documentNo} completed (${result.docStatus})`,
            );
            reload();
          }}
          onError={(msg) => notifyErrorRef.current('Issue failed', msg)}
        />
      )}
      {showReceive && (
        <ReceiveStockDialog
          productId={Number(id)}
          onClose={() => setShowReceive(false)}
          onSuccess={(result) => {
            setShowReceive(false);
            notifySuccessRef.current?.(
              'Goods received',
              `Document ${result.documentNo} completed (${result.docStatus})`,
            );
            reload();
          }}
          onError={(msg) => notifyErrorRef.current('Receipt failed', msg)}
        />
      )}
    </div>
  );
}

// ── Read-only field cell ────────────────────────────────────────────────────
function FieldRO({ label, value, link }) {
  const styles = useStyles();
  const v = value == null || value === '' ? '—' : value;
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={link ? styles.fieldLink : styles.fieldValue}>{v}</div>
    </div>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────
function Tile({ label, value, hint }) {
  const styles = useStyles();
  return (
    <div className={styles.stockTile}>
      <span className={styles.stockLabel}>{label}</span>
      <span className={styles.stockNumber}>{Number.isFinite(value) ? formatNum(value) : '—'}</span>
      {hint && <span className={styles.stockLabel} style={{ fontSize: tokens.fontSizeBase100 }}>{hint}</span>}
    </div>
  );
}

// ── Bottom-tab panels ───────────────────────────────────────────────────────
function InventoryPanel({ rows, onAdjust, onMove, onIssue, onReceive }) {
  const styles = useStyles();
  const hasRows = rows && rows.length > 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: tokens.spacingVerticalS }}>
        <Button appearance="primary" size="small" icon={<ArrowDownload20Regular />} onClick={onReceive}>
          {hasRows ? 'Receive' : 'Add stock'}
        </Button>
      </div>
      {!hasRows ? (
        <div className={styles.emptyTab}>
          No inventory records yet. Click <strong>Add stock</strong> to post the first vendor receipt.
        </div>
      ) : (
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Locator</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: 'right' }}>On Hand</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: 'right' }}>Reserved</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: 'right' }}>On Order</TableHeaderCell>
              <TableHeaderCell style={{ width: '1%' }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.m_locator_id_display || `#${r.m_locator_id}`}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>{formatNum(r.qtyonhand)}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>{formatNum(r.qtyreserved)}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>{formatNum(r.qtyordered)}</TableCell>
                <TableCell style={{ whiteSpace: 'nowrap' }}>
                  <Button appearance="subtle" size="small" icon={<EditArrowBack20Regular />} onClick={() => onAdjust?.(r)}>
                    Adjust
                  </Button>
                  <Button appearance="subtle" size="small" icon={<ArrowSwap20Regular />} onClick={() => onMove?.(r)}>
                    Move
                  </Button>
                  <Button appearance="subtle" size="small" icon={<Delete20Regular />} onClick={() => onIssue?.(r)}>
                    Issue
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// Adjust-Stock dialog. Posts a Physical Inventory variance to the BFF,
// which routes it through GridTab + MInventory.processIt so M_Storage,
// M_Transaction, and Fact_Acct stay consistent. The user's input is the
// new on-hand for this locator; the BFF lets the M_InventoryLine callout
// auto-populate QtyBook from current M_Storage.
function AdjustStockDialog({ productId, row, onClose, onSuccess, onError }) {
  const currentQty = Number(row.qtyonhand || 0);
  const [newQty, setNewQty] = useState(String(currentQty));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = Number(newQty);
    if (!Number.isFinite(n)) {
      onError?.('New quantity must be numeric');
      return;
    }
    if (n === currentQty) {
      onError?.('New quantity matches current — nothing to post');
      return;
    }
    setSaving(true);
    try {
      const result = await adjustStock({
        productId,
        locatorId: row.m_locator_id,
        newQty: n,
        description: reason ? `Stock adjustment: ${reason}` : 'Stock adjustment',
      });
      onSuccess?.(result);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Adjustment failed';
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_e, d) => { if (!d.open) onClose?.(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
              <div>
                <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                  Locator
                </div>
                <div>{row.m_locator_id_display || `#${row.m_locator_id}`}</div>
              </div>
              <div>
                <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                  Current on hand
                </div>
                <div>{formatNum(currentQty)}</div>
              </div>
              <Field label="New on-hand quantity" required>
                <Input
                  type="number"
                  value={newQty}
                  onChange={(_e, d) => setNewQty(d.value)}
                  disabled={saving}
                  autoFocus
                />
              </Field>
              <Field label="Reason (optional)" hint="Stored on the inventory document description.">
                <Textarea
                  value={reason}
                  onChange={(_e, d) => setReason(d.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" disabled={saving}>Cancel</Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={submit} disabled={saving}>
              {saving ? 'Posting…' : 'Post adjustment'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function PricesPanel({ rows }) {
  const styles = useStyles();
  if (!rows || rows.length === 0) {
    return <div className={styles.emptyTab}>No prices on file.</div>;
  }
  return (
    <Table size="small">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Price List</TableHeaderCell>
          <TableHeaderCell style={{ textAlign: 'right' }}>List Price</TableHeaderCell>
          <TableHeaderCell style={{ textAlign: 'right' }}>Standard</TableHeaderCell>
          <TableHeaderCell style={{ textAlign: 'right' }}>Limit</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.m_pricelist_version_id_display || `#${r.m_pricelist_version_id}`}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{formatMoney(r.pricelist)}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{formatMoney(r.pricestd)}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{formatMoney(r.pricelimit)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Closest equivalent to the EspoCRM "Orders" tab: stock movements caused by
// shipments, receipts, returns, internal moves. Each M_Transaction row maps
// to a source document line (sales order line, inventory move, etc.) with
// movementtype telling us which kind. Better than fabricating an "orders"
// view that iDempiere doesn't model directly.
function ActivityPanel({ rows }) {
  const styles = useStyles();
  if (!rows || rows.length === 0) {
    return <div className={styles.emptyTab}>No activity recorded for this product.</div>;
  }
  return (
    <Table size="small">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell>Reference</TableHeaderCell>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell style={{ textAlign: 'right' }}>Quantity</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => {
          const qty = Number(r.movementqty || 0);
          const inbound = qty > 0;
          return (
            <TableRow key={r.m_transaction_id || i}>
              <TableCell>
                <Badge appearance="outline" size="small"
                       color={inbound ? 'success' : 'informative'}>
                  {r.movementtype_display || r.movementtype || '—'}
                </Badge>
              </TableCell>
              <TableCell>{r.m_inoutline_id_display || (r.m_inoutline_id ? `Shipment line #${r.m_inoutline_id}` : '—')}</TableCell>
              <TableCell>{formatDate(r.movementdate)}</TableCell>
              <TableCell style={{ textAlign: 'right',
                                  color: inbound ? tokens.colorPaletteGreenForeground1 : tokens.colorPaletteRedForeground1 }}>
                {qty > 0 ? '+' : ''}{formatNum(qty)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Direct BFF read of the M_Product row — used to surface AD columns the
// legacy IdempiereProductService doesn't camelize (Manufacturer / Weight /
// Volume / Classification / DocumentNote). No auth required for the BFF.
async function getProductRowRaw(id) {
  const url = `/erp-api/window/${PRODUCT_WINDOW_ID}/tab/0/row/${id}`;
  const resp = await fetch(url, { credentials: 'omit' });
  if (!resp.ok) return null;
  return resp.json();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function aggregateStock(storageRows) {
  let onHand = 0, reserved = 0, ordered = 0;
  for (const r of storageRows || []) {
    onHand += Number(r.qtyonhand || 0);
    reserved += Number(r.qtyreserved || 0);
    ordered += Number(r.qtyordered || 0);
  }
  return { onHand, reserved, ordered, available: onHand - reserved };
}
function formatNum(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function formatMoney(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMeasure(v, unit) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  return formatNum(n) + ' ' + unit;
}
function formatDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return s; }
}
