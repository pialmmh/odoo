// Generic Fluent v9 entity list — used by Contacts/Accounts/Opportunities/Cases.
//
// Caller supplies:
//   - title: list title (e.g. 'Contacts')
//   - countLabel: ({total}) => string  e.g. '24 contacts total'
//   - statuses?: string[]              optional status enum to render a filter
//   - load: ({ search, statusFilter, page, rowsPerPage }) => Promise<{ list, total }>
//   - columns: [{ key, label, render?(row) }]
//   - onCreate, onEdit(row), onDelete(row)  — handlers wired to dialog/router
//   - rowLabel(row): string  for delete confirmations etc.
//
// Behaviour mirrors the Espo list pattern: search box + optional status filter,
// header strip with create button + refresh + reload, paginated table.

import { useCallback, useEffect, useState } from 'react';
import {
  Body1Stronger, Body1, Subtitle1, Caption1,
  Input, Button, Dropdown, Option, Spinner, MessageBar,
  Tooltip, Toolbar, ToolbarButton, ToolbarDivider,
  Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell,
  Link as FluentLink,
  tokens,
} from '@fluentui/react-components';
import {
  Add20Regular, ArrowSync20Regular, Search20Regular,
  Edit20Regular, Delete20Regular,
} from '@fluentui/react-icons';
import { useListStyles } from './styles';

const PAGE_SIZE = 20;

export default function EntityListPage({
  title, countLabel,
  statuses,                 // optional
  load,
  columns,
  onCreate, onEdit, onDelete,
  rowLabel = (r) => r.name || `#${r.id}`,
  createButtonLabel = 'Create',
}) {
  const styles = useListStyles();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load({ search, statusFilter, page, rowsPerPage: PAGE_SIZE });
      setRows(res.list || []);
      setTotal(res.total ?? (res.list?.length || 0));
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    }
    setLoading(false);
  }, [load, search, statusFilter, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const onDeleteRow = async (row) => {
    if (!confirm(`Delete "${rowLabel(row)}"? This cannot be undone.`)) return;
    try {
      await onDelete(row);
      fetchRows();
    } catch (e) {
      alert('Delete failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Subtitle1>{title}</Subtitle1>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {countLabel ? countLabel({ total }) : `${total} total`}
          </Caption1>
        </div>
        <div className={styles.toolbarRight}>
          <Tooltip content="Refresh" relationship="label">
            <Button appearance="subtle" icon={<ArrowSync20Regular />} onClick={fetchRows} />
          </Tooltip>
          {onCreate && (
            <Button appearance="primary" icon={<Add20Regular />} onClick={onCreate}>
              {createButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {error && <MessageBar intent="error">{error}</MessageBar>}

      <div className={styles.filters}>
        <Input
          contentBefore={<Search20Regular />}
          placeholder={`Search ${title.toLowerCase()}…`}
          value={search}
          onChange={(_, d) => { setSearch(d.value); setPage(0); }}
          style={{ minWidth: '280px' }}
        />
        {statuses && (
          <Dropdown
            placeholder="All Statuses"
            value={statusFilter === 'all' ? 'All Statuses' : statusFilter}
            selectedOptions={[statusFilter]}
            onOptionSelect={(_, d) => { setStatusFilter(d.optionValue || 'all'); setPage(0); }}
            style={{ minWidth: '180px' }}
          >
            <Option value="all">All Statuses</Option>
            {statuses.map(s => <Option key={s} value={s}>{s}</Option>)}
          </Dropdown>
        )}
      </div>

      <div className={styles.card}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}>
            <Spinner />
          </div>
        ) : (
          <Table size="small">
            <TableHeader>
              <TableRow>
                {columns.map(c => <TableHeaderCell key={c.key}>{c.label}</TableHeaderCell>)}
                <TableHeaderCell style={{ width: '110px', textAlign: 'center' }}>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1}>
                    <div className={styles.empty}>No data</div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map(row => (
                <TableRow key={row.id}>
                  {columns.map(c => (
                    <TableCell key={c.key}>
                      {c.render
                        ? c.render(row, { onOpen: () => onEdit?.(row) })
                        : (row[c.key] ?? '—')}
                    </TableCell>
                  ))}
                  <TableCell style={{ textAlign: 'center' }}>
                    {onEdit && (
                      <Tooltip content="Edit" relationship="label">
                        <Button appearance="subtle" size="small" icon={<Edit20Regular />}
                                onClick={(e) => { e.stopPropagation(); onEdit(row); }} />
                      </Tooltip>
                    )}
                    {onDelete && (
                      <Tooltip content="Delete" relationship="label">
                        <Button appearance="subtle" size="small" icon={<Delete20Regular />}
                                onClick={(e) => { e.stopPropagation(); onDeleteRow(row); }} />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', columnGap: tokens.spacingHorizontalM }}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {`${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
          </Caption1>
          <Button appearance="subtle" size="small" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</Button>
          <Button appearance="subtle" size="small" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

/** Helper used by columns: turn a name into a clickable link cell. */
export function NameCell({ children, sub, onClick }) {
  const styles = useListStyles();
  return (
    <div>
      <button className={styles.rowLink} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        {children}
      </button>
      {sub && <div className={styles.rowSubtext}>{sub}</div>}
    </div>
  );
}
