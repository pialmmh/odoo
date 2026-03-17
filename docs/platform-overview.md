# Platform Overview

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React UI (:5180)                      │
│  Billing | Infra | SSH | Artifacts | Device Catalog          │
└──────────────────────────┬──────────────────────────────────┘
                           │ Keycloak JWT
┌──────────────────────────▼──────────────────────────────────┐
│              Spring Boot API Gateway (:8180)                  │
│  /api/odoo/* → Odoo XML-RPC    /api/kb/* → Kill Bill REST    │
│  JWT validation via Keycloak    Service creds in config       │
└────────┬─────────────────┬──────────────────┬───────────────┘
         │                 │                  │
┌────────▼───────┐ ┌──────▼───────┐ ┌────────▼────────┐
│  Odoo (:7169)  │ │ Kill Bill    │ │ Vault/OpenBao   │
│  PostgreSQL    │ │ (:18080)     │ │ (:8200)         │
│  :5433         │ │ MySQL :3306  │ │ SSH key storage │
└────────────────┘ └──────────────┘ └─────────────────┘
         │
┌────────▼───────┐
│ Keycloak       │
│ (:7104)        │
│ Realm:         │
│ telcobright    │
└────────────────┘
```

## Directory Layout

```
odoo/                          # Repository root
├── api/                       # Spring Boot API gateway
│   ├── pom.xml
│   └── src/main/java/com/telcobright/api/
│       ├── controller/        # OdooProxyController, KillBillProxyController
│       ├── odoo/              # OdooClient (generic XML-RPC)
│       └── config/            # Properties, SecurityConfig
├── odoo-backend/              # Odoo server
│   ├── odoo-src/              # Odoo 17 source (gitignored)
│   ├── custom-addons/
│   │   ├── kb_integration/    # Kill Bill billing module (14 models)
│   │   ├── infra_management/  # Infrastructure module (16 models)
│   │   └── artifact_management/ # Artifact deploy module (7 models)
│   ├── odoo.conf
│   ├── start-odoo.sh
│   └── venv/                  # Python virtualenv (gitignored)
├── killbill/                  # Kill Bill server
│   ├── killbill-server/       # KB source (gitignored)
│   ├── catalogs/              # ISP catalog XML
│   └── start.sh
├── ui/                        # React frontend
│   ├── src/
│   │   ├── services/          # API clients (odoo.js, killbill.js, infra.js, artifacts.js, keycloak.js)
│   │   ├── pages/             # Page components
│   │   ├── context/           # AuthContext, ThemeContext
│   │   └── theme/             # Theme definitions (btcl, telcobright)
│   ├── tests/                 # Playwright smoke tests
│   └── vite.config.js
├── db/                        # Database setup scripts
├── scripts/                   # Utility scripts
└── docs/                      # This documentation
```

## Ports

| Port | Service | Protocol |
|------|---------|----------|
| 5180 | React UI (Vite dev) | HTTP |
| 7104 | Keycloak | HTTP |
| 7169 | Odoo | HTTP/JSON-RPC |
| 8180 | Spring Boot API | HTTP/REST |
| 8200 | Vault/OpenBao | HTTP |
| 18080 | Kill Bill | HTTP/REST |
| 3306 | MySQL (Kill Bill) | TCP |
| 5433 | PostgreSQL (Odoo) | TCP |

## Quick Start

```bash
# 1. Odoo
cd odoo-backend && ./start-odoo.sh &

# 2. Spring Boot API
cd api && java -jar target/platform-api-1.0-SNAPSHOT.jar &

# 3. React UI
cd ui && npx vite --port 5180 &

# 4. Keycloak (optional — legacy auth works without it)
export KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin
/opt/keycloak/bin/kc.sh start-dev --http-port=7104 &

# 5. Vault (optional — needed only for vault-stored SSH keys)
cd /home/mustafa/telcobright-projects/routesphere/vault
./start.sh --dev &

# 6. Kill Bill (optional — needed only for billing features)
cd killbill && ./start.sh &
```

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Backend ORM | Odoo | 17.0 |
| Billing Engine | Kill Bill | 0.24.16 |
| API Gateway | Spring Boot | 3.4.3 |
| Frontend | React + MUI | 19 + 7 |
| Build Tool | Vite | 8 |
| Auth | Keycloak | 24.0.5 |
| Secrets | OpenBao | 2.1.0 |
| SSH | paramiko | 4.0.0 |
| Database | PostgreSQL + MySQL | 5433 / 3306 |
| Java | JDK 21 | |
| Python | 3.12 | |
