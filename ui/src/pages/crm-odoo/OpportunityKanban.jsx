// OpportunityKanban — Fluent v9 clone of pages/crm/OpportunityKanban.jsx (MUI).
// 6 stage columns, drag/drop card → updates x_espo_status + probability.
// Per-stage tone (Fluent palette tokens, no hex).

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles, mergeClasses, tokens,
  Body1Stronger, Caption1, Subtitle2, Spinner, MessageBar, Badge,
} from '@fluentui/react-components';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners,
} from '@dnd-kit/core';
import {
  Calendar16Regular, ReOrderDotsVertical16Regular,
} from '@fluentui/react-icons';
import {
  listOpportunities, updateOpportunity,
  OPPORTUNITY_PROBABILITY_MAP,
} from '../../services/crm-via-odoo';

export const PERIODS = [
  { key: '1w',  label: '1 Week',   days: 7   },
  { key: '1m',  label: '1 Month',  days: 30  },
  { key: '3m',  label: '3 Months', days: 90  },
  { key: '6m',  label: '6 Months', days: 180 },
  { key: '1y',  label: '1 Year',   days: 365 },
  { key: '2y',  label: '2 Years',  days: 730 },
  { key: 'all', label: 'Always',   days: null },
];

export const OPPORTUNITY_STAGES = [
  'Prospecting', 'Qualification', 'Proposal',
  'Negotiation', 'Closed Won',    'Closed Lost',
];

// Per-stage tone — uses the project's existing semantic CSS variables
// (defined in styles/theme-light.css + theme-dark.css + per-tenant override
// files). These were carried forward from the Espo MUI source where the
// kanban used theme.palette.<tone>.main / .light. Each tone has a paired
// {bg, text, main} tuple so light/dark/tenant remain coherent.
//
//   Prospecting → info       (Tailwind blue-100/700)
//   Qualification, Proposal → primary    (tenant brand — BTCL: olive)
//   Negotiation → warning    (yellow)
//   Closed Won  → success    (sage green)
//   Closed Lost → danger     (red)
const STAGE_TONE = {
  'Prospecting':   {
    bg:    'var(--color-info-bg)',
    fg:    'var(--color-info-text)',
    main:  'var(--color-info)',
    badge: 'informative',
  },
  'Qualification': {
    bg:    'var(--color-primary-bg)',
    fg:    'var(--color-primary-text)',
    main:  'var(--color-primary)',
    badge: 'brand',
  },
  'Proposal':      {
    bg:    'var(--color-primary-bg)',
    fg:    'var(--color-primary-text)',
    main:  'var(--color-primary)',
    badge: 'brand',
  },
  'Negotiation':   {
    bg:    'var(--color-warning-bg)',
    fg:    'var(--color-warning-text)',
    main:  'var(--color-warning)',
    badge: 'warning',
  },
  'Closed Won':    {
    bg:    'var(--color-success-bg)',
    fg:    'var(--color-success-text)',
    main:  'var(--color-success)',
    badge: 'success',
  },
  'Closed Lost':   {
    bg:    'var(--color-danger-bg)',
    fg:    'var(--color-danger-text)',
    main:  'var(--color-danger)',
    badge: 'danger',
  },
};

// 15% alpha tint of the saturated `main` token, used for the assignee-avatar
// background. Mirrors MUI's `alpha(toneColor, 0.15)` from the Espo source.
const tint15 = (mainVar) => `color-mix(in srgb, ${mainVar} 15%, transparent)`;

const useStyles = makeStyles({
  board: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalS,
    paddingBottom: tokens.spacingVerticalM,
    width: '100%',
  },
  column: {
    flex: '1 1 0',
    minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 260px)',
    borderTop: '1px solid transparent',
    borderRight: '1px solid transparent',
    borderBottom: '1px solid transparent',
    borderLeft: '1px solid transparent',
    transition: 'background-color 120ms, border-color 120ms',
  },
  columnOver: {
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
  },
  colHeader: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalM,
    borderTopLeftRadius: tokens.borderRadiusLarge,
    borderTopRightRadius: tokens.borderRadiusLarge,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalS,
  },
  colHeaderText: { display: 'flex', flexDirection: 'column', minWidth: 0, rowGap: tokens.spacingVerticalXXS },
  colTitle: {
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightBold,
  },
  colSub: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  colBody: {
    overflowY: 'auto',
    flex: 1,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    display: 'flex', flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  /* Card sizing/typography taken verbatim from pages/crm/OpportunityKanban.jsx
     so the cloned Fluent kanban renders pixel-for-pixel like the Espo MUI
     source. Literal px values are intentional here — they are part of the
     spec, not arbitrary numbers. */
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderRadius: tokens.borderRadiusMedium,
    paddingTop: '10px',         // MUI p:1.25 → 10px
    paddingBottom: '10px',
    paddingLeft: '10px',
    paddingRight: '10px',
    cursor: 'grab',
    transition: 'box-shadow 120ms, transform 120ms',
    ':hover': { boxShadow: tokens.shadow8 },
  },
  cardDragging: { boxShadow: tokens.shadow28, opacity: 0.92 },
  cardHeader: {
    display: 'flex', alignItems: 'flex-start',
    columnGap: '2px',           // MUI gap:0.25 → 2px
    marginBottom: '2px',        // MUI mb:0.25
  },
  cardName: {
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
    fontSize: '12.5px',         // source: 12.5
    lineHeight: 1.3,
    flex: 1, minWidth: 0,
    display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
    background: 'none', border: 'none', padding: 0, textAlign: 'left',
    cursor: 'pointer',
    ':hover': { textDecoration: 'underline' },
  },
  cardSub: {
    color: tokens.colorNeutralForeground3,
    fontSize: '10.5px',         // source: 10.5
    marginLeft: '14px',         // MUI ml:1.75
    marginBottom: '4px',        // MUI mb:0.5
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  cardDivider: {
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke3,
    marginTop: '6px',           // MUI my:0.75
    marginBottom: '6px',
  },
  cardMoneyRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    columnGap: '4px',           // MUI gap:0.5
    marginLeft: '2px',          // MUI ml:0.25
  },
  cardMoney: {
    display: 'inline-flex', alignItems: 'center',
    columnGap: '4px',
    minWidth: 0,
  },
  cardMoneySymbol: {
    fontWeight: 700,
    fontSize: '14px',           // source $ icon: fontSize 14
    lineHeight: 1,
  },
  cardMoneyText: {
    fontWeight: 700,
    fontSize: '13px',           // source: fontWeight 700, fontSize 13
    color: tokens.colorNeutralForeground1,
  },
  /* Outlined % pill — `<Chip variant=outlined>` from the source. */
  cardProbChip: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: '18px',             // source: height 18
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: '6px',         // MUI px:0.75
    paddingRight: '6px',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopLeftRadius: tokens.borderRadiusCircular,
    borderTopRightRadius: tokens.borderRadiusCircular,
    borderBottomLeftRadius: tokens.borderRadiusCircular,
    borderBottomRightRadius: tokens.borderRadiusCircular,
    fontSize: '10px',           // source: 10
    fontWeight: 600,
    flexShrink: 0,
  },
  cardFootRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    columnGap: '4px',
    marginTop: '6px',           // MUI mt:0.75
    marginLeft: '2px',
  },
  cardCal: {
    display: 'inline-flex', alignItems: 'center',
    columnGap: '4px',
    color: tokens.colorNeutralForeground3,
    fontSize: '11px',           // source: 11
  },
  cardAvatar: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '22px', height: '22px',
    borderRadius: tokens.borderRadiusCircular,
    fontSize: '10px',
    fontWeight: 700,
    flexShrink: 0,
  },
  /* Count badge in column header — solid tone bg, white text. */
  colCount: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '24px',
    height: '22px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderTopLeftRadius: tokens.borderRadiusCircular,
    borderTopRightRadius: tokens.borderRadiusCircular,
    borderBottomLeftRadius: tokens.borderRadiusCircular,
    borderBottomRightRadius: tokens.borderRadiusCircular,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    flexShrink: 0,
  },
  emptyDrop: {
    borderTop: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRight: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderLeft: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground1Hover,
  },
});

function avatarInitials(name) {
  if (!name) return '?';
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtMoney(v, cur) {
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${cur ? cur + ' ' : ''}${n.toLocaleString()}`;
}

function OppCard({ opp, dragging, onClick }) {
  const styles = useStyles();
  const tone = STAGE_TONE[opp.stage] || STAGE_TONE['Prospecting'];
  return (
    <div
      className={mergeClasses(styles.card, dragging && styles.cardDragging)}
      style={{ borderLeftColor: tone.main }}
    >
      <div className={styles.cardHeader}>
        <ReOrderDotsVertical16Regular style={{
          width: '12px', height: '12px',
          color: tokens.colorNeutralForeground4,
          marginTop: '2px', flexShrink: 0,
        }} />
        <button
          type="button"
          className={styles.cardName}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onClick && onClick(); }}
        >
          {opp.name || '—'}
        </button>
      </div>
      {opp.accountName && <div className={styles.cardSub}>{opp.accountName}</div>}
      <div className={styles.cardDivider} />

      <div className={styles.cardMoneyRow}>
        <span className={styles.cardMoney}>
          <span className={styles.cardMoneySymbol} style={{ color: tone.main }}>$</span>
          <span className={styles.cardMoneyText}>{fmtMoney(opp.amount, opp.amountCurrency)}</span>
        </span>
        {opp.probability != null && (
          <span
            className={styles.cardProbChip}
            style={{
              borderColor: `color-mix(in srgb, ${tone.main} 40%, transparent)`,
              backgroundColor: tone.bg,
              color: tone.main,
            }}
          >
            {opp.probability}%
          </span>
        )}
      </div>

      <div className={styles.cardFootRow}>
        <span className={styles.cardCal}>
          <Calendar16Regular style={{ width: '12px', height: '12px', color: tokens.colorNeutralForeground4 }} />
          <span>{opp.closeDate || '—'}</span>
        </span>
        {opp.assignedUserName && (
          <span
            className={styles.cardAvatar}
            title={opp.assignedUserName}
            style={{
              backgroundColor: tone.bg,
              color: tone.main,
            }}
          >
            {avatarInitials(opp.assignedUserName)}
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ opp, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id, data: { opp } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <OppCard opp={opp} onClick={onClick} />
    </div>
  );
}

function Column({ stage, items, total, onCardClick }) {
  const styles = useStyles();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const tone = STAGE_TONE[stage] || STAGE_TONE['Prospecting'];
  const sum = items.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
  return (
    <div ref={setNodeRef} className={mergeClasses(styles.column, isOver && styles.columnOver)}>
      <div className={styles.colHeader} style={{ backgroundColor: tone.bg }}>
        <div className={styles.colHeaderText}>
          <Subtitle2 className={styles.colTitle} style={{ color: tone.fg }}>{stage}</Subtitle2>
          <Caption1 className={styles.colSub}>
            {sum ? `${sum.toLocaleString()} · ` : ''}{OPPORTUNITY_PROBABILITY_MAP[stage]}%
          </Caption1>
        </div>
        <span
          className={styles.colCount}
          style={{ backgroundColor: tone.main, color: '#fff' }}
        >
          {total}
        </span>
      </div>
      <div className={styles.colBody}>
        {items.map(o => <DraggableCard key={o.id} opp={o} onClick={() => onCardClick(o)} />)}
        {items.length === 0 && <div className={styles.emptyDrop}>Drop here</div>}
      </div>
    </div>
  );
}

const FIELDS_FOR_KANBAN = 'id,name,amount,amountCurrency,accountName,assignedUserName,closeDate,probability,stage';

function buildPeriodWhere(period) {
  const w = [];
  if (period && period.days != null) {
    const d = new Date();
    d.setDate(d.getDate() - period.days);
    w.push({ type: 'after', attribute: 'createdAt', value: d.toISOString().slice(0, 19).replace('T', ' ') });
  }
  return w;
}

function whereToParams(where, startIdx = 0) {
  const p = {};
  where.forEach((c, i) => {
    const idx = startIdx + i;
    p[`where[${idx}][type]`]      = c.type;
    p[`where[${idx}][attribute]`] = c.attribute;
    if (c.value !== undefined) p[`where[${idx}][value]`] = c.value;
  });
  return p;
}

export default function OpportunityKanban({ periodKey = '1y' }) {
  const styles = useStyles();
  const navigate = useNavigate();
  const period = useMemo(() => PERIODS.find(p => p.key === periodKey), [periodKey]);

  const [columns, setColumns] = useState({});
  const [totals,  setTotals]  = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [activeOpp, setActiveOpp] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const periodWhere = buildPeriodWhere(period);
      const fetched = await Promise.all(OPPORTUNITY_STAGES.map(async (stage) => {
        const stageWhere = [{ type: 'equals', attribute: 'stage', value: stage }, ...periodWhere];
        const params = {
          maxSize: 200, select: FIELDS_FOR_KANBAN,
          orderBy: 'createdAt', order: 'desc',
          ...whereToParams(stageWhere),
        };
        const res = await listOpportunities(params);
        return { stage, list: res.list || [], total: res.total ?? 0 };
      }));
      setColumns(Object.fromEntries(fetched.map(f => [f.stage, f.list])));
      setTotals(Object.fromEntries(fetched.map(f => [f.stage, f.total])));
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Load failed');
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const onDragStart = (e) => setActiveOpp(e.active?.data?.current?.opp || null);

  const onDragEnd = async (e) => {
    setActiveOpp(null);
    const { active, over } = e;
    if (!over) return;
    const targetStage = over.id;
    const opp = active.data?.current?.opp;
    if (!opp || opp.stage === targetStage) return;
    const prevStage = opp.stage;
    const newProb = OPPORTUNITY_PROBABILITY_MAP[targetStage] ?? opp.probability;

    setColumns(prev => {
      const src = (prev[prevStage] || []).filter(o => o.id !== opp.id);
      const moved = { ...opp, stage: targetStage, probability: newProb };
      const dst = [moved, ...(prev[targetStage] || [])];
      return { ...prev, [prevStage]: src, [targetStage]: dst };
    });
    setTotals(prev => ({
      ...prev,
      [prevStage]:   Math.max(0, (prev[prevStage]   || 0) - 1),
      [targetStage]: (prev[targetStage] || 0) + 1,
    }));

    try {
      await updateOpportunity(opp.id, { stage: targetStage, probability: newProb });
    } catch (err) {
      setError('Update failed: ' + (err?.response?.data?.message || err.message));
      load();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {error && <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>{error}</MessageBar>}
      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={styles.board}>
          {OPPORTUNITY_STAGES.map(stage => (
            <Column key={stage} stage={stage}
              items={columns[stage] || []} total={totals[stage] || 0}
              onCardClick={(o) => navigate(o.id)} />
          ))}
        </div>
        <DragOverlay>
          {activeOpp ? <div style={{ width: '260px' }}><OppCard opp={activeOpp} dragging /></div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
