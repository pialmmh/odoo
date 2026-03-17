from odoo import models, fields


class InfraAvailabilityZone(models.Model):
    _name = 'infra.availability.zone'
    _description = 'Availability Zone'
    _order = 'region_id, name'

    name = fields.Char(string='Zone Name', required=True, index=True)
    code = fields.Char(string='Code', required=True, index=True)
    region_id = fields.Many2one('infra.region', string='Region', required=True, ondelete='cascade', index=True)
    zone_type = fields.Selection([
        ('standard', 'Standard'),
        ('edge', 'Edge'),
        ('local', 'Local'),
    ], string='Zone Type', default='standard', required=True)
    is_default = fields.Boolean(string='Default Zone', default=False)
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('maintenance', 'Maintenance'),
    ], string='Status', default='active', required=True, index=True)

    datacenter_ids = fields.One2many('infra.datacenter', 'zone_id', string='Datacenters')
    datacenter_count = fields.Integer(string='DC Count', compute='_compute_datacenter_count')

    _sql_constraints = [
        ('code_uniq', 'unique(code)', 'Availability zone code must be unique.'),
    ]

    def _compute_datacenter_count(self):
        for rec in self:
            rec.datacenter_count = len(rec.datacenter_ids)
