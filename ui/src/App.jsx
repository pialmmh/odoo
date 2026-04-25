import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ThemeRegistryProvider, useAppTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { NotificationProvider } from './components/ErrorNotification';
import MainLayout from './layouts/MainLayout';
import TenantSelector from './pages/TenantSelector';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Subscriptions from './pages/Subscriptions';
import Invoices from './pages/Invoices';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Pricing from './pages/Pricing';
import RateHistory from './pages/RateHistory';
import Settings from './pages/Settings';
import Tenants from './pages/Tenants';
import ARReport from './pages/ARReport';
import Payments from './pages/Payments';
import InfraMain from './pages/infra/InfraMain';
import InfraDeviceCatalog from './pages/infra/InfraDeviceCatalog';
import InfraSSH from './pages/infra/InfraSSH';
import ArtifactsMain from './pages/artifacts/ArtifactsMain';
import NmsOverview from './pages/nms/NmsOverview';
import NmsGalera from './pages/nms/NmsGalera';
import NmsTemporalClusters from './pages/nms/NmsTemporalClusters';
import NmsTemporalClusterEdit from './pages/nms/NmsTemporalClusterEdit';
import RBACManagement from './pages/RBACManagement';
import Purchase from './pages/Purchase';
import CrmIndex from './pages/crm/CrmIndex';
import Operators from './pages/party/Operators';
import OperatorDetail from './pages/party/OperatorDetail';
import PartyTenantsPage from './pages/party/PartyTenants';
import OperatorUsers from './pages/party/OperatorUsers';
import Partners from './pages/party/Partners';
import PartnerDetail from './pages/party/PartnerDetail';
import PartyUsers from './pages/party/PartyUsers';
import PartyUserDetail from './pages/party/PartyUserDetail';
import Roles from './pages/party/Roles';
import RoleDetail from './pages/party/RoleDetail';
import Permissions from './pages/party/Permissions';
import SyncJobs from './pages/party/SyncJobs';
import CallHost from './call/CallHost';
import LivekitCallExp from './pages/experiments/LivekitCallExp';
import ErpWorkspace from './pages/erp/workspace/ErpWorkspace';
import { FEATURES } from './config/platform';

/** Block access to tenant URLs the user is not authorized for */
function TenantAuthGuard() {
  const { tenant } = useParams();
  const { allowedTenantSlugs, isSuper } = useAuth();

  // Super admin can access any tenant
  if (isSuper || allowedTenantSlugs === null) return <MainLayout />;

  // Check if the URL tenant slug is in the user's allowed list
  if (!allowedTenantSlugs.includes(tenant)) {
    return <Navigate to="/" replace />;
  }

  return <MainLayout />;
}

function TenantRoutes() {
  const { isSuper } = useAuth();
  return (
    <Route element={<TenantAuthGuard />}>
      <Route index element={<Dashboard />} />
      <Route path="customers" element={<Customers />} />
      <Route path="customers/:id" element={<CustomerDetail />} />
      <Route path="subscriptions" element={<Subscriptions />} />
      <Route path="invoices" element={<Invoices />} />
      <Route path="payments" element={<Payments />} />
      <Route path="products" element={<Products />} />
      <Route path="products/:id" element={<ProductDetail />} />
      <Route path="pricing" element={<Pricing />} />
      <Route path="rate-history" element={<RateHistory />} />
      <Route path="reports/ar" element={<ARReport />} />
      <Route path="settings" element={<Settings />} />
      <Route path="infra" element={<InfraMain />} />
      <Route path="infra/catalog" element={<InfraDeviceCatalog />} />
      <Route path="infra/ssh" element={<InfraSSH />} />
      <Route path="artifacts" element={<ArtifactsMain />} />
      <Route path="nms" element={<NmsOverview />} />
      <Route path="nms/galera" element={<NmsGalera />} />
      <Route path="nms/temporal" element={<NmsTemporalClusters />} />
      <Route path="nms/temporal/new" element={<NmsTemporalClusterEdit />} />
      <Route path="nms/temporal/:id/edit" element={<NmsTemporalClusterEdit />} />
      <Route path="purchase" element={<Purchase />} />
      <Route path="erp/*" element={<ErpWorkspace />} />
      <Route path="rbac" element={<RBACManagement />} />
      {FEATURES.crm && <Route path="crm/*" element={<CrmIndex />} />}
      <Route path="experiments/livekit-call" element={<LivekitCallExp />} />
      {isSuper && <Route path="tenants" element={<Tenants />} />}

      {/* Party — tenant-scoped */}
      <Route path="party/partners" element={<Partners />} />
      <Route path="party/partners/:partnerId" element={<PartnerDetail />} />
      <Route path="party/users" element={<PartyUsers />} />
      <Route path="party/users/:userId" element={<PartyUserDetail />} />
      <Route path="party/roles" element={<Roles />} />
      <Route path="party/roles/:roleId" element={<RoleDetail />} />
      <Route path="party/permissions" element={<Permissions />} />
      <Route path="party/sync-jobs" element={<SyncJobs />} />

      {/* Party — super-admin (cross-tenant registry) */}
      {isSuper && <Route path="party/admin/operators" element={<Operators />} />}
      {isSuper && <Route path="party/admin/operators/:operatorId" element={<OperatorDetail />} />}
      {isSuper && <Route path="party/admin/tenants" element={<PartyTenantsPage />} />}
      {isSuper && <Route path="party/admin/operator-users" element={<OperatorUsers />} />}

      <Route path="*" element={<Navigate to="" replace />} />
    </Route>
  );
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  // Keycloak is configured with login-required, so if we reach here
  // unauthenticated something went wrong — render nothing rather than loop.
  if (!isLoggedIn) return null;

  return (
    <Routes>
      <Route path="/" element={<TenantSelector />} />
      <Route path="/:tenant/*">{TenantRoutes()}</Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ThemedApp() {
  const { muiTheme } = useAppTheme();
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <NotificationProvider>
        <AuthProvider>
          <TenantProvider>
            <BrowserRouter>
              <CallHost>
                <AppRoutes />
              </CallHost>
            </BrowserRouter>
          </TenantProvider>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ThemeRegistryProvider>
      <ThemedApp />
    </ThemeRegistryProvider>
  );
}
