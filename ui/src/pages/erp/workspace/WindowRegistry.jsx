import { Suspense } from 'react';
import { makeStyles, tokens, Spinner, Text, Badge } from '@fluentui/react-components';
import {
  Home20Regular, Box20Regular, People20Regular, Receipt20Regular,
  Cart20Regular, VehicleTruck20Regular, Money20Regular, ReceiptMoney20Regular,
  BuildingShop20Regular, Tag20Regular, BuildingBank20Regular, Organization20Regular,
  Person20Regular, Building20Regular, ContactCard20Regular, Globe20Regular,
  Settings20Regular, Braces20Regular, PuzzlePiece20Regular,
  ChartMultiple20Regular, Timeline20Regular, Wrench20Regular,
  ArrowSwap20Regular, Ruler20Regular, Color20Regular,
} from '@fluentui/react-icons';
import ErpProductList from '../ErpProductList';
import ErpProductDetail from '../ErpProductDetail';
import ErpProductSimpleDetail from '../ErpProductSimpleDetail';
import ErpBPartnerList from '../ErpBPartnerList';
import ErpBPartnerDetail from '../ErpBPartnerDetail';
import ErpWarehouseList from '../ErpWarehouseList';
import ErpWarehouseDetail from '../ErpWarehouseDetail';

/**
 * Window registry — single source of truth for what kinds of tabs exist.
 *   render(tab)  -> JSX content for the tab
 *   urlOf(tab)   -> URL the tab should reflect when active
 *   icon         -> Tab strip icon component (Fluent icon)
 *   status       -> 'ready' (mounted) or 'soon' (placeholder)
 *
 * APP_MENU entries that map to a 'soon' window render the StubWindow.
 */

const useHomeStyles = makeStyles({
  home: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  stub: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
  },
  unknown: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
  },
  loader: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: tokens.spacingVerticalXXXL,
    paddingBottom: tokens.spacingVerticalXXXL,
  },
});

function ErpHome() {
  const styles = useHomeStyles();
  return (
    <div className={styles.home}>
      <Text size={500} weight="semibold">Welcome</Text>
      <Text>Use the search box on the left (Alt+G) or the sidebar to open a window.</Text>
    </div>
  );
}

function StubWindow({ title, category }) {
  const styles = useHomeStyles();
  return (
    <div className={styles.stub}>
      <Text size={500} weight="semibold">{title}</Text>
      {category && <Text size={300}>{category}</Text>}
      <Badge appearance="outline" size="small">Coming soon</Badge>
      <Text size={200}>This window is in the roadmap but not yet built.</Text>
    </div>
  );
}

/** Build a stub window descriptor for an APP_MENU entry. */
function stub(kind, title, icon, category) {
  return {
    icon,
    titleOf: () => title,
    urlOf: (_tab, tenant) => `/${tenant}/erp/_stub/${kind}`,
    render: () => <StubWindow title={title} category={category} />,
    status: 'soon',
  };
}

export const WINDOWS = {
  home: {
    icon: Home20Regular,
    titleOf: () => 'Home',
    urlOf: (_tab, tenant) => `/${tenant}/erp`,
    render: () => <ErpHome />,
    status: 'ready',
  },
  'product-list': {
    icon: Box20Regular,
    titleOf: () => 'Products',
    urlOf: (_tab, tenant) => `/${tenant}/erp/product`,
    render: () => <ErpProductList />,
    status: 'ready',
  },
  'product-detail': {
    icon: Box20Regular,
    titleOf: (tab) => tab.params?.title || `Product #${tab.params?.id}`,
    urlOf: (tab, tenant) => `/${tenant}/erp/product/${tab.params?.id}`,
    render: (tab) => <ErpProductDetail idOverride={tab.params?.id} />,
    status: 'ready',
  },
  'product-new': {
    icon: Box20Regular,
    titleOf: () => 'New Product',
    urlOf: (_tab, tenant) => `/${tenant}/erp/product/new`,
    render: () => <ErpProductDetail idOverride="new" />,
    status: 'ready',
  },
  // Simplified product list: same component, but row clicks land on the
  // simplified detail. "New" always uses the full editor.
  'product-simple-list': {
    icon: Box20Regular,
    titleOf: () => 'Products (Simple)',
    urlOf: (_tab, tenant) => `/${tenant}/erp/product-simple`,
    render: () => <ErpProductList detailRoute="product-simple" />,
    status: 'ready',
  },
  'product-simple-detail': {
    icon: Box20Regular,
    titleOf: (tab) => tab.params?.title || `Product #${tab.params?.id}`,
    urlOf: (tab, tenant) => `/${tenant}/erp/product-simple/${tab.params?.id}`,
    render: (tab) => <ErpProductSimpleDetail idOverride={tab.params?.id} />,
    status: 'ready',
  },
  'warehouse-list': {
    icon: Building20Regular,
    titleOf: () => 'Warehouses',
    urlOf: (_tab, tenant) => `/${tenant}/erp/warehouse`,
    render: () => <ErpWarehouseList />,
    status: 'ready',
  },
  'warehouse-detail': {
    icon: Building20Regular,
    titleOf: (tab) => tab.params?.title || `Warehouse #${tab.params?.id}`,
    urlOf: (tab, tenant) => `/${tenant}/erp/warehouse/${tab.params?.id}`,
    render: (tab) => <ErpWarehouseDetail idOverride={tab.params?.id} />,
    status: 'ready',
  },
  'bpartner-list': {
    icon: People20Regular,
    titleOf: () => 'Business Partners',
    urlOf: (_tab, tenant) => `/${tenant}/erp/bpartner`,
    render: () => <ErpBPartnerList />,
    status: 'ready',
  },
  'bpartner-detail': {
    icon: People20Regular,
    titleOf: (tab) => tab.params?.title || `Partner #${tab.params?.id}`,
    urlOf: (tab, tenant) => `/${tenant}/erp/bpartner/${tab.params?.id}`,
    render: (tab) => <ErpBPartnerDetail idOverride={tab.params?.id} />,
    status: 'ready',
  },
  'bpartner-new': {
    icon: People20Regular,
    titleOf: () => 'New Business Partner',
    urlOf: (_tab, tenant) => `/${tenant}/erp/bpartner/new`,
    render: () => <ErpBPartnerDetail idOverride="new" />,
    status: 'ready',
  },
};

const CATEGORIES = {
  SALES:    'Quote-to-Invoice',
  PURCH:    'Requisition-to-Invoice',
  MATERIAL: 'Material Management',
  PARTNER:  'Partner Relations',
  PERF:     'Performance Analysis',
  GENERAL:  'General Rules',
  AD:       'Application Dictionary',
};

function entry(kind, title, icon, category, status) {
  if (status === 'soon' && !WINDOWS[kind]) WINDOWS[kind] = stub(kind, title, icon, category);
  return { kind, key: kind, title, icon, category, status };
}

export const APP_MENU = [
  entry('home',                'Home',                  Home20Regular,                null,                    'ready'),

  // Quote-to-Invoice (Sales)
  entry('customer-list',       'Customers',             People20Regular,              CATEGORIES.SALES,        'soon'),
  entry('sales-order',         'Sales Orders',          Cart20Regular,                CATEGORIES.SALES,        'soon'),
  entry('sales-invoice',       'Customer Invoices',     Receipt20Regular,             CATEGORIES.SALES,        'soon'),
  entry('shipment',            'Shipments',             VehicleTruck20Regular,        CATEGORIES.SALES,        'soon'),
  entry('payment-receipt',     'Payment Receipts',      Money20Regular,               CATEGORIES.SALES,        'soon'),
  entry('quote',               'Quotes',                ReceiptMoney20Regular,        CATEGORIES.SALES,        'soon'),

  // Requisition-to-Invoice (Purchasing)
  entry('vendor-list',         'Vendors',               BuildingShop20Regular,        CATEGORIES.PURCH,        'soon'),
  entry('purchase-order',      'Purchase Orders',       Cart20Regular,                CATEGORIES.PURCH,        'soon'),
  entry('vendor-invoice',      'Vendor Invoices',       Receipt20Regular,             CATEGORIES.PURCH,        'soon'),
  entry('material-receipt',    'Material Receipts',     VehicleTruck20Regular,        CATEGORIES.PURCH,        'soon'),
  entry('payment-out',         'Vendor Payments',       Money20Regular,               CATEGORIES.PURCH,        'soon'),

  // Material Management
  entry('product-list',        'Products',              Box20Regular,                 CATEGORIES.MATERIAL,     'ready'),
  entry('product-category',    'Product Categories',    Tag20Regular,                 CATEGORIES.MATERIAL,     'soon'),
  entry('price-list',          'Price Lists',           Tag20Regular,                 CATEGORIES.MATERIAL,     'soon'),
  entry('warehouse-list',      'Warehouses',            Building20Regular,            CATEGORIES.MATERIAL,     'ready'),
  entry('inventory-move',      'Inventory Moves',       ArrowSwap20Regular,           CATEGORIES.MATERIAL,     'soon'),
  entry('uom',                 'Units of Measure',      Ruler20Regular,               CATEGORIES.MATERIAL,     'soon'),
  entry('attribute-set',       'Attributes',            Color20Regular,               CATEGORIES.MATERIAL,     'soon'),

  // Partner Relations
  entry('bpartner-list',       'Business Partners',     People20Regular,              CATEGORIES.PARTNER,      'ready'),
  entry('partner-group',       'Business Partner Groups', People20Regular,            CATEGORIES.PARTNER,      'soon'),
  entry('contact',             'Contacts',              Person20Regular,              CATEGORIES.PARTNER,      'soon'),
  entry('campaign',            'Campaigns',             ChartMultiple20Regular,       CATEGORIES.PARTNER,      'soon'),

  // Performance Analysis
  entry('account-schema',      'Accounting Schema',     BuildingBank20Regular,        CATEGORIES.PERF,         'soon'),
  entry('gl-journal',          'GL Journal',            Organization20Regular,        CATEGORIES.PERF,         'soon'),
  entry('tax-rate',            'Tax Rates',             Tag20Regular,                 CATEGORIES.PERF,         'soon'),
  entry('ar-aging',            'A/R Aging',             Timeline20Regular,            CATEGORIES.PERF,         'soon'),
  entry('ap-aging',            'A/P Aging',             Timeline20Regular,            CATEGORIES.PERF,         'soon'),
  entry('cost-type',           'Cost Types',            Wrench20Regular,              CATEGORIES.PERF,         'soon'),

  // General Rules
  entry('tenant-list',         'Tenants',               Building20Regular,            CATEGORIES.GENERAL,      'soon'),
  entry('organization',        'Organizations',         Building20Regular,            CATEGORIES.GENERAL,      'soon'),
  entry('role',                'Roles',                 ContactCard20Regular,         CATEGORIES.GENERAL,      'soon'),
  entry('user-list',           'Users',                 Person20Regular,              CATEGORIES.GENERAL,      'soon'),
  entry('country',             'Countries',             Globe20Regular,               CATEGORIES.GENERAL,      'soon'),
  entry('currency',            'Currencies',            Money20Regular,               CATEGORIES.GENERAL,      'soon'),
  entry('calendar',            'Calendars',             Organization20Regular,        CATEGORIES.GENERAL,      'soon'),

  // Application Dictionary (superuser-style)
  entry('ad-window',           'Windows',               Braces20Regular,              CATEGORIES.AD,           'soon'),
  entry('ad-tab',              'Tabs',                  Braces20Regular,              CATEGORIES.AD,           'soon'),
  entry('ad-field',            'Fields',                Braces20Regular,              CATEGORIES.AD,           'soon'),
  entry('ad-element',          'Elements',              PuzzlePiece20Regular,         CATEGORIES.AD,           'soon'),
  entry('ad-reference',        'References',            PuzzlePiece20Regular,         CATEGORIES.AD,           'soon'),
  entry('ad-process',          'Processes',             Settings20Regular,            CATEGORIES.AD,           'soon'),
];

/** Renders a tab's content with a small fallback. */
export function TabContent({ tab }) {
  const styles = useHomeStyles();
  const w = WINDOWS[tab.kind];
  if (!w) {
    return <div className={styles.unknown}>Unknown window: {tab.kind}</div>;
  }
  return (
    <Suspense fallback={
      <div className={styles.loader}><Spinner size="small" /></div>
    }>
      {w.render(tab)}
    </Suspense>
  );
}
