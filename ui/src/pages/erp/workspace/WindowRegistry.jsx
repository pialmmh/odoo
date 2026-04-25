import { Suspense } from 'react';
import { Box, CircularProgress, Typography, Chip } from '@mui/material';
import {
  HomeOutlined, Inventory2Outlined, GroupOutlined, ReceiptLongOutlined,
  ShoppingCartOutlined, LocalShippingOutlined, PaymentsOutlined, RequestQuoteOutlined,
  StoreOutlined, CategoryOutlined, AccountBalanceOutlined, AccountTreeOutlined,
  PersonOutlineOutlined, BusinessOutlined, AssignmentIndOutlined, LanguageOutlined,
  SettingsApplicationsOutlined, DataObjectOutlined, ExtensionOutlined,
  AssessmentOutlined, TimelineOutlined, EngineeringOutlined, PercentOutlined,
  SwapHorizOutlined, ScaleOutlined, ColorLensOutlined,
} from '@mui/icons-material';
import ErpProductList from '../ErpProductList';
import ErpProductDetail from '../ErpProductDetail';

/**
 * Window registry — single source of truth for what kinds of tabs exist.
 *   render(tab)  -> JSX content for the tab
 *   urlOf(tab)   -> URL the tab should reflect when active
 *   icon         -> Tab strip icon
 *   status       -> 'ready' (mounted) or 'soon' (placeholder)
 *
 * APP_MENU entries that map to a 'soon' window render the StubWindow.
 */

function ErpHome() {
  return (
    <Box sx={{ p: 'var(--space-4)', color: 'text.secondary' }}>
      <Typography variant="h6" sx={{ mb: 'var(--space-2)' }}>Welcome</Typography>
      <Typography variant="body2">
        Use the search box on the left (Alt+G) or the sidebar to open a window.
      </Typography>
    </Box>
  );
}

function StubWindow({ title, category }) {
  return (
    <Box sx={{ p: 'var(--space-6)', textAlign: 'center' }}>
      <Typography variant="h6" sx={{ mb: 'var(--space-1)' }}>{title}</Typography>
      {category && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 'var(--space-3)' }}>
          {category}
        </Typography>
      )}
      <Chip label="Coming soon" size="small" variant="outlined" />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 'var(--space-4)' }}>
        This window is in the roadmap but not yet built.
      </Typography>
    </Box>
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
    icon: HomeOutlined,
    titleOf: () => 'Home',
    urlOf: (_tab, tenant) => `/${tenant}/erp`,
    render: () => <ErpHome />,
    status: 'ready',
  },
  'product-list': {
    icon: Inventory2Outlined,
    titleOf: () => 'Products',
    urlOf: (_tab, tenant) => `/${tenant}/erp/product`,
    render: () => <ErpProductList />,
    status: 'ready',
  },
  'product-detail': {
    icon: Inventory2Outlined,
    titleOf: (tab) => tab.params?.title || `Product #${tab.params?.id}`,
    urlOf: (tab, tenant) => `/${tenant}/erp/product/${tab.params?.id}`,
    render: (tab) => <ErpProductDetail idOverride={tab.params?.id} />,
    status: 'ready',
  },
  'product-new': {
    icon: Inventory2Outlined,
    titleOf: () => 'New Product',
    urlOf: (_tab, tenant) => `/${tenant}/erp/product/new`,
    render: () => <ErpProductDetail idOverride="new" />,
    status: 'ready',
  },
};

/**
 * APP_MENU — categories follow iDempiere's superuser menu groupings, curated
 * down to what we plan to support. Each entry is searchable; selecting opens
 * the matching window (real or stub).
 *
 * Categories (mirroring iDempiere): Quote-to-Invoice, Requisition-to-Invoice,
 * Material Management, Performance Analysis, Partner Relations, General Rules,
 * Application Dictionary.
 */
const CATEGORIES = {
  SALES:    'Quote-to-Invoice',
  PURCH:    'Requisition-to-Invoice',
  MATERIAL: 'Material Management',
  PARTNER:  'Partner Relations',
  PERF:     'Performance Analysis',
  GENERAL:  'General Rules',
  AD:       'Application Dictionary',
};

/** Helper to declare a menu entry + (if soon) auto-register a stub window. */
function entry(kind, title, icon, category, status) {
  if (status === 'soon' && !WINDOWS[kind]) WINDOWS[kind] = stub(kind, title, icon, category);
  return { kind, key: kind, title, icon, category, status };
}

export const APP_MENU = [
  entry('home',                'Home',                  HomeOutlined,                 null,                    'ready'),

  // Quote-to-Invoice (Sales)
  entry('customer-list',       'Customers',             GroupOutlined,                CATEGORIES.SALES,        'soon'),
  entry('sales-order',         'Sales Orders',          ShoppingCartOutlined,         CATEGORIES.SALES,        'soon'),
  entry('sales-invoice',       'Customer Invoices',     ReceiptLongOutlined,          CATEGORIES.SALES,        'soon'),
  entry('shipment',            'Shipments',             LocalShippingOutlined,        CATEGORIES.SALES,        'soon'),
  entry('payment-receipt',     'Payment Receipts',      PaymentsOutlined,             CATEGORIES.SALES,        'soon'),
  entry('quote',               'Quotes',                RequestQuoteOutlined,         CATEGORIES.SALES,        'soon'),

  // Requisition-to-Invoice (Purchasing)
  entry('vendor-list',         'Vendors',               StoreOutlined,                CATEGORIES.PURCH,        'soon'),
  entry('purchase-order',      'Purchase Orders',       ShoppingCartOutlined,         CATEGORIES.PURCH,        'soon'),
  entry('vendor-invoice',      'Vendor Invoices',       ReceiptLongOutlined,          CATEGORIES.PURCH,        'soon'),
  entry('material-receipt',    'Material Receipts',     LocalShippingOutlined,        CATEGORIES.PURCH,        'soon'),
  entry('payment-out',         'Vendor Payments',       PaymentsOutlined,             CATEGORIES.PURCH,        'soon'),

  // Material Management
  entry('product-list',        'Products',              Inventory2Outlined,           CATEGORIES.MATERIAL,     'ready'),
  entry('product-category',    'Product Categories',    CategoryOutlined,             CATEGORIES.MATERIAL,     'soon'),
  entry('price-list',          'Price Lists',           PercentOutlined,              CATEGORIES.MATERIAL,     'soon'),
  entry('warehouse',           'Warehouses',            BusinessOutlined,             CATEGORIES.MATERIAL,     'soon'),
  entry('inventory-move',      'Inventory Moves',       SwapHorizOutlined,            CATEGORIES.MATERIAL,     'soon'),
  entry('uom',                 'Units of Measure',      ScaleOutlined,                CATEGORIES.MATERIAL,     'soon'),
  entry('attribute-set',       'Attributes',            ColorLensOutlined,            CATEGORIES.MATERIAL,     'soon'),

  // Partner Relations
  entry('partner-group',       'Business Partner Groups', GroupOutlined,              CATEGORIES.PARTNER,      'soon'),
  entry('contact',             'Contacts',              PersonOutlineOutlined,        CATEGORIES.PARTNER,      'soon'),
  entry('campaign',            'Campaigns',             AssessmentOutlined,           CATEGORIES.PARTNER,      'soon'),

  // Performance Analysis
  entry('account-schema',      'Accounting Schema',     AccountBalanceOutlined,       CATEGORIES.PERF,         'soon'),
  entry('gl-journal',          'GL Journal',            AccountTreeOutlined,          CATEGORIES.PERF,         'soon'),
  entry('tax-rate',            'Tax Rates',             PercentOutlined,              CATEGORIES.PERF,         'soon'),
  entry('ar-aging',            'A/R Aging',             TimelineOutlined,             CATEGORIES.PERF,         'soon'),
  entry('ap-aging',            'A/P Aging',             TimelineOutlined,             CATEGORIES.PERF,         'soon'),
  entry('cost-type',           'Cost Types',            EngineeringOutlined,          CATEGORIES.PERF,         'soon'),

  // General Rules
  entry('tenant-list',         'Tenants',               BusinessOutlined,             CATEGORIES.GENERAL,      'soon'),
  entry('organization',        'Organizations',         BusinessOutlined,             CATEGORIES.GENERAL,      'soon'),
  entry('role',                'Roles',                 AssignmentIndOutlined,        CATEGORIES.GENERAL,      'soon'),
  entry('user-list',           'Users',                 PersonOutlineOutlined,        CATEGORIES.GENERAL,      'soon'),
  entry('country',             'Countries',             LanguageOutlined,             CATEGORIES.GENERAL,      'soon'),
  entry('currency',            'Currencies',            PaymentsOutlined,             CATEGORIES.GENERAL,      'soon'),
  entry('calendar',            'Calendars',             AccountTreeOutlined,          CATEGORIES.GENERAL,      'soon'),

  // Application Dictionary (superuser-style)
  entry('ad-window',           'Windows',               DataObjectOutlined,           CATEGORIES.AD,           'soon'),
  entry('ad-tab',              'Tabs',                  DataObjectOutlined,           CATEGORIES.AD,           'soon'),
  entry('ad-field',            'Fields',                DataObjectOutlined,           CATEGORIES.AD,           'soon'),
  entry('ad-element',          'Elements',              ExtensionOutlined,            CATEGORIES.AD,           'soon'),
  entry('ad-reference',        'References',            ExtensionOutlined,            CATEGORIES.AD,           'soon'),
  entry('ad-process',          'Processes',             SettingsApplicationsOutlined, CATEGORIES.AD,           'soon'),
];

/** Renders a tab's content with a small fallback. */
export function TabContent({ tab }) {
  const w = WINDOWS[tab.kind];
  if (!w) {
    return (
      <Box sx={{ p: 'var(--space-4)', color: 'text.secondary' }}>
        Unknown window: {tab.kind}
      </Box>
    );
  }
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 'var(--space-8)' }}>
        <CircularProgress size={24} />
      </Box>
    }>
      {w.render(tab)}
    </Suspense>
  );
}
