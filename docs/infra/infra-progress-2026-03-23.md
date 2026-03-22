# Infrastructure Management Module — Progress (2026-03-23)

## Overview

The `infra_management` Odoo module and corresponding React UI were implemented to manage ISP/telecom infrastructure (datacenters, servers, routers, networking) alongside the existing billing system (Odoo + Kill Bill).

## What Was Built

### Odoo Backend: `infra_management` module

**Location**: `/home/mustafa/telcobright-projects/odoo/odoo-backend/custom-addons/infra_management/`

**14 models total**:

| Model | Purpose |
|-------|---------|
| `infra.region` | Geographic region (e.g. Dhaka, Chittagong) |
| `infra.availability.zone` | Zone within region (e.g. DK-AZ1) |
| `infra.datacenter` | Physical/logical DC with partner link |
| `infra.resource.pool` | Compute/storage pools with capacity tracking |
| `infra.compute` | Physical servers and VMs |
| `infra.container` | LXC/Docker/K8s containers on compute nodes |
| `infra.network.device` | Routers, switches, firewalls with model + role M2M |
| `infra.storage` | SAN/NAS/local/object storage |
| `infra.networking` | VLAN/VXLAN/bridge configurations |
| `infra.ip.address` | Polymorphic IP assignment (compute/device/container) |
| `infra.device.attribute` | Device role tags (9 seeded: PPPoE, Core Router, etc.) |
| `infra.device.model` | Equipment catalog (9 MikroTik models seeded) |
| `infra.ssh.key` | SSH key pair generation and storage |
| `infra.ssh.credential` | Server SSH credentials with deploy/verify/exec |

**Security**: 28 access rules (14 models × 2 groups: admin + user)

**Seed data**:
- 9 device role attributes (Access Gateway PPPoE, Core Router, Edge Router, Distribution Switch, Access Switch, Firewall, Load Balancer, Wireless Controller, OLT)
- 9 MikroTik device models (CCR1036, CCR2004, CCR2116, RB4011, hAP ac3, RB5009, CRS326, CRS354, CSS610) with specs and default roles

**Key backend features**:
- SSH key generation via `ssh-keygen` subprocess (ED25519, RSA, ECDSA)
- Key deployment to Linux servers via paramiko (password → authorized_keys)
- MikroTik key deployment (SFTP upload + RouterOS import command)
- Key verification (test key-based auth)
- Remote command execution via SSH
- OS-specific setup script generation (Ubuntu, Debian, RHEL, CentOS, macOS, Windows PowerShell)
- Setup scripts embed the private key inline with proper permissions
- Configurable SSH port (default 22)

### React Frontend

**Location**: `/home/mustafa/telcobright-projects/odoo/ui/src/`

**Routes**:
| Path | Page | Description |
|------|------|-------------|
| `/:tenant/infra` | `InfraMain.jsx` | Split pane: tree (left) + detail table (right) |
| `/:tenant/infra/catalog` | `InfraDeviceCatalog.jsx` | Device model catalog CRUD |
| `/:tenant/infra/ssh` | `InfraSSH.jsx` | SSH key generation, credentials, deploy, verify, exec |
| `/:tenant/rbac` | `RBACManagement.jsx` | RBAC permissions, roles, URL patterns CRUD |

**Key UI components**:
- `InfraTree.jsx` — MUI TreeView: Region → Zone → DC → entity type (computes/devices/storage/networks)
- `InfraDetailPane.jsx` — Dynamic table per entity type with CRUD + Setup SSH dialog
- `InfraEntityModal.jsx` — Tabbed create/edit dialogs for regions, zones, DCs, devices, computes
- `InfraSSH.jsx` — Two tabs: SSH Keys (generate/download/setup script) + Credentials (add/deploy/verify/exec)

**Theme system** (`src/theme/themes.js`):
- `btcl` theme (green primary: #00A651)
- `telcobright` theme (blue primary: #1565C0)
- Brand color tokens for sidebar, infra tree badges
- Theme switcher in top bar, persisted to localStorage

**Sidebar** (`src/layouts/Sidebar.jsx`):
- Organized into sections: Billing, Infrastructure, Artifacts, Admin
- Section headers auto-hidden when all items are RBAC-hidden
- RBAC-aware via `canMenu()` hook

### Demo Data Loaded

3 regions (Dhaka, Chittagong, Sylhet), 4 zones, 5 datacenters, 6 computes, 4 containers, 9 network devices, 3 storage, 5 networks, 10 IP addresses — all linked with proper hierarchy.

### Services/API Layer

- `src/services/infra.js` — Full CRUD for all 14 infra models + SSH operations
- `src/services/rbac.js` — CRUD for RBAC permissions, roles, URL patterns

### RBAC Integration

- Odoo module: `rbac_management` (pre-existing) with `rbac.role`, `rbac.permission`, `rbac.url.pattern`
- React RBAC page at `/rbac` for managing roles → permissions → URL patterns
- RBAC menu entry requires `user:manage` permission (super_admin only)
- Static fallback config in `src/config/rbac.js`

## Architecture

```
React UI (:5180)
  ↓ Vite proxy /api → APISIX (:9080)
    ↓ JWT validation via Keycloak (:7104)
      ↓ Spring Boot API (:8180) → Odoo XML-RPC (:7169)
                                → Kill Bill REST (:18080)
```

- Keycloak: authentication + realm roles
- APISIX: JWT enforcement at gateway level
- Odoo: data storage (infra, RBAC, partners, products)
- Kill Bill: subscription/invoice/payment engine
- Spring Boot: API proxy bridging JWT to Odoo/KB auth

## Platform Config

| Service | Port | Purpose |
|---------|------|---------|
| React UI | 5180 | Frontend (Vite dev server) |
| Odoo | 7169 | Backend ERP |
| Keycloak | 7104 | Auth (SSO, RBAC roles) |
| Spring Boot API | 8180 | API gateway backend |
| APISIX | 9080 | API gateway (routes, OIDC) |
| Kill Bill | 18080 | Billing engine |
| PostgreSQL | 5433 | Odoo database |
| MySQL | 3306 | Kill Bill database |
| etcd | 2379 | APISIX config store |
| Vault | 8200 | Secrets (SSH keys with vault storage) |

**Start all**: `./launch-all.sh`
**APISIX routes setup**: `./apisix/setup-routes.sh` (run after APISIX restart if etcd data lost)

## Tenant Mapping

| Odoo Partner ID | Slug | Name |
|-----------------|------|------|
| 1 | telcobright | Telcobright ISP |
| 8 | btcl | BTCL |
| 7 | abc-isp | ABC ISP Limited |

KB tenant API key/secret is on `res.company` (ID 1): `telcobright-isp` / `telcobright-isp-secret`

## Files Changed (Git)

Last commit: `8bbb270` — Add RBAC UI, categorized sidebar, SSH setup scripts with port config

Key files to continue from:
- `odoo-backend/custom-addons/infra_management/` — Full module
- `odoo-backend/custom-addons/rbac_management/` — RBAC module
- `ui/src/pages/infra/` — All infra UI pages
- `ui/src/pages/RBACManagement.jsx` — RBAC UI
- `ui/src/services/infra.js` — Infra API service
- `ui/src/services/rbac.js` — RBAC API service
- `ui/src/theme/themes.js` — Theme definitions
- `ui/src/context/ThemeContext.jsx` — Theme switching
- `ui/src/layouts/Sidebar.jsx` — Categorized sidebar
- `ui/src/config/platform.js` — Tenant slugs, ports, auth config
- `ui/src/config/rbac.js` — Static RBAC fallback config

## Next Steps (Planned)

1. Subscription & billing flow — create 100Mbps internet subscription for BTCL partner with OTC + monthly recurring
2. Purchase UI for admin to buy on behalf of partner
3. MikroTik PPPoE user provisioning from KB subscription events
4. SSLCommerz payment gateway integration
5. Email notifications (invoice, payment receipt, overdue)
