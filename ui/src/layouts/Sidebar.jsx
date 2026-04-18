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
  AddShoppingCart as PurchaseIcon,
  ContactPhone as CrmIcon,
  PersonAdd as LeadsIcon,
  Person as ContactsIcon,
  Business as AccountsIcon,
  TrendingUp as OpportunitiesIcon,
  SupportAgent as CasesIcon,
  TaskAlt as TasksIcon,
  VideoCall as MeetingsIcon,
  Dashboard as MeetingDashIcon,
  MeetingRoom as RoomsIcon,
  CalendarMonth as CalendarIcon,
  Email as EmailsIcon,
  Campaign as CampaignIcon,
  Phone as VoiceIcon,
  Policy as PolicyIcon,
  Tune as AdminToolsIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useTenant } from '../context/TenantContext';
import { useRBAC } from '../hooks/useRBAC';
import config, { FEATURES } from '../config/platform';

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
    { text: 'Pricing', icon: <PricingIcon />, path: `${base}/pricing` },
    { text: 'Rate History', icon: <HistoryIcon />, path: `${base}/rate-history` },
    { text: 'AR Report', icon: <ARIcon />, path: `${base}/reports/ar` },
    { text: 'Purchase', icon: <PurchaseIcon />, path: `${base}/purchase` },

    // ── Infrastructure ──
    { section: 'Infrastructure' },
    { text: 'Infra', icon: <InfraIcon />, path: `${base}/infra` },
    { text: 'Device Catalog', icon: <CatalogDeviceIcon />, path: `${base}/infra/catalog` },
    { text: 'SSH', icon: <SSHIcon />, path: `${base}/infra/ssh` },

    // ── Artifacts ──
    { section: 'Artifacts' },
    { text: 'Artifacts', icon: <ArtifactIcon />, path: `${base}/artifacts` },

    // ── CRM (feature-flagged) ──
    ...(FEATURES.crm ? [
      { section: 'CRM' },
      { text: 'Leads',         icon: <LeadsIcon />,         path: `${base}/crm/leads` },
      { text: 'Contacts',      icon: <ContactsIcon />,      path: `${base}/crm/contacts` },
      { text: 'Accounts',      icon: <AccountsIcon />,      path: `${base}/crm/accounts` },
      { text: 'Opportunities', icon: <OpportunitiesIcon />, path: `${base}/crm/opportunities` },
      { text: 'Cases',         icon: <CasesIcon />,         path: `${base}/crm/cases` },
      { text: 'Tasks',         icon: <TasksIcon />,         path: `${base}/crm/tasks` },
      { text: 'Meetings',      icon: <MeetingsIcon />,      path: `${base}/crm/meetings` },
      { text: 'Meeting Dashboard', icon: <MeetingDashIcon />, path: `${base}/crm/meetings/dashboard` },
      { text: 'Rooms (Admin)', icon: <RoomsIcon />,         path: `${base}/crm/meetings/rooms` },
      { text: 'Demo Room',     icon: <MeetingsIcon />,      path: `${base}/crm/meetings/demo/room` },
      { text: 'Calendar',      icon: <CalendarIcon />,      path: `${base}/crm/calendar` },
      { text: 'Emails',        icon: <EmailsIcon />,        path: `${base}/crm/emails` },
      { text: 'Administration', icon: <AdminToolsIcon />,    path: `${base}/crm/admin` },

      { section: 'Campaign' },
      { text: 'Voice Campaigns', icon: <VoiceIcon />,    path: `${base}/crm/campaign/voice` },
      { text: 'Voice Policies',  icon: <PolicyIcon />,   path: `${base}/crm/campaign/voice/policies` },
    ] : []),

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
    // Voice Campaigns parent vs Voice Policies sibling: don't highlight parent
    // when on /policies child.
    if (path === `${base}/crm/campaign/voice`)
      return loc.startsWith(path) && !loc.startsWith(`${path}/policies`);
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
          bgcolor: 'background.paper',
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
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
            const neutral = item.section === 'Admin';
            return (
              <Box key={`sec-${item.section}`} sx={{ mt: idx === 0 ? 0 : 0.5 }}>
                <span className={`sidebar-section${neutral ? ' sidebar-section--neutral' : ''}`}>
                  {item.section}
                </span>
              </Box>
            );
          }

          return (
            <ListItemButton
              key={item.text}
              onClick={() => {
                // If we're on a deeper sub-path of this item (e.g. on
                // /cases/new and clicking "Cases"), replace the history
                // entry. This drops abandoned create/edit drafts from
                // the back-history so browser-back can't resurrect them.
                const loc = location.pathname;
                const onSubPath = loc !== item.path && loc.startsWith(item.path + '/');
                navigate(item.path, onSubPath ? { replace: true } : undefined);
              }}
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
              <ListItemIcon sx={{ minWidth: 32, color: isActive(item.path) ? 'primary.main' : 'text.primary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontSize: 13, fontWeight: isActive(item.path) ? 700 : 600, color: 'text.primary' }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
