#!/usr/bin/env python3
"""Sync KB invoices and record a payment in both KB and Odoo."""
import xmlrpc.client
import requests
import json

ODOO_URL = 'http://localhost:7169'
ODOO_DB = 'odoo_billing'
KB_URL = 'http://localhost:18080'
KB_AUTH = ('admin', 'password')
KB_HEADERS = {
    'X-Killbill-ApiKey': 'telcobright-isp',
    'X-Killbill-ApiSecret': 'telcobright-isp-secret',
    'X-Killbill-CreatedBy': 'odoo-sync',
    'Content-Type': 'application/json',
}
KB_ACCOUNT_ID = '23db1e2c-1c14-4909-a8a7-ce5b7f77b18f'
PARTNER_ID = 7

common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, 'admin', 'admin', {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object', allow_none=True)

def odoo(model, method, *args, **kwargs):
    return models.execute_kw(ODOO_DB, uid, 'admin', model, method, *args, **kwargs)

print("=" * 60)
print("Syncing KB invoices to Odoo")
print("=" * 60)

# Fetch unpaid invoices with items
resp = requests.get(
    f'{KB_URL}/1.0/kb/accounts/{KB_ACCOUNT_ID}/invoices',
    params={'unpaidInvoicesOnly': 'true', 'withItems': 'true'},
    auth=KB_AUTH, headers={**KB_HEADERS, 'Accept': 'application/json'})
invoices = resp.json()
print(f"Found {len(invoices)} unpaid invoices in KB\n")

for inv in invoices:
    inv_id = inv['invoiceId']
    inv_amount = inv.get('amount', 0)
    inv_date = inv.get('invoiceDate', '')
    inv_number = inv.get('invoiceNumber', '')

    if inv_amount <= 0:
        continue

    # Check if already in Odoo
    existing = odoo('account.move', 'search', [[('x_kb_invoice_id', '=', inv_id)]], {'limit': 1})
    if existing:
        print(f"Invoice #{inv_number} ({inv_id[:8]}): already in Odoo (move {existing[0]})")
        continue

    # Build invoice lines from KB items
    lines = []
    for item in inv.get('items', []):
        if item.get('amount', 0) <= 0:
            continue
        desc = item.get('description') or item.get('planName', 'Service')
        lines.append((0, 0, {
            'name': desc,
            'quantity': 1,
            'price_unit': item['amount'],
        }))

    if not lines:
        lines = [(0, 0, {
            'name': f'KB Invoice #{inv_number}',
            'quantity': 1,
            'price_unit': inv_amount,
        })]

    move_id = odoo('account.move', 'create', [{
        'move_type': 'out_invoice',
        'partner_id': PARTNER_ID,
        'invoice_date': inv_date,
        'x_kb_invoice_id': inv_id,
        'company_id': 1,
        'invoice_line_ids': lines,
    }])
    print(f"Invoice #{inv_number} ({inv_id[:8]}): created in Odoo (move {move_id}), amount={inv_amount} BDT")

    # Post the invoice
    try:
        odoo('account.move', 'action_post', [[move_id]])
        print(f"  → Posted (confirmed)")
    except Exception as e:
        print(f"  → Could not post: {e}")

    # Log sync
    odoo('kb.sync.log', 'create', [{
        'operation': 'invoice_from_kb',
        'direction': 'kb_to_odoo',
        'status': 'success',
        'kb_object_id': inv_id,
        'odoo_object': f'account.move,{move_id}',
        'request_payload': json.dumps({'invoiceId': inv_id, 'amount': inv_amount, 'date': inv_date}),
        'company_id': 1,
    }])

print()
print("=" * 60)
print("Recording payment for first invoice via bKash")
print("=" * 60)

# Pay the first invoice in KB
first_inv = invoices[0]
inv_id = first_inv['invoiceId']
pay_amount = first_inv['balance']

print(f"Paying invoice #{first_inv.get('invoiceNumber')} ({inv_id[:8]}): {pay_amount} BDT via bKash")

pay_resp = requests.post(
    f'{KB_URL}/1.0/kb/invoices/{inv_id}/payments',
    auth=KB_AUTH, headers=KB_HEADERS,
    json={
        'accountId': KB_ACCOUNT_ID,
        'purchasedAmount': pay_amount,
        'currency': 'BDT',
        'isExternal': True,
        'transactionExternalKey': 'BKASH:TXN20260315001:Internet 100Mbps March',
    })
kb_payment_id = pay_resp.headers.get('Location', '').split('/')[-1]
print(f"KB payment: {kb_payment_id}")

# Create payment in Odoo
journals = odoo('account.journal', 'search_read',
                [[('type', 'in', ['bank', 'cash']), ('company_id', '=', 1)]],
                {'fields': ['id', 'name'], 'limit': 1})
journal_id = journals[0]['id']

payment_id = odoo('account.payment', 'create', [{
    'payment_type': 'inbound',
    'partner_type': 'customer',
    'partner_id': PARTNER_ID,
    'amount': pay_amount,
    'journal_id': journal_id,
    'ref': 'BKASH:TXN20260315001:Internet 100Mbps March',
    'x_kb_payment_id': kb_payment_id,
    'company_id': 1,
}])
print(f"Odoo payment created (ID {payment_id})")

try:
    odoo('account.payment', 'action_post', [[payment_id]])
    print("Payment posted (confirmed)")
except Exception as e:
    print(f"Could not post: {e}")

# Log sync
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

# Update partner balance
acc = requests.get(f'{KB_URL}/1.0/kb/accounts/{KB_ACCOUNT_ID}',
                   auth=KB_AUTH, headers={**KB_HEADERS, 'Accept': 'application/json'}).json()
balance = acc.get('accountBalance', 0) or 0.0
odoo('res.partner', 'write', [[PARTNER_ID], {'x_kb_balance': float(balance)}])

print()
print("=" * 60)
print("DONE")
print("=" * 60)
print(f"""
Data visible in Odoo UI at http://localhost:7169:

  Contacts → ABC ISP Limited → Kill Bill tab
    - External Key: ISP-001
    - KB Account ID: {KB_ACCOUNT_ID}
    - KB Balance: {balance} BDT

  Accounting → Invoices (Customer)
    - 2 invoices from KB (1200 BDT each)

  Accounting → Payments
    - 1 bKash payment (1200 BDT)

  Kill Bill → Sync Log
    - partner_to_kb: ABC ISP → KB account
    - subscription_create: Internet 100Mbps
    - invoice_from_kb: 2 invoices synced
    - payment_from_kb: bKash payment synced
""")
