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

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: `${base}/` },
    { text: 'Customers', icon: <PeopleIcon />, path: `${base}/customers` },
    { text: 'Subscriptions', icon: <SubIcon />, path: `${base}/subscriptions` },
    { text: 'Invoices', icon: <InvoiceIcon />, path: `${base}/invoices` },
    { text: 'Payments', icon: <PaymentsIcon />, path: `${base}/payments` },
    { text: 'Catalog', icon: <CatalogIcon />, path: `${base}/catalog` },
    { text: 'Products', icon: <ProductsIcon />, path: `${base}/products` },
    { text: 'Pricing', icon: <PricingIcon />, path: `${base}/pricing` },
    { text: 'Rate History', icon: <HistoryIcon />, path: `${base}/rate-history` },
    { text: 'AR Report', icon: <ARIcon />, path: `${base}/reports/ar` },
    { text: 'Infra', icon: <InfraIcon />, path: `${base}/infra` },
    { text: 'Device Catalog', icon: <CatalogDeviceIcon />, path: `${base}/infra/catalog` },
    { text: 'SSH', icon: <SSHIcon />, path: `${base}/infra/ssh` },
    { text: 'Artifacts', icon: <ArtifactIcon />, path: `${base}/artifacts` },
    { text: 'Settings', icon: <SettingsIcon />, path: `${base}/settings` },
  ];

  // Tenants always in the list — RBAC canMenu() will hide it for non-admins
  menuItems.push({ text: 'Tenants', icon: <TenantIcon />, path: `${base}/tenants` });

  const isActive = (path) => {
    const loc = location.pathname;
    // Exact match for dashboard
    if (path === `${base}/`) return loc === `${base}/` || loc === `${base}`;
    // Exact match for /infra (not /infra/catalog)
    if (path === `${base}/infra`) return loc === `${base}/infra`;
    return loc.startsWith(path);
  };

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
      <List sx={{ px: 1, pt: 1 }}>
        {menuItems.filter(item => canMenu(item.text)).map((item) => (
          <ListItemButton
            key={item.text}
            onClick={() => navigate(item.path)}
            selected={isActive(item.path)}
            sx={{
              borderRadius: '6px', mb: 0.5,
              '&.Mui-selected': {
                bgcolor: brand.sidebar.activeBg,
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
              '&:hover': { bgcolor: brand.sidebar.hoverBg },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: isActive(item.path) ? 'primary.main' : '#6b7280' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{ fontSize: 14, fontWeight: isActive(item.path) ? 600 : 400 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
