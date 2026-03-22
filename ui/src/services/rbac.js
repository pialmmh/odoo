import { call } from './odoo';

// ── Permissions ──

export async function getPermissions(domain = []) {
  return call('rbac.permission', 'search_read', [domain], {
    fields: ['id', 'name', 'code', 'module', 'action', 'description', 'is_active'],
    order: 'module, code',
  });
}

export async function createPermission(vals) {
  return call('rbac.permission', 'create', [vals]);
}

export async function updatePermission(id, vals) {
  return call('rbac.permission', 'write', [[id], vals]);
}

export async function deletePermission(id) {
  return call('rbac.permission', 'unlink', [[id]]);
}

// ── Roles ──

export async function getRoles(domain = []) {
  return call('rbac.role', 'search_read', [domain], {
    fields: ['id', 'name', 'code', 'description', 'sequence', 'is_active', 'permission_ids', 'permission_count'],
    order: 'sequence, name',
  });
}

export async function createRole(vals) {
  return call('rbac.role', 'create', [vals]);
}

export async function updateRole(id, vals) {
  return call('rbac.role', 'write', [[id], vals]);
}

export async function deleteRole(id) {
  return call('rbac.role', 'unlink', [[id]]);
}

// ── URL Patterns ──

export async function getUrlPatterns(domain = []) {
  return call('rbac.url.pattern', 'search_read', [domain], {
    fields: ['id', 'name', 'url_pattern', 'http_methods', 'menu_label', 'permission_ids', 'description', 'sequence', 'is_active'],
    order: 'sequence, url_pattern',
  });
}

export async function createUrlPattern(vals) {
  return call('rbac.url.pattern', 'create', [vals]);
}

export async function updateUrlPattern(id, vals) {
  return call('rbac.url.pattern', 'write', [[id], vals]);
}

export async function deleteUrlPattern(id) {
  return call('rbac.url.pattern', 'unlink', [[id]]);
}

// ── Full config (for cache refresh) ──

export async function getRBACConfig() {
  return call('rbac.role', 'get_full_rbac_config', []);
}
