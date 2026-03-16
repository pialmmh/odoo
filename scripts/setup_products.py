#!/usr/bin/env python3
"""Create ISP/Telecom service products and categories in Odoo."""
import xmlrpc.client

URL = 'http://localhost:7169'
DB = 'odoo_billing'
USER = 'admin'
PASS = 'admin'

# Authenticate
common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USER, PASS, {})
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')

def call(model, method, *args, **kwargs):
    return models.execute_kw(DB, uid, PASS, model, method, *args, **kwargs)

# --- Product Categories ---
categories = {}
cat_list = [
    ('Internet Services', None),
    ('Bandwidth Plans', 'Internet Services'),
    ('Dedicated Internet', 'Internet Services'),
    ('SMS Services', None),
    ('Voice Services', None),
    ('Value Added Services', None),
]

# Get root category
root_cat = call('product.category', 'search', [[('name', '=', 'All')]], {'limit': 1})
root_id = root_cat[0] if root_cat else 1

for cat_name, parent_name in cat_list:
    parent_id = categories.get(parent_name, root_id)
    existing = call('product.category', 'search', [[('name', '=', cat_name)]], {'limit': 1})
    if existing:
        categories[cat_name] = existing[0]
    else:
        cat_id = call('product.category', 'create', [{'name': cat_name, 'parent_id': parent_id}])
        categories[cat_name] = cat_id
    print(f"Category: {cat_name} -> ID {categories[cat_name]}")

# Get "Units" UoM
unit_uom = call('uom.uom', 'search', [[('name', '=', 'Units')]], {'limit': 1})
unit_uom_id = unit_uom[0] if unit_uom else 1

print(f"UoM Units: {unit_uom_id}")

# --- Create Product Attributes ---
# Bandwidth attribute
bw_attr = call('product.attribute', 'search', [[('name', '=', 'Bandwidth')]], {'limit': 1})
if not bw_attr:
    bw_attr_id = call('product.attribute', 'create', [{
        'name': 'Bandwidth',
        'display_type': 'radio',
        'create_variant': 'always',
    }])
else:
    bw_attr_id = bw_attr[0]

# Bandwidth values
bw_values = {}
for bw in ['10 Mbps', '25 Mbps', '50 Mbps', '100 Mbps', '200 Mbps', '500 Mbps', '1 Gbps']:
    existing = call('product.attribute.value', 'search',
                    [[('name', '=', bw), ('attribute_id', '=', bw_attr_id)]], {'limit': 1})
    if existing:
        bw_values[bw] = existing[0]
    else:
        val_id = call('product.attribute.value', 'create', [{
            'name': bw,
            'attribute_id': bw_attr_id,
        }])
        bw_values[bw] = val_id

print(f"Bandwidth attribute: {bw_attr_id}, values: {bw_values}")

# Billing Cycle attribute
cycle_attr = call('product.attribute', 'search', [[('name', '=', 'Billing Cycle')]], {'limit': 1})
if not cycle_attr:
    cycle_attr_id = call('product.attribute', 'create', [{
        'name': 'Billing Cycle',
        'display_type': 'select',
        'create_variant': 'always',
    }])
else:
    cycle_attr_id = cycle_attr[0]

cycle_values = {}
for cycle in ['Monthly', 'Quarterly', 'Yearly']:
    existing = call('product.attribute.value', 'search',
                    [[('name', '=', cycle), ('attribute_id', '=', cycle_attr_id)]], {'limit': 1})
    if existing:
        cycle_values[cycle] = existing[0]
    else:
        val_id = call('product.attribute.value', 'create', [{
            'name': cycle,
            'attribute_id': cycle_attr_id,
        }])
        cycle_values[cycle] = val_id

print(f"Billing Cycle attribute: {cycle_attr_id}, values: {cycle_values}")

# SMS Package Size attribute
sms_attr = call('product.attribute', 'search', [[('name', '=', 'SMS Package')]], {'limit': 1})
if not sms_attr:
    sms_attr_id = call('product.attribute', 'create', [{
        'name': 'SMS Package',
        'display_type': 'radio',
        'create_variant': 'always',
    }])
else:
    sms_attr_id = sms_attr[0]

sms_values = {}
for pkg in ['10K SMS', '50K SMS', '100K SMS', '500K SMS', '1M SMS']:
    existing = call('product.attribute.value', 'search',
                    [[('name', '=', pkg), ('attribute_id', '=', sms_attr_id)]], {'limit': 1})
    if existing:
        sms_values[pkg] = existing[0]
    else:
        val_id = call('product.attribute.value', 'create', [{
            'name': pkg,
            'attribute_id': sms_attr_id,
        }])
        sms_values[pkg] = val_id

print(f"SMS Package attribute: {sms_attr_id}, values: {sms_values}")

# --- Service Products ---

# 1. Shared Bandwidth Internet
product_data = [
    {
        'name': 'Shared Internet',
        'type': 'service',
        'categ_id': categories['Bandwidth Plans'],
        'list_price': 0,  # price set per variant
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'Shared bandwidth internet service for ISP/Enterprise clients',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
        'attribute_line_ids': [
            (0, 0, {
                'attribute_id': bw_attr_id,
                'value_ids': [(6, 0, list(bw_values.values()))],
            }),
            (0, 0, {
                'attribute_id': cycle_attr_id,
                'value_ids': [(6, 0, list(cycle_values.values()))],
            }),
        ],
    },
    {
        'name': 'Dedicated Internet Access (DIA)',
        'type': 'service',
        'categ_id': categories['Dedicated Internet'],
        'list_price': 0,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'Dedicated 1:1 bandwidth internet with SLA guarantee',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
        'attribute_line_ids': [
            (0, 0, {
                'attribute_id': bw_attr_id,
                'value_ids': [(6, 0, list(bw_values.values()))],
            }),
            (0, 0, {
                'attribute_id': cycle_attr_id,
                'value_ids': [(6, 0, list(cycle_values.values()))],
            }),
        ],
    },
    {
        'name': 'Bulk SMS',
        'type': 'service',
        'categ_id': categories['SMS Services'],
        'list_price': 0,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'Bulk SMS packages for enterprise messaging',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
        'attribute_line_ids': [
            (0, 0, {
                'attribute_id': sms_attr_id,
                'value_ids': [(6, 0, list(sms_values.values()))],
            }),
        ],
    },
]

# Simple service products without variants
simple_products = [
    {
        'name': 'IPLC (International Private Leased Circuit)',
        'type': 'service',
        'categ_id': categories['Internet Services'],
        'list_price': 50000.00,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'Point-to-point international private leased circuit',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
    },
    {
        'name': 'IP Transit',
        'type': 'service',
        'categ_id': categories['Internet Services'],
        'list_price': 25000.00,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'IP transit service with full routing table',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
    },
    {
        'name': 'Colocation Service',
        'type': 'service',
        'categ_id': categories['Value Added Services'],
        'list_price': 15000.00,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'Data center colocation - rack space, power, cooling',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
    },
    {
        'name': 'Domain & Hosting',
        'type': 'service',
        'categ_id': categories['Value Added Services'],
        'list_price': 2000.00,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'Domain registration and web hosting service',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
    },
    {
        'name': 'VoIP Termination',
        'type': 'service',
        'categ_id': categories['Voice Services'],
        'list_price': 5000.00,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'Voice over IP termination service',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
    },
    {
        'name': 'MPLS VPN',
        'type': 'service',
        'categ_id': categories['Internet Services'],
        'list_price': 30000.00,
        'sale_ok': True,
        'purchase_ok': False,
        'invoice_policy': 'order',
        'description_sale': 'MPLS VPN connectivity for multi-site enterprise',
        'uom_id': unit_uom_id,
        'uom_po_id': unit_uom_id,
    },
]

# Create products with attributes (variants)
for pdata in product_data:
    existing = call('product.template', 'search', [[('name', '=', pdata['name'])]], {'limit': 1})
    if existing:
        print(f"Product already exists: {pdata['name']} (ID {existing[0]})")
    else:
        pid = call('product.template', 'create', [pdata])
        print(f"Created product: {pdata['name']} -> Template ID {pid}")

# Create simple products
for pdata in simple_products:
    existing = call('product.template', 'search', [[('name', '=', pdata['name'])]], {'limit': 1})
    if existing:
        print(f"Product already exists: {pdata['name']} (ID {existing[0]})")
    else:
        pid = call('product.template', 'create', [pdata])
        print(f"Created product: {pdata['name']} -> Template ID {pid}")

# --- Set variant prices for bandwidth products ---
# Get Shared Internet variants and set prices
bandwidth_prices = {
    '10 Mbps': {'Monthly': 3000, 'Quarterly': 8500, 'Yearly': 32000},
    '25 Mbps': {'Monthly': 6000, 'Quarterly': 17000, 'Yearly': 64000},
    '50 Mbps': {'Monthly': 10000, 'Quarterly': 28000, 'Yearly': 108000},
    '100 Mbps': {'Monthly': 18000, 'Quarterly': 50000, 'Yearly': 192000},
    '200 Mbps': {'Monthly': 30000, 'Quarterly': 85000, 'Yearly': 336000},
    '500 Mbps': {'Monthly': 60000, 'Quarterly': 170000, 'Yearly': 672000},
    '1 Gbps': {'Monthly': 100000, 'Quarterly': 285000, 'Yearly': 1080000},
}

dia_multiplier = 2.5  # DIA costs ~2.5x shared

for prod_name, multiplier in [('Shared Internet', 1.0), ('Dedicated Internet Access (DIA)', dia_multiplier)]:
    tmpl = call('product.template', 'search', [[('name', '=', prod_name)]], {'limit': 1})
    if tmpl:
        variants = call('product.product', 'search_read',
                       [[('product_tmpl_id', '=', tmpl[0])]],
                       {'fields': ['id', 'product_template_attribute_value_ids']})
        for var in variants:
            # Get attribute value names for this variant
            attr_vals = call('product.template.attribute.value', 'read',
                           [var['product_template_attribute_value_ids']],
                           {'fields': ['name']})
            val_names = [v['name'] for v in attr_vals]

            # Find bandwidth and cycle
            bw_match = [n for n in val_names if 'Mbps' in n or 'Gbps' in n]
            cycle_match = [n for n in val_names if n in ('Monthly', 'Quarterly', 'Yearly')]

            if bw_match and cycle_match:
                base_price = bandwidth_prices.get(bw_match[0], {}).get(cycle_match[0], 0)
                price = base_price * multiplier
                # Set price via price_extra on template attribute values
                # For simplicity, set list_price on the variant directly
                call('product.product', 'write', [[var['id']], {'lst_price': price}])
                print(f"  {prod_name} [{bw_match[0]}, {cycle_match[0]}] = ৳{price:.0f}")

# SMS pricing
sms_prices = {
    '10K SMS': 4000,
    '50K SMS': 18000,
    '100K SMS': 32000,
    '500K SMS': 140000,
    '1M SMS': 250000,
}

tmpl = call('product.template', 'search', [[('name', '=', 'Bulk SMS')]], {'limit': 1})
if tmpl:
    variants = call('product.product', 'search_read',
                   [[('product_tmpl_id', '=', tmpl[0])]],
                   {'fields': ['id', 'product_template_attribute_value_ids']})
    for var in variants:
        attr_vals = call('product.template.attribute.value', 'read',
                       [var['product_template_attribute_value_ids']],
                       {'fields': ['name']})
        val_names = [v['name'] for v in attr_vals]
        for pkg_name, price in sms_prices.items():
            if pkg_name in val_names:
                call('product.product', 'write', [[var['id']], {'lst_price': price}])
                print(f"  Bulk SMS [{pkg_name}] = ৳{price}")

print("\n=== DONE ===")
print("Products available at: Sales > Products > Products")
print("Navigate to: http://localhost:7169/web#action=product.product_template_action_all")
