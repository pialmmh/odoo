from odoo import models, fields


class RbacUrlPattern(models.Model):
    _name = 'rbac.url.pattern'
    _description = 'RBAC URL Pattern'
    _order = 'sequence, url_pattern'

    name = fields.Char(string='Name', required=True,
        help='Descriptive name, e.g. "Infrastructure pages"')
    url_pattern = fields.Char(string='URL Pattern', required=True, index=True,
        help='Glob pattern, e.g. "/*/infra", "/*/infra/*", "/*/customers"')
    http_methods = fields.Char(string='HTTP Methods', default='ALL',
        help='Comma-separated: GET,POST,PUT,DELETE or ALL')
    menu_label = fields.Char(string='Menu Label',
        help='Sidebar menu item to show/hide, e.g. "Infra", "SSH"')
    permission_ids = fields.Many2many(
        'rbac.permission',
        'rbac_url_pattern_permission_rel',
        'pattern_id', 'permission_id',
        string='Required Permissions',
    )
    description = fields.Text(string='Description')
    sequence = fields.Integer(string='Sequence', default=10)
    is_active = fields.Boolean(string='Active', default=True)
