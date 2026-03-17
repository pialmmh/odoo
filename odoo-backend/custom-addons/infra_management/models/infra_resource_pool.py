from odoo import models, fields


class InfraResourcePool(models.Model):
    _name = 'infra.resource.pool'
    _description = 'Resource Pool'
    _order = 'datacenter_id, name'

    name = fields.Char(string='Pool Name', required=True, index=True)
    pool_type = fields.Selection([
        ('compute', 'Compute'),
        ('storage', 'Storage'),
        ('kubernetes', 'Kubernetes'),
        ('vmware', 'VMware'),
        ('openstack', 'OpenStack'),
    ], string='Pool Type', default='compute', required=True)
    datacenter_id = fields.Many2one('infra.datacenter', string='Datacenter', required=True, ondelete='cascade', index=True)
    hypervisor = fields.Char(string='Hypervisor')
    total_cpu_cores = fields.Integer(string='Total CPU Cores')
    used_cpu_cores = fields.Integer(string='Used CPU Cores')
    total_memory_gb = fields.Float(string='Total Memory (GB)', digits=(10, 2))
    used_memory_gb = fields.Float(string='Used Memory (GB)', digits=(10, 2))
    total_storage_tb = fields.Float(string='Total Storage (TB)', digits=(10, 2))
    used_storage_tb = fields.Float(string='Used Storage (TB)', digits=(10, 2))
    description = fields.Text(string='Description')
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('full', 'Full'),
        ('maintenance', 'Maintenance'),
    ], string='Status', default='active', required=True, index=True)

    compute_ids = fields.One2many('infra.compute', 'pool_id', string='Computes')
