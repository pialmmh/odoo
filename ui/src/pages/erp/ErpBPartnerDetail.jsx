import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles, mergeClasses, tokens, Text, TabList, Tab, Spinner, Badge,
  Input, Textarea, Field, Checkbox, Button, Tooltip,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions,
  Table, TableHeader, TableHeaderCell, TableRow, TableCell, TableBody,
  Dropdown, Option, MessageBar, MessageBarBody,
} from '@fluentui/react-components';
import {
  ArrowClockwise20Regular, Save20Regular, Dismiss20Regular, Edit20Regular,
  ChevronLeft20Regular, ChevronRight20Regular,
} from '@fluentui/react-icons';
import {
  getBPartner, getCaps, saveBPartner, createBPartner,
} from '../../services/bpartners';
import { getTabRows, saveRow, saveRowByKeys } from '../../services/erpBundle';
import { useNotification } from '../../components/ErrorNotification';
import { evaluateDisplayLogic } from '../../lib/displayLogic';
import { useTabDirty } from './workspace/workspaceStore';
import { useErpTableStyles } from './components/erpTableStyles';
import bpartnerWindow from './c_bpartner_window.json';

const BPARTNER_WINDOW_ID = 123;
const TAB_ORDER = bpartnerWindow.tabs.map((t) => t.name);
const HEADER_TAB_INDEX = 0;
const HEADER_TABLE = 'C_BPartner';

// Composite primary keys for BPartner child tabs. Tables not listed use the
// single-PK URL form ({Table}_ID).
const COMPOSITE_KEYS = {
  'C_BP_Customer_Acct':  ['C_BPartner_ID', 'C_AcctSchema_ID'],
  'C_BP_Vendor_Acct':    ['C_BPartner_ID', 'C_AcctSchema_ID'],
  'AD_UserBPAccess':     ['AD_User_ID', 'C_BPartner_ID'],
  'R_ContactInterest':   ['AD_User_ID', 'R_InterestArea_ID'],
};

// Defaults applied to a new BPartner. Matches iDempiere AD-defaults so PO.save
// can succeed without forcing the user to flip every flag.
const NEW_BPARTNER_DEFAULTS = {
  IsActive: true,
  IsCustomer: true,
  IsVendor: false,
  IsEmployee: false,
  IsSalesRep: false,
  IsProspect: false,
  IsSummary: false,
  IsOneTime: false,
  IsTaxExempt: false,
  IsPOTaxExempt: false,
  IsPotentialCustomer: false,
  BPartnerType: 'B',
  SO_CreditStatus: 'O',
  SO_CreditLimit: 0,
  SO_CreditUsed: 0,
  TotalOpenBalance: 0,
  ActualLifeTimeValue: 0,
  PotentialLifeTimeValue: 0,
  AcqusitionCost: 0,
  ShareOfCustomer: 0,
  SalesVolume: 0,
  NumberEmployees: 0,
  PaymentRule: 'P',
  PaymentRulePO: 'P',
  DeliveryRule: 'A',
  DeliveryViaRule: 'P',
  FreightCostRule: 'I',
  InvoiceRule: 'I',
  FlatDiscount: 0,
  FirstSale: null,
};

const useStyles = makeStyles({
  page: { paddingBottom: '64px' },
  entityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  entityHeaderText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  entityBreadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorBrandForeground1,
    cursor: 'pointer',
  },
  entityHeaderActions: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS },
  panel: {
    marginBottom: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  panelHeader: {
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  panelBody: {
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  chipStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '160px minmax(0, 1fr)',
    gap: tokens.spacingHorizontalM,
    alignItems: 'start',
  },
  tabsPaper: {
    borderRadius: tokens.borderRadiusMedium,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    overflow: 'hidden',
    position: 'sticky',
    top: tokens.spacingVerticalL,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  tabList: {
    overflowY: 'auto',
    overflowX: 'hidden',
    flex: 1,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    rowGap: tokens.spacingVerticalXS,
    '& [role="tab"]': {
      justifyContent: 'flex-start',
      textAlign: 'left',
      width: '100%',
      minHeight: '32px',
      paddingLeft: tokens.spacingHorizontalS,
      paddingRight: tokens.spacingHorizontalS,
      paddingTop: tokens.spacingVerticalSNudge,
      paddingBottom: tokens.spacingVerticalSNudge,
      columnGap: tokens.spacingHorizontalS,
      borderTopRightRadius: tokens.borderRadiusMedium,
      borderBottomRightRadius: tokens.borderRadiusMedium,
      borderTopLeftRadius: tokens.borderRadiusMedium,
      borderBottomLeftRadius: tokens.borderRadiusMedium,
      color: tokens.colorNeutralForeground2,
      backgroundColor: tokens.colorNeutralBackground2,
      transitionProperty: 'background-color, color',
      transitionDuration: tokens.durationFaster,
      transitionTimingFunction: tokens.curveEasyEase,
      '&:hover': {
        backgroundColor: tokens.colorNeutralBackground2Hover,
        color: tokens.colorNeutralForeground1,
      },
    },
    '& [role="tab"] .fui-Tab__content, & [role="tab"] > span': {
      textAlign: 'left',
      flex: 1,
      minWidth: 0,
    },
    '& [role="tab"][aria-selected="true"]': {
      backgroundColor: tokens.colorBrandBackground2,
      color: tokens.colorBrandForeground1,
      fontWeight: tokens.fontWeightSemibold,
      '&:hover': {
        backgroundColor: tokens.colorBrandBackground2Hover,
      },
    },
    '& [role="tab"] .fui-Tab__icon, & [role="tab"] svg': {
      color: tokens.colorNeutralForeground3,
      width: '16px',
      height: '16px',
      flexShrink: 0,
    },
    '& .fui-Tab__indicator': { display: 'none' },
  },
  bodyCol: { minWidth: 0 },
  loadWrap: {
    display: 'flex', justifyContent: 'center',
    paddingTop: tokens.spacingVerticalXXXL,
    paddingBottom: tokens.spacingVerticalXXXL,
  },
  childPaper: {
    borderRadius: tokens.borderRadiusMedium,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  // 12-col fluid grid; per fluent-ui-forms skill. Default span planning
  // happens per-field in FieldRenderer via gridColumn: 'span N'. Collapses
  // at tablet (each child snaps to span 6) and phone (span 12).
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
    '@media (max-width: 1023px)': {
      '& > *': { gridColumn: 'span 6 !important' },
    },
    '@media (max-width: 639px)': {
      '& > *': { gridColumn: 'span 12 !important' },
    },
  },
  saveBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveBarPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
  },
  saveBarActions: { display: 'flex', gap: tokens.spacingHorizontalS },
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
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  pagerControls: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS },
  childRow: {
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    '& > td:first-of-type': {
      borderLeftWidth: '3px',
      borderLeftStyle: 'solid',
      borderLeftColor: 'transparent',
    },
    '&:hover': { backgroundColor: tokens.colorNeutralBackground2 },
  },
  childRowDisabled: {
    cursor: 'default',
    '&:hover': { backgroundColor: 'transparent' },
  },
  childRowActive: {
    backgroundColor: tokens.colorBrandBackground2,
    '&:hover': { backgroundColor: tokens.colorBrandBackground2 },
    '& > td:first-of-type': {
      borderLeftWidth: '3px',
      borderLeftStyle: 'solid',
      borderLeftColor: tokens.colorBrandStroke1,
      fontWeight: tokens.fontWeightSemibold,
    },
  },
  emptyChild: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  drawerForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
    '@media (max-width: 639px)': {
      '& > *': { gridColumn: 'span 12 !important' },
    },
  },
});

export default function ErpBPartnerDetail({ idOverride }) {
  const styles = useStyles();
  const params = useParams();
  const { tenant } = params;
  const id = idOverride ?? params.id;
  const navigate = useNavigate();
  const { error: notifyError, success: notifySuccess } = useNotification();

  const isNew = id === 'new' || id == null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState(0);
  const [writesEnabled, setWritesEnabled] = useState(true);

  const [headerDirty, setHeaderDirty] = useState(false);
  const [childDirty, setChildDirty] = useState(false);
  useTabDirty(headerDirty || childDirty);

  useEffect(() => {
    let alive = true;
    getCaps().then((c) => { if (alive) setWritesEnabled(!!c.writes); });
    return () => { alive = false; };
  }, []);

  const reload = useCallback(() => {
    if (isNew) return;
    let alive = true;
    setLoading(true);
    getBPartner(id)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => notifyError('Failed to load partner', e?.response?.data?.message || e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, isNew, notifyError]);

  useEffect(() => reload(), [reload]);

  const headerTabSpec = useMemo(
    () => bpartnerWindow.tabs.find((t) => t.tableName === HEADER_TABLE),
    []
  );

  const headerActions = !isNew && (
    <div style={{ display: 'flex', gap: '4px' }}>
      <PrevNextNav id={id} tenant={tenant} />
      <Tooltip content="Refresh" relationship="label" withArrow={false}>
        <Button appearance="subtle" size="small" icon={<ArrowClockwise20Regular />} onClick={reload} />
      </Tooltip>
    </div>
  );

  const subtitle = isNew
    ? 'Fill in the required fields and click Create.'
    : data
      ? `${data.value || '—'} · ${data.groupName || '—'} · ${data.taxId || 'no tax ID'}`
      : null;

  return (
    <div className={styles.page}>
      <EntityHeader
        backTo={`/${tenant}/erp/bpartner`}
        entityLabel="Business Partners"
        title={isNew ? 'New Business Partner' : (loading ? 'Loading…' : (data?.name || `#${id}`))}
        subtitle={subtitle}
        actions={headerActions}
      />

      {!writesEnabled && (
        <MessageBar intent="info" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>Editing is temporarily unavailable.</MessageBarBody>
        </MessageBar>
      )}

      {!isNew && data && (
        <div className={styles.chipStrip}>
          {data.isActive
            ? <Badge appearance="outline" color="success" size="small">Active</Badge>
            : <Badge appearance="outline" size="small">Inactive</Badge>}
          {data.isCustomer  && <Badge appearance="outline" size="small">Customer</Badge>}
          {data.isVendor    && <Badge appearance="outline" size="small">Vendor</Badge>}
          {data.isEmployee  && <Badge appearance="outline" size="small">Employee</Badge>}
          {data.isSalesRep  && <Badge appearance="outline" size="small">Sales Rep</Badge>}
          {data.isProspect  && <Badge appearance="outline" size="small">Prospect</Badge>}
          {data.isOneTime   && <Badge appearance="outline" size="small">One-Time</Badge>}
          {data.isSummary   && <Badge appearance="outline" size="small">Summary</Badge>}
        </div>
      )}

      {isNew ? (
        <HeaderTab
          spec={headerTabSpec}
          data={null}
          isNew
          defaults={NEW_BPARTNER_DEFAULTS}
          writesEnabled={writesEnabled}
          onDirtyChange={setHeaderDirty}
          onCreated={(created) => {
            notifySuccess('Business partner created');
            const newId = created?.cBpartnerId ?? created?.id ?? created?.c_bpartner_id;
            if (newId) navigate(`/${tenant}/erp/bpartner/${newId}`);
          }}
          onError={(msg) => notifyError('Create failed', msg)}
        />
      ) : (
        <div className={styles.layout}>
          <div className={styles.tabsPaper}>
            <TabList
              vertical
              selectedValue={String(activeTab)}
              onTabSelect={(_e, data) => setActiveTab(Number(data.value))}
              className={styles.tabList}
              size="small"
            >
              {TAB_ORDER.map((name, i) => (
                <Tab key={name} value={String(i)}>{name}</Tab>
              ))}
            </TabList>
          </div>

          <div className={styles.bodyCol}>
            {loading ? (
              <div className={styles.loadWrap}><Spinner size="small" /></div>
            ) : activeTab === HEADER_TAB_INDEX ? (
              <HeaderTab
                spec={headerTabSpec}
                data={data}
                recordId={Number(id)}
                writesEnabled={writesEnabled}
                onDirtyChange={setHeaderDirty}
                onSaved={(updated) => {
                  setData((prev) => ({ ...prev, ...mapBundleToBPartner(updated) }));
                  notifySuccess('Saved');
                }}
                onError={(msg) => notifyError('Save failed', msg)}
              />
            ) : (
              <ChildTab
                key={activeTab}
                tabIndex={activeTab}
                tabSpec={bpartnerWindow.tabs[activeTab]}
                parentId={data?.id ?? Number(id)}
                onDirtyChange={setChildDirty}
                onSavedRow={() => notifySuccess('Saved')}
                onError={(msg) => notifyError('Save failed', msg)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Prev/Next record nav ────────────────────────────────────────────────────
function PrevNextNav({ id, tenant }) {
  const navigate = useNavigate();
  const go = (delta) => {
    const next = Number(id) + delta;
    if (next > 0) navigate(`/${tenant}/erp/bpartner/${next}`);
  };
  return (
    <div style={{ display: 'flex' }}>
      <Tooltip content="Previous record" relationship="label" withArrow={false}>
        <Button appearance="subtle" size="small" icon={<ChevronLeft20Regular />} onClick={() => go(-1)} />
      </Tooltip>
      <Tooltip content="Next record" relationship="label" withArrow={false}>
        <Button appearance="subtle" size="small" icon={<ChevronRight20Regular />} onClick={() => go(+1)} />
      </Tooltip>
    </div>
  );
}

// ── Header / Panel ──────────────────────────────────────────────────────────
function EntityHeader({ backTo, entityLabel, title, subtitle, actions }) {
  const styles = useStyles();
  const navigate = useNavigate();
  return (
    <div className={styles.entityHeader}>
      <div className={styles.entityHeaderText}>
        <div
          className={styles.entityBreadcrumb}
          onClick={() => backTo && navigate(backTo)}
          role={backTo ? 'button' : undefined}
        >
          <ChevronLeft20Regular />
          <Text size={200} weight="medium">{entityLabel}</Text>
        </div>
        <Text size={500} weight="semibold" truncate wrap={false}>{title}</Text>
        {subtitle && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{subtitle}</Text>
        )}
      </div>
      {actions && <div className={styles.entityHeaderActions}>{actions}</div>}
    </div>
  );
}

function Panel({ title, children, actions }) {
  const styles = useStyles();
  return (
    <div className={styles.panel}>
      {title && (
        <div className={styles.panelHeader} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Text size={300} weight="semibold">{title}</Text>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={styles.panelBody}>{children}</div>
    </div>
  );
}

// Derive panel groups from the AD spec's fieldGroup. Fields without a group
// fall under "General" (always rendered first); the remaining groups follow
// in first-encountered order. Matches iDempiere's natural section layout
// without us having to hard-code one HEADER_GROUPS list per window.
function deriveGroups(fields) {
  const order = [];
  const groups = new Map();
  const ensure = (id, title) => {
    if (!groups.has(id)) {
      groups.set(id, { id, title, columns: [] });
      order.push(id);
    }
    return groups.get(id);
  };
  ensure('_general', 'General');
  for (const f of fields) {
    const fg = f.fieldGroup;
    const g = fg ? ensure(`fg:${fg}`, fg) : groups.get('_general');
    g.columns.push(f);
  }
  return order.map((id) => groups.get(id)).filter((g) => g.columns.length > 0);
}

function HeaderTab({ spec, data, recordId, isNew, defaults, writesEnabled = true,
                     onSaved, onCreated, onError, onDirtyChange }) {
  const styles = useStyles();
  const original = useMemo(() => {
    if (isNew) {
      const o = {};
      for (const f of spec.fields) o[f.columnName] = (defaults && defaults[f.columnName]) ?? null;
      return o;
    }
    const o = {};
    for (const f of spec.fields) o[f.columnName] = readField(data, f);
    return o;
  }, [data, spec, isNew, defaults]);

  const [form, setForm] = useState(original);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(original); }, [original]);

  const dirty = useMemo(() => {
    const diff = {};
    for (const k of Object.keys(form)) {
      if (!shallowEqual(form[k], original[k])) diff[k] = form[k];
    }
    return diff;
  }, [form, original]);
  const isDirty = Object.keys(dirty).length > 0;
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  const fields = useMemo(() =>
    spec.fields.filter((f) => f.isDisplayed === 'Y').sort((a, b) => a.seqno - b.seqno),
    [spec]
  );
  const groups = useMemo(() => deriveGroups(fields), [fields]);

  const onChange = (col, v) => setForm((s) => ({ ...s, [col]: v }));
  const onDiscard = () => setForm(original);

  const onSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const payload = { ...form };
        for (const k of Object.keys(payload)) {
          if (payload[k] === null || payload[k] === undefined) delete payload[k];
        }
        const created = await createBPartner(payload);
        onCreated?.(created);
      } else {
        const updated = await saveBPartner(recordId, dirty);
        onSaved?.(updated);
      }
    } catch (e) {
      const status = e?.response?.status;
      const msg = status === 501
        ? 'Editing is not yet available.'
        : (e?.response?.data?.message || e.message);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && !data) return null;

  const renderField = (f) => {
    const visible = !f.displayLogic || evaluateDisplayLogic(f.displayLogic, form);
    if (!visible) return null;
    return (
      <FieldRenderer
        key={f.columnName}
        field={f}
        value={form[f.columnName]}
        lookup={isNew ? null : readLookup(data, f.columnName)}
        onChange={(v) => onChange(f.columnName, v)}
      />
    );
  };

  return (
    <>
      {groups.map((g) => (
        <Panel key={g.id} title={g.title}>
          <div className={styles.fieldGrid}>{g.columns.map(renderField)}</div>
        </Panel>
      ))}

      {(isDirty || isNew) && (
        <SaveBar
          isNew={isNew}
          dirtyCount={Object.keys(dirty).length}
          saving={saving}
          disabled={!writesEnabled}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      )}
    </>
  );
}

// ── Field renderer ──────────────────────────────────────────────────────────
// Span planning per fluent-ui-forms skill (12-col base):
//   checkbox / boolean       → span 2   (extends to 4 on FK-heavy rows by parent CSS)
//   number / date / dropdown → span 4
//   text                     → span 6
//   memo / textarea          → span 12
function FieldRenderer({ field, value, lookup, onChange }) {
  const ref = field.reference;
  const editable = field.isUpdateable === 'Y' && !field.readOnlyLogic;
  const labelText = field.label + (field.isMandatory === 'Y' ? ' *' : '');

  if (ref === 'Yes-No') {
    // paddingTop: 26px aligns the checkbox baseline with neighboring labelled
    // fields on the same row (skill rule for mixed-type alignment).
    return (
      <div style={{ gridColumn: 'span 2', paddingTop: '26px' }}>
        <Checkbox
          checked={value === true || value === 'Y'}
          onChange={(_e, data) => onChange(!!data.checked)}
          disabled={!editable}
          label={labelText}
        />
      </div>
    );
  }

  const isFk = ref === 'Table' || ref === 'Table Direct' || ref === 'Search'
            || ref === 'Locator (WH)' || ref === 'Product Attribute';

  if (isFk) {
    const display = lookup || (value != null ? `#${value}` : '');
    return (
      <div style={{ gridColumn: 'span 4' }}>
        <Field label={labelText} hint={editable ? null : 'Read-only'} size="small">
          <Input
            size="small"
            value={display}
            readOnly
            contentAfter={editable ? (
              <Tooltip content="Picker coming soon" relationship="label" withArrow={false}>
                <Edit20Regular style={{ opacity: 0.5 }} />
              </Tooltip>
            ) : null}
          />
        </Field>
      </div>
    );
  }

  if (ref === 'Integer' || ref === 'Number' || ref === 'Amount'
      || ref === 'Quantity' || ref === 'Costs+Prices') {
    return (
      <div style={{ gridColumn: 'span 4' }}>
        <Field label={labelText} size="small">
          <Input
            size="small"
            type="number"
            value={value == null ? '' : String(value)}
            onChange={(_e, data) => onChange(data.value === '' ? null : Number(data.value))}
            disabled={!editable}
          />
        </Field>
      </div>
    );
  }

  if (ref === 'Date') {
    return (
      <div style={{ gridColumn: 'span 4' }}>
        <Field label={labelText} size="small">
          <Input
            size="small"
            type="date"
            value={(value || '').toString().split('T')[0]}
            onChange={(_e, data) => onChange(data.value || null)}
            disabled={!editable}
          />
        </Field>
      </div>
    );
  }

  if (ref === 'Button') {
    return (
      <div style={{ gridColumn: 'span 2', paddingTop: '26px' }}>
        <Button appearance="outline" size="small" disabled>{field.label}</Button>
      </div>
    );
  }

  if (ref === 'Memo') {
    return (
      <div style={{ gridColumn: 'span 12' }}>
        <Field label={labelText} size="small">
          <Textarea
            size="small"
            value={value ?? ''}
            onChange={(_e, data) => onChange(data.value)}
            disabled={!editable}
            rows={3}
          />
        </Field>
      </div>
    );
  }
  return (
    <div style={{ gridColumn: 'span 6' }}>
      <Field label={labelText} size="small">
        <Input
          size="small"
          value={value ?? ''}
          onChange={(_e, data) => onChange(data.value)}
          disabled={!editable}
        />
      </Field>
    </div>
  );
}

// ── Sticky save bar ─────────────────────────────────────────────────────────
function SaveBar({ isNew, dirtyCount, saving, disabled, onSave, onDiscard }) {
  const styles = useStyles();
  return (
    <div className={styles.saveBar}>
      <div className={styles.saveBarPanel}>
        <Text size={300}>
          {disabled
            ? 'Editing is temporarily unavailable.'
            : isNew
              ? 'New business partner (unsaved)'
              : `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}`}
        </Text>
        <div className={styles.saveBarActions}>
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss20Regular />}
            onClick={onDiscard}
            disabled={saving || isNew}
          >
            {isNew ? 'Reset' : 'Discard'}
          </Button>
          <Button
            appearance="primary"
            size="small"
            icon={saving ? <Spinner size="tiny" /> : <Save20Regular />}
            onClick={onSave}
            disabled={saving || disabled}
          >
            {isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Child tab ───────────────────────────────────────────────────────────────
function ChildTab({ tabIndex, tabSpec, parentId, onSavedRow, onError, onDirtyChange }) {
  const styles = useStyles();
  const tableStyles = useErpTableStyles();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [editing, setEditing] = useState(null);
  useEffect(() => { onDirtyChange?.(editing != null); }, [editing, onDirtyChange]);

  const cols = useMemo(() => {
    if (!tabSpec) return [];
    return tabSpec.fields
      .filter((f) => f.isDisplayedGrid === 'Y')
      .sort((a, b) => (a.seqNoGrid || 0) - (b.seqNoGrid || 0))
      .slice(0, 10);
  }, [tabSpec]);

  const reload = useCallback(() => {
    if (!parentId) return;
    setLoading(true); setErrorMsg(null);
    getTabRows(BPARTNER_WINDOW_ID, tabIndex, { parentId, page, size })
      .then((d) => { setRows(d.items || []); setTotal(d.total || 0); })
      .catch((e) => setErrorMsg(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [tabIndex, parentId, page, size]);

  useEffect(reload, [reload]);

  if (loading && rows.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner size="small" /></div>;
  }
  if (errorMsg) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMsg}</MessageBarBody>
      </MessageBar>
    );
  }
  if (rows.length === 0) {
    return <div className={styles.emptyChild}>No rows for this tab.</div>;
  }

  const compositeCols = COMPOSITE_KEYS[tabSpec.tableName];
  const isComposite = !!compositeCols;
  const singleIdCol = !isComposite
    ? (tabSpec.tableName + '_ID').toLowerCase()
    : null;
  const isRowEditable = (r) =>
    isComposite
      ? compositeCols.every((c) => r[c.toLowerCase()] != null)
      : !!(singleIdCol && r[singleIdCol]);
  const isRowActive = (r) => {
    if (!editing) return false;
    if (isComposite) {
      return compositeCols.every((c) => {
        const k = c.toLowerCase();
        return r[k] != null && r[k] === editing[k];
      });
    }
    return singleIdCol && r[singleIdCol] != null && r[singleIdCol] === editing[singleIdCol];
  };

  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = total === 0 ? 0 : page * size + 1;
  const end = Math.min(total, (page + 1) * size);

  return (
    <div className={styles.childPaper}>
      <Table size="small">
        <TableHeader>
          <TableRow className={tableStyles.headerRow}>
            {cols.map((col) => (
              <TableHeaderCell key={col.columnName}>{col.label}</TableHeaderCell>
            ))}
            <TableHeaderCell style={{ width: 60, textAlign: 'right' }}>Edit</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const editable = isRowEditable(r);
            const active = isRowActive(r);
            return (
              <TableRow
                key={i}
                className={mergeClasses(
                  styles.childRow,
                  !editable && styles.childRowDisabled,
                  active && styles.childRowActive,
                )}
                onClick={() => editable && setEditing(r)}
              >
                {cols.map((col) => (
                  <TableCell key={col.columnName}>
                    {formatCell(r[col.columnName.toLowerCase()])}
                  </TableCell>
                ))}
                <TableCell style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Edit20Regular />}
                    disabled={!editable}
                    onClick={() => setEditing(r)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className={styles.pager}>
        <Text size={200}>Rows per page:</Text>
        <Dropdown
          size="small"
          value={String(size)}
          selectedOptions={[String(size)]}
          onOptionSelect={(_e, data) => { setSize(parseInt(data.optionValue, 10)); setPage(0); }}
          style={{ minWidth: 0, width: 84 }}
        >
          {[25, 50, 100].map((n) => (
            <Option key={n} value={String(n)} text={String(n)}>{n}</Option>
          ))}
        </Dropdown>
        <Text size={200}>{start}–{end} of {total}</Text>
        <div className={styles.pagerControls}>
          <Button appearance="subtle" size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
          <Button appearance="subtle" size="small" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
      {editing && (
        <ChildRowEditDrawer
          row={editing}
          compositeCols={compositeCols}
          singleIdCol={singleIdCol}
          tabIndex={tabIndex}
          tabSpec={tabSpec}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); onSavedRow?.(); }}
          onError={onError}
        />
      )}
    </div>
  );
}

// ── Drawer that edits a single child row ────────────────────────────────────
function ChildRowEditDrawer({ row, compositeCols, singleIdCol, tabIndex, tabSpec, onClose, onSaved, onError }) {
  const styles = useStyles();
  const original = useMemo(() => {
    const o = {};
    for (const f of tabSpec.fields) o[f.columnName] = row[f.columnName.toLowerCase()];
    return o;
  }, [row, tabSpec]);

  const [form, setForm] = useState(original);
  const [saving, setSaving] = useState(false);

  const fields = tabSpec.fields
    .filter((f) => f.isDisplayed === 'Y')
    .sort((a, b) => a.seqno - b.seqno);

  const dirty = {};
  for (const k of Object.keys(form)) {
    if (!shallowEqual(form[k], original[k])) dirty[k] = form[k];
  }
  const isDirty = Object.keys(dirty).length > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      if (compositeCols) {
        const keys = {};
        for (const c of compositeCols) keys[c] = row[c.toLowerCase()];
        await saveRowByKeys(BPARTNER_WINDOW_ID, tabIndex, keys, dirty);
      } else {
        const id = singleIdCol ? row[singleIdCol] : null;
        if (id == null) throw new Error('No primary key found for row');
        await saveRow(BPARTNER_WINDOW_ID, tabIndex, Number(id), dirty);
      }
      onSaved?.();
    } catch (e) {
      onError?.(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(_, data) => { if (!data.open) onClose?.(); }}
      modalType="non-modal"
    >
      <DialogSurface style={{ maxWidth: 560 }}>
        <DialogBody>
          <DialogTitle
            action={
              <Button appearance="subtle" size="small" icon={<Dismiss20Regular />} onClick={onClose} />
            }
          >
            Edit {tabSpec.name}
          </DialogTitle>
          <DialogContent>
            <div className={styles.drawerForm}>
              {fields.map((f) => {
                const visible = !f.displayLogic || evaluateDisplayLogic(f.displayLogic, form);
                if (!visible) return null;
                return (
                  <FieldRenderer
                    key={f.columnName}
                    field={f}
                    value={form[f.columnName]}
                    lookup={null}
                    onChange={(v) => setForm((s) => ({ ...s, [f.columnName]: v }))}
                  />
                );
              })}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" size="small" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              appearance="primary"
              size="small"
              onClick={onSave}
              disabled={!isDirty || saving}
              icon={saving ? <Spinner size="tiny" /> : <Save20Regular />}
            >
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readField(data, f) {
  const key = camelize(f.columnName);
  const v = data[key];
  if (f.reference === 'Yes-No') return v === true;
  return v;
}

function readLookup(data, columnName) {
  switch (columnName) {
    case 'C_BP_Group_ID':         return data.groupName;
    case 'AD_Org_ID':             return data.orgName;
    case 'AD_Client_ID':          return data.clientName;
    case 'AD_Language':           return data.languageName;
    case 'M_PriceList_ID':        return data.priceListName;
    case 'PO_PriceList_ID':       return data.poPriceListName;
    case 'C_PaymentTerm_ID':      return data.paymentTermName;
    case 'PO_PaymentTerm_ID':     return data.poPaymentTermName;
    case 'SalesRep_ID':           return data.salesRepName;
    case 'C_Dunning_ID':          return data.dunningName;
    case 'C_InvoiceSchedule_ID':  return data.invoiceScheduleName;
    default: return null;
  }
}

function mapBundleToBPartner(row) {
  if (!row) return {};
  const out = {};
  for (const k of Object.keys(row)) {
    out[camelize(k)] = row[k];
  }
  return out;
}

function camelize(adName) {
  if (!adName) return adName;
  const parts = adName.split(/_|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  let first = true;
  let out = '';
  for (const p of parts) {
    if (!p) continue;
    const low = p.toLowerCase();
    if (first) { out += low; first = false; }
    else       { out += low.charAt(0).toUpperCase() + low.slice(1); }
  }
  return out;
}

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === 'string' && v.length > 40) return v.slice(0, 40) + '…';
  return String(v);
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
