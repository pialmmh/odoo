import axios from 'axios';
import { getToken } from './keycloak';

// Party service — proxied through APISIX at /api/party → http://party-api:8080
const api = axios.create({
  baseURL: '/api/party/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  let token = getToken();
  if (!token) {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500));
      token = getToken();
      if (token) break;
    }
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Slug → Party tenant ID resolver. Cache per session.
const _slugToId = new Map();

export async function resolveTenantIdBySlug(slug) {
  if (!slug) return null;
  if (_slugToId.has(slug)) return _slugToId.get(slug);
  try {
    const { data } = await api.get('/tenants', { params: { shortName: slug } });
    const match = Array.isArray(data) ? data.find(t => t.shortName === slug) : null;
    if (match) {
      _slugToId.set(slug, match.id);
      return match.id;
    }
  } catch {
    // fall through
  }
  return null;
}

// ── Operators (super admin) ──
export const operatorsApi = {
  list: () => api.get('/operators').then(r => r.data),
  get: (id) => api.get(`/operators/${id}`).then(r => r.data),
  create: (body) => api.post('/operators', body).then(r => r.data),
  patch: (id, body) => api.patch(`/operators/${id}`, body).then(r => r.data),
  remove: (id) => api.delete(`/operators/${id}`).then(r => r.data),
};

// ── Tenants (Party master registry) ──
export const partyTenantsApi = {
  listAll: () => api.get('/tenants').then(r => r.data),
  listByOperator: (operatorId) =>
    api.get(`/operators/${operatorId}/tenants`).then(r => r.data),
  get: (id) => api.get(`/tenants/${id}`).then(r => r.data),
  create: (operatorId, body) =>
    api.post(`/operators/${operatorId}/tenants`, body).then(r => r.data),
  patch: (id, body) => api.patch(`/tenants/${id}`, body).then(r => r.data),
  remove: (id) => api.delete(`/tenants/${id}`).then(r => r.data),
};

// ── Operator users ──
export const operatorUsersApi = {
  list: () => api.get('/operator-users').then(r => r.data),
  get: (id) => api.get(`/operator-users/${id}`).then(r => r.data),
  create: (body) => api.post('/operator-users', body).then(r => r.data),
  patch: (id, body) => api.patch(`/operator-users/${id}`, body).then(r => r.data),
  remove: (id) => api.delete(`/operator-users/${id}`).then(r => r.data),
  resetPassword: (id, password) =>
    api.post(`/operator-users/${id}/password`, { password }).then(r => r.data),
  setStatus: (id, status) =>
    api.post(`/operator-users/${id}/status`, { status }).then(r => r.data),
};

// ── Tenant-scoped: partners ──
export const partnersApi = {
  list: (tenantId) =>
    api.get(`/tenants/${tenantId}/partners`).then(r => r.data),
  get: (tenantId, id) =>
    api.get(`/tenants/${tenantId}/partners/${id}`).then(r => r.data),
  create: (tenantId, body) =>
    api.post(`/tenants/${tenantId}/partners`, body).then(r => r.data),
  patch: (tenantId, id, body) =>
    api.patch(`/tenants/${tenantId}/partners/${id}`, body).then(r => r.data),
  remove: (tenantId, id) =>
    api.delete(`/tenants/${tenantId}/partners/${id}`).then(r => r.data),
  getExtra: (tenantId, id) =>
    api.get(`/tenants/${tenantId}/partners/${id}/extra`).then(r => r.data),
  putExtra: (tenantId, id, body) =>
    api.put(`/tenants/${tenantId}/partners/${id}/extra`, body).then(r => r.data),
};

// ── Tenant-scoped: auth users ──
export const partyUsersApi = {
  list: (tenantId) =>
    api.get(`/tenants/${tenantId}/users`).then(r => r.data),
  get: (tenantId, id) =>
    api.get(`/tenants/${tenantId}/users/${id}`).then(r => r.data),
  create: (tenantId, partnerId, body) =>
    api.post(`/tenants/${tenantId}/partners/${partnerId}/users`, body).then(r => r.data),
  patch: (tenantId, id, body) =>
    api.patch(`/tenants/${tenantId}/users/${id}`, body).then(r => r.data),
  remove: (tenantId, id) =>
    api.delete(`/tenants/${tenantId}/users/${id}`).then(r => r.data),
  resetPassword: (tenantId, id, password) =>
    api.post(`/tenants/${tenantId}/users/${id}/password`, { password }).then(r => r.data),
  replaceRoles: (tenantId, id, roleIds) =>
    api.post(`/tenants/${tenantId}/users/${id}/roles`, { roleIds }).then(r => r.data),

  listIpRules: (tenantId, userId) =>
    api.get(`/tenants/${tenantId}/users/${userId}/ip-rules`).then(r => r.data),
  addIpRule: (tenantId, userId, body) =>
    api.post(`/tenants/${tenantId}/users/${userId}/ip-rules`, body).then(r => r.data),
  deleteIpRule: (tenantId, userId, ruleId) =>
    api.delete(`/tenants/${tenantId}/users/${userId}/ip-rules/${ruleId}`).then(r => r.data),

  getMenuPerms: (tenantId, userId) =>
    api.get(`/tenants/${tenantId}/users/${userId}/menu-permissions`).then(r => r.data),
  putMenuPerms: (tenantId, userId, items) =>
    api.put(`/tenants/${tenantId}/users/${userId}/menu-permissions`, { items }).then(r => r.data),
};

// ── Tenant-scoped: roles ──
export const rolesApi = {
  list: (tenantId) => api.get(`/tenants/${tenantId}/roles`).then(r => r.data),
  get: (tenantId, id) => api.get(`/tenants/${tenantId}/roles/${id}`).then(r => r.data),
  create: (tenantId, body) =>
    api.post(`/tenants/${tenantId}/roles`, body).then(r => r.data),
  patch: (tenantId, id, body) =>
    api.patch(`/tenants/${tenantId}/roles/${id}`, body).then(r => r.data),
  remove: (tenantId, id) =>
    api.delete(`/tenants/${tenantId}/roles/${id}`).then(r => r.data),
  replacePermissions: (tenantId, id, permissionIds) =>
    api.post(`/tenants/${tenantId}/roles/${id}/permissions`, { permissionIds }).then(r => r.data),
};

// ── Tenant-scoped: permissions ──
export const permissionsApi = {
  list: (tenantId) =>
    api.get(`/tenants/${tenantId}/permissions`).then(r => r.data),
  create: (tenantId, body) =>
    api.post(`/tenants/${tenantId}/permissions`, body).then(r => r.data),
  remove: (tenantId, id) =>
    api.delete(`/tenants/${tenantId}/permissions/${id}`).then(r => r.data),
};

// ── Tenant-scoped: sync jobs ──
export const syncJobsApi = {
  list: (tenantId, { status, limit = 200 } = {}) =>
    api.get(`/tenants/${tenantId}/sync-jobs`, { params: { status, limit } })
      .then(r => r.data),
  get: (tenantId, id) =>
    api.get(`/tenants/${tenantId}/sync-jobs/${id}`).then(r => r.data),
  retry: (tenantId, id) =>
    api.post(`/tenants/${tenantId}/sync-jobs/${id}/retry`, {}).then(r => r.data),
};
