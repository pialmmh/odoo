from odoo import models, fields


class InfraContainer(models.Model):
    _name = 'infra.container'
    _description = 'Container'
    _order = 'compute_id, name'

    name = fields.Char(string='Container Name', required=True, index=True)
    container_type = fields.Selection([
        ('lxc', 'LXC'),
        ('lxd', 'LXD'),
        ('docker', 'Docker'),
        ('podman', 'Podman'),
        ('kubernetes', 'Kubernetes'),
    ], string='Container Type', default='lxc', required=True)
    image = fields.Char(string='Image')
    compute_id = fields.Many2one('infra.compute', string='Compute Node', required=True, ondelete='cascade', index=True)
    cpu_limit = fields.Integer(string='CPU Limit (cores)')
    memory_limit = fields.Float(string='Memory Limit (GB)', digits=(10, 2))
    status = fields.Selection([
        ('running', 'Running'),
        ('stopped', 'Stopped'),
        ('paused', 'Paused'),
        ('error', 'Error'),
    ], string='Status', default='stopped', required=True, index=True)

    ip_address_ids = fields.One2many('infra.ip.address', 'container_id', string='IP Addresses')
