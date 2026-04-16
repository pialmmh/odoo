import axios from 'axios';
import { getToken } from './keycloak';

// ── CRM client: routes through Spring Boot gateway → EspoCRM (server-side only) ──

const api = axios.create({
  baseURL: '/api/crm',
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT on every request — wait briefly if Keycloak isn't ready yet
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

// ── Generic passthrough — mirrors services/odoo.js `call()` ──

export const get  = (path, params) => api.get(path, { params }).then(r => r.data);
export const post = (path, data)   => api.post(path, data).then(r => r.data);
export const put  = (path, data)   => api.put(path, data).then(r => r.data);
export const del  = (path)         => api.delete(path).then(r => r.data);

// ── Lead helpers ──
// EspoCRM list response shape: { total, list: [...] }

export const listLeads  = (params) => get('/Lead', params);
export const getLead    = (id)     => get(`/Lead/${id}`);
export const createLead = (data)   => post('/Lead', data);
export const updateLead = (id, d)  => put(`/Lead/${id}`, d);
export const deleteLead = (id)     => del(`/Lead/${id}`);

// Lead enum values — sourced from EspoCRM entityDefs/Lead.json
export const LEAD_STATUSES = ['New', 'Assigned', 'In Process', 'Converted', 'Recycled', 'Dead'];
export const LEAD_SOURCES  = ['Call', 'Email', 'Existing Customer', 'Partner', 'Public Relations', 'Web Site', 'Campaign', 'Other'];
export const LEAD_SALUTATIONS = ['', 'Mr.', 'Ms.', 'Mrs.', 'Dr.'];
