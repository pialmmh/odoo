{
    'name': 'Kill Bill Integration',
    'version': '17.0.1.0.0',
    'category': 'Accounting',
    'summary': 'Kill Bill billing engine integration fields, sync queue, and PG NOTIFY bridge',
    'description': """
Adds Kill Bill integration fields to Odoo models and provides a sync queue
(kb.sync.log) that uses PostgreSQL LISTEN/NOTIFY for real-time event delivery
between Odoo and Kill Bill.

Sync architecture:
- Odoo model hooks insert pending entries into kb.sync.log
- PostgreSQL NOTIFY fires on insert (channel: kb_sync)
- External consumer service LISTENs, processes pending entries, calls KB REST API
- KB webhook relay inserts KB events into kb.sync.log
- Odoo consumer processes them via XML-RPC
    """,
    'depends': ['base', 'contacts', 'account', 'sale_management', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'views/res_company_views.xml',
        'views/res_partner_views.xml',
        'views/product_views.xml',
        'views/account_move_views.xml',
        'views/account_payment_views.xml',
        'views/sale_order_views.xml',
        'views/kb_sync_log_views.xml',
        'views/product_rate_history_views.xml',
        'views/product_tax_rate_views.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
