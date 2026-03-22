import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Box, Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Subscriptions as SubIcon,
  Receipt as InvoiceIcon,
  Inventory as CatalogIcon,
  Business as TenantIcon,
  Assessment as ARIcon,
  Payments as PaymentsIcon,
  ShoppingCart as ProductsIcon,
  PriceChange as PricingIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Lan as InfraIcon,
  DeviceHub as CatalogDeviceIcon,
  VpnKey as SSHIcon,
  Inventory2 as ArtifactIcon,
  AdminPanelSettings as RBACIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useTenant } from '../context/TenantContext';
import { useRBAC } from '../hooks/useRBAC';
import config from '../config/platform';

const DRAWER_WIDTH = 240;

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant: tenantSlug } = useParams();
  const { isSuper } = useAuth();
  const { brand } = useAppTheme();
  const { tenantName } = useTenant();
  const { canMenu } = useRBAC();

  const base = tenantSlug ? `/${tenantSlug}` : '';

  // Menu organized by category. `null` items are section headers.
  const menu = [
    // ── Overview ──
    { text: 'Dashboard', icon: <DashboardIcon />, path: `${base}/` },

    // ── Billing ──
    { section: 'Billing' },
    { text: 'Customers', icon: <PeopleIcon />, path: `${base}/customers` },
    { text: 'Subscriptions', icon: <SubIcon />, path: `${base}/subscriptions` },
    { text: 'Invoices', icon: <InvoiceIcon />, path: `${base}/invoices` },
    { text: 'Payments', icon: <PaymentsIcon />, path: `${base}/payments` },
    { text: 'Products', icon: <ProductsIcon />, path: `${base}/products` },
    { text: 'Catalog', icon: <CatalogIcon />, path: `${base}/catalog` },
    { text: 'Pricing', icon: <PricingIcon />, path: `${base}/pricing` },
    { text: 'Rate History', icon: <HistoryIcon />, path: `${base}/rate-history` },
    { text: 'AR Report', icon: <ARIcon />, path: `${base}/reports/ar` },

    // ── Infrastructure ──
    { section: 'Infrastructure' },
    { text: 'Infra', icon: <InfraIcon />, path: `${base}/infra` },
    { text: 'Device Catalog', icon: <CatalogDeviceIcon />, path: `${base}/infra/catalog` },
    { text: 'SSH', icon: <SSHIcon />, path: `${base}/infra/ssh` },

    // ── Artifacts ──
    { section: 'Artifacts' },
    { text: 'Artifacts', icon: <ArtifactIcon />, path: `${base}/artifacts` },

    // ── Admin ──
    { section: 'Admin' },
    { text: 'RBAC', icon: <RBACIcon />, path: `${base}/rbac` },
    { text: 'Tenants', icon: <TenantIcon />, path: `${base}/tenants` },
    { text: 'Settings', icon: <SettingsIcon />, path: `${base}/settings` },
  ];

  const isActive = (path) => {
    const loc = location.pathname;
    if (path === `${base}/`) return loc === `${base}/` || loc === `${base}`;
    if (path === `${base}/infra`) return loc === `${base}/infra`;
    return loc.startsWith(path);
  };

  // Filter items by RBAC, and hide section headers if all their items are hidden
  const visibleItems = [];
  let i = 0;
  while (i < menu.length) {
    const item = menu[i];
    if (item.section) {
      // Collect following non-section items
      const sectionItems = [];
      let j = i + 1;
      while (j < menu.length && !menu[j].section) {
        if (canMenu(menu[j].text)) sectionItems.push(menu[j]);
        j++;
      }
      if (sectionItems.length > 0) {
        visibleItems.push(item); // section header
        visibleItems.push(...sectionItems);
      }
      i = j;
    } else {
      // Top-level item (Dashboard)
      if (canMenu(item.text)) visibleItems.push(item);
      i++;
    }
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          bgcolor: '#fff',
          borderRight: '1px solid #e5e7eb',
        },
      }}
    >
      <Toolbar sx={{ px: 2, gap: 1 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: '8px',
            bgcolor: 'primary.main', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{config.appShortName}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {tenantName || config.appName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
            {tenantSlug || 'Select tenant'}
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, pt: 0.5, overflow: 'auto' }}>
        {visibleItems.map((item, idx) => {
          if (item.section) {
            return (
              <Typography
                key={`sec-${item.section}`}
                variant="overline"
                sx={{
                  display: 'block',
                  px: 1.5,
                  pt: idx === 0 ? 0.5 : 1.5,
                  pb: 0.3,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: 'text.secondary',
                  lineHeight: 1,
                }}
              >
                {item.section}
              </Typography>
            );
          }

          return (
            <ListItemButton
              key={item.text}
              onClick={() => navigate(item.path)}
              selected={isActive(item.path)}
              sx={{
                borderRadius: '6px', mb: 0.3, py: 0.4,
                '&.Mui-selected': {
                  bgcolor: brand.sidebar.activeBg,
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                },
                '&:hover': { bgcolor: brand.sidebar.hoverBg },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: isActive(item.path) ? 'primary.main' : '#6b7280' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontSize: 13, fontWeight: isActive(item.path) ? 600 : 400 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
