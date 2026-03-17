import { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth, setAuth as saveAuth, clearAuth,
  getActiveTenant, setActiveTenant as saveActiveTenant,
  getTenants, isSuperAdmin, login as doLegacyLogin,
} from '../services/auth';
import {
  initKeycloak, getUser as getKCUser, isAuthenticated as isKCAuth,
  isSuper as isKCSuper, logout as kcLogout, getToken,
} from '../services/keycloak';

const AuthContext = createContext(null);

// Auth mode: 'keycloak' or 'legacy'
const AUTH_MODE = localStorage.getItem('auth_mode') || 'keycloak';

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [activeTenant, setActiveTenantState] = useState(() => getActiveTenant());
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(AUTH_MODE);

  // Initialize auth on mount
  useEffect(() => {
    async function init() {
      if (mode === 'keycloak') {
        try {
          const authenticated = await initKeycloak();
          if (authenticated) {
            const user = getKCUser();
            setAuthState({
              username: user.username,
              name: user.name,
              email: user.email,
              role: isKCSuper() ? 'super_admin' : 'tenant_admin',
              roles: user.roles,
              keycloak: true,
            });
          }
        } catch (e) {
          console.warn('Keycloak unavailable, falling back to legacy auth:', e.message);
          setMode('legacy');
          localStorage.setItem('auth_mode', 'legacy');
          const saved = getAuth();
          if (saved) setAuthState(saved);
        }
      } else {
        const saved = getAuth();
        if (saved) setAuthState(saved);
      }
      setLoading(false);
    }
    init();
  }, [mode]);

  // Legacy login (only used when Keycloak is not available)
  const login = (username, password) => {
    const result = doLegacyLogin(username, password);
    if (result) {
      setAuthState(result);
      if (result.tenantApiKey) {
        const tenant = getTenants().find(t => t.apiKey === result.tenantApiKey);
        if (tenant) setActiveTenantState(tenant);
      }
    }
    return result;
  };

  const logout = () => {
    if (auth?.keycloak) {
      kcLogout();
    } else {
      clearAuth();
      setAuthState(null);
      setActiveTenantState(null);
    }
  };

  const switchTenant = (tenant) => {
    saveActiveTenant(tenant);
    setActiveTenantState(tenant);
  };

  const isSuper = auth?.keycloak ? auth.roles?.includes('super_admin') : isSuperAdmin(auth);
  const availableTenants = isSuper ? getTenants() : (activeTenant ? [activeTenant] : []);

  // Switch between auth modes
  const switchAuthMode = (newMode) => {
    localStorage.setItem('auth_mode', newMode);
    clearAuth();
    setAuthState(null);
    setMode(newMode);
    if (newMode === 'keycloak') {
      window.location.reload(); // Keycloak needs full page init
    }
  };

  if (loading) {
    return null; // or a spinner — Keycloak init takes ~1s
  }

  return (
    <AuthContext.Provider value={{
      auth, activeTenant, isSuper,
      login, logout, switchTenant,
      availableTenants,
      isLoggedIn: !!auth,
      authMode: mode,
      switchAuthMode,
      getToken: auth?.keycloak ? getToken : () => null,
      refreshTenants: () => setAuthState(prev => ({ ...prev })),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
