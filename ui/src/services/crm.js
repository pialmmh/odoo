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

// ── Current user (cached) — needed to populate assignedUserId on creates ──
let _currentUser = null;
export async function getCurrentUser() {
  if (_currentUser) return _currentUser;
  const resp = await get('/App/user');
  _currentUser = resp?.user || null;
  return _currentUser;
}

// ── Activity creates (Meeting / Call / Task / Email) ──
export const createMeeting = (data) => post('/Meeting', data);
export const createCall    = (data) => post('/Call', data);
export const createTask    = (data) => post('/Task', data);
export const createEmail   = (data) => post('/Email', data);

// ── Stream (Notes on a record) ──
export const getStream = (entityType, id, params) =>
  get(`/${entityType}/${id}/stream`, params);

export const postNote = (entityType, id, text) =>
  post('/Note', { parentType: entityType, parentId: id, type: 'Post', post: text });

// ── Activities (upcoming) + History (past) + Tasks ──
// EspoCRM path: /Activities/{scope}/{id}/{activities|history}
export const getActivities = (entityType, id) =>
  get(`/Activities/${entityType}/${id}/activities`);
export const getHistory = (entityType, id) =>
  get(`/Activities/${entityType}/${id}/history`);
export const getRelatedTasks = (entityType, id, params) =>
  get(`/${entityType}/${id}/tasks`, params);

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
