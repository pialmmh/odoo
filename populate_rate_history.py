#!/usr/bin/env python3
"""Populate product.rate.history with current and historical prices."""
import xmlrpc.client

URL = 'http://localhost:7169'
DB = 'odoo_billing'

common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, 'admin', 'admin', {})
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object', allow_none=True)

def call(model, method, *args, **kwargs):
    return models.execute_kw(DB, uid, 'admin', model, method, *args, **kwargs)

# Get BDT currency
bdt = call('res.currency', 'search', [[('name', '=', 'BDT')]], {'limit': 1})
bdt_id = bdt[0] if bdt else 1

# Get all products with variants
templates = call('product.template', 'search_read',
                 [[('sale_ok', '=', True)]],
                 {'fields': ['id', 'name', 'list_price']})

# Check if we already have history
existing = call('product.rate.history', 'search_count', [[]])
if existing > 0:
    print(f"Rate history already has {existing} entries. Skipping population.")
    exit(0)

count = 0

for tmpl in templates:
    variants = call('product.product', 'search_read',
                    [[('product_tmpl_id', '=', tmpl['id'])]],
                    {'fields': ['id', 'name', 'lst_price']})

    for variant in variants:
        # Historical rate (2025) — 8% lower than current
        hist_price = round(variant['lst_price'] * 0.92, 2)
        call('product.rate.history', 'create', [{
            'product_tmpl_id': tmpl['id'],
            'product_id': variant['id'],
            'price': hist_price,
            'currency_id': bdt_id,
            'effective_date': '2025-01-01',
            'end_date': '2025-12-31',
            'pricelist_tier': 'standard',
            'reason': 'Initial rate card 2025',
            'company_id': 1,
        }])
        count += 1

        # Current rate (2026) — current price
        call('product.rate.history', 'create', [{
            'product_tmpl_id': tmpl['id'],
            'product_id': variant['id'],
            'price': variant['lst_price'],
            'currency_id': bdt_id,
            'effective_date': '2026-01-01',
            'end_date': False,
            'pricelist_tier': 'standard',
            'reason': 'Annual rate revision 2026 (+8%)',
            'company_id': 1,
        }])
        count += 1

        # Enterprise rate (2026) — 10% discount
        ent_price = round(variant['lst_price'] * 0.90, 2)
        call('product.rate.history', 'create', [{
            'product_tmpl_id': tmpl['id'],
            'product_id': variant['id'],
            'price': ent_price,
            'currency_id': bdt_id,
            'effective_date': '2026-01-01',
            'end_date': False,
            'pricelist_tier': 'enterprise',
            'reason': 'Enterprise tier — 10% discount on standard',
            'company_id': 1,
        }])
        count += 1

        # Government rate (2026) — 15% discount
        gov_price = round(variant['lst_price'] * 0.85, 2)
        call('product.rate.history', 'create', [{
            'product_tmpl_id': tmpl['id'],
            'product_id': variant['id'],
            'price': gov_price,
            'currency_id': bdt_id,
            'effective_date': '2026-01-01',
            'end_date': False,
            'pricelist_tier': 'government',
            'reason': 'Government tier — 15% discount on standard',
            'company_id': 1,
        }])
        count += 1

print(f"Created {count} rate history entries for {len(templates)} products")
print(f"\nTiers: standard (2025 + 2026), enterprise (2026), government (2026)")
print("View in Odoo: Kill Bill > Rate History")
