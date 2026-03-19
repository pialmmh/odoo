from odoo import models, fields


class InfraCompute(models.Model):
    _name = 'infra.compute'
    _description = 'Compute Node'
    _order = 'datacenter_id, name'

    name = fields.Char(string='Name', required=True, index=True)
    hostname = fields.Char(string='Hostname')
    node_type = fields.Selection([
        ('dedicated_server', 'Dedicated Server'),
        ('vm', 'Virtual Machine'),
    ], string='Node Type', default='dedicated_server', required=True)
    datacenter_id = fields.Many2one('infra.datacenter', string='Datacenter', required=True, ondelete='cascade', index=True)
    pool_id = fields.Many2one('infra.resource.pool', string='Resource Pool', index=True)
    cpu_cores = fields.Integer(string='CPU Cores')
    memory_gb = fields.Float(string='Memory (GB)', digits=(10, 2))
    disk_gb = fields.Float(string='Disk (GB)', digits=(10, 2))
    brand = fields.Char(string='Brand')
    model = fields.Char(string='Model')
    serial_number = fields.Char(string='Serial Number')
    rack_location = fields.Char(string='Rack Location')
    os_type = fields.Selection([
        ('linux', 'Linux'),
        ('windows', 'Windows'),
        ('esxi', 'ESXi'),
        ('other', 'Other'),
    ], string='OS Type', default='linux')
    os_version_id = fields.Many2one('infra.os.version', string='OS Version', index=True)
    os_display = fields.Char(string='OS', related='os_version_id.display_name', readonly=True)
    management_ip = fields.Char(string='Management IP')
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('provisioning', 'Provisioning'),
        ('maintenance', 'Maintenance'),
        ('decommissioned', 'Decommissioned'),
    ], string='Status', default='active', required=True, index=True)

    container_ids = fields.One2many('infra.container', 'compute_id', string='Containers')
    ip_address_ids = fields.One2many('infra.ip.address', 'compute_id', string='IP Addresses')
    ssh_credential_ids = fields.One2many('infra.ssh.credential', 'compute_id', string='SSH Credentials')
