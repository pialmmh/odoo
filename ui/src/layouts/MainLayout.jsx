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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f6fa' }}>
      <Sidebar />
      <TopBar />
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: 0 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
