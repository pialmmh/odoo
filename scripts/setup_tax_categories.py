#!/usr/bin/env python3
"""
Restructure product categories to match BD VAT/tax classification.
Create tax categories, remap products, add attachment support to tax rates.

Tax categories (per NBR classification):
- IT Enabled Services (ITES) — internet, hosting, cloud, SMS
- Software — custom software, SaaS
- Computer Hardware — routers, switches, servers
- General Services — consulting, colocation, managed services
- General Hardware — cables, UPS, networking gear
"""
import xmlrpc.client

URL = 'http://localhost:7169'
DB = 'odoo_billing'

common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, 'admin', 'admin', {})
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object', allow_none=True)

def call(model, method, *args, **kwargs):
    return models.execute_kw(DB, uid, 'admin', model, method, *args, **kwargs)

def find_or_create_cat(name, parent_id=None):
    domain = [('name', '=', name)]
    if parent_id:
        domain.append(('parent_id', '=', parent_id))
    existing = call('product.category', 'search', [domain], {'limit': 1})
    if existing:
        return existing[0]
    vals = {'name': name}
    if parent_id:
        vals['parent_id'] = parent_id
    cid = call('product.category', 'create', [vals])
    print(f"  Created category: {name} (ID {cid})")
    return cid

# ══════════════════════════════════════════════════════════════
print("=" * 60)
print("STEP 1: Create tax classification categories")
print("=" * 60)

root = call('product.category', 'search', [[('name', '=', 'All'), ('parent_id', '=', False)]], {'limit': 1})
root_id = root[0] if root else 1

# Top-level tax classification categories
tax_cats = {}
for cat_name in ['IT Enabled Services', 'Software', 'Computer Hardware', 'General Services', 'General Hardware']:
    tax_cats[cat_name] = find_or_create_cat(cat_name, root_id)

# Sub-categories under IT Enabled Services
ites_subs = {}
for sub in ['Internet - Shared', 'Internet - Dedicated', 'SMS & Messaging', 'Cloud & Hosting', 'VoIP & Voice']:
    ites_subs[sub] = find_or_create_cat(sub, tax_cats['IT Enabled Services'])

# Sub-categories under General Services
gs_subs = {}
for sub in ['Colocation', 'Managed Services', 'Consulting', 'IPLC & Transit', 'MPLS & VPN']:
    gs_subs[sub] = find_or_create_cat(sub, tax_cats['General Services'])

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 2: Remap products to tax categories")
print("=" * 60)

product_category_map = {
    'Shared Internet': ites_subs['Internet - Shared'],
    'Dedicated Internet Access (DIA)': ites_subs['Internet - Dedicated'],
    'Bulk SMS': ites_subs['SMS & Messaging'],
    'Domain & Hosting': ites_subs['Cloud & Hosting'],
    'VoIP Termination': ites_subs['VoIP & Voice'],
    'IPLC (International Private Leased Circuit)': gs_subs['IPLC & Transit'],
    'IP Transit': gs_subs['IPLC & Transit'],
    'Colocation Service': gs_subs['Colocation'],
    'MPLS VPN': gs_subs['MPLS & VPN'],
}

for prod_name, cat_id in product_category_map.items():
    tmpl_ids = call('product.template', 'search', [[('name', '=', prod_name)]])
    if tmpl_ids:
        call('product.template', 'write', [tmpl_ids, {'categ_id': cat_id}])
        cat_name = call('product.category', 'read', [[cat_id]], {'fields': ['complete_name']})[0]['complete_name']
        print(f"  {prod_name} -> {cat_name}")

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 3: Update tax rates to use new categories")
print("=" * 60)

# Clear old tax rates that used old categories
old_rates = call('product.tax.rate', 'search', [[]])
if old_rates:
    call('product.tax.rate', 'unlink', [old_rates])
    print(f"  Cleared {len(old_rates)} old tax rate entries")

# Get tax record IDs
def get_tax(name):
    ids = call('account.tax', 'search', [[('name', '=', name), ('company_id', '=', 1)]], {'limit': 1})
    return ids[0] if ids else False

vat_15 = get_tax('VAT 15%')
vat_7_5 = get_tax('VAT 7.5%')
vat_5 = get_tax('VAT 5%')
vat_0 = get_tax('VAT Exempt')
ait_10 = get_tax('AIT 10%')
ait_5 = get_tax('AIT 5%')

# Current VAT rates by tax category (2026+)
current_vat_rates = [
    # IT Enabled Services — VAT 5% (ITES gets reduced rate per NBR)
    {
        'tax_type': 'vat', 'categ_id': tax_cats['IT Enabled Services'],
        'rate': 5.0, 'effective_date': '2026-07-01', 'end_date': False,
        'gazette_ref': 'SRO-234/2026/VAT', 'odoo_tax_id': vat_5,
        'reason': 'ITES reduced VAT rate per NBR FY2026-27 budget',
    },
    # Software — VAT Exempt (govt incentive for local software)
    {
        'tax_type': 'vat', 'categ_id': tax_cats['Software'],
        'rate': 0.0, 'effective_date': '2026-07-01', 'end_date': False,
        'gazette_ref': 'SRO-235/2026/VAT', 'odoo_tax_id': vat_0,
        'reason': 'Software development VAT exemption (Digital BD initiative)',
    },
    # Computer Hardware — VAT 15% (standard)
    {
        'tax_type': 'vat', 'categ_id': tax_cats['Computer Hardware'],
        'rate': 15.0, 'effective_date': '2026-07-01', 'end_date': False,
        'gazette_ref': 'SRO-001/2026/VAT', 'odoo_tax_id': vat_15,
        'reason': 'Standard VAT on hardware',
    },
    # General Services — VAT 15% (standard)
    {
        'tax_type': 'vat', 'categ_id': tax_cats['General Services'],
        'rate': 15.0, 'effective_date': '2026-07-01', 'end_date': False,
        'gazette_ref': 'SRO-001/2026/VAT', 'odoo_tax_id': vat_15,
        'reason': 'Standard VAT on general services',
    },
    # General Hardware — VAT 15%
    {
        'tax_type': 'vat', 'categ_id': tax_cats['General Hardware'],
        'rate': 15.0, 'effective_date': '2026-07-01', 'end_date': False,
        'gazette_ref': 'SRO-001/2026/VAT', 'odoo_tax_id': vat_15,
        'reason': 'Standard VAT on hardware goods',
    },
]

# Historical VAT rates (FY2025-26)
historical_vat_rates = [
    {
        'tax_type': 'vat', 'categ_id': tax_cats['IT Enabled Services'],
        'rate': 7.5, 'effective_date': '2025-07-01', 'end_date': '2026-06-30',
        'gazette_ref': 'SRO-189/2025/VAT', 'odoo_tax_id': vat_7_5,
        'reason': 'ITES reduced VAT FY2025-26',
    },
    {
        'tax_type': 'vat', 'categ_id': tax_cats['Software'],
        'rate': 0.0, 'effective_date': '2025-07-01', 'end_date': '2026-06-30',
        'gazette_ref': 'SRO-190/2025/VAT', 'odoo_tax_id': vat_0,
        'reason': 'Software VAT exemption FY2025-26',
    },
    {
        'tax_type': 'vat', 'categ_id': tax_cats['General Services'],
        'rate': 15.0, 'effective_date': '2025-07-01', 'end_date': '2026-06-30',
        'gazette_ref': 'SRO-001/2025/VAT', 'odoo_tax_id': vat_15,
        'reason': 'Standard VAT FY2025-26',
    },
    {
        'tax_type': 'vat', 'categ_id': tax_cats['Computer Hardware'],
        'rate': 15.0, 'effective_date': '2025-07-01', 'end_date': '2026-06-30',
        'gazette_ref': 'SRO-001/2025/VAT', 'odoo_tax_id': vat_15,
        'reason': 'Standard VAT FY2025-26',
    },
    {
        'tax_type': 'vat', 'categ_id': tax_cats['General Hardware'],
        'rate': 15.0, 'effective_date': '2025-07-01', 'end_date': '2026-06-30',
        'gazette_ref': 'SRO-001/2025/VAT', 'odoo_tax_id': vat_15,
        'reason': 'Standard VAT FY2025-26',
    },
]

# AIT rates by category
ait_rates = [
    # General Services — AIT 10% (source deduction on service payments)
    {
        'tax_type': 'ait', 'categ_id': tax_cats['General Services'],
        'rate': 10.0, 'is_deduction': True,
        'effective_date': '2025-07-01', 'end_date': False,
        'gazette_ref': 'Income Tax Ordinance 1984, S52',
        'odoo_tax_id': ait_10,
        'reason': 'AIT on service payments (B2B, source deduction)',
    },
    # IT Enabled Services — AIT 5% (reduced for ITES)
    {
        'tax_type': 'ait', 'categ_id': tax_cats['IT Enabled Services'],
        'rate': 5.0, 'is_deduction': True,
        'effective_date': '2025-07-01', 'end_date': False,
        'gazette_ref': 'SRO-236/2025/IT, Income Tax Ordinance S52AA',
        'odoo_tax_id': ait_5,
        'reason': 'Reduced AIT for ITES (source deduction)',
    },
    # Software — AIT 5%
    {
        'tax_type': 'ait', 'categ_id': tax_cats['Software'],
        'rate': 5.0, 'is_deduction': True,
        'effective_date': '2025-07-01', 'end_date': False,
        'gazette_ref': 'SRO-236/2025/IT',
        'odoo_tax_id': ait_5,
        'reason': 'Reduced AIT for software (source deduction)',
    },
    # Computer Hardware — AIT 7% (different rate for goods)
    {
        'tax_type': 'ait', 'categ_id': tax_cats['Computer Hardware'],
        'rate': 7.0, 'is_deduction': True,
        'effective_date': '2025-07-01', 'end_date': False,
        'gazette_ref': 'Income Tax Ordinance 1984, S52',
        'odoo_tax_id': ait_10,  # closest Odoo tax
        'reason': 'AIT on hardware supply (source deduction)',
    },
]

all_rates = current_vat_rates + historical_vat_rates + ait_rates
count = 0
for r in all_rates:
    call('product.tax.rate', 'create', [{
        'tax_type': r['tax_type'],
        'categ_id': r['categ_id'],
        'rate': r['rate'],
        'is_deduction': r.get('is_deduction', False),
        'effective_date': r['effective_date'],
        'end_date': r.get('end_date', False),
        'gazette_ref': r.get('gazette_ref', ''),
        'reason': r.get('reason', ''),
        'odoo_tax_id': r.get('odoo_tax_id', False),
        'company_id': 1,
    }])
    count += 1
print(f"  Created {count} tax rate entries")

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 4: Update product taxes based on new categories")
print("=" * 60)

# Map products to correct taxes based on their new categories
# ITES products get VAT 5% + AIT 5%
ites_products = call('product.template', 'search', [
    [('categ_id', 'child_of', tax_cats['IT Enabled Services'])]
])
if ites_products:
    call('product.template', 'write', [ites_products, {
        'taxes_id': [(6, 0, [vat_5, ait_5] if ait_5 else [vat_5])],
    }])
    print(f"  ITES products ({len(ites_products)}): VAT 5% + AIT 5%")

# General Services get VAT 15% + AIT 10%
gs_products = call('product.template', 'search', [
    [('categ_id', 'child_of', tax_cats['General Services'])]
])
if gs_products:
    call('product.template', 'write', [gs_products, {
        'taxes_id': [(6, 0, [vat_15, ait_10] if ait_10 else [vat_15])],
    }])
    print(f"  General Services products ({len(gs_products)}): VAT 15% + AIT 10%")

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
print("""
Tax Classification Categories:
  IT Enabled Services    -> Internet, SMS, Cloud, VoIP
  Software               -> Custom dev, SaaS
  Computer Hardware      -> Routers, switches, servers
  General Services       -> IPLC, Transit, Colocation, MPLS, Consulting
  General Hardware       -> Cables, UPS, networking gear

VAT Rates (FY2026-27):
  IT Enabled Services:   5%   (SRO-234/2026/VAT)
  Software:              0%   (exempt, SRO-235/2026/VAT)
  Computer Hardware:    15%   (standard)
  General Services:     15%   (standard)
  General Hardware:     15%   (standard)

AIT Rates:
  IT Enabled Services:   5%   (reduced, source deduction)
  Software:              5%   (reduced, source deduction)
  Computer Hardware:     7%   (goods, source deduction)
  General Services:     10%   (standard, source deduction)

Historical rates preserved with gazette/SRO references.
""")
