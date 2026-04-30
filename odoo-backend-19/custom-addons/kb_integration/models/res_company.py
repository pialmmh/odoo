from odoo import models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    x_kb_api_key = fields.Char(
        string='KB API Key',
        help='Kill Bill tenant API key (X-Killbill-ApiKey header)')
    x_kb_api_secret = fields.Char(
        string='KB API Secret',
        groups='base.group_system',
        help='Kill Bill tenant API secret (X-Killbill-ApiSecret header)')
    x_kb_tenant_id = fields.Char(
        string='KB Tenant ID',
        help='Kill Bill tenant UUID (set after tenant creation in KB)')
    x_kb_api_url = fields.Char(
        string='KB API URL',
        default='http://127.0.0.1:18080',
        help='Kill Bill REST API base URL')
