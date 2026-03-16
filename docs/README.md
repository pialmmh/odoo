# Project Documentation

## Architecture & Integration
- [kill-bill-integration/](kill-bill-integration/) — 11 docs covering full Odoo + Kill Bill architecture, sync flows, API reference, module specs

## Key Documents
| Doc | Description |
|-----|-------------|
| [00-README](kill-bill-integration/00-README.md) | Documentation index with all paths |
| [01-goals-and-progress](kill-bill-integration/01-goals-and-progress.md) | Roadmap, what's done, what's next |
| [02-architecture](kill-bill-integration/02-architecture.md) | System architecture, PG NOTIFY sync, responsibility matrix |
| [03-killbill-operations](kill-bill-integration/03-killbill-operations.md) | Kill Bill build, start, stop, tenant management |
| [04-killbill-api-reference](kill-bill-integration/04-killbill-api-reference.md) | KB REST API endpoints, headers, payloads |
| [05-odoo-setup-status](kill-bill-integration/05-odoo-setup-status.md) | Odoo install state, modules, products |
| [06-multi-tenancy](kill-bill-integration/06-multi-tenancy.md) | KB tenant ↔ Odoo company mapping |
| [07-kb-integration-module](kill-bill-integration/07-kb-integration-module.md) | kb_integration module spec |
| [08-catalog-sync](kill-bill-integration/08-catalog-sync.md) | Product → KB catalog XML generation |
| [09-sync-service](kill-bill-integration/09-sync-service.md) | PG NOTIFY sync architecture |
| [10-accounting-config](kill-bill-integration/10-accounting-config.md) | Chart of accounts, journals, tax, fiscal year |
| [11-odoo-modules](kill-bill-integration/11-odoo-modules.md) | Allowed/banned modules, OCA alternatives |

## Database
See [../db/](../db/) for database setup scripts and schemas.

## Setup Scripts
See [../scripts/](../scripts/) for product catalog, pricing, tax, and GL setup scripts.
