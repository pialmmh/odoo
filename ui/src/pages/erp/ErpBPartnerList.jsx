import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  makeStyles, tokens, Text, Input, Button, Spinner, Badge,
  Tooltip, Table, TableHeader, TableHeaderCell, TableRow, TableCell, TableBody,
  Dropdown, Option,
} from '@fluentui/react-components';
import {
  Search20Regular, ArrowClockwise20Regular, Add20Regular,
} from '@fluentui/react-icons';
import { listBPartners } from '../../services/bpartners';
import { useNotification } from '../../components/ErrorNotification';
import { useErpTableStyles } from './components/erpTableStyles';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: tokens.spacingVerticalM,
  },
  headerTitle: { display: 'flex', flexDirection: 'column' },
  headerActions: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  searchRow: { marginBottom: tokens.spacingVerticalM },
  searchInput: { width: '320px' },
  loaderWrap: {
    display: 'flex', justifyContent: 'center',
    paddingTop: tokens.spacingVerticalXXXL,
    paddingBottom: tokens.spacingVerticalXXXL,
  },
  emptyRow: {
    textAlign: 'center',
    paddingTop: tokens.spacingVerticalXXXL,
    paddingBottom: tokens.spacingVerticalXXXL,
    color: tokens.colorNeutralForeground3,
  },
  rowClickable: { cursor: 'pointer' },
  pager: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    color: tokens.colorNeutralForeground2,
  },
  pagerControls: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS },
});

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export default function ErpBPartnerList() {
  const styles = useStyles();
  const tableStyles = useErpTableStyles();
  const navigate = useNavigate();
  const { tenant } = useParams();
  const { error: notifyError } = useNotification();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listBPartners({ search, page, size, sort: 'value', dir: 'asc' });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      notifyError('Failed to load business partners', e?.response?.data?.message || e.message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, page, size, notifyError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (pendingSearch !== search) {
        setSearch(pendingSearch);
        setPage(0);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pendingSearch, search]);

  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = total === 0 ? 0 : page * size + 1;
  const end = Math.min(total, (page + 1) * size);

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Text as="h2" size={500} weight="semibold">Business Partners</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {total} {total === 1 ? 'partner' : 'partners'} total
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Button
            appearance="primary"
            size="small"
            icon={<Add20Regular />}
            onClick={() => navigate(`/${tenant}/erp/bpartner/new`)}
          >
            New Partner
          </Button>
          <Tooltip content="Refresh" relationship="label" withArrow={false}>
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowClockwise20Regular />}
              onClick={load}
            />
          </Tooltip>
        </div>
      </div>

      <div className={styles.searchRow}>
        <Input
          className={styles.searchInput}
          size="small"
          placeholder="Search by key, name, or tax ID"
          value={pendingSearch}
          onChange={(_, data) => setPendingSearch(data.value)}
          contentBefore={<Search20Regular />}
        />
      </div>

      <div>
        {loading && items.length === 0 ? (
          <div className={styles.loaderWrap}><Spinner size="small" /></div>
        ) : (
          <Table size="small" sortable={false}>
            <TableHeader>
              <TableRow className={tableStyles.headerRow}>
                <TableHeaderCell>Search Key</TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Group</TableHeaderCell>
                <TableHeaderCell>Tax ID</TableHeaderCell>
                <TableHeaderCell>Customer</TableHeaderCell>
                <TableHeaderCell>Vendor</TableHeaderCell>
                <TableHeaderCell>Employee</TableHeaderCell>
                <TableHeaderCell>Active</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8}><div className={styles.emptyRow}>No business partners</div></TableCell>
                </TableRow>
              )}
              {items.map((p) => (
                <TableRow
                  key={p.id}
                  className={styles.rowClickable}
                  onClick={() => navigate(`/${tenant}/erp/bpartner/${p.id}`)}
                >
                  <TableCell>{p.value}</TableCell>
                  <TableCell>{p.name}{p.name2 ? ` — ${p.name2}` : ''}</TableCell>
                  <TableCell>{p.groupName || '—'}</TableCell>
                  <TableCell>{p.taxId || '—'}</TableCell>
                  <TableCell>{p.isCustomer ? '✓' : ''}</TableCell>
                  <TableCell>{p.isVendor ? '✓' : ''}</TableCell>
                  <TableCell>{p.isEmployee ? '✓' : ''}</TableCell>
                  <TableCell>
                    {p.isActive
                      ? <Badge appearance="outline" color="success" size="small">Yes</Badge>
                      : <Badge appearance="outline" size="small">No</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className={styles.pager}>
          <Text size={200}>Rows per page:</Text>
          <Dropdown
            size="small"
            value={String(size)}
            selectedOptions={[String(size)]}
            onOptionSelect={(_e, data) => {
              setSize(parseInt(data.optionValue, 10));
              setPage(0);
            }}
            style={{ minWidth: 0, width: 84 }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <Option key={n} value={String(n)} text={String(n)}>{n}</Option>
            ))}
          </Dropdown>
          <Text size={200}>{start}–{end} of {total}</Text>
          <div className={styles.pagerControls}>
            <Button
              appearance="subtle"
              size="small"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <Button
              appearance="subtle"
              size="small"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
