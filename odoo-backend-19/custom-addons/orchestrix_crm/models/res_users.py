from odoo import fields, models


class ResUsers(models.Model):
    """Hosted Contact Center fields ported from EspoCRM `User`."""
    _inherit = 'res.users'

    # FusionPBX domain & extension wiring
    pbx_uuid       = fields.Char(string='PBX UUID')
    pbx_domain     = fields.Char(string='PBX Domain')
    domain_uuid    = fields.Char(string='Domain UUID')
    agent_uuid     = fields.Char(string='Call Center Agent UUID')
    extension_uuid = fields.Char(string='SIP Extension UUID')

    # SIP credentials (used by the call window component)
    sip_username = fields.Char(string='SIP Username')
    sip_password = fields.Char(string='SIP Password')

    # XMPP credentials (legacy Prosody bridge — kept for migration window)
    xmpp_user_c = fields.Char(string='XMPP Username')
    xmpp_pass_c = fields.Char(string='XMPP Password')

    # Productivity dial targets
    daily_call_target = fields.Integer(string='Daily Call Target', default=30)
    agent_limit       = fields.Integer(string='Agent Limit', default=0,
                                       help='Max number of concurrent calls or agents the user may supervise. 0 = unlimited.')
