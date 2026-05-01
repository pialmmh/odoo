from odoo import api, fields, models


class PbxExtension(models.Model):
    """Registry of FusionPBX extensions that can be assigned to res.users.

    Mirrors the EspoCRM `PbxExtension` custom entity. Entries are typically
    created out-of-band by the PBX provisioning service and consumed by the
    user-edit form to populate the SIP credentials / extension UUID fields.
    """
    _name = 'pbx.extension'
    _description = 'PBX Extension'
    _order = 'extension'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name        = fields.Char(string='Extension Label', compute='_compute_name', store=True)
    extension   = fields.Char(string='Extension', required=True, index=True, tracking=True)
    domain_name = fields.Char(string='PBX Domain', required=True, index=True, tracking=True)
    domain_uuid = fields.Char(string='Domain UUID', index=True)
    extension_uuid = fields.Char(string='Extension UUID', index=True)

    sip_username = fields.Char(string='SIP Username')
    sip_password = fields.Char(string='SIP Password')

    user_id = fields.Many2one('res.users', string='Assigned User', tracking=True,
                              help='Currently assigned agent. Empty = available.')

    state = fields.Selection(
        selection=[
            ('available', 'Available'),
            ('assigned',  'Assigned'),
            ('disabled',  'Disabled'),
        ],
        string='State', default='available', required=True, tracking=True,
    )

    notes = fields.Text(string='Notes')

    _uniq_ext_per_domain = models.Constraint(
        'unique(extension, domain_name)',
        'Extension must be unique per PBX domain.',
    )

    @api.depends('extension', 'domain_name')
    def _compute_name(self):
        for rec in self:
            rec.name = f'{rec.extension or "?"} @ {rec.domain_name or "?"}'

    def action_assign(self, user_id):
        """Assign this extension to a user; flips state and copies SIP creds."""
        self.ensure_one()
        user = self.env['res.users'].browse(int(user_id))
        if not user.exists():
            raise ValueError(f'User {user_id} not found')
        self.write({'user_id': user.id, 'state': 'assigned'})
        user.write({
            'pbx_domain':     self.domain_name,
            'domain_uuid':    self.domain_uuid,
            'extension_uuid': self.extension_uuid,
            'sip_username':   self.sip_username,
            'sip_password':   self.sip_password,
        })
        return True

    def action_release(self):
        """Free the extension; clears assignment but keeps SIP creds for audit."""
        for rec in self:
            rec.write({'user_id': False, 'state': 'available'})
        return True
