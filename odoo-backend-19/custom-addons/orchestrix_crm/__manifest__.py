{
    'name': 'Orchestrix CRM',
    'version': '19.0.1.0.0',
    'category': 'Sales/CRM',
    'summary': 'CRM extensions for the Telcobright/BTCL Hosted Contact Center',
    'description': """
Extends Odoo CRM models with the custom fields used by the Hosted Contact
Center frontend (ported from EspoCRM). Adds:

* res.users — PBX domain/agent UUIDs, SIP/XMPP credentials, daily call target
* crm.lead — source-channel tag (FB/WhatsApp/SMS/email/voice) for contact center origin
* pbx.extension — registry of FusionPBX extensions assignable to users

This module is installed per-tenant DB. It does not replace Odoo's built-in
crm/sale_management/mail modules — it composes on top of them.
    """,
    'author': 'Telcobright',
    'depends': [
        'base',
        'mail',
        'contacts',
        'crm',
        'sale_management',
        'calendar',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/res_users_views.xml',
        'views/crm_lead_views.xml',
        'views/pbx_extension_views.xml',
        'views/menus.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
