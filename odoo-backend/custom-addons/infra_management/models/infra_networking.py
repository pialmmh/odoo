from odoo import models, fields


class InfraNetworking(models.Model):
    _name = 'infra.networking'
    _description = 'Network Configuration'
    _order = 'datacenter_id, name'

    name = fields.Char(string='Network Name', required=True, index=True)
    network_type = fields.Selection([
        ('vlan', 'VLAN'),
        ('vxlan', 'VXLAN'),
        ('bridge', 'Bridge'),
        ('overlay', 'Overlay'),
    ], string='Network Type', default='vlan', required=True)
    cidr = fields.Char(string='CIDR')
    vlan_id = fields.Integer(string='VLAN ID')
    gateway = fields.Char(string='Gateway')
    dhcp_enabled = fields.Boolean(string='DHCP Enabled', default=False)
    datacenter_id = fields.Many2one('infra.datacenter', string='Datacenter', required=True, ondelete='cascade', index=True)
    description = fields.Text(string='Description')
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('reserved', 'Reserved'),
    ], string='Status', default='active', required=True, index=True)

    ip_address_ids = fields.One2many('infra.ip.address', 'vlan_id', string='IP Addresses')
