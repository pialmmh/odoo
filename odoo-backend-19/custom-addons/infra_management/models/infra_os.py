from odoo import models, fields, api


class InfraOSFamily(models.Model):
    _name = 'infra.os.family'
    _description = 'Operating System Family'
    _order = 'sequence, name'

    name = fields.Char(string='OS Family', required=True, index=True)
    code = fields.Char(string='Code', required=True, index=True)
    os_category = fields.Selection([
        ('linux', 'Linux'),
        ('windows', 'Windows'),
        ('bsd', 'BSD'),
        ('hypervisor', 'Hypervisor'),
        ('network', 'Network OS'),
        ('other', 'Other'),
    ], string='Category', default='linux', required=True)
    vendor = fields.Char(string='Vendor')
    icon = fields.Char(string='Icon', help='Icon identifier for UI')
    sequence = fields.Integer(string='Sequence', default=10)
    is_active = fields.Boolean(string='Active', default=True)
    version_ids = fields.One2many('infra.os.version', 'family_id', string='Versions')
    version_count = fields.Integer(string='Versions', compute='_compute_version_count')

    _sql_constraints = [
        ('code_uniq', 'unique(code)', 'OS family code must be unique.'),
    ]

    def _compute_version_count(self):
        for rec in self:
            rec.version_count = len(rec.version_ids)


class InfraOSVersion(models.Model):
    _name = 'infra.os.version'
    _description = 'Operating System Version'
    _order = 'family_id, release_date desc, name'
    _rec_name = 'display_name'

    name = fields.Char(string='Version Name', required=True, index=True)
    family_id = fields.Many2one('infra.os.family', string='OS Family', required=True, ondelete='cascade', index=True)
    version_number = fields.Char(string='Version Number', help='e.g. 12, 22.04, 9.4')
    codename = fields.Char(string='Codename', help='e.g. Bookworm, Jammy Jellyfish')
    arch = fields.Selection([
        ('x86_64', 'x86_64 / amd64'),
        ('aarch64', 'ARM64 / aarch64'),
        ('armhf', 'ARM 32-bit'),
        ('multi', 'Multi-arch'),
    ], string='Architecture', default='x86_64')
    release_date = fields.Date(string='Release Date')
    eol_date = fields.Date(string='End of Life')
    lts = fields.Boolean(string='LTS', default=False)
    is_active = fields.Boolean(string='Active', default=True)
    notes = fields.Text(string='Notes')

    display_name = fields.Char(string='Display Name', compute='_compute_display_name', store=True)

    @api.depends('family_id.name', 'name', 'codename', 'lts')
    def _compute_display_name(self):
        for rec in self:
            parts = [rec.family_id.name or '', rec.name or '']
            if rec.codename:
                parts.append(f'({rec.codename})')
            if rec.lts:
                parts.append('LTS')
            rec.display_name = ' '.join(parts)
