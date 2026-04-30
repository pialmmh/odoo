{
    'name': 'Product Extended View',
    'version': '17.0.2.0.0',
    'category': 'Inventory/Products',
    'summary': 'Extended product form: adds OEM No. + Version fields (per video wiki); faithful Odoo 17 visual style',
    'depends': ['product', 'sale', 'sale_management'],
    'data': [
        'views/product_template_fluent_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'product_fluent_view/static/src/scss/fluent_skin.scss',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
