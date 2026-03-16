from odoo import models, fields


class InfraDeviceAttribute(models.Model):
    _name = 'infra.device.attribute'
    _description = 'Device Attribute'
    _order = 'category, name'

    name = fields.Char(string='Attribute Name', required=True, index=True)
    code = fields.Char(string='Code', required=True, index=True)
    category = fields.Selection([
        ('role', 'Role'),
        ('capability', 'Capability'),
        ('protocol', 'Protocol'),
    ], string='Category', default='role', required=True)
    description = fields.Text(string='Description')
    color = fields.Integer(string='Color Index', default=0)

    _sql_constraints = [
        ('code_uniq', 'unique(code)', 'Attribute code must be unique.'),
    ]
