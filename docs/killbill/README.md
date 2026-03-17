# Kill Bill Billing Engine

## Overview
Kill Bill 0.24.16 handles subscriptions, invoicing, and payments. Odoo manages the product catalog and customer data; Kill Bill executes the billing logic.

## Server
- Location: `killbill/`
- Port: 18080
- Database: MySQL at 127.0.0.1:3306, database `killbill`, user `root`/`123456`
- Start: `cd killbill && ./start.sh`

## Configuration
- `killbill/killbill-server.properties` — server config
- `killbill/catalogs/isp-catalog.xml` — product catalog (plans, pricing)
- `killbill/catalogs/overdue-config.xml` — overdue/dunning rules

## API Access
Kill Bill REST API is proxied through Spring Boot:
```
React → POST /api/kb/{path} → Spring Boot → Kill Bill :18080/1.0/kb/{path}
```

Spring Boot injects KB basic auth (`admin`/`password`) server-side. React only sends JWT + tenant headers.

### Tenant Headers (per-request)
```
X-Killbill-ApiKey: <tenant api key>
X-Killbill-ApiSecret: <tenant api secret>
X-Killbill-CreatedBy: <username>
```

## Key Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/accounts` | GET/POST | Customer accounts |
| `/subscriptions` | POST | Create subscription |
| `/subscriptions/{id}` | DELETE | Cancel subscription |
| `/invoices/{id}` | GET | Get invoice with items |
| `/invoices/{id}/payments` | POST | Pay invoice |
| `/accounts/{id}/payments` | GET | List payments |
| `/catalog` | GET | Current catalog |
| `/catalog/xml` | POST | Upload new catalog |
| `/tenants` | POST | Create tenant |

## Multi-Tenancy
- Each Kill Bill tenant maps to an Odoo company
- Tenant selection in React UI via dropdown in TopBar
- API key/secret stored in Odoo `res.company` fields

## Odoo Integration (kb_integration module)
- Partner verification → auto-sync to KB account
- Product catalog → XML generation and upload
- Invoice/payment data flows back to Odoo accounting
- PG NOTIFY trigger on `kb_sync_log` for real-time sync

## Detailed Docs
See [../kill-bill-integration/](../kill-bill-integration/) for the full 11-doc integration spec.
