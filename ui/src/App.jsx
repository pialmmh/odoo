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
import RBACManagement from './pages/RBACManagement';
import Purchase from './pages/Purchase';
import CrmIndex from './pages/crm/CrmIndex';
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
      <Route path="purchase" element={<Purchase />} />
      <Route path="rbac" element={<RBACManagement />} />
      {FEATURES.crm && <Route path="crm/*" element={<CrmIndex />} />}
      {isSuper && <Route path="tenants" element={<Tenants />} />}
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
              <AppRoutes />
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
