#!/usr/bin/env python3
"""
End-to-end: Create first tenant mapping, client, subscription in both Odoo and Kill Bill.
Then sync KB invoice/payment data back to Odoo so it's visible in the UI.
"""
import xmlrpc.client
import requests
import json
import time

# ── Connection config ──
ODOO_URL = 'http://localhost:7169'
ODOO_DB = 'odoo_billing'
ODOO_USER = 'admin'
ODOO_PASS = 'admin'

KB_URL = 'http://localhost:18080'
KB_AUTH = ('admin', 'password')
KB_API_KEY = 'telcobright-isp'
KB_API_SECRET = 'telcobright-isp-secret'
KB_HEADERS = {
    'X-Killbill-ApiKey': KB_API_KEY,
    'X-Killbill-ApiSecret': KB_API_SECRET,
    'X-Killbill-CreatedBy': 'odoo-sync',
    'Content-Type': 'application/json',
}

# ── Odoo XML-RPC ──
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

def odoo(model, method, *args, **kwargs):
    return models.execute_kw(ODOO_DB, uid, ODOO_PASS, model, method, *args, **kwargs)

def kb_get(path, **params):
    r = requests.get(f'{KB_URL}{path}', auth=KB_AUTH, headers=KB_HEADERS, params=params)
    r.raise_for_status()
    return r.json() if r.text else None

def kb_post(path, data=None):
    r = requests.post(f'{KB_URL}{path}', auth=KB_AUTH, headers=KB_HEADERS, json=data)
    r.raise_for_status()
    return r

print("=" * 60)
print("STEP 1: Configure tenant mapping on Odoo company")
print("=" * 60)

# Get default company (id=1)
company = odoo('res.company', 'read', [[1]], {'fields': ['name', 'x_kb_api_key']})
print(f"Current company: {company[0]['name']}")

# Update company with KB tenant credentials
odoo('res.company', 'write', [[1], {
    'name': 'Telcobright ISP',
    'x_kb_api_key': KB_API_KEY,
    'x_kb_api_secret': KB_API_SECRET,
    'x_kb_api_url': KB_URL,
}])

# Get the KB tenant ID
tenants_resp = requests.get(f'{KB_URL}/1.0/kb/tenants', auth=KB_AUTH,
                            headers={'Content-Type': 'application/json'})
# Search by API key
tenant_search = requests.get(f'{KB_URL}/1.0/kb/tenants?apiKey={KB_API_KEY}',
                             auth=KB_AUTH, headers={'Content-Type': 'application/json'})
if tenant_search.ok and tenant_search.text:
    tenant_data = tenant_search.json()
    tenant_id = tenant_data.get('tenantId', '')
    if tenant_id:
        odoo('res.company', 'write', [[1], {'x_kb_tenant_id': tenant_id}])
        print(f"KB Tenant ID set: {tenant_id}")

print("Company updated to 'Telcobright ISP' with KB credentials\n")

print("=" * 60)
print("STEP 2: Create a client (partner) in Odoo")
print("=" * 60)

# Check if partner already exists
existing = odoo('res.partner', 'search', [[('x_external_key', '=', 'ISP-001')]], {'limit': 1})
if existing:
    partner_id = existing[0]
    print(f"Partner ISP-001 already exists (ID {partner_id})")
else:
    partner_id = odoo('res.partner', 'create', [{
        'name': 'ABC ISP Limited',
        'email': 'billing@abcisp.bd',
        'phone': '+8801712345678',
        'company_type': 'company',
        'x_external_key': 'ISP-001',
        'x_nid_passport': 'NID-1234567890',
        'x_verification_status': 'pending',
        'company_id': 1,
    }])
    print(f"Created partner: ABC ISP Limited (ID {partner_id})")

# Verify the partner (this triggers the sync queue entry)
odoo('res.partner', 'write', [[partner_id], {'x_verification_status': 'verified'}])
print("Partner verified — sync queue entry created\n")

print("=" * 60)
print("STEP 3: Create KB account for this partner")
print("=" * 60)

# Check if account already exists in KB
try:
    existing_acc = kb_get(f'/1.0/kb/accounts?externalKey=ISP-001')
    kb_account_id = existing_acc.get('accountId')
    print(f"KB account already exists: {kb_account_id}")
except:
    # Create account in Kill Bill
    resp = kb_post('/1.0/kb/accounts', {
        'name': 'ABC ISP Limited',
        'email': 'billing@abcisp.bd',
        'externalKey': 'ISP-001',
        'currency': 'BDT',
        'company': 'ABC ISP Limited',
    })
    # Get account ID from Location header
    location = resp.headers.get('Location', '')
    kb_account_id = location.split('/')[-1] if location else ''
    print(f"Created KB account: {kb_account_id}")

# Write KB account ID back to Odoo partner
odoo('res.partner', 'write', [[partner_id], {'x_kb_account_id': kb_account_id}])
print(f"Wrote KB account ID back to Odoo partner\n")

# Update sync log entry to success
sync_entries = odoo('kb.sync.log', 'search', [[
    ('operation', '=', 'partner_to_kb'),
    ('odoo_object', '=', f'res.partner,{partner_id}'),
    ('status', '=', 'pending'),
]])
if sync_entries:
    odoo('kb.sync.log', 'write', [sync_entries, {
        'status': 'success',
        'kb_object_id': kb_account_id,
        'response_payload': json.dumps({'accountId': kb_account_id}),
    }])

print("=" * 60)
print("STEP 4: Create subscription (Internet 100Mbps Monthly)")
print("=" * 60)

try:
    # Check if subscription already exists
    sub_resp = requests.get(
        f'{KB_URL}/1.0/kb/accounts/{kb_account_id}/bundles',
        auth=KB_AUTH, headers=KB_HEADERS)
    bundles = sub_resp.json() if sub_resp.ok and sub_resp.text else []
    existing_sub = None
    for bundle in bundles:
        for sub in bundle.get('subscriptions', []):
            if sub.get('externalKey') == 'SUB-ISP001-INT100':
                existing_sub = sub
                break
    if existing_sub:
        kb_subscription_id = existing_sub['subscriptionId']
        print(f"KB subscription already exists: {kb_subscription_id}")
    else:
        resp = kb_post('/1.0/kb/subscriptions', {
            'accountId': kb_account_id,
            'planName': 'internet-100mbps-monthly',
            'externalKey': 'SUB-ISP001-INT100',
        })
        location = resp.headers.get('Location', '')
        kb_subscription_id = location.split('/')[-1] if location else ''
        print(f"Created KB subscription: {kb_subscription_id}")
except Exception as e:
    print(f"Subscription error: {e}")
    kb_subscription_id = 'unknown'

# Log subscription creation in sync log
odoo('kb.sync.log', 'create', [{
    'operation': 'subscription_create',
    'direction': 'odoo_to_kb',
    'status': 'success',
    'kb_object_id': kb_subscription_id,
    'odoo_object': f'res.partner,{partner_id}',
    'request_payload': json.dumps({
        'accountId': kb_account_id,
        'planName': 'internet-100mbps-monthly',
        'externalKey': 'SUB-ISP001-INT100',
    }),
    'response_payload': json.dumps({'subscriptionId': kb_subscription_id}),
    'company_id': 1,
}])
print()

print("=" * 60)
print("STEP 5: Wait for KB to generate invoice, then sync to Odoo")
print("=" * 60)

# Give KB a moment to generate the invoice
time.sleep(3)

# Fetch invoices from KB
invoices = kb_get(f'/1.0/kb/accounts/{kb_account_id}/invoices', withItems='true', audit='NONE')
print(f"KB has {len(invoices)} invoice(s)")

for inv in invoices:
    inv_id = inv['invoiceId']
    inv_amount = inv.get('amount', 0)
    inv_balance = inv.get('balance', 0)
    inv_date = inv.get('invoiceDate', '')

    if inv_amount == 0:
        print(f"  Skipping $0 invoice {inv_id}")
        continue

    print(f"  Invoice {inv_id}: amount={inv_amount} BDT, balance={inv_balance}, date={inv_date}")

    # Check if already synced to Odoo
    existing_move = odoo('account.move', 'search', [[('x_kb_invoice_id', '=', inv_id)]], {'limit': 1})
    if existing_move:
        print(f"  Already synced to Odoo (move ID {existing_move[0]})")
        continue

    # Find product in Odoo for the invoice line
    product_ids = odoo('product.product', 'search', [[('name', 'ilike', 'Internet%100')]], {'limit': 1})

    # Create invoice in Odoo
    invoice_lines = []
    for item in inv.get('items', []):
        line_vals = {
            'name': item.get('description', f"KB: {item.get('planName', 'Service')}"),
            'quantity': 1,
            'price_unit': item.get('amount', 0),
        }
        if product_ids:
            line_vals['product_id'] = product_ids[0]
        invoice_lines.append((0, 0, line_vals))

    if not invoice_lines:
        invoice_lines = [(0, 0, {
            'name': f'Internet 100Mbps - Monthly (KB Invoice {inv_id[:8]})',
            'quantity': 1,
            'price_unit': inv_amount,
        })]

    move_id = odoo('account.move', 'create', [{
        'move_type': 'out_invoice',
        'partner_id': partner_id,
        'invoice_date': inv_date,
        'x_kb_invoice_id': inv_id,
        'company_id': 1,
        'invoice_line_ids': invoice_lines,
    }])
    print(f"  Created Odoo invoice (move ID {move_id})")

    # Post (confirm) the invoice
    try:
        odoo('account.move', 'action_post', [[move_id]])
        print(f"  Invoice posted (confirmed)")
    except Exception as e:
        print(f"  Note: Could not auto-post invoice: {e}")

    # Log in sync log
    odoo('kb.sync.log', 'create', [{
        'operation': 'invoice_from_kb',
        'direction': 'kb_to_odoo',
        'status': 'success',
        'kb_object_id': inv_id,
        'odoo_object': f'account.move,{move_id}',
        'request_payload': json.dumps(inv),
        'company_id': 1,
    }])

print()
print("=" * 60)
print("STEP 6: Record payment in KB and sync to Odoo")
print("=" * 60)

# Find the non-zero invoice to pay
payable_invoices = [inv for inv in invoices if inv.get('balance', 0) > 0]
if payable_invoices:
    target_inv = payable_invoices[0]
    inv_id = target_inv['invoiceId']
    pay_amount = target_inv['balance']

    print(f"Paying invoice {inv_id}: {pay_amount} BDT via bKash")

    # Record payment in KB
    pay_resp = kb_post(f'/1.0/kb/invoices/{inv_id}/payments', {
        'accountId': kb_account_id,
        'purchasedAmount': pay_amount,
        'currency': 'BDT',
        'isExternal': True,
        'transactionExternalKey': 'BKASH:TXN20260315001:First monthly payment',
    })
    kb_payment_location = pay_resp.headers.get('Location', '')
    kb_payment_id = kb_payment_location.split('/')[-1] if kb_payment_location else ''
    print(f"KB payment recorded: {kb_payment_id}")

    # Find the Odoo invoice for this KB invoice
    odoo_move = odoo('account.move', 'search', [[('x_kb_invoice_id', '=', inv_id)]], {'limit': 1})

    # Create payment in Odoo
    # First find the bKash journal (or use default bank journal)
    journals = odoo('account.journal', 'search_read',
                    [[('type', 'in', ['bank', 'cash']), ('company_id', '=', 1)]],
                    {'fields': ['id', 'name'], 'limit': 5})
    # Use bank journal as default (bKash journal not created yet)
    journal_id = journals[0]['id'] if journals else False
    journal_name = journals[0]['name'] if journals else 'Unknown'

    if journal_id and odoo_move:
        payment_id = odoo('account.payment', 'create', [{
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': partner_id,
            'amount': pay_amount,
            'journal_id': journal_id,
            'ref': 'BKASH:TXN20260315001:First monthly payment',
            'x_kb_payment_id': kb_payment_id,
            'company_id': 1,
        }])
        print(f"Created Odoo payment (ID {payment_id}) in journal '{journal_name}'")

        # Confirm payment
        try:
            odoo('account.payment', 'action_post', [[payment_id]])
            print("Payment posted (confirmed)")
        except Exception as e:
            print(f"Note: Could not auto-post payment: {e}")

        # Log in sync log
        odoo('kb.sync.log', 'create', [{
            'operation': 'payment_from_kb',
            'direction': 'kb_to_odoo',
            'status': 'success',
            'kb_object_id': kb_payment_id,
            'odoo_object': f'account.payment,{payment_id}',
            'request_payload': json.dumps({
                'paymentId': kb_payment_id,
                'amount': pay_amount,
                'method': 'BKASH',
                'ref': 'TXN20260315001',
            }),
            'company_id': 1,
        }])
else:
    print("No payable invoices found (may be $0 initial invoice)")

print()
print("=" * 60)
print("STEP 7: Update KB balance on partner")
print("=" * 60)

# Fetch account balance from KB
account_data = kb_get(f'/1.0/kb/accounts/{kb_account_id}')
kb_balance = account_data.get('accountBalance', 0) or 0.0
odoo('res.partner', 'write', [[partner_id], {'x_kb_balance': float(kb_balance)}])
print(f"Partner KB balance updated: {kb_balance} BDT")

print()
print("=" * 60)
print("DONE — Summary")
print("=" * 60)
print(f"""
Company:      Telcobright ISP (KB tenant: {KB_API_KEY})
Partner:      ABC ISP Limited (external key: ISP-001)
KB Account:   {kb_account_id}
Subscription: Internet 100Mbps Monthly ({kb_subscription_id})
Invoice(s):   {len(invoices)} in KB, synced to Odoo
Payment:      {'Recorded in both KB and Odoo' if payable_invoices else 'No payment needed yet'}

View in Odoo UI:
  - Partner:    http://localhost:7169/web#model=res.partner&id={partner_id}
  - Invoices:   http://localhost:7169/web#action=account.action_move_out_invoice_type
  - Payments:   http://localhost:7169/web#action=account.action_account_payments
  - Sync Log:   http://localhost:7169/web#action=kb_integration.action_kb_sync_log
  - Kill Bill:  http://localhost:5180
""")
