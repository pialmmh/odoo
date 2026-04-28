import { useEffect } from 'react';
import { Box, Toolbar } from '@mui/material';
import { Outlet, useParams } from 'react-router-dom';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import TopBar from './TopBar';
import { useTenant } from '../context/TenantContext';
import { getPartnerIdFromSlug } from '../config/platform';

export default function MainLayout() {
  const { tenant: tenantSlug } = useParams();
  const { tenants, activeTenant, switchTenant } = useTenant();

  // Auto-select tenant from URL when tenants are loaded
  useEffect(() => {
    if (!tenantSlug || tenants.length === 0) return;
    if (activeTenant?.slug === tenantSlug) return;
    const found = tenants.find(t => t.slug === tenantSlug);
    if (found) switchTenant(found);
  }, [tenantSlug, tenants, activeTenant]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar />
      <TopBar />
      {/*
        minWidth: 0 lets the flex item shrink below the intrinsic width of
        its widest descendant (default is `min-width: auto`). Without it a
        wide child — e.g. a tab content with a long table — blows the main
        column past the viewport, which gives the page a horizontal scroll
        bar; the sticky Sidebar then slides left with the scrolled content.
      */}
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: 3, ml: 0 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
