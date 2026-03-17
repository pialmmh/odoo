from odoo import models, fields, api


class InfraIPAddress(models.Model):
    _name = 'infra.ip.address'
    _description = 'IP Address'
    _order = 'ip_address'
    _rec_name = 'ip_address'

    ip_address = fields.Char(string='IP Address', required=True, index=True)
    subnet_mask = fields.Char(string='Subnet Mask', default='255.255.255.0')
    ip_type = fields.Selection([
        ('public', 'Public'),
        ('private', 'Private'),
        ('management', 'Management'),
        ('vpn', 'VPN'),
        ('floating', 'Floating'),
        ('service', 'Service'),
        ('storage', 'Storage'),
    ], string='IP Type', default='private', required=True)
    assignment_method = fields.Selection([
        ('static', 'Static'),
        ('dhcp', 'DHCP'),
        ('reserved', 'Reserved'),
        ('auto', 'Auto'),
    ], string='Assignment Method', default='static', required=True)

    # Polymorphic assignment — only one should be set
    compute_id = fields.Many2one('infra.compute', string='Compute', index=True, ondelete='cascade')
    network_device_id = fields.Many2one('infra.network.device', string='Network Device', index=True, ondelete='cascade')
    container_id = fields.Many2one('infra.container', string='Container', index=True, ondelete='cascade')
    vlan_id = fields.Many2one('infra.networking', string='VLAN/Network', index=True, ondelete='set null')

    is_primary = fields.Boolean(string='Primary', default=False)
    is_active = fields.Boolean(string='Active', default=True)

    assigned_to_display = fields.Char(string='Assigned To', compute='_compute_assigned_to')

    @api.depends('compute_id', 'network_device_id', 'container_id')
    def _compute_assigned_to(self):
        for rec in self:
            if rec.compute_id:
                rec.assigned_to_display = f"Compute: {rec.compute_id.name}"
            elif rec.network_device_id:
                rec.assigned_to_display = f"Device: {rec.network_device_id.name}"
            elif rec.container_id:
                rec.assigned_to_display = f"Container: {rec.container_id.name}"
            else:
                rec.assigned_to_display = 'Unassigned'
