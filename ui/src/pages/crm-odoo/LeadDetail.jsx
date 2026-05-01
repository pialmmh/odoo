// LeadDetail — Fluent UI v9 clone of pages/crm/LeadDetail.jsx (which is MUI).
// Per `.claude/skills/fluent-ui-forms` and ai-docs/erp-react-clone-design.md:
// new work goes through Fluent v9 + 12-col grid + tokens, never raw px / hex.
//
// Layout mirrors the original:
//   - Header card (icon + breadcrumb + title + subtitle)
//   - Action bar (Edit + kebab on left; prev/next + Follow + Convert on right)
//   - 12-col grid: span 8 main / span 4 side at >=1024px; collapses to 12 below.
//   - Main panels: Overview, Details, Stream (stub).
//   - Side panels: Overview (audit), Converted To, Activities/History/Tasks (stubs).

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles, mergeClasses, tokens,
  Body1, Body1Stronger, Caption1, Subtitle1, Subtitle2,
  Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger,
  Badge, Spinner, MessageBar, Link as FluentLink,
} from '@fluentui/react-components';
import {
  Edit20Regular, Delete20Regular, MoreHorizontal20Regular,
  ChevronLeft20Regular, ChevronRight20Regular,
  Rss20Regular, Copy20Regular,
  PersonAdd24Regular,
  Person20Regular, Mail20Regular, Phone20Regular,
  Building20Regular, Globe20Regular, Location20Regular,
  Mail20Filled, Calendar20Regular, CallAdd20Regular, Add20Regular,
} from '@fluentui/react-icons';
import { getLead, deleteLead, LEAD_NOT_ACTUAL_STATUSES } from '../../services/crm-via-odoo';
import LeadDialog from './LeadDialog';

// ────────────────────────────── styles
const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },

  // Top header card (icon + breadcrumb + title + subtitle)
  headerCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalL,
  },
  headerIcon: {
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  breadcrumb: { color: tokens.colorBrandForeground1 },

  // Toolbar / action bar
  actionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalL,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  btnGroup: { display: 'inline-flex', alignItems: 'center', columnGap: tokens.spacingHorizontalS },

  // 2-col content grid (12-col base; main span 8, side span 4)
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalL,
  },
  mainCol: { gridColumn: 'span 8',
             '@media (max-width: 1023px)': { gridColumn: 'span 12' } },
  sideCol: { gridColumn: 'span 4',
             '@media (max-width: 1023px)': { gridColumn: 'span 12' } },

  // Panel = white card with header band
  panel: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflow: 'hidden',
    marginBottom: tokens.spacingVerticalL,
  },
  panelHeader: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelBody: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  panelHeaderConverted: {
    borderTop: `2px solid ${tokens.colorPaletteGreenBorderActive}`,
  },

  // Field row inside panels
  // 12-col grid, fields take span 6 in main panels (2-up); span 12 in dense side panels.
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalM,
  },
  fieldHalf: { gridColumn: 'span 6',
               '@media (max-width: 639px)': { gridColumn: 'span 12' } },
  fieldFull: { gridColumn: 'span 12' },
  field: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.04em',
  },
  fieldValue: {
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    marginTop: tokens.spacingVerticalXS,
    overflowWrap: 'anywhere',
  },
  fieldEmpty: { color: tokens.colorNeutralForeground4 },

  // Stream stub (composer + entries)
  streamComposer: {
    width: '100%',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  streamList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
    marginTop: tokens.spacingVerticalL,
  },
  streamEntry: { display: 'flex', columnGap: tokens.spacingHorizontalM },
  streamAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  streamBody: { display: 'flex', flexDirection: 'column', rowGap: tokens.spacingVerticalXXS },
  streamMeta: { color: tokens.colorNeutralForeground3 },

  // Side panel "no data" empty state
  emptySide: {
    color: tokens.colorNeutralForeground4,
    fontStyle: 'italic',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
  },

  // Status badge container (Fluent badge can't take arbitrary bgcolor easily, so we wrap)
  statusBadge: { display: 'inline-flex' },
});

// ────────────────────────────── small helpers
function statusAppearance(status) {
  switch (status) {
    case 'Converted':  return { color: 'success' };
    case 'Assigned':   return { color: 'warning' };
    case 'In Process': return { color: 'brand' };
    case 'Recycled':   return { color: 'informative' };
    case 'Dead':       return { color: 'subtle' };
    default:           return { color: 'subtle' };
  }
}

function formatAddress(l) {
  const parts = [l.addressStreet, l.addressCity, l.addressState, l.addressCountry, l.addressPostalCode];
  return parts.filter(Boolean).join(', ');
}

function formatAudit(ts, who) {
  if (!ts) return '';
  return who ? `${ts} · ${who}` : ts;
}

function avatarLetter(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// ────────────────────────────── small components
function Field({ label, icon, value, multiline, half = true, classes }) {
  const empty = value === null || value === undefined || value === '' ||
                (typeof value === 'string' && !value.trim());
  return (
    <div className={half ? classes.fieldHalf : classes.fieldFull}>
      <div className={classes.field}>
        <div className={classes.fieldLabel}>
          {icon}<span>{label}</span>
        </div>
        <div className={mergeClasses(classes.fieldValue, empty && classes.fieldEmpty)}>
          {empty ? 'None' : value}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, headerExtra, headerVariant, children, classes }) {
  return (
    <div className={classes.panel}>
      <div className={mergeClasses(classes.panelHeader, headerVariant === 'converted' && classes.panelHeaderConverted)}>
        <Body1Stronger>{title}</Body1Stronger>
        {headerExtra}
      </div>
      <div className={classes.panelBody}>{children}</div>
    </div>
  );
}

// ────────────────────────────── page
export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = location.pathname.replace(/\/\d+(\/edit)?$/, '');
  const styles = useStyles();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLead(await getLead(id));
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load lead');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirm(`Delete lead "${lead?.name}"? This cannot be undone.`)) return;
    try {
      await deleteLead(id);
      navigate(listPath);
    } catch (e) {
      alert('Delete failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}>
        <Spinner />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <MessageBar intent="error">{error || 'Lead not found'}</MessageBar>
    );
  }

  const isConvertable = lead.status && !LEAD_NOT_ACTUAL_STATUSES.includes(lead.status);
  const hasConvertedTo = lead.createdAccountId || lead.createdContactId || lead.createdOpportunityId
    || lead.status === 'Converted';
  const subtitle = lead.title
    ? `${lead.title}${lead.accountName ? ` · ${lead.accountName}` : ''}`
    : (lead.accountName || '');
  const stat = statusAppearance(lead.status);

  return (
    <div className={styles.page}>
      {/* Header card */}
      <div className={styles.headerCard}>
        <div className={styles.headerIcon}>
          <PersonAdd24Regular />
        </div>
        <div className={styles.headerText}>
          <Caption1>
            <FluentLink as="button" onClick={() => navigate(listPath)} className={styles.breadcrumb}>
              Enquiries
            </FluentLink>{' '}›
          </Caption1>
          <Subtitle1>{lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'}</Subtitle1>
          {subtitle && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{subtitle}</Caption1>}
        </div>
      </div>

      {/* Action bar */}
      <div className={styles.actionBar}>
        <div className={styles.btnGroup}>
          <Button appearance="primary" icon={<Edit20Regular />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="outline" icon={<MoreHorizontal20Regular />} aria-label="More" />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<Copy20Regular />}>Duplicate</MenuItem>
                <MenuItem icon={<Delete20Regular />} onClick={handleDelete}>Remove</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>

        <div className={styles.btnGroup}>
          <Button appearance="subtle" icon={<ChevronLeft20Regular />} aria-label="Previous Entry" />
          <Button appearance="subtle" icon={<ChevronRight20Regular />} aria-label="Next Entry" />
          <Button
            appearance={lead.isFollowed ? 'primary' : 'outline'}
            icon={<Rss20Regular />}
            style={lead.isFollowed ? {
              backgroundColor: tokens.colorPaletteGreenBackground3,
              borderColor: tokens.colorPaletteGreenBorderActive,
            } : undefined}
          >
            {lead.isFollowed ? 'Followed' : 'Follow'}
          </Button>
          {isConvertable && (
            <Button appearance="primary">Convert</Button>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className={styles.contentGrid}>
        {/* MAIN (span 8) */}
        <div className={styles.mainCol}>
          {/* Overview */}
          <Panel title="Overview" classes={styles}>
            <div className={styles.fieldGrid}>
              <Field classes={styles} label="Name"        icon={<Person20Regular  />} value={lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim()} />
              <Field classes={styles} label="Account Name" icon={<Building20Regular />} value={lead.accountName} />
              <Field classes={styles} label="Email"       icon={<Mail20Regular    />} value={lead.emailAddress
                ? <FluentLink href={`mailto:${lead.emailAddress}`}>{lead.emailAddress}</FluentLink> : null} />
              <Field classes={styles} label="Phone"       icon={<Phone20Regular   />} value={lead.phoneNumber
                ? <FluentLink href={`tel:${lead.phoneNumber}`}>{lead.phoneNumber}</FluentLink> : null} />
              <Field classes={styles} label="Title"       value={lead.title} />
              <Field classes={styles} label="Website"     icon={<Globe20Regular   />} value={lead.website
                ? <FluentLink href={lead.website} target="_blank" rel="noreferrer">{lead.website}</FluentLink> : null} />
              <Field classes={styles} half={false} label="Address" icon={<Location20Regular />} value={formatAddress(lead)} multiline />
            </div>
          </Panel>

          {/* Details */}
          <Panel title="Details" classes={styles}>
            <div className={styles.fieldGrid}>
              <Field classes={styles} label="Status" value={lead.status
                ? <span className={styles.statusBadge}><Badge appearance="filled" color={stat.color}>{lead.status}</Badge></span>
                : null} />
              <Field classes={styles} label="Source"   value={lead.source} />
              <Field classes={styles} label="Opportunity Amount" value={
                lead.opportunityAmount != null && lead.opportunityAmount !== 0
                  ? `${lead.opportunityAmountCurrency || ''} ${lead.opportunityAmount}`.trim() : null
              } />
              <Field classes={styles} label="Campaign" value={lead.campaignName} />
              <Field classes={styles} label="Industry" value={lead.industry} />
              {lead.doNotCall && <Field classes={styles} label="Do Not Call" value="Yes" />}
              <Field classes={styles} half={false} label="Description" value={lead.description} multiline />
            </div>
          </Panel>

          {/* Stream (visual stub — backed by mail.message later) */}
          <Panel title="Stream" classes={styles}>
            <div className={styles.streamComposer}>Write your comment here</div>
            <div className={styles.streamList}>
              <div className={styles.streamEntry}>
                <div className={styles.streamAvatar}>{avatarLetter(lead.createdByName)}</div>
                <div className={styles.streamBody}>
                  <Body1>
                    <Body1Stronger>{lead.createdByName || 'System'}</Body1Stronger> created this lead
                  </Body1>
                  <Caption1 className={styles.streamMeta}>{lead.createdAt}</Caption1>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* SIDE (span 4) */}
        <div className={styles.sideCol}>
          <Panel title="Overview" classes={styles}>
            <div className={styles.fieldGrid}>
              <Field classes={styles} half={false} label="Assigned User" value={lead.assignedUserName} />
              <Field classes={styles} half={false} label="Teams" value={
                lead.teamsNames ? Object.values(lead.teamsNames).join(', ') : null
              } />
              {lead.convertedAt && <Field classes={styles} half={false} label="Converted At" value={lead.convertedAt} />}
              <Field classes={styles} half={false} label="Created"  value={formatAudit(lead.createdAt,  lead.createdByName)} />
              <Field classes={styles} half={false} label="Modified" value={formatAudit(lead.modifiedAt, lead.modifiedByName)} />
            </div>
          </Panel>

          {hasConvertedTo && (
            <Panel title="Converted To" headerVariant="converted" classes={styles}>
              <div className={styles.fieldGrid}>
                <Field classes={styles} half={false} label="Account"     value={lead.createdAccountName     || lead.accountName} />
                <Field classes={styles} half={false} label="Contact"     value={lead.createdContactName     || `${lead.firstName || ''} ${lead.lastName || ''}`.trim()} />
                <Field classes={styles} half={false} label="Opportunity" value={lead.createdOpportunityName} />
              </div>
            </Panel>
          )}

          <Panel title="Activities" classes={styles} headerExtra={
            <div className={styles.btnGroup}>
              <Button appearance="subtle" size="small" icon={<Mail20Filled    />} aria-label="New email"    />
              <Button appearance="subtle" size="small" icon={<Calendar20Regular/>} aria-label="New meeting"  />
              <Button appearance="subtle" size="small" icon={<CallAdd20Regular />} aria-label="New call"     />
              <Button appearance="subtle" size="small" icon={<MoreHorizontal20Regular />} aria-label="More"  />
            </div>
          }>
            <div className={styles.emptySide}>No Data</div>
          </Panel>

          <Panel title="History" classes={styles}>
            <div className={styles.emptySide}>No Data</div>
          </Panel>

          <Panel title="Tasks" classes={styles} headerExtra={
            <Button appearance="subtle" size="small" icon={<Add20Regular />} aria-label="Add task" />
          }>
            <div className={styles.emptySide}>No Data</div>
          </Panel>
        </div>
      </div>

      <LeadDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lead={lead}
        onSaved={load}
      />
    </div>
  );
}
