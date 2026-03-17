# Telcobright Platform Documentation

ISP/Telecom billing and infrastructure management platform.

## Documentation Index

| Section | Description |
|---------|-------------|
| [Platform Overview](./platform-overview.md) | Architecture, services, ports, quick start |
| [Odoo Backend](./odoo/) | Custom modules, models, ORM patterns |
| [Kill Bill](./killbill/) | Billing engine, catalog, subscriptions |
| [Keycloak](./keycloak/) | Authentication, realm config, JWT flow |
| [API Gateway](./api-gateway/) | Spring Boot proxy, endpoints, security |
| [Infrastructure](./infra/) | Infra management, SSH, device catalog, Vault |
| [Artifacts](./artifacts/) | Software registry, deploy pipelines |
| [Integration](./integration/) | Cross-service flows, data model relationships |
| [Kill Bill Integration (legacy)](./kill-bill-integration/) | Original 11-doc KB integration spec |

## Service Map

```
React UI (:5180)
    │ JWT (Keycloak)
    ▼
Spring Boot API (:8180)
    ├── Odoo (:7169)        — billing data, infra, artifacts
    ├── Kill Bill (:18080)  — subscriptions, invoices, payments
    └── Vault (:8200)       — SSH keys (via Odoo)

Keycloak (:7104)            — user authentication
PostgreSQL (:5433)          — Odoo database
MySQL (:3306)               — Kill Bill database
```

## Database
See [../db/](../db/) for database setup scripts and schemas.

## Setup Scripts
See [../scripts/](../scripts/) for product catalog, pricing, tax, and GL setup scripts.
