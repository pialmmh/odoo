import { createContext, useContext, useState, useEffect } from 'react';
import {
  initKeycloak, getUser as getKCUser,
  isSuper as isKCSuper, logout as kcLogout, getToken,
  getTenantSlugs,
} from '../services/keycloak';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
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
        });
      }
      setLoading(false);
    }
    init();
  }, []);

  const logout = () => kcLogout();

  const isSuper = !!auth?.roles?.includes('super_admin');

  if (loading) return null;

  return (
    <AuthContext.Provider value={{
      auth,
      isSuper,
      isLoggedIn: !!auth,
      allowedTenantSlugs: auth?.allowedTenantSlugs ?? null,
      logout,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
