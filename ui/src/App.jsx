import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ThemeRegistryProvider, useAppTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { NotificationProvider } from './components/ErrorNotification';
import MainLayout from './layouts/MainLayout';
import TenantSelector from './pages/TenantSelector';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Subscriptions from './pages/Subscriptions';
import Invoices from './pages/Invoices';
import Catalog from './pages/Catalog';
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

/** All app pages under /:tenant prefix */
function TenantRoutes() {
  const { isSuper } = useAuth();

  return (
    <Route element={<MainLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="customers" element={<Customers />} />
      <Route path="customers/:id" element={<CustomerDetail />} />
      <Route path="subscriptions" element={<Subscriptions />} />
      <Route path="invoices" element={<Invoices />} />
      <Route path="payments" element={<Payments />} />
      <Route path="catalog" element={<Catalog />} />
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
      {isSuper && <Route path="tenants" element={<Tenants />} />}
      <Route path="*" element={<Navigate to="" replace />} />
    </Route>
  );
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Root: tenant selector */}
      <Route path="/" element={<TenantSelector />} />
      {/* Tenant-prefixed routes */}
      <Route path="/:tenant/*">
        {TenantRoutes()}
      </Route>
      {/* Fallback */}
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
