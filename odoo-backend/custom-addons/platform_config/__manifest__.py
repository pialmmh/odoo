{
    'name': 'Platform Tenant Config',
    'version': '17.0.1.0.0',
    'category': 'Technical',
    'summary': 'Per-tenant platform configuration: billing credentials, branding, overdue policy',
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'data/seed_data.xml',
    ],
    'post_init_hook': '_post_init_hook',
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
