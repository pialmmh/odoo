// Work Packages list page — tree view with expand/collapse (MS Project style).
// Fetches all WPs for the project (up to 500), builds parent-child tree client-side,
// flattens with depth info, renders indented rows with chevron toggles.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  makeStyles, tokens, mergeClasses,
  Caption1, Subtitle1,
  Input, Button, Dropdown, Option, Spinner, MessageBar,
  Tooltip,
  Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell,
} from '@fluentui/react-components';
import {
  Add20Regular, ArrowSync20Regular, Search20Regular,
  ArrowSortDown20Regular, ArrowSortUp20Regular,
  ChevronRight20Regular, ChevronDown20Regular,
  SubtractSquare20Regular, AddSquare20Regular,
} from '@fluentui/react-icons';
import { Chip } from '@mui/material';
import {
  listWorkPackages, listProjects, listStatuses, listAllTypes,
} from '../../services/openproject';
import WorkPackageSlideOver from './WorkPackageSlideOver';
import WorkPackageDialog from './WorkPackageDialog';
import { useListStyles } from '../crm-odoo/_shared/styles';

const TREE_PAGE_SIZE = 500; // load all for tree building

const usePmStyles = makeStyles({
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: '1 1 280px',
    minWidth: '200px',
    maxWidth: '400px',
  },
  chipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
  sortable: {
    cursor: 'pointer',
    userSelect: 'none',
    '&:hover': { backgroundColor: tokens.colorNeutralBackground2 },
  },
  idCell: {
    width: '60px',
    flexShrink: 0,
  },
  subjectCell: {
    fontWeight: tokens.fontWeightSemibold,
    cursor: 'pointer',
    color: tokens.colorBrandForeground1,
    background: 'none',
    border: 'none',
    padding: 0,
    textAlign: 'left',
    ':hover': { textDecoration: 'underline' },
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 2px',
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: tokens.borderRadiusSmall,
    ':hover': { color: tokens.colorNeutralForeground1, backgroundColor: tokens.colorNeutralBackground2 },
  },
});

// ── Status pill ────────────────────────────────────────────────────────────────
function StatusPill({ title, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: '12px',
      fontSize: '11px', fontWeight: 600,
      backgroundColor: color ? `${color}26` : '#e0e0e0',
      color: color ? darken(color) : '#444',
      border: `1px solid ${color ? `${color}66` : '#ccc'}`,
      whiteSpace: 'nowrap',
    }}>
      {title}
    </span>
  );
}

function darken(hex) {
  if (!hex || hex.length < 7) return '#333';
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.max(0,(n>>16)-60)},${Math.max(0,((n>>8)&0xff)-60)},${Math.max(0,(n&0xff)-60)})`;
}

// ── Tree helpers ───────────────────────────────────────────────────────────────

function buildFlatTree(rows, expandedIds) {
  const rowIds = new Set(rows.map(r => r.id));
  const childrenMap = new Map(); // parentId → child[]

  for (const row of rows) {
    const pid = row.parentId && rowIds.has(row.parentId) ? row.parentId : null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(row);
  }

  const result = [];

  function walk(parentId, depth) {
    for (const row of childrenMap.get(parentId) || []) {
      const children = childrenMap.get(row.id) || [];
      const hasChildren = children.length > 0;
      result.push({ ...row, depth, hasChildren });
      if (hasChildren && expandedIds.has(row.id)) {
        walk(row.id, depth + 1);
      }
    }
  }

  walk(null, 0);
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkPackages() {
  const sharedStyles = useListStyles();
  const pmStyles = usePmStyles();
  const [searchParams, setSearchParams] = useSearchParams();

  // data
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [types, setTypes] = useState([]);
  const [projects, setProjects] = useState([]);

  const statusColorMap = useMemo(() =>
    Object.fromEntries(statuses.map(s => [s.id, s.color])), [statuses]);
  const typeColorMap = useMemo(() =>
    Object.fromEntries(types.map(t => [t.id, t.color])), [types]);

  // filters
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState(null);
  const [activeStatusIds, setActiveStatusIds] = useState([]);
  const [sortBy, setSortBy] = useState([['id', 'asc']]);
  const [sortDir, setSortDir] = useState({ field: 'id', dir: 'asc' });

  // tree expand state
  const [expandedIds, setExpandedIds] = useState(new Set());

  // dialog / slide-over
  const wpIdParam = searchParams.get('wp');
  const [dialogState, setDialogState] = useState({ open: false, wp: null });

  // Bootstrap
  useEffect(() => {
    Promise.all([listProjects(), listStatuses(), listAllTypes()])
      .then(([{ list: prj }, sts, tps]) => {
        setProjects(prj);
        setStatuses(sts);
        setTypes(tps);
        if (!projectId && prj.length > 0) setProjectId(prj[0].id);
      })
      .catch(e => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch — always load all for tree building
  const fetchRows = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const statusId = activeStatusIds.length === 1 ? activeStatusIds[0] : null;
      const res = await listWorkPackages(projectId, {
        search, statusId,
        page: 1, pageSize: TREE_PAGE_SIZE,
        sortBy,
      });
      const enriched = res.list.map(wp => ({
        ...wp,
        statusColor: statusColorMap[wp.statusId] || null,
      }));
      setRows(enriched);
      setTotal(res.total);
      setError(null);

      // Auto-expand all nodes that have children in this result set
      const idSet = new Set(enriched.map(r => r.id));
      const parentIds = new Set(
        enriched.filter(r => r.parentId && idSet.has(r.parentId)).map(r => r.parentId)
      );
      setExpandedIds(parentIds);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    }
    setLoading(false);
  }, [projectId, search, activeStatusIds, sortBy, statusColorMap]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Tree rows (memoised, re-computed when expandedIds or rows change)
  const treeRows = useMemo(() => buildFlatTree(rows, expandedIds), [rows, expandedIds]);

  // Sort toggle
  const handleSort = (field) => {
    setSortDir(prev => {
      const next = prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc';
      setSortBy([[field, next]]);
      return { field, dir: next };
    });
  };
  const SortIcon = ({ field }) => {
    if (sortDir.field !== field) return null;
    return sortDir.dir === 'asc' ? <ArrowSortUp20Regular /> : <ArrowSortDown20Regular />;
  };

  // Status chip toggle
  const toggleStatus = (id) => {
    setActiveStatusIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id]);
  };

  // Expand / collapse
  const toggleExpand = useCallback((id, e) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => {
    const ids = new Set(treeRows.filter(r => r.hasChildren).map(r => r.id));
    setExpandedIds(ids);
  };
  const collapseAll = () => setExpandedIds(new Set());

  // Slide-over
  const openSlideOver  = (id) => setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('wp', id); return p; });
  const closeSlideOver = ()   => setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('wp'); return p; });

  const hasAnyChildren = treeRows.some(r => r.hasChildren);

  return (
    <div className={sharedStyles.page}>

      {/* Title bar */}
      <div className={sharedStyles.toolbar}>
        <div className={sharedStyles.toolbarLeft}>
          <Subtitle1>Work Packages</Subtitle1>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {total} {total === 1 ? 'item' : 'items'}
          </Caption1>
        </div>
        <div className={sharedStyles.toolbarRight}>
          {projects.length > 1 && (
            <Dropdown
              placeholder="Project"
              value={projects.find(p => p.id === projectId)?.name || ''}
              selectedOptions={projectId ? [String(projectId)] : []}
              onOptionSelect={(_, d) => { setProjectId(Number(d.optionValue)); }}
              style={{ minWidth: '160px' }}
            >
              {projects.map(p => <Option key={p.id} value={String(p.id)}>{p.name}</Option>)}
            </Dropdown>
          )}
          {hasAnyChildren && (
            <>
              <Tooltip content="Expand all" relationship="label">
                <Button appearance="subtle" size="small" icon={<AddSquare20Regular />} onClick={expandAll} />
              </Tooltip>
              <Tooltip content="Collapse all" relationship="label">
                <Button appearance="subtle" size="small" icon={<SubtractSquare20Regular />} onClick={collapseAll} />
              </Tooltip>
            </>
          )}
          <Tooltip content="Refresh" relationship="label">
            <Button appearance="subtle" icon={<ArrowSync20Regular />} onClick={fetchRows} />
          </Tooltip>
          <Button appearance="primary" icon={<Add20Regular />}
            onClick={() => setDialogState({ open: true, wp: null })}>
            New
          </Button>
        </div>
      </div>

      {error && <MessageBar intent="error">{error}</MessageBar>}

      {/* Search */}
      <div className={pmStyles.filterRow}>
        <Input
          className={pmStyles.searchInput}
          contentBefore={<Search20Regular />}
          placeholder="Search work packages…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
        />
      </div>

      {/* Status chips */}
      {statuses.length > 0 && (
        <div className={pmStyles.chipRow}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}>Status:</Caption1>
          {statuses.map(s => {
            const active = activeStatusIds.includes(s.id);
            return (
              <Chip key={s.id} label={s.name} size="small"
                variant={active ? 'filled' : 'outlined'}
                onClick={() => toggleStatus(s.id)}
                sx={{
                  fontSize: '11px',
                  backgroundColor: active ? `${s.color}33` : undefined,
                  borderColor: active ? s.color : undefined,
                  color: active ? darken(s.color) : undefined,
                  fontWeight: active ? 600 : 400,
                }}
              />
            );
          })}
          {activeStatusIds.length > 0 && (
            <Caption1 style={{ cursor: 'pointer', color: tokens.colorBrandForeground1 }}
              onClick={() => setActiveStatusIds([])}>
              Clear
            </Caption1>
          )}
        </div>
      )}

      {/* Table */}
      <div className={sharedStyles.card}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}>
            <Spinner />
          </div>
        ) : (
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell className={mergeClasses(pmStyles.sortable, pmStyles.idCell)}
                  onClick={() => handleSort('id')}>
                  # <SortIcon field="id" />
                </TableHeaderCell>
                <TableHeaderCell className={pmStyles.sortable} onClick={() => handleSort('subject')}>
                  Subject <SortIcon field="subject" />
                </TableHeaderCell>
                <TableHeaderCell className={pmStyles.sortable} onClick={() => handleSort('status')}>
                  Status <SortIcon field="status" />
                </TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell className={pmStyles.sortable} onClick={() => handleSort('assignee')}>
                  Assignee <SortIcon field="assignee" />
                </TableHeaderCell>
                <TableHeaderCell className={pmStyles.sortable} onClick={() => handleSort('dueDate')}>
                  Due <SortIcon field="dueDate" />
                </TableHeaderCell>
                <TableHeaderCell style={{ width: '56px', textAlign: 'center' }}>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treeRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className={sharedStyles.empty}>
                      {search || activeStatusIds.length
                        ? 'No work packages match the current filters.'
                        : 'No work packages yet. Create one to get started.'}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {treeRows.map(row => (
                <TableRow
                  key={row.id}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: row.depth > 0 ? `rgba(0,0,0,${row.depth * 0.018})` : undefined,
                  }}
                  onClick={() => openSlideOver(row.id)}
                >
                  {/* # */}
                  <TableCell className={pmStyles.idCell}>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>#{row.id}</Caption1>
                  </TableCell>

                  {/* Subject — indented with expand toggle */}
                  <TableCell>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: `${row.depth * 20}px`,
                      gap: '2px',
                      minWidth: 0,
                    }}>
                      {row.hasChildren ? (
                        <button
                          className={pmStyles.expandBtn}
                          onClick={(e) => toggleExpand(row.id, e)}
                          title={expandedIds.has(row.id) ? 'Collapse' : 'Expand'}
                        >
                          {expandedIds.has(row.id)
                            ? <ChevronDown20Regular style={{ width: 14, height: 14 }} />
                            : <ChevronRight20Regular style={{ width: 14, height: 14 }} />
                          }
                        </button>
                      ) : (
                        // Leaf node — align with parent subjects
                        <span style={{ width: 18, display: 'inline-block', flexShrink: 0 }} />
                      )}
                      <button
                        className={pmStyles.subjectCell}
                        onClick={(e) => { e.stopPropagation(); openSlideOver(row.id); }}
                      >
                        {row.subject}
                      </button>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {row.statusTitle
                      ? <StatusPill title={row.statusTitle} color={row.statusColor} />
                      : <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>—</Caption1>}
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{row.typeTitle || '—'}</Caption1>
                  </TableCell>

                  {/* Assignee */}
                  <TableCell>
                    <Caption1 style={{ color: row.assigneeTitle ? undefined : tokens.colorNeutralForeground4 }}>
                      {row.assigneeTitle || '—'}
                    </Caption1>
                  </TableCell>

                  {/* Due */}
                  <TableCell>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {row.dueDate ? fmtDate(row.dueDate) : '—'}
                    </Caption1>
                  </TableCell>

                  {/* Actions */}
                  <TableCell style={{ textAlign: 'center' }}>
                    <Button appearance="subtle" size="small"
                      onClick={(e) => { e.stopPropagation(); setDialogState({ open: true, wp: row }); }}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Note when result is capped */}
      {total > TREE_PAGE_SIZE && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, textAlign: 'right' }}>
          Showing first {TREE_PAGE_SIZE} of {total} items.
        </Caption1>
      )}

      {/* Slide-over */}
      <WorkPackageSlideOver
        wpId={wpIdParam ? Number(wpIdParam) : null}
        statusColorMap={statusColorMap}
        typeColorMap={typeColorMap}
        onClose={closeSlideOver}
        onEdit={(row) => { closeSlideOver(); setDialogState({ open: true, wp: row }); }}
      />

      {/* Create / Edit dialog */}
      <WorkPackageDialog
        open={dialogState.open}
        projectId={projectId}
        wp={dialogState.wp}
        onClose={() => setDialogState({ open: false, wp: null })}
        onSaved={() => { setDialogState({ open: false, wp: null }); fetchRows(); }}
      />
    </div>
  );
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}
