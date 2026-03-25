import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setKBTenant } from '../services/killbill';
import { call } from '../services/odoo';
import config from '../config/platform';
import { useAuth } from './AuthContext';

const TenantContext = createContext(null);

// Cache tenant configs from DB so we don't refetch on every render
let _tenantConfigCache = null;

/**
 * Fetch tenant configs from Odoo DB (platform.tenant.config model).
 * Returns array of { slug, partnerId, partnerName, billing, branding, overdue }.
 */
async function fetchTenantConfigs() {
  if (_tenantConfigCache) return _tenantConfigCache;
  try {
    const configs = await call('platform.tenant.config', 'get_all_active', []);
    _tenantConfigCache = configs;
    return configs;
  } catch (e) {
    console.warn('Failed to fetch tenant configs from DB, using empty:', e.message);
    return [];
  }
}

export function TenantProvider({ children }) {
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const { allowedTenantSlugs } = useAuth();

  const loadTenants = useCallback(async () => {
    try {
      // Fetch tenant configs from DB (billing creds + branding)
      const dbConfigs = await fetchTenantConfigs();

      // Build tenant list from DB configs (each config has partnerId, slug, billing creds)
      const tenantList = dbConfigs.map(cfg => ({
        id: cfg.partnerId,
        name: cfg.partnerName,
        slug: cfg.slug,
        apiKey: cfg.billing?.apiKey || '',
        apiSecret: cfg.billing?.apiSecret || '',
        branding: cfg.branding || {},
      }));

      // Filter by allowed tenants: null = super admin, sees all
      const filtered = allowedTenantSlugs === null
        ? tenantList
        : tenantList.filter(t => allowedTenantSlugs.includes(t.slug));
      setTenants(filtered);

      // Auto-select tenant from URL path
      const pathSlug = getTenantSlugFromURL(filtered);
      if (pathSlug) {
        const found = filtered.find(t => t.slug === pathSlug);
        if (found) {
          setActiveTenant(found);
          setKBTenant(found);
        }
      }
    } catch (e) {
      console.warn('Failed to load tenants:', e.message);
    } finally {
      setLoading(false);
    }
  }, [allowedTenantSlugs]);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const switchTenant = (tenant) => {
    setActiveTenant(tenant);
    setKBTenant(tenant);
    setBrandingCookies(tenant);
    if (tenant && config.tenantUrlMode === 'path') {
      const currentPath = window.location.pathname;
      const stripped = stripTenantFromPath(currentPath, tenants);
      const newPath = `/${tenant.slug}${stripped || '/'}`;
      if (currentPath !== newPath) {
        window.history.replaceState(null, '', newPath);
      }
    }
  };

  // Sync KB tenant and branding cookies on restore
  useEffect(() => {
    if (activeTenant) {
      setKBTenant(activeTenant);
      setBrandingCookies(activeTenant);
    }
  }, [activeTenant]);

  return (
    <TenantContext.Provider value={{
      tenants,
      activeTenant,
      switchTenant,
      loading,
      refreshTenants: loadTenants,
      kbApiKey: activeTenant?.apiKey || '',
      kbApiSecret: activeTenant?.apiSecret || '',
      partnerId: activeTenant?.id || null,
      tenantName: activeTenant?.name || '',
      tenantSlug: activeTenant?.slug || '',
    }}>
      {children}
    </TenantContext.Provider>
  );
}

/** Extract tenant slug from URL path by checking against known tenant slugs */
function getTenantSlugFromURL(tenantList) {
  if (config.tenantUrlMode !== 'path') return null;
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const candidate = parts[0];
  // Check against loaded tenant slugs
  if (tenantList?.some(t => t.slug === candidate)) return candidate;
  // Fallback: check hardcoded slugs (for backward compat during transition)
  if (config.tenantSlugs) {
    const knownSlugs = Object.values(config.tenantSlugs);
    if (knownSlugs.includes(candidate)) return candidate;
  }
  return null;
}

/** Strip tenant prefix from a path */
function stripTenantFromPath(path, tenantList) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  const candidate = parts[0];
  const isKnown = tenantList?.some(t => t.slug === candidate)
    || (config.tenantSlugs && Object.values(config.tenantSlugs).includes(candidate));
  if (isKnown) {
    return '/' + parts.slice(1).join('/') || '/';
  }
  return path;
}

/**
 * Set branding cookies from tenant's DB config so the Keycloak login page
 * can display tenant-specific title and subtitle on next login.
 */
function setBrandingCookies(tenant) {
  const branding = tenant?.branding || {};
  const title = branding.loginTitle || config.appName || 'Telcobright Platform';
  const subtitle = branding.loginSubtitle || '';
  const opts = 'path=/;max-age=31536000;SameSite=Lax';
  document.cookie = `tb_login_title=${encodeURIComponent(title)};${opts}`;
  document.cookie = `tb_login_subtitle=${encodeURIComponent(subtitle)};${opts}`;
}

export const useTenant = () => useContext(TenantContext);
