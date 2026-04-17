import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, Tooltip,
  Link as MuiLink, Avatar, Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon, DragIndicator as DragIcon,
} from '@mui/icons-material';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners,
} from '@dnd-kit/core';
import {
  listOpportunities, updateOpportunity,
  OPPORTUNITY_STAGES, OPPORTUNITY_PROBABILITY_MAP,
} from '../../services/crm';
import PLATFORM from '../../config/platform';

export const PERIODS = [
  { key: '1w',  label: '1 Week',   days: 7 },
  { key: '1m',  label: '1 Month',  days: 30 },
  { key: '3m',  label: '3 Months', days: 90 },
  { key: '6m',  label: '6 Months', days: 180 },
  { key: '1y',  label: '1 Year',   days: 365 },
  { key: '2y',  label: '2 Years',  days: 730 },
  { key: 'all', label: 'Always',   days: null },
];

// Map each stage to a theme palette key so colors adapt to light/dark/tenant.
const STAGE_TONE = {
  'Prospecting':   'info',
  'Qualification': 'primary',
  'Proposal':      'primary',
  'Negotiation':   'warning',
  'Closed Won':    'success',
  'Closed Lost':   'error',
};

const toneColor = (theme, tone) => theme.palette[tone]?.main || theme.palette.primary.main;

const FIELDS = 'id,name,amount,amountCurrency,accountName,assignedUserName,closeDate,probability,stage';

function buildWhere(stage, period) {
  const w = [];
  w.push({ type: 'equals', attribute: 'stage', value: stage });
  if (period && period.days != null) {
    const d = new Date();
    d.setDate(d.getDate() - period.days);
    w.push({ type: 'after', attribute: 'createdAt', value: d.toISOString().replace(/\.\d+Z$/, '') });
  }
  return w;
}

function whereToParams(where) {
  const p = {};
  where.forEach((c, i) => {
    p[`where[${i}][type]`]      = c.type;
    p[`where[${i}][attribute]`] = c.attribute;
    if (c.value !== undefined) p[`where[${i}][value]`] = c.value;
  });
  return p;
}

function fmtMoney(v, cur) {
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${cur ? cur + ' ' : ''}${n.toLocaleString()}`;
}

function Lbl({ children }) {
  return (
    <Typography sx={{ fontSize: 10, letterSpacing: 0.8, fontWeight: 600,
      color: 'text.secondary', textTransform: 'uppercase' }}>{children}</Typography>
  );
}

function OppCard({ opp, dragging }) {
  const tone = STAGE_TONE[opp.stage] || 'primary';
  return (
    <Card sx={(theme) => ({
      p: 1.25, mb: 1, cursor: 'grab',
      borderLeft: 3,
      borderLeftColor: toneColor(theme, tone),
      bgcolor: 'background.paper',
      boxShadow: dragging ? 6 : 0,
      border: `1px solid ${theme.palette.divider}`,
      borderLeftWidth: 3,
      transition: 'box-shadow 120ms, transform 120ms, border-color 120ms',
      '&:hover': {
        boxShadow: 3,
        borderColor: alpha(toneColor(theme, tone), 0.4),
        borderLeftColor: toneColor(theme, tone),
      },
    })}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25, mb: 0.25 }}>
        <DragIcon sx={{ fontSize: 12, color: 'text.disabled', mt: '2px', flexShrink: 0 }} />
        <MuiLink component={RouterLink} to={opp.id} underline="hover"
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          sx={{
            fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0,
            color: 'text.primary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.3,
            wordBreak: 'break-word',
          }}>
          {opp.name || '—'}
        </MuiLink>
      </Box>
      {opp.accountName && (
        <Typography variant="caption" color="text.secondary"
          sx={{
            display: 'block', ml: 1.75, mb: 0.5, fontSize: 10.5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
          {opp.accountName}
        </Typography>
      )}
      <Divider sx={{ my: 0.75 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ml: 0.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <MoneyIcon sx={(theme) => ({ fontSize: 14, color: toneColor(theme, tone) })} />
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
            {fmtMoney(opp.amount, opp.amountCurrency)}
          </Typography>
        </Box>
        {opp.probability != null && (
          <Chip size="small" variant="outlined"
            label={`${opp.probability}%`}
            sx={(theme) => ({
              height: 18, fontSize: 10, fontWeight: 600,
              borderColor: alpha(toneColor(theme, tone), 0.4),
              color: toneColor(theme, tone),
              '& .MuiChip-label': { px: 0.75 },
            })} />
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75, ml: 0.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CalendarIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            {opp.closeDate || '—'}
          </Typography>
        </Box>
        {opp.assignedUserName && (
          <Tooltip title={opp.assignedUserName}>
            <Avatar sx={(theme) => ({
              width: 22, height: 22, fontSize: 10, fontWeight: 700,
              bgcolor: alpha(toneColor(theme, tone), 0.15),
              color: toneColor(theme, tone),
            })}>
              {opp.assignedUserName.slice(0, 2).toUpperCase()}
            </Avatar>
          </Tooltip>
        )}
      </Box>
    </Card>
  );
}

function DraggableCard({ opp }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id, data: { opp } });
  return (
    <Box ref={setNodeRef} {...listeners} {...attributes}
      sx={{ opacity: isDragging ? 0.4 : 1 }}>
      <OppCard opp={opp} />
    </Box>
  );
}

function Column({ stage, items, total }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const tone = STAGE_TONE[stage] || 'primary';
  const sum = items.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
  return (
    <Box ref={setNodeRef} sx={(theme) => ({
      flex: '1 1 0', minWidth: 0,
      bgcolor: isOver
        ? alpha(toneColor(theme, tone), theme.palette.mode === 'dark' ? 0.12 : 0.06)
        : alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.025),
      border: `1px solid ${isOver ? alpha(toneColor(theme, tone), 0.4) : 'transparent'}`,
      borderRadius: 2,
      display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 260px)',
      transition: 'background 140ms, border-color 140ms',
    })}>
      <Box sx={(theme) => ({
        px: 1.25, py: 1,
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        bgcolor: alpha(toneColor(theme, tone), theme.palette.mode === 'dark' ? 0.22 : 0.14),
        borderBottom: `1px solid ${alpha(toneColor(theme, tone), 0.25)}`,
      })}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={(theme) => ({
            fontWeight: 700, fontSize: 12, letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: toneColor(theme, tone),
          })}>
            {stage}
          </Typography>
          <Typography variant="caption" sx={{
            fontSize: 11,
            color: 'text.secondary',
          }}>
            {sum ? `${sum.toLocaleString()} · ` : ''}{OPPORTUNITY_PROBABILITY_MAP[stage]}%
          </Typography>
        </Box>
        <Chip size="small" label={total}
          sx={(theme) => ({
            height: 22, minWidth: 32, fontWeight: 700, fontSize: 11,
            bgcolor: toneColor(theme, tone),
            color: theme.palette.getContrastText(toneColor(theme, tone)),
            '& .MuiChip-label': { px: 1 },
          })} />
      </Box>
      <Box sx={(theme) => ({
        overflowY: 'auto', flex: 1, p: 1,
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: alpha(theme.palette.text.primary, 0.15),
          borderRadius: 4,
        },
      })}>
        {items.map(o => <DraggableCard key={o.id} opp={o} />)}
        {items.length === 0 && (
          <Box sx={(theme) => ({
            textAlign: 'center', py: 4, px: 1,
            border: `1px dashed ${theme.palette.divider}`,
            borderRadius: 1, mt: 1,
          })}>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
              Drop here
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function OpportunityKanban({ periodKey = '3m' }) {
  const period = useMemo(() => PERIODS.find(p => p.key === periodKey), [periodKey]);
  const [columns, setColumns]   = useState({});
  const [totals, setTotals]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeOpp, setActiveOpp] = useState(null);
  const maxPerColumn = PLATFORM.crmKanban?.maxPerColumn ?? 100000;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const counts = await Promise.all(OPPORTUNITY_STAGES.map(async (stage) => {
        const params = { maxSize: 1, select: 'id', ...whereToParams(buildWhere(stage, period)) };
        const res = await listOpportunities(params);
        return { stage, total: res.total ?? 0 };
      }));
      const over = counts.filter(c => c.total > maxPerColumn);
      if (over.length > 0) {
        const msg = over.map(c => `${c.stage}: ${c.total.toLocaleString()}`).join(', ');
        setError(`Too many records for the selected period (limit ${maxPerColumn.toLocaleString()} per column). Narrow the period. Columns over limit — ${msg}`);
        setColumns({});
        setTotals(Object.fromEntries(counts.map(c => [c.stage, c.total])));
        setLoading(false);
        return;
      }
      const fetched = await Promise.all(counts.map(async ({ stage, total }) => {
        if (total === 0) return { stage, list: [] };
        const params = {
          maxSize: total, select: FIELDS,
          orderBy: 'createdAt', order: 'desc',
          ...whereToParams(buildWhere(stage, period)),
        };
        const res = await listOpportunities(params);
        return { stage, list: res.list || [] };
      }));
      setColumns(Object.fromEntries(fetched.map(f => [f.stage, f.list])));
      setTotals(Object.fromEntries(counts.map(c => [c.stage, c.total])));
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Load failed');
    }
    setLoading(false);
  }, [period, maxPerColumn]);

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
    // optimistic update
    setColumns(prev => {
      const src = (prev[prevStage] || []).filter(o => o.id !== opp.id);
      const moved = { ...opp, stage: targetStage, probability: newProb };
      const dst = [moved, ...(prev[targetStage] || [])];
      return { ...prev, [prevStage]: src, [targetStage]: dst };
    });
    setTotals(prev => ({
      ...prev,
      [prevStage]: Math.max(0, (prev[prevStage] || 0) - 1),
      [targetStage]: (prev[targetStage] || 0) + 1,
    }));
    try {
      await updateOpportunity(opp.id, { stage: targetStage, probability: newProb });
    } catch (err) {
      setError('Update failed: ' + (err?.response?.data?.message || err.message));
      load();
    }
  };

  return (
    <Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <Box sx={{ display: 'flex', gap: 1, pb: 1, width: '100%' }}>
            {OPPORTUNITY_STAGES.map(stage => (
              <Column key={stage} stage={stage}
                items={columns[stage] || []} total={totals[stage] || 0} />
            ))}
          </Box>
          <DragOverlay>
            {activeOpp ? <Box sx={{ width: 260 }}><OppCard opp={activeOpp} dragging /></Box> : null}
          </DragOverlay>
        </DndContext>
      )}
    </Box>
  );
}
