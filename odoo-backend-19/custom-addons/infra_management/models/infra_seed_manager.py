import logging

from odoo import models, fields, api
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class InfraSeedManager(models.TransientModel):
    """Transient model for on-demand seed data management.
    Accessible from Settings > Infrastructure > Seed Data."""
    _name = 'infra.seed.manager'
    _description = 'Infrastructure Seed Data Manager'

    action = fields.Selection([
        ('reload_os', 'Reload OS Families & Versions'),
        ('reload_device_attrs', 'Reload Device Attributes'),
        ('reload_device_models', 'Reload Device Models'),
        ('reload_all', 'Reload All Seed Data'),
        ('status', 'Show Current Status'),
    ], string='Action', default='status', required=True)

    result = fields.Text(string='Result', readonly=True)

    def action_execute(self):
        """Execute the selected seed data action."""
        self.ensure_one()
        if self.action == 'status':
            self.result = self._get_status()
        elif self.action == 'reload_os':
            self.result = self._reload_os()
        elif self.action == 'reload_device_attrs':
            self.result = self._reload_device_attrs()
        elif self.action == 'reload_device_models':
            self.result = self._reload_device_models()
        elif self.action == 'reload_all':
            lines = []
            lines.append(self._reload_device_attrs())
            lines.append(self._reload_device_models())
            lines.append(self._reload_os())
            self.result = '\n'.join(lines)

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'infra.seed.manager',
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def _get_status(self):
        lines = ['=== Infrastructure Seed Data Status ===', '']
        lines.append(f"OS Families: {self.env['infra.os.family'].search_count([])}")
        lines.append(f"OS Versions: {self.env['infra.os.version'].search_count([])}")
        lines.append(f"Device Attributes: {self.env['infra.device.attribute'].search_count([])}")
        lines.append(f"Device Models: {self.env['infra.device.model'].search_count([])}")
        lines.append('')
        lines.append(f"Regions: {self.env['infra.region'].search_count([])}")
        lines.append(f"Zones: {self.env['infra.availability.zone'].search_count([])}")
        lines.append(f"Datacenters: {self.env['infra.datacenter'].search_count([])}")
        lines.append(f"Computes: {self.env['infra.compute'].search_count([])}")
        lines.append(f"Containers: {self.env['infra.container'].search_count([])}")
        lines.append(f"Network Devices: {self.env['infra.network.device'].search_count([])}")
        lines.append(f"SSH Keys: {self.env['infra.ssh.key'].search_count([])}")
        lines.append(f"SSH Credentials: {self.env['infra.ssh.credential'].search_count([])}")
        return '\n'.join(lines)

    def _reload_os(self):
        """Reload OS data by re-triggering the XML data file."""
        # Since XML noupdate=1 means Odoo won't overwrite, we manually sync
        OS_FAMILIES = [
            ('Debian', 'debian', 'linux', 'Debian Project'),
            ('Ubuntu', 'ubuntu', 'linux', 'Canonical'),
            ('RHEL', 'rhel', 'linux', 'Red Hat'),
            ('Rocky Linux', 'rocky', 'linux', 'Rocky Enterprise Software Foundation'),
            ('AlmaLinux', 'almalinux', 'linux', 'AlmaLinux OS Foundation'),
            ('CentOS Stream', 'centos-stream', 'linux', 'Red Hat'),
            ('Fedora', 'fedora', 'linux', 'Fedora Project'),
            ('openSUSE Leap', 'opensuse', 'linux', 'SUSE'),
            ('Alpine Linux', 'alpine', 'linux', 'Alpine Linux'),
            ('Arch Linux', 'arch', 'linux', 'Arch Linux'),
            ('Windows Server', 'windows-server', 'windows', 'Microsoft'),
            ('VMware ESXi', 'esxi', 'hypervisor', 'Broadcom/VMware'),
            ('Proxmox VE', 'proxmox', 'hypervisor', 'Proxmox'),
            ('MikroTik RouterOS', 'routeros', 'network', 'MikroTik'),
            ('FreeBSD', 'freebsd', 'bsd', 'FreeBSD Project'),
        ]
        created = 0
        for name, code, cat, vendor in OS_FAMILIES:
            if not self.env['infra.os.family'].search([('code', '=', code)]):
                self.env['infra.os.family'].create({
                    'name': name, 'code': code, 'os_category': cat, 'vendor': vendor,
                })
                created += 1
        return f"OS Families: {created} created, {len(OS_FAMILIES) - created} already exist"

    def _reload_device_attrs(self):
        ATTRS = [
            ('Access Gateway (PPPoE)', 'access_gateway_pppoe', 'role'),
            ('Core Router', 'core_router', 'role'),
            ('Edge Router', 'edge_router', 'role'),
            ('Distribution Switch', 'distribution_switch', 'role'),
            ('Access Switch', 'access_switch', 'role'),
            ('Firewall', 'firewall', 'role'),
            ('Load Balancer', 'load_balancer', 'role'),
            ('Wireless Controller', 'wireless_controller', 'role'),
            ('OLT (GPON/EPON)', 'olt_gpon_epon', 'role'),
        ]
        created = 0
        for name, code, cat in ATTRS:
            if not self.env['infra.device.attribute'].search([('code', '=', code)]):
                self.env['infra.device.attribute'].create({'name': name, 'code': code, 'category': cat})
                created += 1
        return f"Device Attributes: {created} created, {len(ATTRS) - created} already exist"

    def _reload_device_models(self):
        attr_map = {}
        for a in self.env['infra.device.attribute'].search([]):
            attr_map[a.code] = a.id

        MODELS = [
            ('CCR1036-8G-2S+', 'MikroTik', 'router', 'core_router', 8, 36, 4096),
            ('CCR2004-1G-12S+2XS', 'MikroTik', 'router', 'core_router', 15, 4, 4096),
            ('CCR2116-12G-4S+', 'MikroTik', 'router', 'core_router', 16, 16, 16384),
            ('RB4011iGS+5HacQ2HnD', 'MikroTik', 'router', 'access_gateway_pppoe', 11, 4, 1024),
            ('hAP ac3', 'MikroTik', 'router', 'access_gateway_pppoe', 5, 4, 256),
            ('RB5009UG+S+IN', 'MikroTik', 'router', 'edge_router', 9, 4, 1024),
            ('CRS326-24G-2S+RM', 'MikroTik', 'switch', 'distribution_switch', 26, 1, 512),
            ('CRS354-48G-4S+2Q+RM', 'MikroTik', 'switch', 'distribution_switch', 54, 1, 512),
            ('CSS610-8G-2S+IN', 'MikroTik', 'switch', 'access_switch', 10, 1, 256),
        ]
        created = 0
        for name, vendor, dtype, attr_code, ports, cpu, mem in MODELS:
            if not self.env['infra.device.model'].search([('name', '=', name)]):
                attr_id = attr_map.get(attr_code)
                self.env['infra.device.model'].create({
                    'name': name, 'vendor': vendor, 'device_type': dtype,
                    'default_attribute_ids': [(6, 0, [attr_id])] if attr_id else [],
                    'port_count': ports, 'cpu_cores': cpu, 'memory_mb': mem,
                })
                created += 1
        return f"Device Models: {created} created, {len(MODELS) - created} already exist"

    @api.model
    def action_reload_all_seed_data(self):
        """Called from React UI to reload all seed data."""
        wizard = self.create({'action': 'reload_all'})
        wizard.action_execute()
        return {'status': 'done', 'result': wizard.result}

    @api.model
    def action_get_seed_status(self):
        """Called from React UI to get seed data status."""
        wizard = self.create({'action': 'status'})
        wizard.action_execute()
        return {'status': 'done', 'result': wizard.result}
