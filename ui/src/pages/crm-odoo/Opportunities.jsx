// Opportunities (Fluent v9, Odoo crm.lead with type='opportunity').
//
// Two views:
//   • Pipeline (kanban) — drag/drop to update stage; default view.
//   • List              — table with stage badge, amount, salesperson, etc.
//
// Toolbar mirrors the Espo source: title + subtitle, period chips
// (1W/1M/3M/6M/1Y/2Y/Always), Pipeline/List toggle, Create button.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles, mergeClasses, tokens,
  Subtitle1, Caption1, Body2, Badge, Button, Input, Tooltip, Spinner, MessageBar,
  Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell,
} from '@fluentui/react-components';
import {
  Add20Regular, ArrowSync20Regular, Search20Regular,
  Edit20Regular, Delete20Regular,
  ContentView20Regular, BoardSplit20Regular,
} from '@fluentui/react-icons';
import OpportunityDialog from './OpportunityDialog';
import OpportunityKanban, { PERIODS } from './OpportunityKanban';
import { useListStyles } from './_shared/styles';
import {
  listOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
} from '../../services/crm-via-odoo';

const STAGE_COLOR = {
  Prospecting: 'subtle', Qualification: 'informative', Proposal: 'brand',
  Negotiation: 'warning', 'Closed Won': 'success', 'Closed Lost': 'subtle',
};

const useToolbarStyles = makeStyles({
  topRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    columnGap: tokens.spacingHorizontalM, rowGap: tokens.spacingVerticalM,
    flexWrap: 'wrap',
  },
  rightSide: {
    display: 'flex', alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  periodGroup: {
    display: 'inline-flex', alignItems: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '999px',
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXXS,
    paddingLeft: tokens.spacingHorizontalXXS,
    paddingRight: tokens.spacingHorizontalXXS,
    columnGap: tokens.spacingHorizontalXXS,
  },
  periodChip: {
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderRadius: '999px',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    ':hover': { color: tokens.colorNeutralForeground1 },
  },
  periodChipActive: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ':hover': { color: tokens.colorNeutralForegroundOnBrand },
  },
  toggleGroup: {
    display: 'inline-flex',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  toggleBtn: {
    display: 'inline-flex', alignItems: 'center', columnGap: tokens.spacingHorizontalXS,
    background: tokens.colorNeutralBackground1,
    border: 'none',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    cursor: 'pointer',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    ':hover': { backgroundColor: tokens.colorNeutralBackground2 },
  },
  toggleBtnActive: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ':hover': { backgroundColor: tokens.colorBrandBackgroundHover },
  },
});

const PAGE_SIZE = 20;

function ListView({ reloadKey, onEdit, onDelete }) {
  const styles = useListStyles();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const navigate = useNavigate();

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: PAGE_SIZE, offset: page * PAGE_SIZE, orderBy: 'createdAt', order: 'desc' };
      if (search.trim()) {
        params['where[0][type]']  = 'textFilter';
        params['where[0][value]'] = search.trim();
      }
      const res = await listOpportunities(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    }
    setLoading(false);
  }, [search, page, reloadKey]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  return (
    <>
      {error && <MessageBar intent="error">{error}</MessageBar>}

      <div className={styles.filters}>
        <Input
          contentBefore={<Search20Regular />}
          placeholder="Search opportunities…"
          value={search}
          onChange={(_, d) => { setSearch(d.value); setPage(0); }}
          style={{ minWidth: '280px' }}
        />
      </div>

      <div className={styles.card}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}><Spinner /></div>
        ) : (
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Stage</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Salesperson</TableHeaderCell>
                <TableHeaderCell>Close Date</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell style={{ width: '110px', textAlign: 'center' }}>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7}><div className={styles.empty}>No data</div></TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <button className={styles.rowLink} onClick={() => navigate(r.id)}>{r.name || '—'}</button>
                    {r.accountName && <div className={styles.rowSubtext}>{r.accountName}</div>}
                  </TableCell>
                  <TableCell>{r.stage
                    ? <Badge appearance="filled" color={STAGE_COLOR[r.stage] || 'subtle'}>{r.stage}</Badge>
                    : '—'}</TableCell>
                  <TableCell>{r.amount != null && r.amount !== 0 ? r.amount.toLocaleString() : '—'}</TableCell>
                  <TableCell>{r.assignedUserName || '—'}</TableCell>
                  <TableCell>{r.closeDate || '—'}</TableCell>
                  <TableCell>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{r.createdAt || '—'}</Caption1>
                  </TableCell>
                  <TableCell style={{ textAlign: 'center' }}>
                    <Tooltip content="Edit" relationship="label">
                      <Button appearance="subtle" size="small" icon={<Edit20Regular />}
                              onClick={(e) => { e.stopPropagation(); onEdit?.(r); }} />
                    </Tooltip>
                    <Tooltip content="Delete" relationship="label">
                      <Button appearance="subtle" size="small" icon={<Delete20Regular />}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Delete opportunity "${r.name}"?`)) return;
                                await onDelete?.(r);
                                fetchRows();
                              }} />
                    </Tooltip>
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
    </>
  );
}

export default function Opportunities() {
  const tb = useToolbarStyles();
  const listStyles = useListStyles();
  const [view, setView] = useState('kanban');
  const [periodKey, setPeriodKey] = useState('1y');
  const [dialog, setDialog] = useState({ open: false, opp: null });
  const [reloadKey, setReloadKey] = useState(0);

  const onSaved = async (vals) => {
    if (dialog.opp?.id) await updateOpportunity(dialog.opp.id, vals);
    else                await createOpportunity(vals);
    setReloadKey(k => k + 1);
  };

  return (
    <div className={listStyles.page}>
      <div className={tb.topRow}>
        <div>
          <Subtitle1>Opportunities</Subtitle1>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {view === 'list' ? 'List' : 'Sales pipeline'}
          </Caption1>
        </div>
        <div className={tb.rightSide}>
          {view === 'kanban' && (
            <div className={tb.periodGroup}>
              {PERIODS.map(p => (
                <button key={p.key} type="button"
                  className={mergeClasses(tb.periodChip, p.key === periodKey && tb.periodChipActive)}
                  onClick={() => setPeriodKey(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className={tb.toggleGroup}>
            <button type="button"
              className={mergeClasses(tb.toggleBtn, view === 'kanban' && tb.toggleBtnActive)}
              onClick={() => setView('kanban')}>
              <BoardSplit20Regular /> Pipeline
            </button>
            <button type="button"
              className={mergeClasses(tb.toggleBtn, view === 'list' && tb.toggleBtnActive)}
              onClick={() => setView('list')}>
              <ContentView20Regular /> List
            </button>
          </div>
          <Button appearance="primary" icon={<Add20Regular />}
            onClick={() => setDialog({ open: true, opp: null })}>
            Create Opportunity
          </Button>
          {view === 'list' && (
            <Tooltip content="Refresh" relationship="label">
              <Button appearance="subtle" icon={<ArrowSync20Regular />}
                onClick={() => setReloadKey(k => k + 1)} />
            </Tooltip>
          )}
        </div>
      </div>

      {view === 'kanban'
        ? <OpportunityKanban periodKey={periodKey} key={reloadKey} />
        : <ListView reloadKey={reloadKey}
            onEdit={(r) => setDialog({ open: true, opp: r })}
            onDelete={(r) => deleteOpportunity(r.id)} />}

      <OpportunityDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, opp: null })}
        opportunity={dialog.opp}
        onSaved={onSaved}
      />
    </div>
  );
}
