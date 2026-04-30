import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  makeStyles, tokens, Text, Spinner, Subtitle1, Button, Tooltip, Badge, Input, Switch,
  Table, TableHeader, TableHeaderCell, TableRow, TableCell, TableBody,
} from '@fluentui/react-components';
import {
  ArrowClockwise20Regular, Box20Regular, Search20Regular, Add20Regular,
  ChevronLeft20Regular, ChevronRight20Regular,
} from '@fluentui/react-icons';
import { listProducts } from '../../services/erpV2';
import { useNotification } from '../../components/ErrorNotification';

// Product list — slice 1 read-only. Sourced from /api/erp-v2/products,
// which delegates to the active ErpAdapter (today: IdempiereErpAdapter).
//
// Modern filter bar (single text input). Multi-facet search (categories,
// sale_ok-only, etc.) lands in slice 4 — see
// ai-docs/erp-react-clone-design.md §8.5.

const PAGE_SIZE = 50;

const useStyles = makeStyles({
  page: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    maxWidth: '1280px',
    marginLeft: 'auto', marginRight: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalM,
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  filterInput: { flex: 1, maxWidth: '420px' },
  count: { color: tokens.colorNeutralForeground3 },
  loaderWrap: { display: 'flex', justifyContent: 'center', paddingTop: 64, paddingBottom: 64 },
  rowClickable: { cursor: 'pointer' },
  empty: {
    paddingTop: tokens.spacingVerticalXXL, paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center', color: tokens.colorNeutralForeground3,
  },
  numCell: { textAlign: 'right' },
  pager: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalM,
  },
});

export default function ErpV2ProductList() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { tenant } = useParams();
  const { error: notifyError } = useNotification();

  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const debounceRef = useRef();

  const reload = useCallback((opts = {}) => {
    const { qVal = q, pageVal = page, archivedVal = showArchived } = opts;
    setLoading(true);
    listProducts({ q: qVal || undefined, page: pageVal, pageSize: PAGE_SIZE })
      .then((p) => {
        const all = p?.items || [];
        // Server returns active rows only by default. The archived toggle
        // is informational here — slice 4 will add a real `includeArchived`
        // query param. For now we just dim the inactive rows that come back.
        setItems(archivedVal ? all : all.filter((x) => x.isActive));
        setTotal(p?.total || 0);
      })
      .catch((e) => notifyError('Failed to load products', e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [q, page, showArchived, notifyError]);

  // Initial load + page change.
  useEffect(() => { reload({ pageVal: page }); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [page]);

  // Debounced search.
  const onSearchChange = (val) => {
    setQ(val);
    setPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reload({ qVal: val, pageVal: 0 }), 300);
  };

  const fmtPrice = (v) => (v == null ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Box20Regular />
          <Subtitle1>Products</Subtitle1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button appearance="primary" icon={<Add20Regular />}
            onClick={() => navigate(`/${tenant}/erp-v2/products/new`)}>
            New
          </Button>
          <Tooltip content="Refresh" relationship="label">
            <Button appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={() => reload({})} />
          </Tooltip>
        </div>
      </div>

      <div className={styles.filterRow}>
        <Input
          className={styles.filterInput}
          contentBefore={<Search20Regular />}
          placeholder="Search products by name, code, or SKU"
          value={q}
          onChange={(_, data) => onSearchChange(data.value)}
        />
        <Switch label="Show archived" checked={showArchived}
          onChange={(_, d) => { setShowArchived(!!d.checked); reload({ archivedVal: !!d.checked }); }} />
        <Text className={styles.count}>
          {loading ? '' : `${items.length.toLocaleString()} of ${total.toLocaleString()}`}
        </Text>
      </div>

      {loading ? (
        <div className={styles.loaderWrap}><Spinner /></div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>No products match the filter.</div>
      ) : (
        <>
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Internal Ref</TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>UoM</TableHeaderCell>
                <TableHeaderCell className={styles.numCell}>List Price</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} className={styles.rowClickable}
                  onClick={() => navigate(`/${tenant}/erp-v2/products/${p.id}`)}>
                  <TableCell>{p.value || ''}</TableCell>
                  <TableCell><Text weight="semibold">{p.name}</Text></TableCell>
                  <TableCell>{p.productTypeLabel || p.productType || ''}</TableCell>
                  <TableCell>{p.categoryName || ''}</TableCell>
                  <TableCell>{p.uomName || ''}</TableCell>
                  <TableCell className={styles.numCell}>{fmtPrice(p.listPrice)}</TableCell>
                  <TableCell>
                    {p.isActive
                      ? <Badge appearance="outline" size="small" color="success">Active</Badge>
                      : <Badge appearance="outline" size="small" color="subtle">Inactive</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className={styles.pager}>
            <Button appearance="subtle" icon={<ChevronLeft20Regular />}
              disabled={page === 0}
              onClick={() => setPage(Math.max(0, page - 1))}>Prev</Button>
            <Text>{page + 1} / {lastPage + 1}</Text>
            <Button appearance="subtle" icon={<ChevronRight20Regular />} iconPosition="after"
              disabled={page >= lastPage}
              onClick={() => setPage(Math.min(lastPage, page + 1))}>Next</Button>
          </div>
        </>
      )}
    </div>
  );
}
