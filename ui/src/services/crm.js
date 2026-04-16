import axios from 'axios';
import { getToken } from './keycloak';

// ── CRM client: routes through Spring Boot gateway → EspoCRM (server-side only) ──

const api = axios.create({
  baseURL: '/api/crm',
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

// ── Generic passthrough ──
export const get  = (path, params) => api.get(path, { params }).then(r => r.data);
export const post = (path, data)   => api.post(path, data).then(r => r.data);
export const put  = (path, data)   => api.put(path, data).then(r => r.data);
export const del  = (path)         => api.delete(path).then(r => r.data);

// ── Lead helpers ──
export const listLeads  = (params) => get('/Lead', params);
export const getLead    = (id)     => get(`/Lead/${id}`);
export const createLead = (data)   => post('/Lead', data);
export const updateLead = (id, d)  => put(`/Lead/${id}`, d);
export const deleteLead = (id)     => del(`/Lead/${id}`);

// ── Lead → Convert flow ──
// Mirrors EspoCRM's /Lead/action/getConvertAttributes + /Lead/action/convert
export const getConvertAttributes = (id) =>
  post('/Lead/action/getConvertAttributes', { id });

export const convertLead = (id, records, { skipDuplicateCheck = false } = {}) =>
  post('/Lead/action/convert', { id, records, skipDuplicateCheck });

// ── Lead enum values (from EspoCRM entityDefs/Lead.json) ──
export const LEAD_STATUSES = ['New', 'Assigned', 'In Process', 'Converted', 'Recycled', 'Dead'];
export const LEAD_NOT_ACTUAL_STATUSES = ['Converted', 'Recycled', 'Dead'];
export const LEAD_SOURCES = [
  'Call', 'Email', 'Existing Customer', 'Partner',
  'Public Relations', 'Web Site', 'Campaign', 'Other',
];
export const LEAD_SALUTATIONS = ['', 'Mr.', 'Ms.', 'Mrs.', 'Dr.'];

// ── Account enum values (from Account.json) ──
export const ACCOUNT_TYPES = ['', 'Customer', 'Investor', 'Partner', 'Reseller'];

// ── Opportunity enum values (from Opportunity.json) ──
export const OPPORTUNITY_STAGES = [
  'Prospecting', 'Qualification', 'Proposal',
  'Negotiation', 'Closed Won', 'Closed Lost',
];
export const OPPORTUNITY_PROBABILITY_MAP = {
  Prospecting: 10,
  Qualification: 20,
  Proposal: 50,
  Negotiation: 80,
  'Closed Won': 100,
  'Closed Lost': 0,
};
