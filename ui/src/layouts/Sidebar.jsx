import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { makeStyles, mergeClasses, tokens, Text } from '@fluentui/react-components';
import {
  Board20Regular, People20Regular, ArrowSync20Regular, Receipt20Regular,
  Building20Regular, ChartMultiple20Regular, Money20Regular, Cart20Regular,
  Tag20Regular, History20Regular, Settings20Regular, PlugConnected20Regular,
  Connector20Regular, Key20Regular, Box20Regular, Shield20Regular,
  CoinStack20Regular, PersonAdd20Regular, Person20Regular, ArrowTrending20Regular,
  Headset20Regular, TaskListSquareLtr20Regular, Video20Regular,
  MeetNow20Regular, CalendarMonth20Regular, Mail20Regular, Megaphone20Regular,
  Phone20Regular, ShieldCheckmark20Regular, Options20Regular, HeartPulse20Regular,
  Clock20Regular, Handshake20Regular, PeopleSettings20Regular,
  PersonAvailable20Regular, BuildingFactory20Regular,
} from '@fluentui/react-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useTenant } from '../context/TenantContext';
import { useRBAC } from '../hooks/useRBAC';
import config, { FEATURES } from '../config/platform';
import { SIDEBAR_ICON_COLORS, SIDEBAR_TEXT_COLOR } from '../theme/fluentTheme';

const DRAWER_WIDTH = 240;

const useStyles = makeStyles({
  drawer: {
    width: `${DRAWER_WIDTH}px`,
    flexShrink: 0,
    height: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: tokens.colorNeutralStroke2,
    position: 'sticky',
    top: 0,
    alignSelf: 'flex-start',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    minHeight: '64px',
    boxSizing: 'border-box',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  brandSquare: {
    width: '32px',
    height: '32px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
    flexShrink: 0,
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  tenantName: {
    fontWeight: tokens.fontWeightBold,
    lineHeight: tokens.lineHeightBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tenantSlug: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase100,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  section: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: '2px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalSNudge,
    paddingBottom: tokens.spacingVerticalSNudge,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    color: SIDEBAR_TEXT_COLOR,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightMedium,
    // Resting tile gets a light-grey wash so the rail reads like a list of
    // chips, matching the ERP product page's vertical tab strip.
    backgroundColor: tokens.colorNeutralBackground2,
    // Strip the UA <button> border on all four sides so items don't render
    // with a visible rectangle outline. Plus appearance:none to drop any
    // remaining native chrome.
    appearance: 'none',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopStyle: 'none',
    borderRightStyle: 'none',
    borderBottomStyle: 'none',
    borderLeftStyle: 'none',
    outlineStyle: 'none',
    textAlign: 'left',
    width: '100%',
    minHeight: '34px',
    transitionProperty: 'background-color',
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      color: tokens.colorNeutralForeground1,
    },
    '&:focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: '-2px',
    },
  },
  itemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    '&:hover': {
      backgroundColor: tokens.colorBrandBackground2Hover,
      color: tokens.colorBrandForeground1,
    },
  },
  itemIcon: {
    flexShrink: 0,
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground1,
    // Restore the icon to 20 px even though the global compact-theme rule in
    // index.css shrinks Fluent's 20 px icons to 16 px. Sidebar wants the
    // larger glyph for navigation legibility.
    '& svg[width="20"][height="20"]': {
      width: '20px',
      height: '20px',
    },
  },
  itemIconActive: {
    color: tokens.colorBrandForeground1,
  },
  itemText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export default function Sidebar() {
  const styles = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant: tenantSlug } = useParams();
  const { isSuper } = useAuth();
  // brand kept for backwards compat with anything that still imports it; not used here.
  useAppTheme();
  const { tenantName } = useTenant();
  const { canMenu } = useRBAC();

  const base = tenantSlug ? `/${tenantSlug}` : '';

  const menu = [
    { text: 'Dashboard', icon: <Board20Regular />, path: `${base}/`, iconColor: SIDEBAR_ICON_COLORS.blue },

    { section: 'Billing' },
    { text: 'Customers', icon: <People20Regular />, path: `${base}/customers`, iconColor: SIDEBAR_ICON_COLORS.amber },
    { text: 'Subscriptions', icon: <ArrowSync20Regular />, path: `${base}/subscriptions` },
    { text: 'Invoices', icon: <Receipt20Regular />, path: `${base}/invoices`, iconColor: SIDEBAR_ICON_COLORS.green },
    { text: 'Payments', icon: <Money20Regular />, path: `${base}/payments`, iconColor: SIDEBAR_ICON_COLORS.pink },
    { text: 'Products', icon: <Cart20Regular />, path: `${base}/products` },
    { text: 'Pricing', icon: <Tag20Regular />, path: `${base}/pricing` },
    { text: 'Rate History', icon: <History20Regular />, path: `${base}/rate-history` },
    { text: 'AR Report', icon: <ChartMultiple20Regular />, path: `${base}/reports/ar` },
    { text: 'Purchase', icon: <CoinStack20Regular />, path: `${base}/purchase` },

    { section: 'Infrastructure' },
    { text: 'Infra', icon: <PlugConnected20Regular />, path: `${base}/infra`, iconColor: SIDEBAR_ICON_COLORS.blue },
    { text: 'Device Catalog', icon: <Connector20Regular />, path: `${base}/infra/catalog` },
    { text: 'SSH', icon: <Key20Regular />, path: `${base}/infra/ssh` },

    { section: 'NMS' },
    { text: 'NMS Overview', icon: <HeartPulse20Regular />, path: `${base}/nms` },
    { text: 'Galera Cluster', icon: <Connector20Regular />, path: `${base}/nms/galera` },
    { text: 'Temporal Clusters', icon: <Clock20Regular />, path: `${base}/nms/temporal` },

    { section: 'Artifacts' },
    { text: 'Artifacts', icon: <Box20Regular />, path: `${base}/artifacts` },

    ...(FEATURES.crm ? [
      { section: 'CRM' },
      { text: 'Leads',         icon: <PersonAdd20Regular />,         path: `${base}/crm/leads`,         iconColor: SIDEBAR_ICON_COLORS.pink },
      { text: 'Contacts',      icon: <Person20Regular />,            path: `${base}/crm/contacts`,      iconColor: SIDEBAR_ICON_COLORS.blue },
      { text: 'Accounts',      icon: <Building20Regular />,          path: `${base}/crm/accounts`,      iconColor: SIDEBAR_ICON_COLORS.amber },
      { text: 'Opportunities', icon: <ArrowTrending20Regular />,     path: `${base}/crm/opportunities`, iconColor: SIDEBAR_ICON_COLORS.green },
      { text: 'Cases',         icon: <Headset20Regular />,           path: `${base}/crm/cases` },
      { text: 'Tasks',         icon: <TaskListSquareLtr20Regular />, path: `${base}/crm/tasks` },
      { text: 'Meetings',      icon: <Video20Regular />,             path: `${base}/crm/meetings`,      iconColor: SIDEBAR_ICON_COLORS.blue },
      { text: 'Meeting Dashboard', icon: <Board20Regular />,         path: `${base}/crm/meetings/dashboard` },
      { text: 'Rooms (Admin)', icon: <MeetNow20Regular />,           path: `${base}/crm/meetings/rooms` },
      { text: 'Demo Room',     icon: <Video20Regular />,             path: `${base}/crm/meetings/demo/room` },
      { text: 'Calendar',      icon: <CalendarMonth20Regular />,     path: `${base}/crm/calendar` },
      { text: 'Emails',        icon: <Mail20Regular />,              path: `${base}/crm/emails` },
      { text: 'Extension Management', icon: <Phone20Regular />,      path: `${base}/crm/admin/pbxExtensions` },
      { text: 'Administration', icon: <Options20Regular />,          path: `${base}/crm/admin` },

      { section: 'Campaign' },
      { text: 'Campaigns', icon: <Megaphone20Regular />,             path: `${base}/crm/campaigns` },
      { text: 'Policies',  icon: <ShieldCheckmark20Regular />,       path: `${base}/crm/campaigns/policies` },
    ] : []),

    { section: 'Party' },
    { text: 'Partners',    icon: <Handshake20Regular />,             path: `${base}/party/partners` },
    { text: 'Party Users', icon: <PeopleSettings20Regular />,        path: `${base}/party/users` },
    { text: 'Roles',       icon: <PersonAvailable20Regular />,       path: `${base}/party/roles` },
    { text: 'Permissions', icon: <Key20Regular />,                   path: `${base}/party/permissions` },
    { text: 'Sync Jobs',   icon: <ArrowSync20Regular />,             path: `${base}/party/sync-jobs` },

    { section: 'Admin' },
    { text: 'RBAC', icon: <Shield20Regular />, path: `${base}/rbac` },
    { text: 'Tenants', icon: <Building20Regular />, path: `${base}/tenants` },
    ...(isSuper ? [
      { text: 'Operators',      icon: <BuildingFactory20Regular />, path: `${base}/party/admin/operators` },
      { text: 'Party Tenants',  icon: <Building20Regular />,        path: `${base}/party/admin/tenants` },
      { text: 'Operator Users', icon: <PeopleSettings20Regular />,  path: `${base}/party/admin/operator-users` },
    ] : []),
    { text: 'Settings', icon: <Settings20Regular />, path: `${base}/settings` },

    { section: 'Experimental' },
    { text: 'LiveKit Call (exp)', icon: <Phone20Regular />, path: `${base}/experiments/livekit-call` },
    { text: 'Call Window (exp)', icon: <Headset20Regular />, path: `${base}/experiments/livekit-call?workspace=1` },
    { text: 'ERP Product (exp)', icon: <Box20Regular />, path: `${base}/erp/product` },
    { text: 'ERP Product Simple (exp)', icon: <Box20Regular />, path: `${base}/erp/product-simple` },
    { text: 'ERP Business Partner (exp)', icon: <People20Regular />, path: `${base}/erp/bpartner` },
    { text: 'ERP Warehouses (exp)', icon: <Building20Regular />, path: `${base}/erp/warehouse` },
  ];

  const isActive = (path) => {
    const loc = location.pathname;
    if (path === `${base}/`) return loc === `${base}/` || loc === `${base}`;
    if (path === `${base}/infra`) return loc === `${base}/infra`;
    if (path === `${base}/nms`) return loc === `${base}/nms`;
    if (path === `${base}/crm/campaigns`)
      return loc.startsWith(path) && !loc.startsWith(`${path}/policies`);
    if (path === `${base}/crm/admin`)
      return loc.startsWith(path) && !loc.startsWith(`${path}/pbxExtensions`);
    // /erp/product is a prefix of /erp/product-simple — keep them disjoint.
    if (path === `${base}/erp/product`)
      return loc.startsWith(path) && !loc.startsWith(`${base}/erp/product-simple`);
    return loc.startsWith(path);
  };

  // Filter items by RBAC, hide section headers whose items are all hidden.
  const visibleItems = [];
  let i = 0;
  while (i < menu.length) {
    const item = menu[i];
    if (item.section) {
      const sectionItems = [];
      let j = i + 1;
      while (j < menu.length && !menu[j].section) {
        if (canMenu(menu[j].text)) sectionItems.push(menu[j]);
        j++;
      }
      if (sectionItems.length > 0) {
        visibleItems.push(item);
        visibleItems.push(...sectionItems);
      }
      i = j;
    } else {
      if (canMenu(item.text)) visibleItems.push(item);
      i++;
    }
  }

  return (
    <nav className={styles.drawer} aria-label="Main navigation">
      <div className={styles.header}>
        <div
          className={styles.brandSquare}
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }}
        >
          {config.appShortName}
        </div>
        <div className={styles.headerText}>
          <Text className={styles.tenantName} size={300}>
            {tenantName || config.appName}
          </Text>
          <span className={styles.tenantSlug}>
            {tenantSlug || 'Select tenant'}
          </span>
        </div>
      </div>
      <div className={styles.list}>
        {visibleItems.map((item) => {
          if (item.section) {
            return (
              <div key={`sec-${item.section}`} className={styles.section}>
                {item.section}
              </div>
            );
          }
          const active = isActive(item.path);
          return (
            <button
              key={item.text}
              type="button"
              className={mergeClasses(styles.item, active && styles.itemActive)}
              onClick={() => {
                const loc = location.pathname;
                const onSubPath = loc !== item.path && loc.startsWith(item.path + '/');
                navigate(item.path, onSubPath ? { replace: true } : undefined);
              }}
            >
              <span
                className={mergeClasses(styles.itemIcon, active && styles.itemIconActive)}
                style={!active && item.iconColor ? { color: item.iconColor } : undefined}
              >
                {item.icon}
              </span>
              <span className={styles.itemText}>{item.text}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { DRAWER_WIDTH };
