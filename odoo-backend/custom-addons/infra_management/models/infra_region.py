from odoo import models, fields


class InfraRegion(models.Model):
    _name = 'infra.region'
    _description = 'Infrastructure Region'
    _order = 'name'

    name = fields.Char(string='Region Name', required=True, index=True)
    code = fields.Char(string='Code', required=True, index=True)
    geographic_area = fields.Char(string='Geographic Area')
    description = fields.Text(string='Description')
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('maintenance', 'Maintenance'),
    ], string='Status', default='active', required=True, index=True)

    zone_ids = fields.One2many('infra.availability.zone', 'region_id', string='Availability Zones')
    zone_count = fields.Integer(string='Zones', compute='_compute_zone_count')

    _sql_constraints = [
        ('code_uniq', 'unique(code)', 'Region code must be unique.'),
    ]

    def _compute_zone_count(self):
        for rec in self:
            rec.zone_count = len(rec.zone_ids)
