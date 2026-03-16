from odoo import models, fields


class InfraStorage(models.Model):
    _name = 'infra.storage'
    _description = 'Storage'
    _order = 'datacenter_id, name'

    name = fields.Char(string='Storage Name', required=True, index=True)
    storage_type = fields.Selection([
        ('san', 'SAN'),
        ('nas', 'NAS'),
        ('local', 'Local'),
        ('object', 'Object Storage'),
    ], string='Storage Type', default='local', required=True)
    capacity_gb = fields.Float(string='Capacity (GB)', digits=(10, 2))
    used_gb = fields.Float(string='Used (GB)', digits=(10, 2))
    protocol = fields.Selection([
        ('nfs', 'NFS'),
        ('iscsi', 'iSCSI'),
        ('s3', 'S3'),
        ('cifs', 'CIFS'),
        ('fc', 'Fibre Channel'),
    ], string='Protocol')
    datacenter_id = fields.Many2one('infra.datacenter', string='Datacenter', required=True, ondelete='cascade', index=True)
    description = fields.Text(string='Description')
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('full', 'Full'),
        ('maintenance', 'Maintenance'),
    ], string='Status', default='active', required=True, index=True)
