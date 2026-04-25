import { lazy, Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  Inventory2Outlined, HomeOutlined, ReceiptLongOutlined, GroupOutlined,
} from '@mui/icons-material';
import ErpProductList from '../ErpProductList';
import ErpProductDetail from '../ErpProductDetail';

/**
 * Window registry — single source of truth for what kinds of tabs exist.
 *
 *   render(tab)  -> JSX content for the tab
 *   urlOf(tab)   -> URL the tab should reflect when active
 *   icon         -> Tab strip icon
 *
 * `tab.params` carries kind-specific data (e.g. { id } for product detail).
 */

function ErpHome() {
  return (
    <Box sx={{ p: 'var(--space-4)', color: 'text.secondary' }}>
      Welcome to ERP. Use the search on the left or the sidebar to open a window.
    </Box>
  );
}

export const WINDOWS = {
  home: {
    icon: HomeOutlined,
    titleOf: () => 'Home',
    urlOf: (_tab, tenant) => `/${tenant}/erp`,
    render: () => <ErpHome />,
  },
  'product-list': {
    icon: Inventory2Outlined,
    titleOf: () => 'Products',
    urlOf: (_tab, tenant) => `/${tenant}/erp/product`,
    render: () => <ErpProductList />,
  },
  'product-detail': {
    icon: Inventory2Outlined,
    titleOf: (tab) => tab.params?.title || `Product #${tab.params?.id}`,
    urlOf: (tab, tenant) => `/${tenant}/erp/product/${tab.params?.id}`,
    render: (tab) => <ErpProductDetail idOverride={tab.params?.id} />,
  },
  'product-new': {
    icon: Inventory2Outlined,
    titleOf: () => 'New Product',
    urlOf: (_tab, tenant) => `/${tenant}/erp/product/new`,
    render: () => <ErpProductDetail idOverride="new" />,
  },
};

/** Static list shown in the App search dropdown. */
export const APP_MENU = [
  { kind: 'home',         key: 'home',         title: 'Home',     icon: HomeOutlined },
  { kind: 'product-list', key: 'product-list', title: 'Products', icon: Inventory2Outlined },
  // Future windows go here — they don't need to exist as routes to be searchable.
  // { kind: 'customer-list',     key: 'customer-list',     title: 'Customers',     icon: GroupOutlined },
  // { kind: 'subscription-list', key: 'subscription-list', title: 'Subscriptions', icon: ReceiptLongOutlined },
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
