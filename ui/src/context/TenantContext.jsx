import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setKBTenant } from '../services/killbill';
import { getToken } from '../services/keycloak';
import { call } from '../services/odoo';
import config, { getTenantSlug, getPartnerIdFromSlug } from '../config/platform';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load tenants from Odoo
  const loadTenants = useCallback(async () => {
    try {
      const partners = await call('res.partner', 'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'name'] }
      );

      // Attach slugs
      const withSlugs = partners.map(p => ({ ...p, slug: getTenantSlug(p.id) }));
      setTenants(withSlugs);

      // Auto-select tenant from URL path
      const pathSlug = getTenantSlugFromURL();
      if (pathSlug) {
        const found = withSlugs.find(t => t.slug === pathSlug);
        if (found) {
          setActiveTenant(found);
          setKBTenant(found);
        }
      }
    } catch (e) {
      console.warn('Failed to load tenants from Odoo:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const switchTenant = (tenant) => {
    setActiveTenant(tenant);
    setKBTenant(tenant);
    // Update URL to reflect new tenant
    if (tenant && config.tenantUrlMode === 'path') {
      const currentPath = window.location.pathname;
      const stripped = stripTenantFromPath(currentPath);
      const newPath = `/${tenant.slug}${stripped || '/'}`;
      if (currentPath !== newPath) {
        window.history.replaceState(null, '', newPath);
      }
    }
  };

  // Sync KB tenant on restore
  useEffect(() => {
    if (activeTenant) setKBTenant(activeTenant);
  }, [activeTenant]);

  return (
    <TenantContext.Provider value={{
      tenants,
      activeTenant,
      switchTenant,
      loading,
      refreshTenants: loadTenants,
      kbApiKey: activeTenant?.x_kb_api_key || '',
      kbApiSecret: activeTenant?.x_kb_api_secret || '',
      partnerId: activeTenant?.id || null,
      tenantName: activeTenant?.name || '',
      tenantSlug: activeTenant?.slug || '',
    }}>
      {children}
    </TenantContext.Provider>
  );
}

/** Extract tenant slug from current URL path */
function getTenantSlugFromURL() {
  if (config.tenantUrlMode !== 'path') return null;
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  // First segment could be a tenant slug
  const candidate = parts[0];
  // Check if it's a known slug
  if (getPartnerIdFromSlug(candidate) !== null) return candidate;
  // Check against configured slugs
  const knownSlugs = Object.values(config.tenantSlugs);
  if (knownSlugs.includes(candidate)) return candidate;
  return null;
}

/** Strip tenant prefix from a path */
function stripTenantFromPath(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  const candidate = parts[0];
  if (getPartnerIdFromSlug(candidate) !== null || Object.values(config.tenantSlugs).includes(candidate)) {
    return '/' + parts.slice(1).join('/') || '/';
  }
  return path;
}

export const useTenant = () => useContext(TenantContext);
