# Kill Bill REST API Reference

Base URL: `http://localhost:18080`

## Required Headers (all tenant-scoped requests)

```
Authorization: Basic admin:password
X-Killbill-ApiKey: {tenant_api_key}
X-Killbill-ApiSecret: {tenant_api_secret}
X-Killbill-CreatedBy: {username}
Content-Type: application/json
```

System-level requests (tenant creation, healthcheck) need only `Authorization`.

## Endpoints

### Healthcheck
```
GET /1.0/healthcheck
# No auth needed, returns JSON with component health
```

### Tenant Management (system-level, no tenant headers)
```
POST   /1.0/kb/tenants                              # Create tenant
GET    /1.0/kb/tenants?apiKey={key}                  # Get tenant by API key
POST   /1.0/kb/tenants/registerNotificationCallback  # Register webhook (body: "http://url")
```

### Accounts
```
POST   /1.0/kb/accounts                                              # Create account
GET    /1.0/kb/accounts/{id}?accountWithBalanceAndCBA=true            # Get account with balance
GET    /1.0/kb/accounts?externalKey={key}&accountWithBalanceAndCBA=true  # Get by external key
GET    /1.0/kb/accounts/pagination?offset=0&limit=100                 # List accounts
```

Create account body:
```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "externalKey": "ISP-001",
  "currency": "BDT",
  "company": "Company Name"
}
```
Returns: `201 Created`, `Location` header contains account URL with UUID.

### Subscriptions
```
POST   /1.0/kb/subscriptions              # Create subscription
GET    /1.0/kb/subscriptions/{id}          # Get subscription
DELETE /1.0/kb/subscriptions/{id}          # Cancel subscription
PUT    /1.0/kb/subscriptions/{id}/pause    # Pause subscription
PUT    /1.0/kb/subscriptions/{id}/resume   # Resume subscription
GET    /1.0/kb/accounts/{id}/bundles       # Get account's bundles (subscriptions)
```

Create subscription body:
```json
{
  "accountId": "{account-uuid}",
  "planName": "internet-100mbps-monthly",
  "externalKey": "SO-S00001-1"
}
```

### Invoices
```
GET    /1.0/kb/accounts/{id}/invoices           # List account invoices
GET    /1.0/kb/invoices/{id}?withItems=true      # Get invoice with line items
```

### Payments
```
GET    /1.0/kb/accounts/{id}/payments                    # List account payments
GET    /1.0/kb/accounts/{id}/payments?withAttempts=true   # With attempt details
GET    /1.0/kb/payments/{id}?withAttempts=true             # Get single payment
GET    /1.0/kb/invoices/{id}/payments                      # Get invoice payments
GET    /1.0/kb/payments/search/{searchKey}?offset=0&limit=100  # Search payments
POST   /1.0/kb/invoices/{invoiceId}/payments               # Pay invoice
```

Pay invoice body (external/manual payment):
```json
{
  "accountId": "{account-uuid}",
  "purchasedAmount": 500,
  "currency": "BDT",
  "paymentExternalKey": "BKASH:TRX123456:Monthly payment"
}
```
Query param: `?externalPayment=true` for manual payments (no gateway plugin).

Pay invoice body (gateway payment):
```json
{
  "accountId": "{account-uuid}",
  "purchasedAmount": 500,
  "currency": "BDT",
  "paymentMethodId": "{payment-method-uuid}",
  "paymentExternalKey": "ONLINE:ORD-12345:SSLCommerz"
}
```

### `transactionExternalKey` Convention

Format: `{METHOD}:{REFERENCE}:{NOTE}`

| Method | Example |
|--------|---------|
| `CASH` | `CASH` |
| `BANK_TRANSFER` | `BANK_TRANSFER:REF20260313001:March payment` |
| `BKASH` | `BKASH:TRX9A8B7C:` |
| `NAGAD` | `NAGAD:NAG12345:` |
| `ROCKET` | `ROCKET:ROC67890:` |
| `CHEQUE` | `CHEQUE:CHQ001:Dhaka branch` |
| `ONLINE` | `ONLINE:ORD-12345:SSLCommerz` |
| `OTHER` | `OTHER::misc` |

### Catalog
```
GET    /1.0/kb/catalog                    # Get catalog (JSON, needs Accept: application/json)
GET    /1.0/kb/catalog/simpleCatalog      # Get simplified catalog
POST   /1.0/kb/catalog/xml               # Upload catalog (Content-Type: text/xml)
```

### Overdue
```
GET    /1.0/kb/accounts/{id}/overdue     # Get account overdue state
POST   /1.0/kb/overdue/xml              # Upload overdue config (Content-Type: text/xml)
```

### Custom Fields
```
GET    /1.0/kb/subscriptions/{id}/customFields       # Get custom fields
POST   /1.0/kb/subscriptions/{id}/customFields       # Set custom fields
```

### Tags
```
GET    /1.0/kb/accounts/{id}/tags        # Get account tags
```

## Push Notifications (Webhooks)

Kill Bill sends POST requests to the registered callback URL when events occur.

Event payload fields:
- `eventType` — e.g. `INVOICE_CREATION`, `PAYMENT_SUCCESS`, `SUBSCRIPTION_PHASE`, `OVERDUE_CHANGE`
- `objectId` — UUID of the affected object
- `objectType` — `INVOICE`, `PAYMENT`, `SUBSCRIPTION`, `ACCOUNT`
- `accountId` — UUID of the account

Key events to handle:
| Event | Meaning | Action |
|-------|---------|--------|
| `INVOICE_CREATION` | KB generated a recurring invoice | Create `account.move` in Odoo |
| `PAYMENT_SUCCESS` | Payment recorded against invoice | Create `account.payment` in Odoo |
| `SUBSCRIPTION_PHASE` | Subscription phase changed (trial→evergreen) | Update partner status |
| `OVERDUE_CHANGE` | Account overdue state changed | Update partner tags |
| `SUBSCRIPTION_CANCEL` | Subscription cancelled | Update partner tags |

Register callback per tenant:
```bash
curl -X POST "http://localhost:18080/1.0/kb/tenants/registerNotificationCallback" \
  -u admin:password \
  -H "X-Killbill-ApiKey: telcobright-isp" \
  -H "X-Killbill-ApiSecret: telcobright-isp-secret" \
  -H "X-Killbill-CreatedBy: admin" \
  -H "Content-Type: application/json" \
  -d '"http://localhost:8900/webhook/kb"'
```

## Full API Docs

https://apidocs.killbill.io

## JavaScript API Client Reference

The existing React UI has a complete API client at:
`/home/mustafa/telcobright-projects/odoo/killbill-billing/billing-ui/src/services/killbill.js`

This shows the exact Axios calls for every operation and can be used as reference when building the Python sync service.
