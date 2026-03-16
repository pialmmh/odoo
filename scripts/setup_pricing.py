#!/usr/bin/env python3
"""
Set up proper pricing infrastructure in Odoo:
1. Fix variant prices using price_extra (not lst_price)
2. Create 15% Bangladesh VAT tax
3. Enable and create pricelists with effective dates
4. Create rate plan history entries
"""
import xmlrpc.client
from datetime import date, timedelta

URL = 'http://localhost:7169'
DB = 'odoo_billing'
USER = 'admin'
PASS = 'admin'

common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, USER, PASS, {})
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object', allow_none=True)

def call(model, method, *args, **kwargs):
    return models.execute_kw(DB, uid, PASS, model, method, *args, **kwargs)

# ══════════════════════════════════════════════════════════════
# STEP 1: Fix variant pricing with price_extra
# ══════════════════════════════════════════════════════════════
print("=" * 60)
print("STEP 1: Fix variant pricing")
print("=" * 60)

# Define base prices per template and price_extra per attribute value
# Base price = cheapest variant (10 Mbps Monthly)
SHARED_BASE = 3000  # 10 Mbps Monthly

shared_bandwidth_extras = {
    '10 Mbps': 0,
    '25 Mbps': 3000,      # 6000 - 3000
    '50 Mbps': 7000,      # 10000 - 3000
    '100 Mbps': 15000,    # 18000 - 3000
    '200 Mbps': 27000,    # 30000 - 3000
    '500 Mbps': 57000,    # 60000 - 3000
    '1 Gbps': 97000,      # 100000 - 3000
}

shared_cycle_extras = {
    'Monthly': 0,
    'Quarterly': 5500,    # 8500 - 3000
    'Yearly': 29000,      # 32000 - 3000
}

DIA_BASE = 7500  # 10 Mbps Monthly (2.5x shared)

dia_bandwidth_extras = {
    '10 Mbps': 0,
    '25 Mbps': 7500,
    '50 Mbps': 17500,
    '100 Mbps': 37500,
    '200 Mbps': 67500,
    '500 Mbps': 142500,
    '1 Gbps': 242500,
}

dia_cycle_extras = {
    'Monthly': 0,
    'Quarterly': 13750,
    'Yearly': 72500,
}

SMS_BASE = 4000  # 10K SMS

sms_extras = {
    '10K SMS': 0,
    '50K SMS': 14000,
    '100K SMS': 28000,
    '500K SMS': 136000,
    '1M SMS': 246000,
}

# Set base prices on templates
templates = {
    'Shared Internet': SHARED_BASE,
    'Dedicated Internet Access (DIA)': DIA_BASE,
    'Bulk SMS': SMS_BASE,
    'IPLC (International Private Leased Circuit)': 50000,
    'IP Transit': 25000,
    'Colocation Service': 15000,
    'Domain & Hosting': 2000,
    'VoIP Termination': 5000,
    'MPLS VPN': 30000,
}

for name, base_price in templates.items():
    tmpl_ids = call('product.template', 'search', [[('name', '=', name)]])
    if tmpl_ids:
        call('product.template', 'write', [tmpl_ids, {'list_price': base_price}])
        print(f"  {name}: base price set to ৳{base_price:,}")

# Set price_extra on attribute values per template
def set_price_extras(tmpl_name, extras_map):
    tmpl_ids = call('product.template', 'search', [[('name', '=', tmpl_name)]])
    if not tmpl_ids:
        return
    tmpl_id = tmpl_ids[0]

    # Get product.template.attribute.value records for this template
    ptav_ids = call('product.template.attribute.value', 'search_read',
                    [[('product_tmpl_id', '=', tmpl_id)]],
                    {'fields': ['id', 'name', 'price_extra', 'attribute_id']})

    for ptav in ptav_ids:
        val_name = ptav['name']
        if val_name in extras_map:
            extra = extras_map[val_name]
            if ptav['price_extra'] != extra:
                call('product.template.attribute.value', 'write', [[ptav['id']], {'price_extra': extra}])
                print(f"    {tmpl_name} / {ptav['attribute_id'][1]}: {val_name} -> extra ৳{extra:,}")

print("\nSetting price_extra on Shared Internet variants...")
set_price_extras('Shared Internet', {**shared_bandwidth_extras, **shared_cycle_extras})

print("Setting price_extra on DIA variants...")
set_price_extras('Dedicated Internet Access (DIA)', {**dia_bandwidth_extras, **dia_cycle_extras})

print("Setting price_extra on Bulk SMS variants...")
set_price_extras('Bulk SMS', sms_extras)

# Verify a few computed prices
print("\nVerifying computed prices...")
variants = call('product.product', 'search_read',
                [[('product_tmpl_id.name', '=', 'Shared Internet')]],
                {'fields': ['name', 'lst_price', 'product_template_attribute_value_ids'], 'limit': 5})
for v in variants[:5]:
    ptav_names = call('product.template.attribute.value', 'read',
                      [v['product_template_attribute_value_ids']],
                      {'fields': ['name']})
    attrs = ', '.join(p['name'] for p in ptav_names)
    print(f"  {attrs}: ৳{v['lst_price']:,.0f}")

# ══════════════════════════════════════════════════════════════
# STEP 2: Create 15% Bangladesh VAT
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 2: Create 15% Bangladesh VAT")
print("=" * 60)

existing_tax = call('account.tax', 'search', [[('name', 'ilike', 'VAT 15%'), ('company_id', '=', 1)]])
if existing_tax:
    print(f"  VAT 15% already exists (ID {existing_tax[0]})")
    vat_id = existing_tax[0]
else:
    vat_id = call('account.tax', 'create', [{
        'name': 'VAT 15%',
        'type_tax_use': 'sale',
        'amount_type': 'percent',
        'amount': 15.0,
        'description': 'BD VAT',
        'company_id': 1,
    }])
    print(f"  Created VAT 15% (ID {vat_id})")

# Apply VAT to all service products
all_tmpls = call('product.template', 'search', [[('sale_ok', '=', True)]])
for tmpl_id in all_tmpls:
    call('product.template', 'write', [[tmpl_id], {'taxes_id': [(4, vat_id)]}])
print(f"  Applied VAT 15% to {len(all_tmpls)} products")

# ══════════════════════════════════════════════════════════════
# STEP 3: Create pricelists with effective dates
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 3: Create pricelists with effective dates")
print("=" * 60)

# Enable pricelists via settings
# (Odoo stores this in res.config.settings)
# The pricelist module is already available, just need to create them

# Get BDT currency
bdt = call('res.currency', 'search', [[('name', '=', 'BDT')]], {'limit': 1})
bdt_id = bdt[0] if bdt else False

# Create Standard Pricelist
existing_pl = call('product.pricelist', 'search', [[('name', '=', 'Standard ISP Rates 2026')]])
if existing_pl:
    std_pl_id = existing_pl[0]
    print(f"  Standard pricelist exists (ID {std_pl_id})")
else:
    std_pl_id = call('product.pricelist', 'create', [{
        'name': 'Standard ISP Rates 2026',
        'currency_id': bdt_id or 1,
        'company_id': 1,
    }])
    print(f"  Created: Standard ISP Rates 2026 (ID {std_pl_id})")

# Create Enterprise pricelist (discounted)
existing_ent = call('product.pricelist', 'search', [[('name', '=', 'Enterprise Rates 2026')]])
if existing_ent:
    ent_pl_id = existing_ent[0]
    print(f"  Enterprise pricelist exists (ID {ent_pl_id})")
else:
    ent_pl_id = call('product.pricelist', 'create', [{
        'name': 'Enterprise Rates 2026',
        'currency_id': bdt_id or 1,
        'company_id': 1,
    }])
    print(f"  Created: Enterprise Rates 2026 (ID {ent_pl_id})")

# Create Government pricelist
existing_gov = call('product.pricelist', 'search', [[('name', '=', 'Government Rates 2026')]])
if existing_gov:
    gov_pl_id = existing_gov[0]
    print(f"  Government pricelist exists (ID {gov_pl_id})")
else:
    gov_pl_id = call('product.pricelist', 'create', [{
        'name': 'Government Rates 2026',
        'currency_id': bdt_id or 1,
        'company_id': 1,
    }])
    print(f"  Created: Government Rates 2026 (ID {gov_pl_id})")

# Historical pricelist (expired — keeps old rates)
existing_hist = call('product.pricelist', 'search', [[('name', '=', 'Standard ISP Rates 2025 (Archived)')]])
if existing_hist:
    hist_pl_id = existing_hist[0]
    print(f"  Historical pricelist exists (ID {hist_pl_id})")
else:
    hist_pl_id = call('product.pricelist', 'create', [{
        'name': 'Standard ISP Rates 2025 (Archived)',
        'currency_id': bdt_id or 1,
        'company_id': 1,
        'active': False,  # archived but still queryable
    }])
    print(f"  Created: Standard ISP Rates 2025 Archived (ID {hist_pl_id})")

# ══════════════════════════════════════════════════════════════
# STEP 4: Add pricelist items with effective dates
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 4: Add pricelist items with effective dates")
print("=" * 60)

# Current period: 2026-01-01 to 2026-12-31
CURRENT_START = '2026-01-01'
CURRENT_END = '2026-12-31'

# Historical period: 2025-01-01 to 2025-12-31
HIST_START = '2025-01-01'
HIST_END = '2025-12-31'

def create_pricelist_items(pricelist_id, pricelist_name, product_prices, date_start, date_end):
    """Create pricelist items with fixed prices and date ranges."""
    count = 0
    for tmpl_name, price in product_prices.items():
        tmpl_ids = call('product.template', 'search', [[('name', '=', tmpl_name)]])
        if not tmpl_ids:
            continue
        # Check if item already exists
        existing = call('product.pricelist.item', 'search', [
            [('pricelist_id', '=', pricelist_id),
             ('product_tmpl_id', '=', tmpl_ids[0]),
             ('date_start', '=', date_start)]
        ])
        if existing:
            continue
        call('product.pricelist.item', 'create', [{
            'pricelist_id': pricelist_id,
            'product_tmpl_id': tmpl_ids[0],
            'compute_price': 'fixed',
            'fixed_price': price,
            'date_start': date_start,
            'date_end': date_end,
            'min_quantity': 1,
        }])
        count += 1
    print(f"  {pricelist_name}: {count} items created ({date_start} to {date_end})")

# Standard rates 2026 (current)
std_prices_2026 = {
    'IPLC (International Private Leased Circuit)': 50000,
    'IP Transit': 25000,
    'Colocation Service': 15000,
    'Domain & Hosting': 2000,
    'VoIP Termination': 5000,
    'MPLS VPN': 30000,
}
create_pricelist_items(std_pl_id, 'Standard 2026', std_prices_2026, CURRENT_START, CURRENT_END)

# Enterprise rates 2026 (10% discount on standard)
ent_prices_2026 = {k: int(v * 0.9) for k, v in std_prices_2026.items()}
create_pricelist_items(ent_pl_id, 'Enterprise 2026', ent_prices_2026, CURRENT_START, CURRENT_END)

# Government rates 2026 (15% discount)
gov_prices_2026 = {k: int(v * 0.85) for k, v in std_prices_2026.items()}
create_pricelist_items(gov_pl_id, 'Government 2026', gov_prices_2026, CURRENT_START, CURRENT_END)

# Historical rates 2025 (old prices — 8% cheaper than 2026, shows price was raised)
hist_prices_2025 = {k: int(v * 0.92) for k, v in std_prices_2026.items()}
create_pricelist_items(hist_pl_id, 'Historical 2025', hist_prices_2025, HIST_START, HIST_END)

# Also add percentage-based discount rules for Enterprise pricelist on bandwidth products
for tmpl_name in ['Shared Internet', 'Dedicated Internet Access (DIA)', 'Bulk SMS']:
    tmpl_ids = call('product.template', 'search', [[('name', '=', tmpl_name)]])
    if not tmpl_ids:
        continue
    existing = call('product.pricelist.item', 'search', [
        [('pricelist_id', '=', ent_pl_id),
         ('product_tmpl_id', '=', tmpl_ids[0]),
         ('date_start', '=', CURRENT_START)]
    ])
    if not existing:
        call('product.pricelist.item', 'create', [{
            'pricelist_id': ent_pl_id,
            'product_tmpl_id': tmpl_ids[0],
            'compute_price': 'percentage',
            'percent_price': 10.0,  # 10% discount
            'date_start': CURRENT_START,
            'date_end': CURRENT_END,
        }])
        print(f"  Enterprise: 10% discount on {tmpl_name}")

# Gov gets 15% discount on bandwidth products
for tmpl_name in ['Shared Internet', 'Dedicated Internet Access (DIA)', 'Bulk SMS']:
    tmpl_ids = call('product.template', 'search', [[('name', '=', tmpl_name)]])
    if not tmpl_ids:
        continue
    existing = call('product.pricelist.item', 'search', [
        [('pricelist_id', '=', gov_pl_id),
         ('product_tmpl_id', '=', tmpl_ids[0]),
         ('date_start', '=', CURRENT_START)]
    ])
    if not existing:
        call('product.pricelist.item', 'create', [{
            'pricelist_id': gov_pl_id,
            'product_tmpl_id': tmpl_ids[0],
            'compute_price': 'percentage',
            'percent_price': 15.0,  # 15% discount
            'date_start': CURRENT_START,
            'date_end': CURRENT_END,
        }])
        print(f"  Government: 15% discount on {tmpl_name}")

# ══════════════════════════════════════════════════════════════
# STEP 5: Create payment terms
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 5: Create payment terms")
print("=" * 60)

for term_name, days in [('Net 7', 7), ('Net 15', 15), ('Net 30', 30)]:
    existing = call('account.payment.term', 'search', [[('name', '=', term_name)]])
    if existing:
        print(f"  {term_name} already exists")
    else:
        term_id = call('account.payment.term', 'create', [{
            'name': term_name,
            'company_id': 1,
            'line_ids': [(0, 0, {
                'value': 'percent',
                'value_amount': 100,
                'nb_days': days,
            })],
        }])
        print(f"  Created {term_name} (ID {term_id})")

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("DONE — Pricing Summary")
print("=" * 60)
print(f"""
VAT: 15% Bangladesh VAT applied to all {len(all_tmpls)} products

Pricelists (with effective dates):
  1. Standard ISP Rates 2026    (2026-01-01 to 2026-12-31) — base prices
  2. Enterprise Rates 2026      (2026-01-01 to 2026-12-31) — 10% discount
  3. Government Rates 2026      (2026-01-01 to 2026-12-31) — 15% discount
  4. Standard ISP Rates 2025    (2025-01-01 to 2025-12-31) — archived, historical

Price history is preserved forever:
  - Old pricelist items stay with their date ranges (never deleted)
  - New periods get new items — old ones remain as history
  - Archived pricelists are queryable but don't appear in active lists
  - Every pricelist item has date_start/date_end for auditability

Payment terms: Net 7, Net 15, Net 30

Sample computed prices (Shared Internet, standard):
  10 Mbps Monthly:   ৳3,000 + 15% VAT = ৳3,450
  100 Mbps Monthly:  ৳18,000 + 15% VAT = ৳20,700
  1 Gbps Yearly:     ৳129,000 + 15% VAT = ৳148,350
""")
