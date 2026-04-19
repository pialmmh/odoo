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
export const listMeetings   = (params) => get('/Meeting', params);
export const getMeeting     = (id)     => get(`/Meeting/${id}`);
export const updateMeeting  = (id, d)  => put(`/Meeting/${id}`, d);
export const deleteMeeting  = (id)     => del(`/Meeting/${id}`);
export const listCalls      = (params) => get('/Call', params);

// ── Email ──
export const listEmails    = (params) => get('/Email', params);
export const getEmail      = (id)     => get(`/Email/${id}`);
export const updateEmail   = (id, d)  => put(`/Email/${id}`, d);
export const deleteEmail   = (id)     => del(`/Email/${id}`);
export const sendEmailMsg  = (data)   => post('/Email', { ...data, status: 'Sending' });
export const saveEmailDraft = (data) => {
  if (data.id) return put(`/Email/${data.id}`, { ...data, status: 'Draft' });
  return post('/Email', { ...data, status: 'Draft' });
};
export const emailMassUpdate = (ids, data) =>
  post('/Email/action/massUpdate', { ids, data });
export const markEmailsRead = (ids, isRead) => emailMassUpdate(ids, { isRead });
export const moveEmailsToFolder = (ids, folderId) => emailMassUpdate(ids, { folderId });
export const linkEmailToParent = (id, parentType, parentId, parentName) =>
  put(`/Email/${id}`, { parentType, parentId, parentName });

// ── EmailFolder (custom user folders) ──
export const listEmailFolders = (params) => get('/EmailFolder', { maxSize: 200, ...params });

// ── Attachments (two-step: POST metadata+base64, then use id in email) ──
export const uploadAttachment = async (file, relatedType = 'Email', field = 'attachments') => {
  const base64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return post('/Attachment', {
    name: file.name,
    type: file.type,
    size: file.size,
    role: 'Attachment',
    relatedType,
    field,
    file: base64,
  });
};
export const attachmentDownloadUrl = (attachmentId) =>
  `/api/crm/Attachment/file/${attachmentId}`;

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

// ── Admin: Users, Teams, Roles, Auth Log/Tokens, Action History, API Users ──
// Users — Espo entity: User. Types: regular | admin | api | portal | system | super-admin.
export const listUsers   = (params) => get('/User',  params);
export const getUser     = (id)     => get(`/User/${id}`);
export const createUser  = (data)   => post('/User',    data);
export const updateUser  = (id, d)  => put(`/User/${id}`, d);
export const deleteUser  = (id)     => del(`/User/${id}`);

// Teams
export const listTeams   = (params) => get('/Team',  params);
export const getTeam     = (id)     => get(`/Team/${id}`);
export const createTeam  = (data)   => post('/Team',    data);
export const updateTeam  = (id, d)  => put(`/Team/${id}`, d);
export const deleteTeam  = (id)     => del(`/Team/${id}`);

// Roles
export const listRoles   = (params) => get('/Role',  params);
export const getRole     = (id)     => get(`/Role/${id}`);
export const createRole  = (data)   => post('/Role',    data);
export const updateRole  = (id, d)  => put(`/Role/${id}`, d);
export const deleteRole  = (id)     => del(`/Role/${id}`);

// Auth Log (login history, read-only)
export const listAuthLog = (params) => get('/AuthLogRecord', params);

// Auth Tokens (active sessions; can be deleted to revoke)
export const listAuthTokens = (params) => get('/AuthToken', params);
export const revokeAuthToken = (id)   => del(`/AuthToken/${id}`);

// Action History (log of user actions, read-only)
export const listActionHistory = (params) => get('/ActionHistoryRecord', params);

// API Users — stored as User with type='api'
export const listApiUsers  = (params) => listUsers({
  ...params,
  'where[0][type]': 'equals',
  'where[0][attribute]': 'type',
  'where[0][value]': 'api',
});

// Settings: GET /Settings returns all config, PATCH /Settings with partial updates.
export const getSettings    = ()     => get('/Settings');
export const updateSettings = (data) => api.patch('/Settings', data).then((r) => r.data);

// Messaging CRUD entities
export const listInboundEmails = (params) => get('/InboundEmail', params);
export const getInboundEmail   = (id)     => get(`/InboundEmail/${id}`);
export const createInboundEmail = (data)  => post('/InboundEmail', data);
export const updateInboundEmail = (id, d) => put(`/InboundEmail/${id}`, d);
export const deleteInboundEmail = (id)    => del(`/InboundEmail/${id}`);

export const listEmailAccounts = (params) => get('/EmailAccount', params);
export const getEmailAccount   = (id)     => get(`/EmailAccount/${id}`);
export const createEmailAccount = (data)  => post('/EmailAccount', data);
export const updateEmailAccount = (id, d) => put(`/EmailAccount/${id}`, d);
export const deleteEmailAccount = (id)    => del(`/EmailAccount/${id}`);

export const listEmailFilters  = (params) => get('/EmailFilter', params);
export const createEmailFilter = (data)   => post('/EmailFilter', data);
export const updateEmailFilter = (id, d)  => put(`/EmailFilter/${id}`, d);
export const deleteEmailFilter = (id)     => del(`/EmailFilter/${id}`);

export const listGroupEmailFolders  = (params) => get('/GroupEmailFolder', params);
export const createGroupEmailFolder = (data)   => post('/GroupEmailFolder', data);
export const updateGroupEmailFolder = (id, d)  => put(`/GroupEmailFolder/${id}`, d);
export const deleteGroupEmailFolder = (id)     => del(`/GroupEmailFolder/${id}`);

export const listEmailTemplates  = (params) => get('/EmailTemplate', params);
export const getEmailTemplate    = (id)     => get(`/EmailTemplate/${id}`);
export const createEmailTemplate = (data)   => post('/EmailTemplate', data);
export const updateEmailTemplate = (id, d)  => put(`/EmailTemplate/${id}`, d);
export const deleteEmailTemplate = (id)     => del(`/EmailTemplate/${id}`);

// Enums
export const SMTP_SECURITY    = ['', 'SSL', 'TLS'];
export const IMAP_SECURITY    = ['', 'SSL', 'TLS'];
export const INBOUND_STATUS   = ['Active', 'Inactive'];
export const EMAIL_FILTER_ACTIONS = ['Skip', 'Move to Folder', 'None'];

// Link-picker list endpoints used by the User edit form
export const listWorkingTimeCalendars = (params) =>
  get('/WorkingTimeCalendar', { maxSize: 50, orderBy: 'name', order: 'asc', ...params });
export const listLayoutSets = (params) =>
  get('/LayoutSet', { maxSize: 50, orderBy: 'name', order: 'asc', ...params });

export const USER_TYPES = ['regular', 'admin', 'portal', 'api', 'system', 'super-admin'];
export const USER_SALUTATIONS = ['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.'];
export const USER_GENDERS = ['', 'Male', 'Female', 'Neutral'];
export const AUTH_METHODS = ['', 'ApiKey', 'Hmac'];
export const ASSIGNMENT_PERMISSIONS = ['all', 'team', 'no'];
export const SCOPE_LEVELS = ['all', 'team', 'own', 'no'];
export const ACTION_LEVELS = ['yes', 'no'];

// ── Chat / IM / SMS — custom entities (see espocrm/custom/Espo/Custom/Resources/metadata) ──
export const CHAT_CHANNELS = ['facebook', 'whatsapp', 'sms', 'email'];
export const CHAT_CHANNEL_COLORS = {
  facebook: '#1877F2',
  whatsapp: '#25D366',
  sms:      '#FF9800',
  email:    '#DC3545',
};
export const IM_CONVERSATION_STATUS = ['open', 'closed', 'archived'];
export const IM_DELETION_STATUS     = ['pending', 'processed', 'rejected'];

export const listChannelCredentials   = (params) => get('/ChannelCredential', params);
export const getChannelCredential     = (id)     => get(`/ChannelCredential/${id}`);
export const createChannelCredential  = (data)   => post('/ChannelCredential', data);
export const updateChannelCredential  = (id, d)  => put(`/ChannelCredential/${id}`, d);
export const deleteChannelCredential  = (id)     => del(`/ChannelCredential/${id}`);

export const listSmsSettings   = (params) => get('/SmsSetting', params);
export const getSmsSetting     = (id)     => get(`/SmsSetting/${id}`);
export const createSmsSetting  = (data)   => post('/SmsSetting', data);
export const updateSmsSetting  = (id, d)  => put(`/SmsSetting/${id}`, d);
export const deleteSmsSetting  = (id)     => del(`/SmsSetting/${id}`);

export const listImConversations  = (params) => get('/ImConversation', params);
export const getImConversation    = (id)     => get(`/ImConversation/${id}`);

export const listImCustomers  = (params) => get('/ImCustomer', params);
export const getImCustomer    = (id)     => get(`/ImCustomer/${id}`);

export const listImHandoffs  = (params) => get('/ImHandoff', params);
export const getImHandoff    = (id)     => get(`/ImHandoff/${id}`);

export const listImDeletionRequests  = (params) => get('/ImDeletionRequest', params);
export const updateImDeletionRequest = (id, d)  => put(`/ImDeletionRequest/${id}`, d);
