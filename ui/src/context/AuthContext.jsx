import { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth, clearAuth, login as doLegacyLogin, isSuperAdmin, getTenants,
  getActiveTenant, setActiveTenant as saveActiveTenant,
} from '../services/auth';
import {
  initKeycloak, getUser as getKCUser,
  isSuper as isKCSuper, logout as kcLogout, getToken,
  getTenantSlugs,
} from '../services/keycloak';
import config from '../config/platform';

const AuthContext = createContext(null);

const AUTH_MODE = localStorage.getItem('auth_mode') || config.auth.mode;

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(AUTH_MODE);

  useEffect(() => {
    async function init() {
      if (mode === 'keycloak') {
        try {
          const authenticated = await initKeycloak();
          if (authenticated) {
            const user = getKCUser();
            const isSuperAdmin = isKCSuper();
            setAuthState({
              username: user.username,
              name: user.name,
              email: user.email,
              role: isSuperAdmin ? 'super_admin' : 'tenant_admin',
              roles: user.roles,
              groups: user.groups,
              // null = super admin, all tenants allowed; array = scoped to these slugs
              allowedTenantSlugs: isSuperAdmin ? null : getTenantSlugs(),
              keycloak: true,
            });
          }
        } catch (e) {
          console.warn('Keycloak failed, falling back to legacy:', e.message);
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

  const login = (username, password) => {
    const result = doLegacyLogin(username, password);
    if (result) setAuthState(result);
    return result;
  };

  const logout = () => {
    if (auth?.keycloak) {
      kcLogout();
    } else {
      clearAuth();
      setAuthState(null);
    }
  };

  const isSuper = auth?.keycloak ? auth.roles?.includes('super_admin') : isSuperAdmin(auth);

  const switchAuthMode = (newMode) => {
    localStorage.setItem('auth_mode', newMode);
    clearAuth();
    setAuthState(null);
    setMode(newMode);
    if (newMode === 'keycloak') window.location.reload();
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{
      auth,
      isSuper,
      isLoggedIn: !!auth,
      authMode: mode,
      allowedTenantSlugs: auth?.allowedTenantSlugs ?? null,
      login, logout, switchAuthMode,
      getToken: auth?.keycloak ? getToken : () => null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
