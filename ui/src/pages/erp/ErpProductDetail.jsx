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
  ChevronLeft20Regular, ChevronRight20Regular, Apps16Regular,
} from '@fluentui/react-icons';
import { getProduct } from '../../services/erpProducts';
import { getTabRows, saveRow, saveRowByKeys, createRow } from '../../services/erpBundle';
import { useNotification } from '../../components/ErrorNotification';
import { evaluateDisplayLogic } from '../../lib/displayLogic';
import { useTabDirty } from './workspace/workspaceStore';
import { useErpTableStyles } from './components/erpTableStyles';
import productWindow from './m_product_window.json';

const PRODUCT_WINDOW_ID = 140;
const TAB_ORDER = productWindow.tabs.map((t) => t.name);
const HEADER_TAB_INDEX = 0;

const HEADER_GROUPS = [
  { id: 'identity', title: 'Identity', columns: [
    'Value', 'Name', 'Description', 'Help', 'DocumentNote',
    'UPC', 'SKU', 'VersionNo', 'IsActive', 'IsSummary',
    'AD_Client_ID', 'AD_Org_ID',
  ]},
  { id: 'classification', title: 'Classification', columns: [
    'M_Product_Category_ID', 'C_TaxCategory_ID', 'C_UOM_ID',
    'ProductType', 'SalesRep_ID', 'C_RevenueRecognition_ID',
    'R_MailText_ID', 'M_PartType_ID', 'Classification',
    'Group1', 'Group2',
  ]},
  { id: 'flags', title: 'Inventory & Flags', columns: [
    'IsStocked', 'IsSold', 'IsPurchased', 'IsManufactured',
    'IsPhantom', 'IsKanban', 'IsDropShip', 'IsOwnBox',
    'IsExcludeAutoDelivery', 'IsBOM', 'IsVerified', 'Processing',
    'IsAutoProduce', 'IsBOMPriceOverride',
    'IsInvoicePrintDetails', 'IsPickListPrintDetails',
    'IsWebStoreFeatured', 'IsSelfService', 'M_Locator_ID',
  ]},
  { id: 'dimensions', title: 'Dimensions & Weight', columns: [
    'Weight', 'Volume', 'ShelfWidth', 'ShelfHeight', 'ShelfDepth',
    'UnitsPerPallet', 'UnitsPerPack',
    'CustomsTariffNumber', 'M_FreightCategory_ID',
  ]},
  { id: 'lifecycle', title: 'Lifecycle & Attributes', columns: [
    'Discontinued', 'DiscontinuedAt', 'S_ExpenseType_ID', 'S_Resource_ID',
    'GuaranteeDays', 'GuaranteeDaysMin',
    'M_AttributeSet_ID', 'M_AttributeSetInstance_ID',
    'ImageURL', 'DescriptionURL', 'CopyFrom', 'LowLevel',
  ]},
];

const COMPOSITE_KEYS = {
  'M_ProductPrice':   ['M_PriceList_Version_ID', 'M_Product_ID'],
  'M_Product_Acct':   ['M_Product_ID', 'C_AcctSchema_ID'],
  'M_Product_PO':     ['M_Product_ID', 'C_BPartner_ID'],
  'M_Replenish':      ['M_Product_ID', 'M_Warehouse_ID'],
  'M_Product_Trl':    ['M_Product_ID', 'AD_Language'],
  'M_Cost':           ['M_Product_ID', 'M_CostType_ID', 'M_CostElement_ID', 'C_AcctSchema_ID', 'AD_Org_ID', 'M_AttributeSetInstance_ID'],
  'M_Substitute':     ['M_Product_ID', 'Substitute_ID'],
  'C_UOM_Conversion': ['C_UOM_ID', 'C_UOM_To_ID'],
  'M_Storage':        ['M_Locator_ID', 'M_Product_ID', 'M_AttributeSetInstance_ID'],
};

const NEW_PRODUCT_DEFAULTS = {
  IsActive: true,
  IsSummary: false,
  IsStocked: true,
  IsSold: true,
  IsPurchased: true,
  IsBOM: false,
  IsManufactured: false,
  IsPhantom: false,
  IsKanban: false,
  IsDropShip: false,
  IsOwnBox: false,
  IsAutoProduce: false,
  IsBOMPriceOverride: false,
  IsInvoicePrintDetails: false,
  IsPickListPrintDetails: false,
  IsExcludeAutoDelivery: false,
  IsWebStoreFeatured: false,
  IsSelfService: false,
  IsVerified: false,
  ProductType: 'I',
  M_AttributeSetInstance_ID: 0,
  LowLevel: 0,
};

const useStyles = makeStyles({
  page: { paddingBottom: '64px' /* room for sticky save bar */ },
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
    // Flat menu-item rows: small grey leading icon, left-aligned text,
    // light-grey resting background with vertical breathing room.
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
    // Force the Tab content span to align left even when text wraps
    // (so multi-word labels like "Business Partner" don't appear centred).
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
    // Small, muted leading icon — neutral grey, never brand.
    '& [role="tab"] .fui-Tab__icon, & [role="tab"] svg': {
      color: tokens.colorNeutralForeground3,
      width: '16px',
      height: '16px',
      flexShrink: 0,
    },
    // Hide the default Fluent indicator bar (rounded pill is the cue instead).
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
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
  },
  fkInputWrap: { position: 'relative' },
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
  },
});

export default function ErpProductDetail({ idOverride }) {
  const styles = useStyles();
  const params = useParams();
  const { tenant } = params;
  // Inside the workspace shell each tab carries its own id —
  // useParams alone would resolve to the active URL for ALL alive tabs.
  const id = idOverride ?? params.id;
  const navigate = useNavigate();
  const { error: notifyError, success: notifySuccess } = useNotification();

  const isNew = id === 'new' || id == null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState(0);

  const [headerDirty, setHeaderDirty] = useState(false);
  const [childDirty, setChildDirty] = useState(false);
  useTabDirty(headerDirty || childDirty);

  const reload = useCallback(() => {
    if (isNew) return;
    let alive = true;
    setLoading(true);
    getProduct(id)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => notifyError('Failed to load product', e?.response?.data?.message || e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, isNew, notifyError]);

  useEffect(() => reload(), [reload]);

  const headerTabSpec = useMemo(
    () => productWindow.tabs.find((t) => t.name === 'Product'),
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
      ? `${data.value} · ${data.productTypeLabel || data.productType || '—'} · ${data.uomName || '—'} · ${data.productCategoryName || '—'}`
      : null;

  return (
    <div className={styles.page}>
      <EntityHeader
        backTo={`/${tenant}/erp/product`}
        entityLabel="Products"
        title={isNew ? 'New Product' : (loading ? 'Loading…' : (data?.name || `#${id}`))}
        subtitle={subtitle}
        actions={headerActions}
      />

      {!isNew && data && (
        <div className={styles.chipStrip}>
          {data.isActive
            ? <Badge appearance="outline" color="success" size="small">Active</Badge>
            : <Badge appearance="outline" size="small">Inactive</Badge>}
          {data.isSummary   && <Badge appearance="outline" size="small">Summary</Badge>}
          {data.isStocked   && <Badge appearance="outline" size="small">Stocked</Badge>}
          {data.isSold      && <Badge appearance="outline" size="small">Sold</Badge>}
          {data.isPurchased && <Badge appearance="outline" size="small">Purchased</Badge>}
          {data.isBOM       && <Badge appearance="outline" size="small">BOM</Badge>}
        </div>
      )}

      {isNew ? (
        <HeaderTab
          spec={headerTabSpec}
          data={null}
          isNew
          defaults={NEW_PRODUCT_DEFAULTS}
          onDirtyChange={setHeaderDirty}
          onCreated={(created) => {
            notifySuccess('Product created');
            navigate(`/${tenant}/erp/product/${created.m_product_id}`);
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
                onDirtyChange={setHeaderDirty}
                onSaved={(updated) => {
                  setData((prev) => ({ ...prev, ...mapBundleToProduct(updated) }));
                  notifySuccess('Saved');
                }}
                onError={(msg) => notifyError('Save failed', msg)}
              />
            ) : (
              <ChildTab
                key={activeTab}
                tabIndex={activeTab}
                tabSpec={productWindow.tabs[activeTab]}
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
    if (next > 0) navigate(`/${tenant}/erp/product/${next}`);
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

// ── Header tab ──────────────────────────────────────────────────────────────
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

function HeaderTab({ spec, data, recordId, isNew, defaults, onSaved, onCreated, onError, onDirtyChange }) {
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

  const grouped = useMemo(() => {
    const colToGroup = new Map();
    for (const g of HEADER_GROUPS) {
      for (const c of g.columns) colToGroup.set(c, g.id);
    }
    const buckets = new Map(HEADER_GROUPS.map((g) => [g.id, []]));
    const other = [];
    for (const f of fields) {
      const gid = colToGroup.get(f.columnName);
      if (gid) buckets.get(gid).push(f);
      else other.push(f);
    }
    for (const g of HEADER_GROUPS) {
      const order = new Map(g.columns.map((c, i) => [c, i]));
      buckets.get(g.id).sort((a, b) => (order.get(a.columnName) ?? 0) - (order.get(b.columnName) ?? 0));
    }
    return { buckets, other };
  }, [fields]);

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
        const created = await createRow(PRODUCT_WINDOW_ID, HEADER_TAB_INDEX, payload);
        onCreated?.(created);
      } else {
        const updated = await saveRow(PRODUCT_WINDOW_ID, HEADER_TAB_INDEX, recordId, dirty);
        onSaved?.(updated);
      }
    } catch (e) {
      onError?.(e?.response?.data?.message || e.message);
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
      {HEADER_GROUPS.map((g) => {
        const items = grouped.buckets.get(g.id);
        if (!items || items.length === 0) return null;
        return (
          <Panel key={g.id} title={g.title}>
            <div className={styles.fieldGrid}>{items.map(renderField)}</div>
          </Panel>
        );
      })}
      {grouped.other.length > 0 && (
        <Panel title="Other">
          <div className={styles.fieldGrid}>{grouped.other.map(renderField)}</div>
        </Panel>
      )}

      {(isDirty || isNew) && (
        <SaveBar
          isNew={isNew}
          dirtyCount={Object.keys(dirty).length}
          saving={saving}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      )}
    </>
  );
}

// ── Field renderer ──────────────────────────────────────────────────────────
function FieldRenderer({ field, value, lookup, onChange }) {
  const ref = field.reference;
  const editable = field.isUpdateable === 'Y' && !field.readOnlyLogic;
  const labelText = field.label + (field.isMandatory === 'Y' ? ' *' : '');

  if (ref === 'Yes-No') {
    // Align with sibling Field+Input cells: those reserve vertical space for a
    // label above the input. Push the checkbox down so its baseline matches the
    // input controls in the same row.
    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        minHeight: '46px',
        paddingBottom: '4px',
      }}>
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
    );
  }

  if (ref === 'Integer' || ref === 'Number' || ref === 'Amount'
      || ref === 'Quantity' || ref === 'Costs+Prices') {
    return (
      <Field label={labelText} size="small">
        <Input
          size="small"
          type="number"
          value={value == null ? '' : String(value)}
          onChange={(_e, data) => onChange(data.value === '' ? null : Number(data.value))}
          disabled={!editable}
        />
      </Field>
    );
  }

  if (ref === 'Date') {
    return (
      <Field label={labelText} size="small">
        <Input
          size="small"
          type="date"
          value={(value || '').toString().split('T')[0]}
          onChange={(_e, data) => onChange(data.value || null)}
          disabled={!editable}
        />
      </Field>
    );
  }

  if (ref === 'Button') {
    return (
      <Button appearance="outline" size="small" disabled>{field.label}</Button>
    );
  }

  // String / Text / Memo / URL / List — single-line Input by default so every
  // cell in a row has the same height. Only the explicit Memo reference (true
  // long-form notes) gets a Textarea.
  if (ref === 'Memo') {
    return (
      <Field label={labelText} size="small">
        <Textarea
          size="small"
          value={value ?? ''}
          onChange={(_e, data) => onChange(data.value)}
          disabled={!editable}
          rows={3}
        />
      </Field>
    );
  }
  return (
    <Field label={labelText} size="small">
      <Input
        size="small"
        value={value ?? ''}
        onChange={(_e, data) => onChange(data.value)}
        disabled={!editable}
      />
    </Field>
  );
}

// ── Sticky save bar ─────────────────────────────────────────────────────────
function SaveBar({ isNew, dirtyCount, saving, onSave, onDiscard }) {
  const styles = useStyles();
  return (
    <div className={styles.saveBar}>
      <div className={styles.saveBarPanel}>
        <Text size={300}>
          {isNew
            ? 'New product (unsaved)'
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
            disabled={saving}
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
    getTabRows(PRODUCT_WINDOW_ID, tabIndex, { parentId, page, size })
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
        await saveRowByKeys(PRODUCT_WINDOW_ID, tabIndex, keys, dirty);
      } else {
        const id = singleIdCol ? row[singleIdCol] : null;
        if (id == null) throw new Error('No primary key found for row');
        await saveRow(PRODUCT_WINDOW_ID, tabIndex, Number(id), dirty);
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
    case 'M_Product_Category_ID':   return data.productCategoryName;
    case 'C_UOM_ID':                return data.uomName;
    case 'AD_Org_ID':               return data.orgName;
    case 'AD_Client_ID':            return data.clientName;
    case 'C_TaxCategory_ID':        return data.taxCategoryName;
    case 'M_FreightCategory_ID':    return data.freightCategoryName;
    case 'SalesRep_ID':             return data.salesRepName;
    case 'M_PartType_ID':           return data.partTypeName;
    case 'M_AttributeSet_ID':       return data.attributeSetName;
    case 'M_Locator_ID':            return data.locatorValue;
    case 'C_RevenueRecognition_ID': return data.revenueRecognitionName;
    case 'R_MailText_ID':           return data.mailTextName;
    case 'S_ExpenseType_ID':        return data.expenseTypeName;
    case 'S_Resource_ID':           return data.resourceName;
    default: return null;
  }
}

function mapBundleToProduct(row) {
  if (!row) return {};
  const out = {};
  for (const k of Object.keys(row)) {
    out[camelize(k.replace(/^_/, '').replace(/_/g, '_'))] = row[k];
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
