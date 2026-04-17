/**
 * Global Platform Configuration
 *
 * All URLs, tenant slugs, subdomains, and feature flags are configured here.
 * Change this file to adapt the platform to different deployments.
 */

const config = {
  // ── Application ──
  appName: 'Telcobright Platform',
  appShortName: 'TB',

  // ── Tenant URL mode ──
  // 'path'      → http://localhost:5180/btcl/infra
  // 'subdomain' → http://btcl.platform.telcobright.com/infra  (future)
  tenantUrlMode: 'path',

  // ── Tenant slug mapping (Odoo partner ID → URL slug) ──
  // Auto-discovered from Odoo if not listed here.
  // Manually listed tenants get the exact slug specified.
  tenantSlugs: {
    1: 'telcobright',
    8: 'btcl',
    7: 'abc-isp',
  },

  // ── KB credentials and branding now come from Odoo DB ──
  // (platform.tenant.config model, fetched by TenantContext)

  // ── Default tenant (redirect to this if no tenant in URL) ──
  defaultTenantSlug: null, // null = show tenant selection page

  // ── API endpoints ──
  api: {
    gateway: '/api',           // Vite proxy → API Gateway → PLATFORM-API
    odoo: '/api/odoo',
    killbill: '/api/kb',
  },

  // ── Auth ──
  auth: {
    keycloak: {
      url: 'http://localhost:7104',
      realm: 'telcobright',
      clientId: 'platform-ui',
    },
  },

  // ── Feature flags ──
  // Toggle optional integrations without code changes.
  features: {
    crm: import.meta.env.VITE_CRM_ENABLED === 'true',
  },

  crmKanban: {
    maxPerColumn: Number(import.meta.env.VITE_CRM_KANBAN_MAX_PER_COLUMN) || 100000,
    // Default period for the Opportunity pipeline: 1w | 1m | 3m | 6m | 1y | 2y | all
    defaultPeriod: import.meta.env.VITE_CRM_KANBAN_DEFAULT_PERIOD || '1y',
  },

  // ── Services (for launch-all.sh / status page) ──
  services: {
    odoo: { port: 7169 },
    keycloak: { port: 7104 },
    springBoot: { port: 8180 },
    gateway: { port: 8001 },
    killbill: { port: 18080 },
    vault: { port: 8200 },
    eureka: { port: 8761 },
  },
};

// ── Derived helpers ──

/** Get slug for a partner ID */
export function getTenantSlug(partnerId) {
  return config.tenantSlugs[partnerId] || `tenant-${partnerId}`;
}

/** Get partner ID from slug */
export function getPartnerIdFromSlug(slug) {
  for (const [id, s] of Object.entries(config.tenantSlugs)) {
    if (s === slug) return +id;
  }
  // Try numeric fallback: tenant-8 → 8
  const match = slug.match(/^tenant-(\d+)$/);
  return match ? +match[1] : null;
}

/** Build a tenant-prefixed path */
export function tenantPath(tenantSlug, path) {
  if (config.tenantUrlMode === 'path') {
    return `/${tenantSlug}${path.startsWith('/') ? path : '/' + path}`;
  }
  return path; // subdomain mode — no prefix needed
}

/** Convenience re-export for feature flags. */
export const FEATURES = config.features;

export default config;
