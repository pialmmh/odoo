{
    'name': 'Artifact Management',
    'version': '17.0.1.0.0',
    'category': 'Operations',
    'summary': 'Software artifact registry, version tracking, and deployment pipelines',
    'description': """
Artifact Management for ISP/Telecom
====================================
- Software project registry (JAR, Docker, LXC)
- Version tracking with git tag/commit/checksum
- Deployment to infra compute nodes via SSH
- Pipeline-based deploy with step-by-step execution and log capture
- Deploy templates with variable substitution
""",
    'depends': ['base', 'infra_management'],
    'data': [
        'security/ir.model.access.csv',
        'views/artifact_menus.xml',
        'views/artifact_views.xml',
        'seed/routesphere_template.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
