/**
 * Espo-shape CRM adapter, backed by Odoo.
 *
 * This module exposes the SAME function signatures as `services/crm.js`
 * (the EspoCRM client) — same names, same params, same response shape —
 * so the existing React CRM pages can be cloned with only the import
 * line changed.
 *
 *   listLeads({ maxSize, offset, orderBy, order, where[]... })
 *     → { list: [...], total: N }
 *     where each row uses Espo field names: name, firstName, lastName,
 *     emailAddress, phoneNumber, status, source, accountName,
 *     assignedUserName, createdAt, doNotCall, …
 *
 * Translation lives entirely on the frontend so the gateway stays
 * tenant-aware via the X-Tenant-Slug header (already handled by
 * `services/odoo.js`).
 */

import { call } from './odoo';

// ────────────────────────────── Constants (re-exported under same names as crm.js)
export const LEAD_STATUSES = ['New', 'Assigned', 'In Process', 'Converted', 'Recycled', 'Dead'];
export const LEAD_NOT_ACTUAL_STATUSES = ['Converted', 'Recycled', 'Dead'];
export const LEAD_SOURCES = [
  'Call', 'Email', 'Existing Customer', 'Partner',
  'Public Relations', 'Web Site', 'Campaign', 'Other',
];
export const LEAD_SALUTATIONS = ['', 'Mr.', 'Ms.', 'Mrs.', 'Dr.'];

// ────────────────────────────── Field set we read from Odoo
const READ_FIELDS = [
  'id', 'name', 'type', 'contact_name', 'partner_name', 'partner_id',
  'email_from', 'phone', 'mobile', 'function', 'website', 'description',
  'street', 'street2', 'city', 'state_id', 'zip', 'country_id',
  'expected_revenue', 'probability', 'company_currency', 'date_deadline',
  'user_id', 'team_id', 'stage_id', 'campaign_id',
  'create_date', 'write_date', 'create_uid', 'write_uid',
  'message_partner_ids',
  'x_espo_status', 'x_espo_source',
  'x_industry', 'x_do_not_call', 'x_salutation',
  'x_first_name', 'x_last_name',
];

// ────────────────────────────── Date helpers
const toEspoDate = (s) => {
  if (!s) return '';
  // Odoo: "2026-05-01 02:14:33" (UTC-naive). Espo UI just renders strings, so
  // a localised "M/d/yyyy, h:mm AM" reads fine.
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d) ? s : d.toLocaleString();
};

// ────────────────────────────── Odoo-row → Espo-row
function odooToEspoLead(r) {
  if (!r) return null;
  const m2o = (v) => (Array.isArray(v) ? v : [null, '']);
  const [userId,   userName]    = m2o(r.user_id);
  const [teamId,   teamName]    = m2o(r.team_id);
  const [stateId,  stateName]   = m2o(r.state_id);
  const [countryId,countryName] = m2o(r.country_id);
  const [campId,   campName]    = m2o(r.campaign_id);
  const [createUid,createUidNm] = m2o(r.create_uid);
  const [writeUid, writeUidNm]  = m2o(r.write_uid);
  const [stageId,  stageName]   = m2o(r.stage_id);
  const [partnerId,partnerNm]   = m2o(r.partner_id);
  const [currencyId,currencyNm] = m2o(r.company_currency);
  // Build firstName / lastName: prefer the dedicated fields, fall back to a
  // split of contact_name on the first space.
  let firstName = r.x_first_name || '';
  let lastName  = r.x_last_name  || '';
  if (!firstName && !lastName && r.contact_name) {
    const parts = r.contact_name.trim().split(/\s+/);
    if (parts.length === 1) lastName = parts[0];
    else { firstName = parts.slice(0, -1).join(' '); lastName = parts.slice(-1)[0]; }
  }
  const isConverted = r.x_espo_status === 'Converted';
  return {
    id:                String(r.id),
    name:              r.name || '',
    type:              r.type || 'lead',
    firstName,
    lastName,
    salutationName:    r.x_salutation || '',
    title:             r.function || '',
    accountName:       r.partner_name || partnerNm || '',
    accountId:         partnerId,
    emailAddress:      r.email_from || '',
    phoneNumber:       r.phone || '',
    mobileNumber:      r.mobile || '',
    status:            r.x_espo_status || 'New',
    source:            r.x_espo_source || '',
    industry:          r.x_industry || '',
    stageId:           stageId,
    stageName:         stageName || '',
    probability:       r.probability ?? null,
    closeDate:         r.date_deadline || null,
    opportunityAmount: r.expected_revenue ?? null,
    opportunityAmountCurrency: currencyNm || '',
    amountCurrency:    currencyNm || '',
    doNotCall:         !!r.x_do_not_call,
    website:           r.website || '',
    description:       r.description || '',
    addressStreet:     r.street || '',
    addressStreet2:    r.street2 || '',
    addressCity:       r.city || '',
    addressState:      stateName || '',
    addressCountry:    countryName || '',
    addressPostalCode: r.zip || '',
    assignedUserId:    userId,
    assignedUserName:  userName || '',
    teamsIds:          teamId ? [teamId] : [],
    teamsNames:        teamName ? { [teamId]: teamName } : null,
    campaignId:        campId,
    campaignName:      campName || '',
    createdAt:         toEspoDate(r.create_date),
    modifiedAt:        toEspoDate(r.write_date),
    createdById:       createUid,
    createdByName:     createUidNm || '',
    modifiedById:      writeUid,
    modifiedByName:    writeUidNm || '',
    convertedAt:       isConverted ? toEspoDate(r.write_date) : null,
    isFollowed:        Array.isArray(r.message_partner_ids) && r.message_partner_ids.length > 0,
    followersIds:      r.message_partner_ids || [],
  };
}

// ────────────────────────────── Espo-vals → Odoo-vals (for create/update)
function espoToOdooVals(v) {
  const out = {};
  if (v.name              !== undefined) out.name = v.name;
  // Build/refresh the Odoo contact_name from first+last if either was sent.
  if (v.firstName !== undefined || v.lastName !== undefined) {
    const fn = v.firstName ?? '';
    const ln = v.lastName ?? '';
    out.contact_name = `${fn} ${ln}`.trim();
    out.x_first_name = fn || false;
    out.x_last_name  = ln || false;
    if (!out.name) out.name = out.contact_name; // Odoo requires `name`
  }
  if (v.salutationName    !== undefined) out.x_salutation     = v.salutationName || false;
  if (v.title             !== undefined) out.function         = v.title || false;
  if (v.accountName       !== undefined) out.partner_name     = v.accountName || false;
  if (v.emailAddress      !== undefined) out.email_from       = v.emailAddress || false;
  if (v.phoneNumber       !== undefined) out.phone            = v.phoneNumber || false;
  if (v.status            !== undefined) out.x_espo_status    = v.status || false;
  if (v.source            !== undefined) out.x_espo_source    = v.source || false;
  if (v.industry          !== undefined) out.x_industry       = v.industry || false;
  if (v.doNotCall         !== undefined) out.x_do_not_call    = !!v.doNotCall;
  if (v.website           !== undefined) out.website          = v.website || false;
  if (v.description       !== undefined) out.description      = v.description || false;
  if (v.opportunityAmount !== undefined)
    out.expected_revenue = v.opportunityAmount === '' || v.opportunityAmount == null ? 0 : Number(v.opportunityAmount);
  if (v.amount !== undefined)
    out.expected_revenue = v.amount === '' || v.amount == null ? 0 : Number(v.amount);
  if (v.probability       !== undefined) out.probability      = v.probability == null ? false : Number(v.probability);
  if (v.closeDate         !== undefined) out.date_deadline    = v.closeDate || false;
  if (v.stage             !== undefined) out.x_espo_status    = v.stage || false;
  if (v.type              !== undefined) out.type             = v.type;
  if (v.assignedUserId    !== undefined) out.user_id          = v.assignedUserId || false;
  return out;
}

// ────────────────────────────── Espo `where[]` → Odoo domain
function whereToDomain(params) {
  // Translate the keys `where[N][type|attribute|value]` into Odoo terms.
  const buckets = {};
  for (const k of Object.keys(params || {})) {
    const m = k.match(/^where\[(\d+)\]\[(type|attribute|value)\]$/);
    if (!m) continue;
    const [, idx, key] = m;
    (buckets[idx] ??= {})[key] = params[k];
  }
  // Field-name translation: Espo attr → Odoo field.
  const ATTR = {
    status:       'x_espo_status',
    stage:        'x_espo_status',
    source:       'x_espo_source',
    name:         'name',
    emailAddress: 'email_from',
    phoneNumber:  'phone',
    accountName:  'partner_name',
    type:         'type',
    createdAt:    'create_date',
  };
  const domain = [];
  for (const idx of Object.keys(buckets).sort((a, b) => +a - +b)) {
    const b = buckets[idx];
    if (b.type === 'equals' && b.attribute && b.value !== undefined) {
      domain.push([ATTR[b.attribute] || b.attribute, '=', b.value]);
    } else if (b.type === 'after' && b.attribute && b.value !== undefined) {
      domain.push([ATTR[b.attribute] || b.attribute, '>=', b.value]);
    } else if (b.type === 'before' && b.attribute && b.value !== undefined) {
      domain.push([ATTR[b.attribute] || b.attribute, '<=', b.value]);
    } else if (b.type === 'textFilter' && b.value) {
      // Espo's text filter: search across name + contact_name + email + phone + partner_name.
      const t = b.value;
      domain.push('|', '|', '|', '|',
        ['name',         'ilike', t],
        ['contact_name', 'ilike', t],
        ['email_from',   'ilike', t],
        ['phone',        'ilike', t],
        ['partner_name', 'ilike', t],
      );
    }
  }
  return domain;
}

const orderToOdoo = (orderBy, order) => {
  const F = {
    createdAt: 'create_date',
    modifiedAt: 'write_date',
    name: 'name',
    status: 'x_espo_status',
    emailAddress: 'email_from',
  };
  const f = F[orderBy] || orderBy || 'create_date';
  return `${f} ${(order || 'desc').toLowerCase()}`;
};

// ────────────────────────────── Public API (matches services/crm.js)
export async function listLeads(params = {}) {
  const domain = whereToDomain(params);
  const limit  = Number(params.maxSize) || 20;
  const offset = Number(params.offset)  || 0;
  const order  = orderToOdoo(params.orderBy, params.order);

  const [rows, total] = await Promise.all([
    call('crm.lead', 'search_read', [domain], { fields: READ_FIELDS, limit, offset, order }),
    call('crm.lead', 'search_count', [domain]),
  ]);
  return { list: rows.map(odooToEspoLead), total };
}

export async function getLead(id) {
  const rows = await call('crm.lead', 'read', [[Number(id)]], { fields: READ_FIELDS });
  return odooToEspoLead(rows && rows[0]);
}

export async function createLead(vals) {
  const odooVals = espoToOdooVals(vals);
  // Odoo requires `name`; if neither subject nor lastName supplied, guard.
  if (!odooVals.name) odooVals.name = odooVals.contact_name || 'Untitled lead';
  const id = await call('crm.lead', 'create', [odooVals]);
  return { id: String(id) };
}

export async function updateLead(id, vals) {
  await call('crm.lead', 'write', [[Number(id)], espoToOdooVals(vals)]);
  return { id: String(id) };
}

export async function deleteLead(id) {
  await call('crm.lead', 'unlink', [[Number(id)]]);
  return { id: String(id) };
}

// ────────────────────────────── CONTACTS / ACCOUNTS (res.partner) ─────────
// Espo splits Contacts (people) and Accounts (companies); Odoo unifies them
// under res.partner with a boolean is_company. We expose both via the same
// underlying calls + an is_company filter.

const PARTNER_FIELDS = [
  'id', 'name', 'is_company', 'parent_id',
  'function', 'title', 'email', 'phone', 'mobile',
  'website', 'industry_id',
  'street', 'street2', 'city', 'state_id', 'country_id', 'zip',
  'user_id',
  'create_date', 'write_date',
];

function partnerToEspoContact(r) {
  if (!r) return null;
  const m2o = (v) => (Array.isArray(v) ? v : [null, '']);
  const [, parentName] = m2o(r.parent_id);
  const [, userName]   = m2o(r.user_id);
  const [, industryNm] = m2o(r.industry_id);
  // Split name on first space for firstName/lastName
  let firstName = '', lastName = '';
  if (r.name) {
    const parts = r.name.trim().split(/\s+/);
    if (parts.length === 1) lastName = parts[0];
    else { firstName = parts.slice(0, -1).join(' '); lastName = parts.slice(-1)[0]; }
  }
  return {
    id:               String(r.id),
    name:             r.name || '',
    firstName,
    lastName,
    title:            r.function || '',     // Job title (Espo "title" = job title)
    accountName:      parentName || '',
    accountId:        Array.isArray(r.parent_id) ? r.parent_id[0] : null,
    emailAddress:     r.email || '',
    phoneNumber:      r.phone || '',
    mobileNumber:     r.mobile || '',
    industry:         industryNm || '',
    website:          r.website || '',
    addressStreet:    r.street || '',
    addressCity:      r.city  || '',
    addressPostalCode:r.zip   || '',
    assignedUserName: userName || '',
    createdAt:        toEspoDate(r.create_date),
    modifiedAt:       toEspoDate(r.write_date),
    isCompany:        !!r.is_company,
  };
}

function partnerToEspoAccount(r) {
  // Same shape as contact but the row IS the account.
  const c = partnerToEspoContact(r);
  return c && {
    ...c,
    type: '',           // Espo Account has a type field; not modelled here
  };
}

function espoContactToPartnerVals(v, opts = { isCompany: false }) {
  const out = { is_company: !!opts.isCompany };
  if (v.firstName !== undefined || v.lastName !== undefined) {
    const fn = v.firstName ?? '';
    const ln = v.lastName ?? '';
    out.name = `${fn} ${ln}`.trim() || (v.name || 'Unnamed');
  } else if (v.name !== undefined) {
    out.name = v.name;
  }
  if (v.title          !== undefined) out.function = v.title || false;
  if (v.emailAddress   !== undefined) out.email    = v.emailAddress || false;
  if (v.phoneNumber    !== undefined) out.phone    = v.phoneNumber || false;
  if (v.mobileNumber   !== undefined) out.mobile   = v.mobileNumber || false;
  if (v.website        !== undefined) out.website  = v.website || false;
  if (v.addressStreet  !== undefined) out.street   = v.addressStreet || false;
  if (v.addressCity    !== undefined) out.city     = v.addressCity || false;
  if (v.addressPostalCode !== undefined) out.zip   = v.addressPostalCode || false;
  if (v.accountId      !== undefined) out.parent_id = v.accountId || false;
  return out;
}

function partnerWhereToDomain(params, isCompany) {
  // Re-use whereToDomain but force is_company filter.
  const ATTR = {
    name: 'name', emailAddress: 'email', phoneNumber: 'phone',
    accountName: 'parent_id.name',
  };
  const buckets = {};
  for (const k of Object.keys(params || {})) {
    const m = k.match(/^where\[(\d+)\]\[(type|attribute|value)\]$/);
    if (!m) continue;
    const [, idx, key] = m;
    (buckets[idx] ??= {})[key] = params[k];
  }
  const domain = [['is_company', '=', !!isCompany]];
  for (const idx of Object.keys(buckets).sort((a, b) => +a - +b)) {
    const b = buckets[idx];
    if (b.type === 'equals' && b.attribute && b.value !== undefined) {
      domain.push([ATTR[b.attribute] || b.attribute, '=', b.value]);
    } else if (b.type === 'textFilter' && b.value) {
      const t = b.value;
      domain.push('|', '|', '|',
        ['name',  'ilike', t],
        ['email', 'ilike', t],
        ['phone', 'ilike', t],
        ['mobile','ilike', t],
      );
    }
  }
  return domain;
}

async function listPartners(params = {}, isCompany) {
  const domain = partnerWhereToDomain(params, isCompany);
  const limit  = Number(params.maxSize) || 20;
  const offset = Number(params.offset)  || 0;
  const orderField = ({ createdAt: 'create_date', name: 'name' })[params.orderBy] || 'create_date';
  const order  = `${orderField} ${(params.order || 'desc').toLowerCase()}`;
  const [rows, total] = await Promise.all([
    call('res.partner', 'search_read', [domain], { fields: PARTNER_FIELDS, limit, offset, order }),
    call('res.partner', 'search_count', [domain]),
  ]);
  const map = isCompany ? partnerToEspoAccount : partnerToEspoContact;
  return { list: rows.map(map), total };
}

// Contact (is_company=False)
export const listContacts   = (params)    => listPartners(params, false);
export const getContact     = (id)        => call('res.partner', 'read', [[Number(id)]], { fields: PARTNER_FIELDS }).then(r => partnerToEspoContact(r && r[0]));
export const createContact  = (vals)      => call('res.partner', 'create', [espoContactToPartnerVals(vals, { isCompany: false })]).then(id => ({ id: String(id) }));
export const updateContact  = (id, vals)  => call('res.partner', 'write', [[Number(id)], espoContactToPartnerVals(vals, { isCompany: false })]).then(() => ({ id: String(id) }));
export const deleteContact  = (id)        => call('res.partner', 'unlink', [[Number(id)]]).then(() => ({ id: String(id) }));

// Account (is_company=True)
export const listAccounts   = (params)    => listPartners(params, true);
export const getAccount     = (id)        => call('res.partner', 'read', [[Number(id)]], { fields: PARTNER_FIELDS }).then(r => partnerToEspoAccount(r && r[0]));
export const createAccount  = (vals)      => call('res.partner', 'create', [espoContactToPartnerVals(vals, { isCompany: true })]).then(id => ({ id: String(id) }));
export const updateAccount  = (id, vals)  => call('res.partner', 'write', [[Number(id)], espoContactToPartnerVals(vals, { isCompany: true })]).then(() => ({ id: String(id) }));
export const deleteAccount  = (id)        => call('res.partner', 'unlink', [[Number(id)]]).then(() => ({ id: String(id) }));

// ────────────────────────────── OPPORTUNITIES (crm.lead with type='opportunity')
// Same model as Lead, filtered to type='opportunity'.  Stage uses x_espo_status
// (Prospecting / Qualification / Proposal / Negotiation / Closed Won / Closed Lost)
// instead of Odoo's stage_id, so we don't need crm.stage seed data per tenant.

// Default probability per stage (mirrors Espo's OPPORTUNITY_PROBABILITY_MAP).
export const OPPORTUNITY_PROBABILITY_MAP = {
  'Prospecting':   10,
  'Qualification': 20,
  'Proposal':      50,
  'Negotiation':   80,
  'Closed Won':    100,
  'Closed Lost':   0,
};

const oppToEspo = (o) => ({
  ...o,
  stage:        o.status,                 // x_espo_status used as stage
  amount:       o.opportunityAmount,
  amountCurrency: o.amountCurrency || o.opportunityAmountCurrency || '',
  amountWeightedConverted:
    o.opportunityAmount != null && o.probability != null
      ? Number(o.opportunityAmount) * Number(o.probability) / 100
      : null,
});

export async function listOpportunities(params = {}) {
  const p = { ...params };
  // Append a `type=opportunity` clause to whatever where[]'s the caller passed.
  let i = 0; while (p[`where[${i}][type]`] !== undefined) i++;
  p[`where[${i}][type]`]      = 'equals';
  p[`where[${i}][attribute]`] = 'type';
  p[`where[${i}][value]`]     = 'opportunity';
  const r = await listLeads(p);
  return { list: r.list.map(oppToEspo), total: r.total };
}
export const getOpportunity    = (id)       => getLead(id).then(oppToEspo);
export const createOpportunity = (vals)     => createLead({ ...vals, type: 'opportunity' });
export const updateOpportunity = (id, vals) => updateLead(id, vals);
export const deleteOpportunity = (id)       => deleteLead(id);

export const OPPORTUNITY_STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

// ────────────────────────────── CASES (project.task) ──────────────────────
// Espo Case ≈ Odoo project.task.  Mapping:
//   Espo name        → task.name
//   Espo description → task.description
//   Espo status      → task.stage_id (m2o → project.task.type)
//   Espo priority    → task.priority ('0' Normal | '1' High)
//   Espo assignedUser→ task.user_ids (m2m, take first)
//   Espo accountName → task.partner_id.name
const TASK_FIELDS = [
  'id', 'name', 'description', 'priority', 'stage_id',
  'user_ids', 'partner_id', 'project_id',
  'create_date', 'write_date',
];

const TASK_PRIORITY_TO_ESPO = { '0': 'Normal', '1': 'High' };
const ESPO_PRIORITY_TO_TASK = { Low: '0', Normal: '0', High: '1', Urgent: '1' };

function taskToEspoCase(r) {
  if (!r) return null;
  const m2o = (v) => (Array.isArray(v) ? v : [null, '']);
  const [, stageName]   = m2o(r.stage_id);
  const [, partnerName] = m2o(r.partner_id);
  return {
    id:               String(r.id),
    name:             r.name || '',
    description:      r.description || '',
    status:           stageName || 'New',
    priority:         TASK_PRIORITY_TO_ESPO[r.priority] || 'Normal',
    accountName:      partnerName || '',
    assignedUserName: '',                 // m2m; resolve later if needed
    createdAt:        toEspoDate(r.create_date),
    modifiedAt:       toEspoDate(r.write_date),
  };
}

function espoCaseToTaskVals(v) {
  const out = {};
  if (v.name        !== undefined) out.name        = v.name;
  if (v.description !== undefined) out.description = v.description || false;
  if (v.priority    !== undefined) out.priority    = ESPO_PRIORITY_TO_TASK[v.priority] || '0';
  return out;
}

export async function listCases(params = {}) {
  // Note: requires `project` module installed on the tenant DB.
  try {
    const t = (params.search || '').trim();
    const domain = t ? ['|', ['name', 'ilike', t], ['description', 'ilike', t]] : [];
    const limit  = Number(params.maxSize) || 20;
    const offset = Number(params.offset)  || 0;
    const order  = 'create_date desc';
    const [rows, total] = await Promise.all([
      call('project.task', 'search_read', [domain], { fields: TASK_FIELDS, limit, offset, order }),
      call('project.task', 'search_count', [domain]),
    ]);
    return { list: rows.map(taskToEspoCase), total };
  } catch (e) {
    // project module not installed for this tenant DB — surface friendly empty state.
    if ((e?.response?.data?.message || '').includes('project.task')) {
      return { list: [], total: 0, _backendUnavailable: true };
    }
    throw e;
  }
}
export const getCase    = (id)        => call('project.task', 'read', [[Number(id)]], { fields: TASK_FIELDS }).then(r => taskToEspoCase(r && r[0]));
export const createCase = (vals)      => call('project.task', 'create', [espoCaseToTaskVals(vals)]).then(id => ({ id: String(id) }));
export const updateCase = (id, vals)  => call('project.task', 'write', [[Number(id)], espoCaseToTaskVals(vals)]).then(() => ({ id: String(id) }));
export const deleteCase = (id)        => call('project.task', 'unlink', [[Number(id)]]).then(() => ({ id: String(id) }));

export const CASE_STATUSES   = ['New', 'Assigned', 'Pending', 'Closed', 'Rejected', 'Duplicate'];
export const CASE_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
