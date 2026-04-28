import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  makeStyles, tokens, Text, Spinner, Subtitle1, Subtitle2, Button, Tooltip,
  TabList, Tab,
  Table, TableHeader, TableHeaderCell, TableRow, TableCell, TableBody,
} from '@fluentui/react-components';
import {
  ArrowClockwise20Regular, ChevronLeft20Regular, Building20Regular,
} from '@fluentui/react-icons';
import { listWarehouses, listLocators, getWarehouseStock } from '../../services/erpInventory';
import { useNotification } from '../../components/ErrorNotification';

// Warehouse detail — shows the warehouse identity card, then a Locators tab
// (with on-hand rollup per locator) and a Stock tab (product-by-locator
// breakdown). Read-only — write actions live on the product detail page.

const useStyles = makeStyles({
  page: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalXXL,
    maxWidth: '1100px',
    marginLeft: 'auto', marginRight: 'auto',
  },
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS,
    color: tokens.colorBrandForeground1, cursor: 'pointer',
    fontSize: tokens.fontSizeBase200, marginBottom: tokens.spacingVerticalXS,
  },
  titleRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS,
  },
  title: { fontSize: tokens.fontSizeBase600, fontWeight: tokens.fontWeightSemibold },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: tokens.spacingVerticalM, overflow: 'hidden',
  },
  cardHead: {
    paddingTop: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL, paddingRight: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  cardBody: { padding: tokens.spacingHorizontalL },
  identity: {
    display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalXXL, rowGap: tokens.spacingVerticalM,
  },
  fieldLabel: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: '2px' },
  fieldValue: { fontSize: tokens.fontSizeBase300, color: tokens.colorNeutralForeground1 },
  empty: {
    paddingTop: tokens.spacingVerticalXXL, paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center', color: tokens.colorNeutralForeground3,
  },
});

export default function ErpWarehouseDetail({ idOverride }) {
  const styles = useStyles();
  const params = useParams();
  const { tenant } = params;
  const id = idOverride ?? params.id;
  const navigate = useNavigate();
  const { error: notifyError } = useNotification();

  const [warehouse, setWarehouse] = useState(null);
  const [locators, setLocators] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('locators');

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      listWarehouses(),
      listLocators(id).catch(() => []),
      getWarehouseStock(id).catch(() => []),
    ])
      .then(([whs, locs, st]) => {
        setWarehouse((whs || []).find((w) => String(w.id) === String(id)) || null);
        setLocators(locs || []);
        setStock(st || []);
      })
      .catch((e) => notifyError('Failed to load warehouse', e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [id, notifyError]);

  useEffect(() => { reload(); }, [reload]);

  if (loading && !warehouse) {
    return <div className={styles.page}><div style={{ textAlign: 'center', padding: 64 }}><Spinner /></div></div>;
  }
  if (!warehouse) {
    return <div className={styles.page}><div className={styles.empty}>Warehouse #{id} not found.</div></div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb} onClick={() => navigate(`/${tenant}/erp/warehouse`)}>
        <ChevronLeft20Regular />
        <Text size={200} weight="medium">Warehouses</Text>
      </div>

      <div className={styles.titleRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
          <Building20Regular />
          <Text className={styles.title}>{warehouse.name}</Text>
        </div>
        <Tooltip content="Refresh" relationship="label">
          <Button appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={reload} />
        </Tooltip>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}><Subtitle2>Identity</Subtitle2></div>
        <div className={styles.cardBody}>
          <div className={styles.identity}>
            <div><div className={styles.fieldLabel}>Search Key</div><div className={styles.fieldValue}>{warehouse.value}</div></div>
            <div><div className={styles.fieldLabel}>Name</div><div className={styles.fieldValue}>{warehouse.name}</div></div>
            <div><div className={styles.fieldLabel}>Description</div><div className={styles.fieldValue}>{warehouse.description || '—'}</div></div>
            <div><div className={styles.fieldLabel}>In-Transit warehouse</div><div className={styles.fieldValue}>{warehouse.isInTransit ? 'Yes' : 'No'}</div></div>
          </div>
        </div>
      </div>

      <TabList selectedValue={tab} onTabSelect={(_e, d) => setTab(d.value)}>
        <Tab value="locators">Locators ({locators.length})</Tab>
        <Tab value="stock">Stock ({stock.length})</Tab>
      </TabList>

      <div className={styles.card} style={{ marginTop: tokens.spacingVerticalS }}>
        <div className={styles.cardBody}>
          {tab === 'locators' && (
            locators.length === 0 ? <div className={styles.empty}>No locators configured.</div> : (
              <Table size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Locator</TableHeaderCell>
                    <TableHeaderCell>Aisle</TableHeaderCell>
                    <TableHeaderCell>Bin</TableHeaderCell>
                    <TableHeaderCell>Level</TableHeaderCell>
                    <TableHeaderCell style={{ textAlign: 'right' }}>Products</TableHeaderCell>
                    <TableHeaderCell style={{ textAlign: 'right' }}>Total on hand</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locators.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Text weight="semibold">{l.value || '—'}</Text>
                        {l.isDefault && <Text size={200} style={{ marginLeft: 8, color: tokens.colorNeutralForeground3 }}>(default)</Text>}
                      </TableCell>
                      <TableCell>{l.x}</TableCell>
                      <TableCell>{l.y}</TableCell>
                      <TableCell>{l.z}</TableCell>
                      <TableCell style={{ textAlign: 'right' }}>{l.productCount}</TableCell>
                      <TableCell style={{ textAlign: 'right' }}>{formatNum(l.qtyOnHand)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {tab === 'stock' && (
            stock.length === 0 ? <div className={styles.empty}>No stock on hand in this warehouse.</div> : (
              <Table size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Product</TableHeaderCell>
                    <TableHeaderCell>Search Key</TableHeaderCell>
                    <TableHeaderCell>Locator</TableHeaderCell>
                    <TableHeaderCell style={{ textAlign: 'right' }}>On Hand</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((s, i) => (
                    <TableRow key={`${s.productId}-${s.locatorId}-${i}`}>
                      <TableCell>
                        <Text className={tokens.colorBrandForeground1 ? '' : ''}
                              style={{ color: tokens.colorBrandForeground1, cursor: 'pointer' }}
                              onClick={() => navigate(`/${tenant}/erp/product-simple/${s.productId}`)}>
                          {s.productName}
                        </Text>
                      </TableCell>
                      <TableCell>{s.productValue}</TableCell>
                      <TableCell>{s.locatorValue}</TableCell>
                      <TableCell style={{ textAlign: 'right' }}>{formatNum(s.qtyOnHand)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function formatNum(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
