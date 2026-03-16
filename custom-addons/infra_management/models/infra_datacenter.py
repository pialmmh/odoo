from odoo import models, fields


class InfraDatacenter(models.Model):
    _name = 'infra.datacenter'
    _description = 'Datacenter'
    _order = 'name'

    name = fields.Char(string='Datacenter Name', required=True, index=True)
    zone_id = fields.Many2one('infra.availability.zone', string='Availability Zone', required=True, ondelete='cascade', index=True)
    region_id = fields.Many2one('infra.region', string='Region', related='zone_id.region_id', store=True, readonly=True)
    location_address = fields.Char(string='Location Address')
    dc_type = fields.Selection([
        ('owned', 'Owned'),
        ('colocation', 'Colocation'),
        ('cloud', 'Cloud'),
        ('edge', 'Edge'),
    ], string='DC Type', default='owned', required=True)
    tier = fields.Selection([
        ('1', 'Tier 1'),
        ('2', 'Tier 2'),
        ('3', 'Tier 3'),
        ('4', 'Tier 4'),
    ], string='Tier Level')
    partner_id = fields.Many2one('res.partner', string='Partner/Provider', index=True)
    is_dr_site = fields.Boolean(string='DR Site', default=False)
    latitude = fields.Float(string='Latitude', digits=(10, 7))
    longitude = fields.Float(string='Longitude', digits=(10, 7))
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('maintenance', 'Maintenance'),
        ('decommissioned', 'Decommissioned'),
    ], string='Status', default='active', required=True, index=True)

    pool_ids = fields.One2many('infra.resource.pool', 'datacenter_id', string='Resource Pools')
    compute_ids = fields.One2many('infra.compute', 'datacenter_id', string='Computes')
    network_device_ids = fields.One2many('infra.network.device', 'datacenter_id', string='Network Devices')
    storage_ids = fields.One2many('infra.storage', 'datacenter_id', string='Storage')
    networking_ids = fields.One2many('infra.networking', 'datacenter_id', string='Networks')
