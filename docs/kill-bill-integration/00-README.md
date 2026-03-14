# Kill Bill Integration — Documentation Index

This directory contains everything needed to develop, integrate, and operate the Odoo + Kill Bill billing platform. All data sync between the two systems flows through **Apache Kafka** topics for guaranteed delivery and eventual consistency — no direct API calls between Odoo and Kill Bill.

## Documents

| # | File | Scope |
|---|------|-------|
| 01 | [goals-and-progress.md](01-goals-and-progress.md) | Project goals, what's done, what's next, step-by-step roadmap |
| 02 | [architecture.md](02-architecture.md) | System architecture, responsibility matrix, design principles |
| 03 | [killbill-operations.md](03-killbill-operations.md) | Kill Bill: how to build, start, stop, configure, manage tenants |
| 04 | [killbill-api-reference.md](04-killbill-api-reference.md) | Kill Bill REST API: all endpoints, headers, payloads, examples |
| 05 | [odoo-setup-status.md](05-odoo-setup-status.md) | Odoo: current install state, modules, products, connection details |
| 06 | [multi-tenancy.md](06-multi-tenancy.md) | Multi-tenancy design: KB tenant ↔ Odoo company mapping |
| 07 | [kb-integration-module.md](07-kb-integration-module.md) | `kb_integration` Odoo module: fields, models, views, security |
| 08 | [catalog-sync.md](08-catalog-sync.md) | Odoo product → KB catalog XML generation and upload |
| 09 | [sync-service.md](09-sync-service.md) | Kafka-based sync: topics, event schemas, consumer services, webhook relay |
| 10 | [accounting-config.md](10-accounting-config.md) | Chart of accounts, journals, tax, payment terms, fiscal year |
| 11 | [odoo-modules.md](11-odoo-modules.md) | Allowed/banned Odoo modules, OCA alternatives |

## Key Paths

| Resource | Path |
|----------|------|
| Odoo source | `/home/mustafa/telcobright-projects/odoo/odoo-src/` |
| Odoo config | `/home/mustafa/telcobright-projects/odoo/odoo.conf` |
| Odoo custom addons | `/home/mustafa/telcobright-projects/odoo/custom-addons/` |
| Odoo venv | `/home/mustafa/telcobright-projects/odoo/venv/` |
| Odoo start script | `/home/mustafa/telcobright-projects/odoo/start-odoo.sh` |
| Odoo product setup | `/home/mustafa/telcobright-projects/odoo/setup_products.py` |
| Kill Bill project | `/home/mustafa/telcobright-projects/odoo/killbill-billing/` |
| KB catalog XML | `/home/mustafa/telcobright-projects/odoo/killbill-billing/catalogs/isp-catalog.xml` |
| KB overdue config | `/home/mustafa/telcobright-projects/odoo/killbill-billing/catalogs/overdue-config.xml` |
| KB server properties | `/home/mustafa/telcobright-projects/odoo/killbill-billing/killbill-server.properties` |
| KB UI (React) | `/home/mustafa/telcobright-projects/odoo/killbill-billing/billing-ui/` |
| KB API client (JS) | `/home/mustafa/telcobright-projects/odoo/killbill-billing/billing-ui/src/services/killbill.js` |
| Sync service (future) | `/home/mustafa/telcobright-projects/odoo-kb-sync/` |
| — KB consumer | `/home/mustafa/telcobright-projects/odoo-kb-sync/kb-consumer/` |
| — Odoo consumer | `/home/mustafa/telcobright-projects/odoo-kb-sync/odoo-consumer/` |
| — KB webhook relay | `/home/mustafa/telcobright-projects/odoo-kb-sync/kb-webhook-relay/` |
