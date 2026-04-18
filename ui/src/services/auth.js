// Legacy tenant-registry helpers used by Tenants.jsx (super-admin page
// that pushes tenant rows into localStorage for Kill Bill API-key browsing).
// Auth / login is handled entirely by Keycloak — see services/keycloak.js.

const STORAGE_KEYS = {
  TENANTS: 'kb_tenants',
};

export const getTenants = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TENANTS) || '[]');
  } catch { return []; }
};

export const saveTenants = (tenants) => {
  localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));
};

export const addTenant = (tenant) => {
  const tenants = getTenants();
  tenants.push(tenant);
  saveTenants(tenants);
  return tenants;
};

export const removeTenant = (apiKey) => {
  const tenants = getTenants().filter(t => t.apiKey !== apiKey);
  saveTenants(tenants);
  return tenants;
};
