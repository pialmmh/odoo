# Kill Bill Operations Guide

## Location

`/home/mustafa/telcobright-projects/odoo/killbill-billing/`

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Billing Engine | Kill Bill 0.24.16 (Java, Apache 2.0) |
| Build | Maven 3.9+ |
| JDK | **17** (Kill Bill requires JDK 11-17) |
| JAVA_HOME | `/home/mustafa/.sdkman/candidates/java/17.0.16-librca` |
| Database | MySQL `127.0.0.1:3306`, database: `killbill`, user: `root`, password: `123456` |
| Server | Embedded Jetty (via Maven plugin) |
| Custom UI | React + Vite, port 5180 |

**IMPORTANT**: Kill Bill uses JDK 17, NOT JDK 21. The `build.sh` and `start.sh` scripts set JAVA_HOME automatically.

## Project Structure

```
odoo/killbill-billing/
├── killbill-server/          # Kill Bill source (cloned v0.24.16)
│   ├── profiles/killbill/    # Server profile with embedded Jetty
│   ├── account/              # Account module
│   ├── invoice/              # Invoice module
│   ├── payment/              # Payment module
│   ├── subscription/         # Subscription module
│   ├── overdue/              # Overdue/dunning module
│   ├── catalog/              # Catalog module
│   └── pom.xml               # Root Maven POM
├── billing-ui/               # React UI (port 5180)
│   └── src/services/killbill.js  # KB API client (all endpoints)
├── catalogs/
│   ├── isp-catalog.xml       # Product catalog (8 products, 8 plans)
│   └── overdue-config.xml    # Dunning rules
├── killbill-server.properties  # Server config (port 18080, DB, etc.)
├── ddl.sql                   # Database schema DDL
├── build.sh                  # Build: ./build.sh or ./build.sh --quick
├── start.sh                  # Start: ./start.sh or ./start.sh --debug
├── reset-db.sh               # Drop and recreate database
├── setup-tenant.sh           # Create tenant + upload catalog + overdue config
└── test-api.sh               # Test subscription flow end-to-end
```

## Quick Start

```bash
cd /home/mustafa/telcobright-projects/odoo/killbill-billing

# 1. Build (first time, ~5 min)
./build.sh

# 2. Start Kill Bill on port 18080
./start.sh

# 3. In another terminal, create tenant and upload catalog
./setup-tenant.sh

# 4. Test the API
./test-api.sh
```

## Quick Rebuild

```bash
# Only changed modules (faster)
./build.sh --quick

# Restart
./start.sh
```

## Start with Debug

```bash
./start.sh --debug
# Debugger listens on port 18000
```

## Key Ports

| Service | Port |
|---------|------|
| Kill Bill API | 18080 |
| Kill Bill Debug | 18000 (with `--debug` flag) |
| React UI | 5180 |
| MySQL | 3306 |

## Server Configuration

File: `killbill-server.properties`

Key settings:
- `org.killbill.dao.url` = `jdbc:mysql://127.0.0.1:3306/killbill`
- `org.killbill.server.multitenant=true`
- `org.killbill.server.baseUrl=http://127.0.0.1:18080`
- Payment retry: 1, 3, 7 days
- Invoice safety: max 200 items/day
- Notification queue: STICKY_POLLING, 500ms sleep

## First Tenant

| Field | Value |
|-------|-------|
| API Key | `telcobright-isp` |
| API Secret | `telcobright-isp-secret` |
| External Key | `telcobright-isp` |
| Auth | `admin:password` (Kill Bill default) |

Created by `setup-tenant.sh` which also uploads the catalog and overdue config.

## Current Catalog (8 products, 8 plans)

| Product | Plan Name | Price (BDT/mo) | Category |
|---------|-----------|-----------------|----------|
| Internet-100Mbps | internet-100mbps-monthly | 1,200 | BASE |
| Internet-50Mbps | internet-50mbps-monthly | 800 | BASE |
| Internet-200Mbps | internet-200mbps-monthly | 1,800 | BASE |
| HostedPBX | hosted-pbx-monthly | 1,200 | BASE |
| VoiceBroadcast | voice-broadcast-monthly | 1,800 | BASE |
| ContactCenter | contact-center-monthly | 850 | BASE |
| BulkSMS | bulk-sms-monthly | 500 | BASE |
| StaticIP | static-ip-monthly | 300 | ADD_ON |

All plans are MONTHLY, EVERGREEN (no trial phase), IN_ADVANCE billing, currency BDT.

## Overdue/Dunning Policy

| Days Unpaid | State | Action |
|-------------|-------|--------|
| 7 | WARNING | Notification sent, service still active |
| 14 | SUSPENDED | Service blocked (entitlement disabled) |
| 30 | DISCONNECTED | Full disconnect, changes blocked |
| Payment received | CLEAR | Auto-restores to good standing |

## Tenant Management

### Create a new tenant
```bash
curl -X POST "http://localhost:18080/1.0/kb/tenants" \
  -u admin:password \
  -H "Content-Type: application/json" \
  -H "X-Killbill-CreatedBy: admin" \
  -d '{
    "apiKey": "new-tenant-key",
    "apiSecret": "new-tenant-secret",
    "externalKey": "new-tenant"
  }'
```

### Upload catalog to a tenant
```bash
curl -X POST "http://localhost:18080/1.0/kb/catalog/xml" \
  -u admin:password \
  -H "Content-Type: text/xml" \
  -H "X-Killbill-ApiKey: new-tenant-key" \
  -H "X-Killbill-ApiSecret: new-tenant-secret" \
  -H "X-Killbill-CreatedBy: admin" \
  -d @catalogs/isp-catalog.xml
```

### Upload overdue config to a tenant
```bash
curl -X POST "http://localhost:18080/1.0/kb/overdue/xml" \
  -u admin:password \
  -H "Content-Type: text/xml" \
  -H "X-Killbill-ApiKey: new-tenant-key" \
  -H "X-Killbill-ApiSecret: new-tenant-secret" \
  -H "X-Killbill-CreatedBy: admin" \
  -d @catalogs/overdue-config.xml
```

### Register webhook for a tenant
```bash
curl -X POST "http://localhost:18080/1.0/kb/tenants/registerNotificationCallback" \
  -u admin:password \
  -H "X-Killbill-ApiKey: telcobright-isp" \
  -H "X-Killbill-ApiSecret: telcobright-isp-secret" \
  -H "X-Killbill-CreatedBy: admin" \
  -H "Content-Type: application/json" \
  -d '"http://localhost:8900/webhook/kb"'
```

## Database

MySQL on `127.0.0.1:3306`:
```bash
mysql -h 127.0.0.1 -P 3306 -u root -p123456 killbill
```

Reset (drop & recreate):
```bash
./reset-db.sh
```

## React UI

```bash
cd billing-ui
npm install
npm run dev
# → http://localhost:5180
```

UI pages: Dashboard, Customers, Customer Detail, Subscriptions, Invoices, Payments, Catalog, AR Report, Tenants.
