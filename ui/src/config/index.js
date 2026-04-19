// Tenant config loader — mirrors api/.../tenant/TenantConfigRegistry.
//
// For each enabled entry in tenants.js, loads the matching
// tenants/{name}/{profile}/profile-{profile}.js at build time via
// Vite's import.meta.glob (eager). Disabled entries are skipped.
//
// Consumers: import { getTenant } from '@/config';
//            const cfg = getTenant(currentSlug);

import { OPERATOR, TENANTS } from './tenants.js';

const modules = import.meta.glob('./operators/*/tenants/*/*/profile-*.js', { eager: true });

function loadTenant(entry) {
  const key = `./operators/${OPERATOR}/tenants/${entry.name}/${entry.profile}/profile-${entry.profile}.js`;
  const mod = modules[key];
  if (!mod || !mod.default) {
    throw new Error(`[config] Missing tenant profile at ${key}`);
  }
  return mod.default;
}

const tenantsBySlug = {};
for (const entry of TENANTS) {
  if (!entry.enabled) continue;
  const cfg = loadTenant(entry);
  if (!cfg.tenant?.slug) {
    throw new Error(`[config] Profile for ${entry.name} is missing tenant.slug`);
  }
  tenantsBySlug[cfg.tenant.slug] = Object.freeze(cfg);
}

export const config = Object.freeze({
  operator: OPERATOR,
  tenants: tenantsBySlug,
  tenantList: Object.values(tenantsBySlug),
  enabledSlugs: Object.keys(tenantsBySlug),
});

export function getTenant(slug) {
  return tenantsBySlug[slug] ?? null;
}

export function isTenantEnabled(slug) {
  return Object.prototype.hasOwnProperty.call(tenantsBySlug, slug);
}

export default config;
