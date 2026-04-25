import { useEffect, useRef } from 'react';
import { Box, Divider } from '@mui/material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { WorkspaceProvider, useWorkspace } from './workspaceStore';
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
export default function ErpWorkspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}

function WorkspaceShell() {
  const { tenant } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tabs, activeKey, openTab, closeTab, activateTab } = useWorkspace();

  // URL → tab sync. The shell owns this so deep links and sidebar clicks just work.
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
    const m = rest.match(/^product\/([^/]+)$/);
    if (m) {
      const id = m[1];
      openTab({
        kind: 'product-detail',
        key: `product:${id}`,
        title: `Product #${id}`,
        params: { id },
      });
      return;
    }
    // Fallback: open the list.
    openTab({ kind: 'product-list', key: 'product-list', title: 'Products', params: {} });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, tenant]);

  // Active tab → URL sync. When the user clicks a tab, push its URL.
  const handleActivate = (key) => {
    activateTab(key);
    const tab = tabs.find((t) => t.key === key);
    if (!tab) return;
    const url = WINDOWS[tab.kind]?.urlOf(tab, tenant);
    if (url && url !== location.pathname) navigate(url);
  };

  const handleClose = (key) => closeTab(key);

  // After activeKey changes (tab click or close picking a neighbor), reflect into URL.
  // Skip the very first run so the URL→tab effect can claim its own activeKey first.
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - var(--space-6))' }}>
      {/* Top bar: search (left) + tab strip (right) */}
      <Box
        sx={{
          display: 'flex', alignItems: 'stretch', gap: 'var(--space-3)',
          pb: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AppSearch onSelect={handleSearchSelect} />
        </Box>
        <Divider orientation="vertical" flexItem sx={{ mx: 'var(--space-1)' }} />
        <TabStrip onActivate={handleActivate} onClose={handleClose} />
      </Box>

      {/* Content area: keep-alive — render all tabs, hide non-active. */}
      <Box
        sx={{
          flex: 1, minHeight: 0,
          mt: '-1px', // align with the active tab's bottom border
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          borderTopLeftRadius: 0,
          bgcolor: 'background.paper',
          p: 'var(--space-4)',
          overflow: 'auto',
        }}
      >
        {tabs.length === 0 ? (
          <Box sx={{ color: 'text.secondary', p: 'var(--space-4)' }}>
            No windows open. Use the search box on the left or the sidebar.
          </Box>
        ) : (
          tabs.map((tab) => (
            <Box
              key={tab.key}
              sx={{ display: tab.key === activeKey ? 'block' : 'none' }}
            >
              <TabContent tab={tab} />
            </Box>
          ))
        )}
      </Box>

    </Box>
  );
}
