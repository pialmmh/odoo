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

// ── Follow / Unfollow (works for any entity) ──
// EspoCRM: PUT /{entity}/{id}/subscription  /  DELETE same
export const followEntity   = (entity, id) => put(`/${entity}/${id}/subscription`);
export const unfollowEntity = (entity, id) => del(`/${entity}/${id}/subscription`);

// ── Lead helpers ──
export const listLeads  = (params) => get('/Lead', params);
export const getLead    = (id)     => get(`/Lead/${id}`);
export const createLead = (data)   => post('/Lead', data);
export const updateLead = (id, d)  => put(`/Lead/${id}`, d);
export const deleteLead = (id)     => del(`/Lead/${id}`);

// ── Contact helpers ──
export const listContacts  = (params) => get('/Contact', params);
export const getContact    = (id)     => get(`/Contact/${id}`);
export const createContact = (data)   => post('/Contact', data);
export const updateContact = (id, d)  => put(`/Contact/${id}`, d);
export const deleteContact = (id)     => del(`/Contact/${id}`);

// ── Account helpers ──
export const listAccounts  = (params) => get('/Account', params);
export const getAccount    = (id)     => get(`/Account/${id}`);
export const createAccount = (data)   => post('/Account', data);
export const updateAccount = (id, d)  => put(`/Account/${id}`, d);
export const deleteAccount = (id)     => del(`/Account/${id}`);

// ── Opportunity helpers ──
export const listOpportunities  = (params) => get('/Opportunity', params);
export const getOpportunity     = (id)     => get(`/Opportunity/${id}`);
export const createOpportunity  = (data)   => post('/Opportunity', data);
export const updateOpportunity  = (id, d)  => put(`/Opportunity/${id}`, d);
export const deleteOpportunity  = (id)     => del(`/Opportunity/${id}`);

// ── Case helpers ──
export const createCase = (data)   => post('/Case', data);
export const listCases  = (params) => get('/Case', params);
export const getCase    = (id)     => get(`/Case/${id}`);
export const updateCase = (id, d)  => put(`/Case/${id}`, d);
export const deleteCase = (id)     => del(`/Case/${id}`);

// ── Task helpers ──
export const listTasks  = (params) => get('/Task', params);
export const getTask    = (id)     => get(`/Task/${id}`);
export const updateTask = (id, d)  => put(`/Task/${id}`, d);
export const deleteTask = (id)     => del(`/Task/${id}`);

// ── Meeting / Call (for calendar) ──
export const listMeetings = (params) => get('/Meeting', params);
export const listCalls    = (params) => get('/Call', params);

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

// ── Case enum values (from Case.json) ──
export const CASE_STATUSES   = ['New', 'Assigned', 'Pending', 'Closed', 'Rejected', 'Duplicate'];
export const CASE_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
export const CASE_TYPES      = ['', 'Question', 'Incident', 'Problem'];

// ── Task enum values (from Task.json) ──
export const TASK_STATUSES   = ['Not Started', 'Started', 'Completed', 'Canceled', 'Deferred'];
export const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

// ── Meeting / Call enum values ──
export const MEETING_STATUSES = ['Planned', 'Held', 'Not Held'];
export const CALL_STATUSES    = ['Planned', 'Held', 'Not Held'];
