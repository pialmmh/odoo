{
    'name': 'Infrastructure Management',
    'version': '17.0.1.0.0',
    'category': 'Operations',
    'summary': 'Manage datacenters, servers, routers, and networking equipment',
    'description': """
Infrastructure Management for ISP/Telecom
==========================================
- Region → Availability Zone → Datacenter hierarchy
- Compute (server/VM), Container, Storage management
- Network Device inventory (routers, switches, firewalls)
- IP address management with polymorphic assignment
- Device model catalog with MikroTik seed data
- Device role attributes (PPPoE gateway, core router, etc.)
""",
    'depends': ['base', 'contacts'],
    'data': [
        'security/ir.model.access.csv',
        'seed/infra_device_attribute_data.xml',
        'seed/infra_device_model_data.xml',
        'seed/infra_os_data.xml',
        'views/infra_menus.xml',
        'views/infra_region_views.xml',
        'views/infra_datacenter_views.xml',
        'views/infra_compute_views.xml',
        'views/infra_network_device_views.xml',
        'views/infra_ip_address_views.xml',
        'views/infra_device_model_views.xml',
        'views/infra_ssh_views.xml',
        'views/infra_vault_views.xml',
        'views/infra_os_views.xml',
        'views/infra_seed_manager_views.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
