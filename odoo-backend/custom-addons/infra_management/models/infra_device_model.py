from odoo import models, fields


class InfraDeviceModel(models.Model):
    _name = 'infra.device.model'
    _description = 'Device Model Catalog'
    _order = 'vendor, name'

    name = fields.Char(string='Model Name', required=True, index=True)
    vendor = fields.Char(string='Vendor', required=True, index=True)
    device_type = fields.Selection([
        ('router', 'Router'),
        ('switch', 'Switch'),
        ('firewall', 'Firewall'),
        ('access_point', 'Access Point'),
        ('olt', 'OLT'),
        ('load_balancer', 'Load Balancer'),
        ('gateway', 'Gateway'),
    ], string='Device Type', required=True)
    default_attribute_ids = fields.Many2many(
        'infra.device.attribute',
        'infra_device_model_attribute_rel',
        'model_id', 'attribute_id',
        string='Default Roles',
    )
    port_count = fields.Integer(string='Port Count')
    cpu_cores = fields.Integer(string='CPU Cores')
    memory_mb = fields.Integer(string='Memory (MB)')
    storage_gb = fields.Float(string='Storage (GB)', digits=(10, 2))
    product_url = fields.Char(string='Product URL')
    description = fields.Text(string='Description')
