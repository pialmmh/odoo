from odoo import models, fields, api


class InfraNetworkDevice(models.Model):
    _name = 'infra.network.device'
    _description = 'Network Device'
    _order = 'datacenter_id, name'

    name = fields.Char(string='Device Name', required=True, index=True)
    device_model_id = fields.Many2one('infra.device.model', string='Device Model', index=True)
    device_attribute_ids = fields.Many2many(
        'infra.device.attribute',
        'infra_network_device_attribute_rel',
        'device_id', 'attribute_id',
        string='Device Roles',
    )
    serial_number = fields.Char(string='Serial Number')
    management_ip = fields.Char(string='Management IP')
    management_port = fields.Integer(string='Management Port', default=22)
    management_protocol = fields.Selection([
        ('ssh', 'SSH'),
        ('https', 'HTTPS'),
        ('snmp', 'SNMP'),
        ('api', 'API'),
    ], string='Management Protocol', default='ssh')
    datacenter_id = fields.Many2one('infra.datacenter', string='Datacenter', required=True, ondelete='cascade', index=True)
    rack_position = fields.Char(string='Rack Position')
    firmware = fields.Char(string='Firmware Version')
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('maintenance', 'Maintenance'),
        ('decommissioned', 'Decommissioned'),
    ], string='Status', default='active', required=True, index=True)
    operational_status = fields.Selection([
        ('up', 'UP'),
        ('down', 'DOWN'),
        ('degraded', 'Degraded'),
    ], string='Operational Status', default='up')
    criticality = fields.Selection([
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ], string='Criticality', default='medium')
    notes = fields.Text(string='Notes')

    ip_address_ids = fields.One2many('infra.ip.address', 'network_device_id', string='IP Addresses')

    # Related fields from device model
    vendor_display = fields.Char(string='Vendor', related='device_model_id.vendor', readonly=True)
    device_type_display = fields.Selection(related='device_model_id.device_type', string='Device Type', readonly=True)

    @api.onchange('device_model_id')
    def _onchange_device_model_id(self):
        if self.device_model_id and self.device_model_id.default_attribute_ids:
            self.device_attribute_ids = self.device_model_id.default_attribute_ids
