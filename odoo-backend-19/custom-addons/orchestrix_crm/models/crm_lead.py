from odoo import fields, models


# Mirror EspoCRM enums exactly so the cloned React UI binds 1:1.
# crm.lead is dual-typed in Odoo (type='lead' or 'opportunity'); we keep both
# the lead-status set and the opportunity-stage set in one Selection so a single
# x_espo_status column serves both. The UI dropdowns only show the relevant
# subset per type.
ESPO_LEAD_STATUSES = [
    # Lead statuses
    ('New',          'New'),
    ('Assigned',     'Assigned'),
    ('In Process',   'In Process'),
    ('Converted',    'Converted'),
    ('Recycled',     'Recycled'),
    ('Dead',         'Dead'),
    # Opportunity stages
    ('Prospecting',  'Prospecting'),
    ('Qualification','Qualification'),
    ('Proposal',     'Proposal'),
    ('Negotiation',  'Negotiation'),
    ('Closed Won',   'Closed Won'),
    ('Closed Lost',  'Closed Lost'),
]
ESPO_LEAD_SOURCES = [
    ('Call',              'Call'),
    ('Email',             'Email'),
    ('Existing Customer', 'Existing Customer'),
    ('Partner',           'Partner'),
    ('Public Relations',  'Public Relations'),
    ('Web Site',          'Web Site'),
    ('Campaign',          'Campaign'),
    ('Other',             'Other'),
]


class CrmLead(models.Model):
    """Espo-parity fields on top of stock crm.lead.

    The cloned React `Leads`/`LeadDialog` pages bind to Espo field names
    (`status`, `source`, `salutationName`, `firstName`, `lastName`,
    `accountName`, `emailAddress`, `phoneNumber`, `industry`, `doNotCall`,
    `opportunityAmount`, `assignedUserName`). The gateway adapter
    (`services/crm-via-odoo.js`) maps those to/from these columns.
    """
    _inherit = 'crm.lead'

    # Native Odoo has stage_id (m2o) but no Espo-style status enum.
    x_espo_status = fields.Selection(
        selection=ESPO_LEAD_STATUSES,
        string='Espo Status',
        default='New',
        index=True,
        tracking=True,
    )

    # Native Odoo has source_id (m2o → utm.source); Espo uses a flat enum.
    x_espo_source = fields.Selection(
        selection=ESPO_LEAD_SOURCES,
        string='Espo Source',
        index=True,
    )

    x_industry      = fields.Char(string='Industry')
    x_do_not_call   = fields.Boolean(string='Do Not Call', tracking=True)
    x_salutation    = fields.Char(string='Salutation')
    x_first_name    = fields.Char(string='First Name')
    x_last_name     = fields.Char(string='Last Name')

    # Carry-over from the contact-center origin metadata (kept from before).
    source_channel = fields.Selection(
        selection=[
            ('voice',    'Voice / Phone'),
            ('sms',      'SMS'),
            ('email',    'Email'),
            ('facebook', 'Facebook'),
            ('whatsapp', 'WhatsApp'),
            ('webchat',  'Web Chat'),
            ('walkin',   'Walk-in / Manual'),
        ],
        string='Contact Center Channel',
        index=True,
        help='Origin of this lead within the contact center. Distinct from '
             '`source_id` which is the marketing source.',
    )
