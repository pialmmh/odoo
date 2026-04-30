from odoo import models, fields


class RbacPermission(models.Model):
    _name = 'rbac.permission'
    _description = 'RBAC Permission'
    _order = 'module, code'

    name = fields.Char(string='Permission Name', required=True, index=True,
        help='Human-readable name, e.g. "View Infrastructure"')
    code = fields.Char(string='Code', required=True, index=True,
        help='Machine code, e.g. "infra:view"')
    module = fields.Selection([
        ('infra', 'Infrastructure'),
        ('ssh', 'SSH Management'),
        ('artifact', 'Artifacts & Deploy'),
        ('billing', 'Billing'),
        ('catalog', 'Device Catalog'),
        ('settings', 'Settings'),
        ('admin', 'Administration'),
    ], string='Module', required=True, index=True)
    action = fields.Selection([
        ('view', 'View'),
        ('edit', 'Edit / Create'),
        ('delete', 'Delete'),
        ('manage', 'Full Manage'),
        ('deploy', 'Deploy / Execute'),
        ('switch', 'Switch / Select'),
    ], string='Action', required=True)
    description = fields.Text(string='Description')
    is_active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('code_uniq', 'unique(code)', 'Permission code must be unique.'),
    ]
