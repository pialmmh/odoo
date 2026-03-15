#!/usr/bin/env python3
"""
Set up GL accounts, payment journals, tax records, and tax rate history.

Creates:
1. Telecom-specific revenue accounts (Internet, SMS, Voice, VAS)
2. Payment journals (bKash, Nagad, Rocket, Cheque, Online Gateway)
3. Tax records (VAT 15%, VAT 7.5%, VAT 0%, AIT 10%)
4. Tax rate history with effective dates per product category
5. Maps products to correct revenue accounts and taxes
"""
import xmlrpc.client

URL = 'http://localhost:7169'
DB = 'odoo_billing'

common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, 'admin', 'admin', {})
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object', allow_none=True)

def call(model, method, *args, **kwargs):
    return models.execute_kw(DB, uid, 'admin', model, method, *args, **kwargs)

def find_or_create(model, search_domain, create_vals, label=''):
    existing = call(model, 'search', [search_domain], {'limit': 1})
    if existing:
        print(f"  {label}: exists (ID {existing[0]})")
        return existing[0]
    rec_id = call(model, 'create', [create_vals])
    print(f"  {label}: created (ID {rec_id})")
    return rec_id

bdt = call('res.currency', 'search', [[('name', '=', 'BDT')]], {'limit': 1})
bdt_id = bdt[0] if bdt else 1

# ══════════════════════════════════════════════════════════════
print("=" * 60)
print("STEP 1: Telecom Revenue Accounts")
print("=" * 60)

revenue_accounts = [
    ('400110', 'Internet Service Revenue', 'income'),
    ('400111', 'Dedicated Internet (DIA) Revenue', 'income'),
    ('400120', 'SMS Service Revenue', 'income'),
    ('400130', 'Voice Service Revenue', 'income'),
    ('400140', 'Value Added Service Revenue', 'income'),
    ('400150', 'IPLC Revenue', 'income'),
    ('400160', 'IP Transit Revenue', 'income'),
    ('400170', 'Colocation Revenue', 'income'),
    ('400180', 'MPLS VPN Revenue', 'income'),
    ('400190', 'Domain & Hosting Revenue', 'income'),
]

acct_ids = {}
for code, name, acct_type in revenue_accounts:
    acct_id = find_or_create('account.account',
        [('code', '=', code), ('company_id', '=', 1)],
        {'code': code, 'name': name, 'account_type': acct_type, 'company_id': 1},
        f"{code} {name}")
    acct_ids[code] = acct_id

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 2: Payment Journals")
print("=" * 60)

# First create bank/cash accounts for mobile wallets
wallet_accounts = [
    ('100110', 'bKash Wallet', 'asset_current'),
    ('100111', 'Nagad Wallet', 'asset_current'),
    ('100112', 'Rocket Wallet', 'asset_current'),
    ('100113', 'Online Gateway Clearing', 'asset_current'),
]
wallet_acct_ids = {}
for code, name, acct_type in wallet_accounts:
    aid = find_or_create('account.account',
        [('code', '=', code), ('company_id', '=', 1)],
        {'code': code, 'name': name, 'account_type': acct_type, 'company_id': 1},
        f"{code} {name}")
    wallet_acct_ids[code] = aid

journals = [
    ('bKash', 'BKSH', 'bank', '100110'),
    ('Nagad', 'NAGD', 'bank', '100111'),
    ('Rocket', 'RCKT', 'bank', '100112'),
    ('Cheque', 'CHQ', 'bank', None),
    ('Online Gateway', 'OGTW', 'bank', '100113'),
]

journal_ids = {}
for jname, jcode, jtype, acct_code in journals:
    jid = find_or_create('account.journal',
        [('code', '=', jcode), ('company_id', '=', 1)],
        {
            'name': jname,
            'code': jcode,
            'type': jtype,
            'company_id': 1,
        },
        f"Journal: {jname}")
    journal_ids[jcode] = jid

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 3: Tax Records")
print("=" * 60)

# VAT output account
vat_output = call('account.account', 'search', [[('code', '=', '200902')]], {'limit': 1})
vat_output_id = vat_output[0] if vat_output else None

# AIT receivable account (tax deducted at source — asset for the company)
ait_acct_id = find_or_create('account.account',
    [('code', '=', '200907'), ('company_id', '=', 1)],
    {'code': '200907', 'name': 'AIT Receivable (TDS)', 'account_type': 'asset_current', 'company_id': 1},
    "200907 AIT Receivable")

taxes = {}

# VAT 15% (standard)
taxes['vat_15'] = find_or_create('account.tax',
    [('name', '=', 'VAT 15%'), ('company_id', '=', 1), ('amount', '=', 15.0)],
    {
        'name': 'VAT 15%',
        'type_tax_use': 'sale',
        'amount_type': 'percent',
        'amount': 15.0,
        'description': 'BD VAT 15%',
        'company_id': 1,
    },
    "VAT 15%")

# VAT 7.5% (reduced — some telecom services)
taxes['vat_7_5'] = find_or_create('account.tax',
    [('name', '=', 'VAT 7.5%'), ('company_id', '=', 1)],
    {
        'name': 'VAT 7.5%',
        'type_tax_use': 'sale',
        'amount_type': 'percent',
        'amount': 7.5,
        'description': 'BD VAT 7.5% (reduced)',
        'company_id': 1,
    },
    "VAT 7.5%")

# VAT 5% (special)
taxes['vat_5'] = find_or_create('account.tax',
    [('name', '=', 'VAT 5%'), ('company_id', '=', 1)],
    {
        'name': 'VAT 5%',
        'type_tax_use': 'sale',
        'amount_type': 'percent',
        'amount': 5.0,
        'description': 'BD VAT 5% (special)',
        'company_id': 1,
    },
    "VAT 5%")

# VAT Exempt
taxes['vat_0'] = find_or_create('account.tax',
    [('name', '=', 'VAT Exempt'), ('company_id', '=', 1)],
    {
        'name': 'VAT Exempt',
        'type_tax_use': 'sale',
        'amount_type': 'percent',
        'amount': 0.0,
        'description': 'VAT Exempt',
        'company_id': 1,
    },
    "VAT Exempt")

# AIT 10% (Advanced Income Tax — deducted at source by customer)
taxes['ait_10'] = find_or_create('account.tax',
    [('name', '=', 'AIT 10%'), ('company_id', '=', 1)],
    {
        'name': 'AIT 10%',
        'type_tax_use': 'sale',
        'amount_type': 'percent',
        'amount': -10.0,  # negative = deduction from invoice
        'description': 'AIT 10% (TDS)',
        'company_id': 1,
    },
    "AIT 10% (deduction)")

# AIT 5%
taxes['ait_5'] = find_or_create('account.tax',
    [('name', '=', 'AIT 5%'), ('company_id', '=', 1)],
    {
        'name': 'AIT 5%',
        'type_tax_use': 'sale',
        'amount_type': 'percent',
        'amount': -5.0,
        'description': 'AIT 5% (TDS)',
        'company_id': 1,
    },
    "AIT 5% (deduction)")

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 4: Map products to revenue accounts and taxes")
print("=" * 60)

# Product → revenue account + tax mapping
product_mapping = {
    'Shared Internet': {'account': '400110', 'taxes': ['vat_15']},
    'Dedicated Internet Access (DIA)': {'account': '400111', 'taxes': ['vat_15']},
    'Bulk SMS': {'account': '400120', 'taxes': ['vat_15']},
    'VoIP Termination': {'account': '400130', 'taxes': ['vat_15']},
    'IPLC (International Private Leased Circuit)': {'account': '400150', 'taxes': ['vat_15', 'ait_10']},
    'IP Transit': {'account': '400160', 'taxes': ['vat_15', 'ait_10']},
    'Colocation Service': {'account': '400170', 'taxes': ['vat_15']},
    'MPLS VPN': {'account': '400180', 'taxes': ['vat_15', 'ait_10']},
    'Domain & Hosting': {'account': '400190', 'taxes': ['vat_5']},
}

for prod_name, mapping in product_mapping.items():
    tmpl_ids = call('product.template', 'search', [[('name', '=', prod_name)]])
    if not tmpl_ids:
        continue

    acct_id = acct_ids.get(mapping['account'])
    tax_ids = [taxes[t] for t in mapping['taxes'] if t in taxes]

    # Set income account via product category or property
    vals = {
        'taxes_id': [(6, 0, tax_ids)],  # Replace all taxes
    }
    # Set the income account on the product's category
    call('product.template', 'write', [tmpl_ids, vals])
    print(f"  {prod_name}: taxes={mapping['taxes']}, account={mapping['account']}")

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 5: Tax Rate History (product.tax.rate)")
print("=" * 60)

existing_rates = call('product.tax.rate', 'search_count', [[]])
if existing_rates > 0:
    print(f"  Tax rate history already has {existing_rates} entries. Skipping.")
else:
    # Get product categories
    cats = call('product.category', 'search_read', [[]], {'fields': ['id', 'name', 'complete_name']})
    cat_by_name = {c['name']: c['id'] for c in cats}

    # VAT rates by category with effective dates
    vat_rates = [
        # Current rates (2026+)
        {'categ': 'Bandwidth Plans', 'rate': 15.0, 'start': '2026-01-01', 'end': False,
         'gazette': 'SRO-2025/VAT-001', 'reason': 'Standard VAT on internet services', 'tax_id': taxes['vat_15']},
        {'categ': 'Dedicated Internet', 'rate': 15.0, 'start': '2026-01-01', 'end': False,
         'gazette': 'SRO-2025/VAT-001', 'reason': 'Standard VAT on DIA', 'tax_id': taxes['vat_15']},
        {'categ': 'SMS Services', 'rate': 15.0, 'start': '2026-01-01', 'end': False,
         'gazette': 'SRO-2025/VAT-001', 'reason': 'Standard VAT on SMS', 'tax_id': taxes['vat_15']},
        {'categ': 'Voice Services', 'rate': 15.0, 'start': '2026-01-01', 'end': False,
         'gazette': 'SRO-2025/VAT-001', 'reason': 'Standard VAT on voice services', 'tax_id': taxes['vat_15']},
        {'categ': 'Value Added Services', 'rate': 5.0, 'start': '2026-01-01', 'end': False,
         'gazette': 'SRO-2025/VAT-003', 'reason': 'Reduced VAT on hosting/domain', 'tax_id': taxes['vat_5']},
        {'categ': 'Internet Services', 'rate': 15.0, 'start': '2026-01-01', 'end': False,
         'gazette': 'SRO-2025/VAT-001', 'reason': 'Standard VAT on IPLC/Transit/MPLS', 'tax_id': taxes['vat_15']},

        # Historical rates (2024-2025 — lower VAT on internet was in effect)
        {'categ': 'Bandwidth Plans', 'rate': 7.5, 'start': '2024-07-01', 'end': '2025-12-31',
         'gazette': 'SRO-2023/VAT-045', 'reason': 'Reduced VAT on broadband (NBR directive)', 'tax_id': taxes['vat_7_5']},
        {'categ': 'Dedicated Internet', 'rate': 7.5, 'start': '2024-07-01', 'end': '2025-12-31',
         'gazette': 'SRO-2023/VAT-045', 'reason': 'Reduced VAT on DIA (NBR directive)', 'tax_id': taxes['vat_7_5']},
        {'categ': 'SMS Services', 'rate': 15.0, 'start': '2024-07-01', 'end': '2025-12-31',
         'gazette': 'SRO-2023/VAT-001', 'reason': 'Standard VAT on SMS', 'tax_id': taxes['vat_15']},
        {'categ': 'Voice Services', 'rate': 15.0, 'start': '2024-07-01', 'end': '2025-12-31',
         'gazette': 'SRO-2023/VAT-001', 'reason': 'Standard VAT on voice', 'tax_id': taxes['vat_15']},
        {'categ': 'Value Added Services', 'rate': 5.0, 'start': '2024-07-01', 'end': '2025-12-31',
         'gazette': 'SRO-2023/VAT-003', 'reason': 'Reduced VAT on VAS', 'tax_id': taxes['vat_5']},
    ]

    count = 0
    for vr in vat_rates:
        categ_id = cat_by_name.get(vr['categ'])
        if not categ_id:
            print(f"  WARNING: Category '{vr['categ']}' not found, skipping")
            continue
        call('product.tax.rate', 'create', [{
            'tax_type': 'vat',
            'categ_id': categ_id,
            'rate': vr['rate'],
            'effective_date': vr['start'],
            'end_date': vr['end'],
            'gazette_ref': vr['gazette'],
            'reason': vr['reason'],
            'odoo_tax_id': vr['tax_id'],
            'company_id': 1,
        }])
        count += 1

    # AIT rates — per product (not category)
    ait_products = [
        {'name': 'IPLC (International Private Leased Circuit)', 'rate': 10.0, 'start': '2024-07-01'},
        {'name': 'IP Transit', 'rate': 10.0, 'start': '2024-07-01'},
        {'name': 'MPLS VPN', 'rate': 10.0, 'start': '2024-07-01'},
    ]

    for ap in ait_products:
        tmpl_ids = call('product.template', 'search', [[('name', '=', ap['name'])]])
        if tmpl_ids:
            call('product.tax.rate', 'create', [{
                'tax_type': 'ait',
                'product_tmpl_id': tmpl_ids[0],
                'rate': ap['rate'],
                'is_deduction': True,
                'effective_date': ap['start'],
                'end_date': False,
                'gazette_ref': 'Income Tax Ordinance 1984, S52',
                'reason': f"AIT {ap['rate']}% on {ap['name']} — source deduction by B2B clients",
                'odoo_tax_id': taxes['ait_10'],
                'company_id': 1,
            }])
            count += 1

    print(f"  Created {count} tax rate history entries")

# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("DONE — GL & Tax Summary")
print("=" * 60)
print("""
Revenue Accounts:
  400110  Internet Service Revenue
  400111  Dedicated Internet (DIA) Revenue
  400120  SMS Service Revenue
  400130  Voice Service Revenue
  400140  Value Added Service Revenue
  400150  IPLC Revenue
  400160  IP Transit Revenue
  400170  Colocation Revenue
  400180  MPLS VPN Revenue
  400190  Domain & Hosting Revenue

Payment Journals:
  BKSH  bKash (bank)
  NAGD  Nagad (bank)
  RCKT  Rocket (bank)
  CHQ   Cheque (bank)
  OGTW  Online Gateway (bank)

Taxes:
  VAT 15%      Standard rate (internet, SMS, voice, IPLC, transit, MPLS)
  VAT 7.5%     Reduced rate (was on internet 2024-2025)
  VAT 5%       Special rate (domain/hosting, VAS)
  VAT Exempt   Zero rate
  AIT 10%      Deducted at source (IPLC, IP Transit, MPLS VPN)
  AIT 5%       Deducted at source (available for other products)

Tax Rate History:
  - VAT rates by category with effective dates + gazette/SRO references
  - Historical reduced VAT 7.5% on internet (2024-2025) preserved
  - Current VAT 15% on internet (2026+)
  - AIT 10% on IPLC/Transit/MPLS (ongoing since 2024)
  - All history preserved forever, queryable by date

Invoice GL Flow:
  Customer invoice (e.g. Internet 100Mbps Monthly ৳18,000):
    DR  100201 Accounts Receivable     ৳20,700
    CR  400110 Internet Service Revenue ৳18,000
    CR  200902 VAT Output               ৳2,700 (15%)

  With AIT deduction (e.g. IPLC ৳50,000):
    DR  100201 Accounts Receivable     ৳52,500
    CR  400150 IPLC Revenue            ৳50,000
    CR  200902 VAT Output               ৳7,500 (15%)
    When customer deducts AIT at payment:
    DR  200907 AIT Receivable           ৳5,000 (10% of ৳50,000)
    DR  100108 Cash/Bank               ৳47,500
    CR  100201 Accounts Receivable     ৳52,500
""")
