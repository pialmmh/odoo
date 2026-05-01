// Work Package slide-over — form/detail view layout, inline styles (CSS vars don't
// cascade into MUI Drawer portals). Colours match the Fluent UI v9 light-theme palette.

import { useEffect, useState } from 'react';
import {
  Body1, Body1Strong, Body1Stronger, Caption1, Caption1Strong,
  Button, Spinner, Tooltip,
} from '@fluentui/react-components';
import {
  Dismiss20Regular, Edit20Regular, ArrowSync20Regular, Calendar20Regular,
} from '@fluentui/react-icons';
import { Drawer, TextField, LinearProgress, Avatar } from '@mui/material';
import {
  getWorkPackage, getActivities, addComment, listRelations, listChildren,
} from '../../services/openproject';

// ── Fluent UI light-theme palette (inline-safe) ────────────────────────────
const C = {
  bg1:          '#ffffff',
  bg2:          '#f5f5f5',
  bg3:          '#f0f0f0',
  bg4:          '#ebebeb',
  stroke1:      '#d1d1d1',
  stroke2:      '#e0e0e0',
  fg1:          '#242424',
  fg2:          '#424242',
  fg3:          '#616161',
  fg4:          '#9e9e9e',
  brand:        '#0f6cbd',
  brandLight:   '#cce0f4',
  radius:       '8px',
  radiusMd:     '4px',
};

const PANEL_WIDTH = 860;

// ── Section card (matches CRM detail Panel) ────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{
      backgroundColor: C.bg1,
      border: `1px solid ${C.stroke1}`,
      borderRadius: C.radius,
      overflow: 'hidden',
      marginBottom: '12px',
    }}>
      <div style={{
        backgroundColor: C.bg3,
        borderBottom: `1px solid ${C.stroke1}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <Body1Stronger>{title}</Body1Stronger>
      </div>
      <div style={{ padding: '12px 16px' }}>{children}</div>
    </div>
  );
}

// ── Field row (matches CRM detail Field) ──────────────────────────────────
function FieldRow({ label, value, full = false }) {
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: full ? '1fr' : '130px 1fr',
      minHeight: '28px',
      padding: '3px 0',
      alignItems: 'flex-start',
      columnGap: '8px',
    }}>
      <span style={{
        fontSize: '11px', fontWeight: 600,
        color: C.fg3, textTransform: 'uppercase',
        letterSpacing: '0.04em', paddingTop: '2px',
      }}>
        {label}
      </span>
      {!full && (
        <span style={{
          fontSize: '14px',
          color: isEmpty ? C.fg4 : C.fg1,
          display: 'flex', alignItems: 'center',
          gap: '6px', flexWrap: 'wrap',
        }}>
          {isEmpty ? '—' : value}
        </span>
      )}
    </div>
  );
}

// ── Field grid (2-column within a section) ─────────────────────────────────
function FieldGrid({ children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      columnGap: '16px',
    }}>
      {children}
    </div>
  );
}

// ── Field pair (half-width) ────────────────────────────────────────────────
function FieldHalf({ label, value }) {
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <div style={{ padding: '3px 0', minHeight: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: C.fg3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', color: isEmpty ? C.fg4 : C.fg1, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {isEmpty ? '—' : value}
      </div>
    </div>
  );
}

// ── Badges ─────────────────────────────────────────────────────────────────
function TypeBadge({ name, color }) {
  if (!name) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '3px',
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
      backgroundColor: color || '#888', color: '#fff',
      textTransform: 'uppercase', flexShrink: 0,
    }}>
      {name}
    </span>
  );
}

function StatusPill({ title, color }) {
  if (!title) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: '12px',
      fontSize: '12px', fontWeight: 600,
      backgroundColor: color ? `${color}26` : '#e0e0e0',
      color: color ? darken(color) : '#555',
      border: `1px solid ${color ? `${color}66` : '#ccc'}`,
      flexShrink: 0,
    }}>
      {title}
    </span>
  );
}

function AvatarInitials({ name, size = 28 }) {
  if (!name) return null;
  const palette = ['#1976d2','#388e3c','#d32f2f','#7b1fa2','#f57c00','#0097a7'];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Avatar sx={{ width: size, height: size, fontSize: size * 0.38, bgcolor: palette[h % palette.length], flexShrink: 0 }}>
      {initials}
    </Avatar>
  );
}

function darken(hex) {
  if (!hex || hex.length < 7) return '#333';
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.max(0,(n>>16)-60)},${Math.max(0,((n>>8)&0xff)-60)},${Math.max(0,(n&0xff)-60)})`;
}

// ── Tab bar ────────────────────────────────────────────────────────────────
function TabButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'none',
      fontSize: '14px', fontWeight: active ? 600 : 400,
      color: active ? C.brand : C.fg2,
      borderBottom: `2px solid ${active ? C.brand : 'transparent'}`,
      marginBottom: '-1px',
      transition: 'color 0.1s',
    }}>
      {label}
    </button>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function WorkPackageSlideOver({ wpId, statusColorMap, typeColorMap, onClose, onEdit }) {
  const [wp, setWp] = useState(null);
  const [activities, setActivities] = useState([]);
  const [relations, setRelations] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!wpId) { setWp(null); setActivities([]); setRelations([]); setChildren([]); return; }
    setLoading(true);
    Promise.all([
      getWorkPackage(wpId), getActivities(wpId), listRelations(wpId), listChildren(wpId),
    ]).then(([w, a, r, c]) => { setWp(w); setActivities(a); setRelations(r); setChildren(c); })
      .catch(console.error).finally(() => setLoading(false));
  }, [wpId]);

  const refresh = () => {
    if (!wpId) return;
    Promise.all([getWorkPackage(wpId), getActivities(wpId)])
      .then(([w, a]) => { setWp(w); setActivities(a); }).catch(console.error);
  };

  const handleComment = async () => {
    if (!comment.trim() || !wpId) return;
    setPosting(true);
    try { await addComment(wpId, comment.trim()); setComment(''); setActivities(await getActivities(wpId)); }
    catch (e) { console.error(e); }
    setPosting(false);
  };

  const statusColor = wp ? (statusColorMap?.[wp.statusId] || null) : null;
  const typeColor   = wp ? (typeColorMap?.[wp.typeId]   || null) : null;
  const totalRels   = relations.length + children.length;
  const visActs     = activities.filter(a => !!(a.comment?.raw) || (a.details?.length || 0) > 0);

  return (
    <Drawer anchor="right" open={!!wpId} onClose={onClose}
      PaperProps={{ sx: { width: PANEL_WIDTH, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '100vh' } }}>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <Spinner size="large" />
        </div>
      )}

      {!loading && wp && (
        <>
          {/* ── Header ── */}
          <div style={{
            padding: '12px 12px 12px 24px',
            borderBottom: `1px solid ${C.stroke2}`,
            backgroundColor: C.bg2,
            position: 'sticky', top: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {wp.parentTitle && (
              <Caption1 style={{ color: C.fg3 }}>
                Parent:&nbsp;<span style={{ color: C.brand }}>{wp.parentTitle}</span>
              </Caption1>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <TypeBadge name={wp.typeTitle} color={typeColor} />
              <span style={{
                flex: 1, fontSize: '18px', fontWeight: 600, color: C.fg1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
              }}>
                {wp.subject}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 'auto' }}>
                <Tooltip content="Refresh" relationship="label">
                  <Button appearance="subtle" size="small" icon={<ArrowSync20Regular />} onClick={refresh} />
                </Tooltip>
                {onEdit && (
                  <Button appearance="subtle" size="small" icon={<Edit20Regular />} onClick={() => onEdit(wp)}>
                    Edit
                  </Button>
                )}
                <Button appearance="subtle" size="small" icon={<Dismiss20Regular />} onClick={onClose} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <StatusPill title={wp.statusTitle} color={statusColor} />
              <Caption1 style={{ color: C.fg3 }}>
                #{wp.id}{wp.assigneeTitle && ` · ${wp.assigneeTitle}`}
                {wp.updatedAt && ` · Updated ${fmtTime(wp.updatedAt)}`}
              </Caption1>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* Left — detail sections */}
            <div style={{
              width: '55%', overflowY: 'auto',
              padding: 16, paddingBottom: 120,
              backgroundColor: C.bg4,
            }}>

              <Section title="Description">
                {wp.description
                  ? <Body1 style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{wp.description}</Body1>
                  : <Caption1 style={{ color: C.fg4, fontStyle: 'italic' }}>No description — click Edit to add one.</Caption1>
                }
              </Section>

              <Section title="People">
                <FieldGrid>
                  <FieldHalf label="Assignee" value={
                    wp.assigneeTitle
                      ? <><AvatarInitials name={wp.assigneeTitle} size={20} />{wp.assigneeTitle}</>
                      : null
                  } />
                  <FieldHalf label="Accountable" value={
                    wp.responsibleTitle
                      ? <><AvatarInitials name={wp.responsibleTitle} size={20} />{wp.responsibleTitle}</>
                      : null
                  } />
                </FieldGrid>
              </Section>

              <Section title="Estimates and Progress">
                <FieldGrid>
                  <FieldHalf label="Work"      value={wp.estimatedTime || null} />
                  <FieldHalf label="Remaining" value={null} />
                </FieldGrid>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: C.fg3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                    % Complete
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <LinearProgress variant="determinate" value={wp.percentageDone || 0}
                      sx={{ flex: 1, maxWidth: 180, height: 6, borderRadius: 3 }} />
                    <Caption1 style={{ color: C.fg2 }}>{wp.percentageDone ?? 0}%</Caption1>
                  </div>
                </div>
              </Section>

              <Section title="Details">
                <FieldGrid>
                  <FieldHalf label="Priority"   value={wp.priorityTitle} />
                  <FieldHalf label="Version"    value={wp.versionTitle} />
                  <FieldHalf label="Category"   value={wp.categoryTitle} />
                  <FieldHalf label="Start Date" value={
                    wp.startDate
                      ? <><Calendar20Regular style={{ width: 14, height: 14 }} />{fmtDate(wp.startDate)}</>
                      : null
                  } />
                  <FieldHalf label="Finish Date" value={
                    wp.dueDate
                      ? <><Calendar20Regular style={{ width: 14, height: 14 }} />{fmtDate(wp.dueDate)}</>
                      : null
                  } />
                  <FieldHalf label="Project" value={wp.projectTitle} />
                </FieldGrid>
                {wp.parentTitle && (
                  <div style={{ marginTop: 4 }}>
                    <FieldRow label="Parent" value={wp.parentTitle} />
                  </div>
                )}
              </Section>
            </div>

            {/* Right — Activity / Relations */}
            <div style={{
              width: '45%', overflowY: 'auto',
              borderLeft: `1px solid ${C.stroke2}`,
              display: 'flex', flexDirection: 'column',
              backgroundColor: C.bg1,
              paddingBottom: 120,
            }}>

              {/* Tab bar */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 1,
                display: 'flex',
                borderBottom: `1px solid ${C.stroke2}`,
                backgroundColor: C.bg1,
                paddingLeft: 4,
              }}>
                <TabButton label="Activity"
                  active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
                <TabButton label={`Relations${totalRels ? ` (${totalRels})` : ''}`}
                  active={activeTab === 'relations'} onClick={() => setActiveTab('relations')} />
              </div>

              {/* Activity */}
              {activeTab === 'activity' && (
                <div>
                  {visActs.length === 0 && (
                    <Caption1 style={{ padding: 16, color: C.fg4, display: 'block' }}>No activity yet.</Caption1>
                  )}
                  {visActs.map((act, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10,
                      padding: '12px 16px',
                      borderBottom: `1px solid ${C.stroke2}`,
                    }}>
                      <AvatarInitials name={act._links?.user?.title || 'System'} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                          <Body1Strong>{act._links?.user?.title || 'System'}</Body1Strong>
                          <Caption1 style={{ color: C.fg4 }}>
                            {act.createdAt ? fmtActivityTime(act.createdAt) : ''}
                          </Caption1>
                        </div>
                        {act.comment?.raw && (
                          <div style={{
                            marginTop: 6,
                            backgroundColor: C.bg2,
                            borderRadius: C.radiusMd,
                            padding: '6px 10px',
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            color: C.fg1,
                          }}>
                            {act.comment.raw}
                          </div>
                        )}
                        {!act.comment?.raw && act.details?.map((d, di) => (
                          <div key={di} style={{
                            paddingLeft: 10,
                            borderLeft: `2px solid ${C.stroke2}`,
                            marginTop: 3,
                          }}>
                            <Caption1 style={{ color: C.fg2 }}>{d.raw}</Caption1>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Relations */}
              {activeTab === 'relations' && (
                <div>
                  {children.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.fg3, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 16px', backgroundColor: C.bg3, borderBottom: `1px solid ${C.stroke2}` }}>
                        Children ({children.length})
                      </div>
                      {children.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${C.stroke2}`, cursor: 'pointer' }}>
                          <Caption1 style={{ color: C.fg4, minWidth: 28 }}>#{c.id}</Caption1>
                          <Caption1 style={{ flex: 1 }}>{c.subject}</Caption1>
                          {c.statusTitle && <StatusPill title={c.statusTitle} color={statusColorMap?.[c.statusId] || null} />}
                        </div>
                      ))}
                    </>
                  )}
                  {relations.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.fg3, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 16px', backgroundColor: C.bg3, borderBottom: `1px solid ${C.stroke2}` }}>
                        Relations ({relations.length})
                      </div>
                      {relations.map((r, i) => {
                        const linked = r._links?.to || r._links?.from;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${C.stroke2}`, cursor: 'pointer' }}>
                            <span style={{ fontSize: 11, color: C.fg3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 72 }}>
                              {r.relationshipType || 'relates'}
                            </span>
                            <Caption1 style={{ flex: 1 }}>{linked?.title || '—'}</Caption1>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {totalRels === 0 && (
                    <Caption1 style={{ padding: 16, color: C.fg4, display: 'block' }}>No relations.</Caption1>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Composer ── */}
          <div style={{
            position: 'sticky', bottom: 0,
            backgroundColor: C.bg1,
            borderTop: `1px solid ${C.stroke2}`,
            padding: '12px 12px 12px 24px',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            <TextField multiline maxRows={4} placeholder="Comment… (Ctrl+Enter to save)"
              value={comment} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleComment(); } }}
              size="small" fullWidth sx={{ '& .MuiInputBase-root': { fontSize: '13px' } }} />
            <Button appearance="primary" size="small" onClick={handleComment} disabled={posting || !comment.trim()}>
              Save
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}
function fmtTime(d) {
  return d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
function fmtActivityTime(d) {
  return d ? new Date(d).toLocaleString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
