{
    'name': 'RBAC Management',
    'version': '19.0.1.0.0',
    'category': 'Security',
    'summary': 'Role-based access control with URL patterns and permissions',
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'views/rbac_views.xml',
        'seed/rbac_seed_data.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
