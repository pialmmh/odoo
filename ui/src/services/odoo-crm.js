// CRM data layer talking directly to Odoo via /api/odoo proxy.
// Phase 0 spike — only Lead is implemented; expand per Phase 2.

import { call } from './odoo';

const LEAD_FIELDS = [
  'id', 'name', 'type',
  'contact_name', 'partner_name', 'email_from', 'phone', 'description',
  'stage_id', 'user_id', 'team_id', 'source_channel',
  'probability', 'expected_revenue',
  'create_date', 'write_date',
];

export async function listLeads({
  type = 'lead',
  search = '',
  limit = 20,
  offset = 0,
  order = 'create_date desc',
} = {}) {
  const domain = [['type', '=', type]];
  if (search.trim()) {
    const t = search.trim();
    domain.push('|', '|', '|',
      ['name', 'ilike', t],
      ['contact_name', 'ilike', t],
      ['email_from', 'ilike', t],
      ['phone', 'ilike', t],
    );
  }
  const [rows, total] = await Promise.all([
    call('crm.lead', 'search_read', [domain], { fields: LEAD_FIELDS, limit, offset, order }),
    call('crm.lead', 'search_count', [domain]),
  ]);
  return { rows, total };
}

export const getLead    = (id)       => call('crm.lead', 'read', [[id]], { fields: LEAD_FIELDS }).then(r => r[0] || null);
export const createLead = (vals)     => call('crm.lead', 'create', [vals]);
export const updateLead = (id, vals) => call('crm.lead', 'write', [[id], vals]);
export const deleteLead = (id)       => call('crm.lead', 'unlink', [[id]]);

// ── Lookups for select / autocomplete fields ──────────────────────────────
export const listStages = () =>
  call('crm.stage', 'search_read', [[]], {
    fields: ['id', 'name', 'sequence', 'is_won', 'team_id'],
    order: 'sequence asc',
  });

export const listSalesUsers = () =>
  call('res.users', 'search_read',
    [[['share', '=', false]]],
    { fields: ['id', 'name', 'login'], order: 'name asc', limit: 100 });

export const listTeams = () =>
  call('crm.team', 'search_read', [[]], {
    fields: ['id', 'name'], order: 'sequence asc',
  });

// Selection ported from custom-addon `crm.lead.source_channel` (orchestrix_crm)
export const SOURCE_CHANNELS = [
  ['voice',    'Voice / Phone'],
  ['sms',      'SMS'],
  ['email',    'Email'],
  ['facebook', 'Facebook'],
  ['whatsapp', 'WhatsApp'],
  ['webchat',  'Web Chat'],
  ['walkin',   'Walk-in / Manual'],
];
