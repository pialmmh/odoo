import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { call } from '../services/odoo';
import { setKBTenant } from '../services/killbill';

const TenantContext = createContext(null);
const STORAGE_KEY = 'platform_active_tenant';

/**
 * Unified tenant context.
 * Tenants are Odoo res.partner records (companies).
 * Selecting a tenant filters infra (by partner_id) and billing (by KB api key).
 */
export function TenantProvider({ children }) {
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load tenants from Odoo
  const loadTenants = useCallback(async () => {
    try {
      // Load company partners — try with KB fields first, fallback without
      let partners;
      try {
        partners = await call('res.partner', 'search_read',
          [[['is_company', '=', true], ['x_kb_api_key', '!=', false]]],
          { fields: ['id', 'name', 'x_kb_api_key', 'x_kb_api_secret', 'x_kb_tenant_id'] }
        );
      } catch {
        // KB module may not be installed — load all company partners
        partners = await call('res.partner', 'search_read',
          [[['is_company', '=', true]]],
          { fields: ['id', 'name'] }
        );
      }
      setTenants(partners);

      // Restore last active tenant
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const found = partners.find(p => p.id === +savedId);
        if (found) setActiveTenant(found);
      }
    } catch (e) {
      // Fallback: load from localStorage if Odoo unreachable
      console.warn('Failed to load tenants from Odoo:', e.message);
      try {
        const saved = JSON.parse(localStorage.getItem('kb_tenants') || '[]');
        setTenants(saved.map((t, i) => ({
          id: i + 1, name: t.name,
          x_kb_api_key: t.apiKey, x_kb_api_secret: t.apiSecret,
        })));
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const switchTenant = (tenant) => {
    setActiveTenant(tenant);
    setKBTenant(tenant);
    if (tenant) {
      localStorage.setItem(STORAGE_KEY, String(tenant.id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
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
      // Convenience getters for billing (KB headers)
      kbApiKey: activeTenant?.x_kb_api_key || '',
      kbApiSecret: activeTenant?.x_kb_api_secret || '',
      // For infra filtering
      partnerId: activeTenant?.id || null,
      tenantName: activeTenant?.name || '',
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
