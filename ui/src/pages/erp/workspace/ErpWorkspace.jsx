import { useEffect, useRef } from 'react';
import { makeStyles, mergeClasses, tokens, Divider } from '@fluentui/react-components';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { WorkspaceProvider, useWorkspace, ActiveTabProvider } from './workspaceStore';
import { TabContent, WINDOWS } from './WindowRegistry';
import AppSearch from './AppSearch';
import TabStrip from './TabStrip';

/**
 * ErpWorkspace — multi-document shell scoped to /:tenant/erp/*.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [App search ▾] │ [Home ×][Product:Azalea ×]              │  <- top bar
 *   ├──────────────────────────────────────────────────────────┤
 *   │ <active tab content; siblings kept alive but hidden>     │
 *   └──────────────────────────────────────────────────────────┘
 *
 * URL is a thin reflection of the active tab. Visiting an ERP route
 * opens that window if not already open and focuses it.
 */

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 64px - 24px)',
    minWidth: 0,
  },
  topbar: {
    display: 'flex',
    alignItems: 'stretch',
    gap: tokens.spacingHorizontalM,
    paddingBottom: 0,
  },
  searchSlot: {
    display: 'flex',
    alignItems: 'center',
  },
  divider: {
    marginLeft: tokens.spacingHorizontalXS,
    marginRight: tokens.spacingHorizontalXS,
  },
  content: {
    flex: 1,
    minHeight: 0,
    marginTop: '-1px',
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
    borderTopRightRadius: tokens.borderRadiusMedium,
    borderBottomRightRadius: tokens.borderRadiusMedium,
    borderBottomLeftRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    overflow: 'auto',
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  tabHidden: { display: 'none' },
  tabVisible: { display: 'block' },
});

export default function ErpWorkspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}

function WorkspaceShell() {
  const styles = useStyles();
  const { tenant } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tabs, activeKey, openTab, closeTab, activateTab } = useWorkspace();

  // URL → tab sync.
  useEffect(() => {
    const path = location.pathname;
    const base = `/${tenant}/erp`;
    if (!path.startsWith(base)) return;
    const rest = path.slice(base.length).replace(/^\/+/, '');

    if (rest === '' || rest === 'home') {
      openTab({ kind: 'home', key: 'home', title: 'Home', params: {}, pinned: true });
      return;
    }
    if (rest === 'product') {
      openTab({ kind: 'product-list', key: 'product-list', title: 'Products', params: {} });
      return;
    }
    if (rest === 'product/new') {
      openTab({ kind: 'product-new', key: 'product-new', title: 'New Product', params: {} });
      return;
    }
    const productMatch = rest.match(/^product\/([^/]+)$/);
    if (productMatch) {
      const id = productMatch[1];
      openTab({
        kind: 'product-detail',
        key: `product:${id}`,
        title: `Product #${id}`,
        params: { id },
      });
      return;
    }
    if (rest === 'product-simple') {
      openTab({ kind: 'product-simple-list', key: 'product-simple-list', title: 'Products (Simple)', params: {} });
      return;
    }
    const productSimpleMatch = rest.match(/^product-simple\/([^/]+)$/);
    if (productSimpleMatch) {
      const id = productSimpleMatch[1];
      openTab({
        kind: 'product-simple-detail',
        key: `product-simple:${id}`,
        title: `Product #${id}`,
        params: { id },
      });
      return;
    }
    if (rest === 'warehouse') {
      openTab({ kind: 'warehouse-list', key: 'warehouse-list', title: 'Warehouses', params: {} });
      return;
    }
    const warehouseMatch = rest.match(/^warehouse\/([^/]+)$/);
    if (warehouseMatch) {
      const id = warehouseMatch[1];
      openTab({
        kind: 'warehouse-detail',
        key: `warehouse:${id}`,
        title: `Warehouse #${id}`,
        params: { id },
      });
      return;
    }
    if (rest === 'bpartner') {
      openTab({ kind: 'bpartner-list', key: 'bpartner-list', title: 'Business Partners', params: {} });
      return;
    }
    if (rest === 'bpartner/new') {
      openTab({ kind: 'bpartner-new', key: 'bpartner-new', title: 'New Business Partner', params: {} });
      return;
    }
    const bpartnerMatch = rest.match(/^bpartner\/([^/]+)$/);
    if (bpartnerMatch) {
      const id = bpartnerMatch[1];
      openTab({
        kind: 'bpartner-detail',
        key: `bpartner:${id}`,
        title: `Partner #${id}`,
        params: { id },
      });
      return;
    }
    openTab({ kind: 'product-list', key: 'product-list', title: 'Products', params: {} });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, tenant]);

  const handleActivate = (key) => {
    activateTab(key);
    const tab = tabs.find((t) => t.key === key);
    if (!tab) return;
    const url = WINDOWS[tab.kind]?.urlOf(tab, tenant);
    if (url && url !== location.pathname) navigate(url);
  };

  const handleClose = (key) => closeTab(key);

  const lastActiveKey = useRef(activeKey);
  useEffect(() => {
    if (lastActiveKey.current === activeKey) return;
    lastActiveKey.current = activeKey;
    if (!activeKey) {
      if (location.pathname !== `/${tenant}/erp`) navigate(`/${tenant}/erp`);
      return;
    }
    const tab = tabs.find((t) => t.key === activeKey);
    if (!tab) return;
    const url = WINDOWS[tab.kind]?.urlOf(tab, tenant);
    if (url && url !== location.pathname) navigate(url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const handleSearchSelect = (entry) => {
    openTab({ kind: entry.kind, key: entry.key, title: entry.title, params: entry.params || {} });
  };

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.searchSlot}>
          <AppSearch onSelect={handleSearchSelect} />
        </div>
        <Divider vertical className={styles.divider} />
        <TabStrip onActivate={handleActivate} onClose={handleClose} />
      </div>

      <div className={styles.content}>
        {tabs.length === 0 ? (
          <div className={styles.empty}>
            No windows open. Use the search box on the left or the sidebar.
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.key}
              className={mergeClasses(tab.key === activeKey ? styles.tabVisible : styles.tabHidden)}
            >
              <ActiveTabProvider tab={tab}>
                <TabContent tab={tab} />
              </ActiveTabProvider>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
