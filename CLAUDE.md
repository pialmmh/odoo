# Odoo Infrastructure & Artifact Management

## Project Overview
This is a **git worktree** of the main Odoo billing project at `/home/mustafa/telcobright-projects/odoo`.
Branch: `odoo-infra` (branched from `main`).

**Purpose of this worktree**: Infrastructure management, artifact/deployment pipelines, SSH management, and device catalog work. The main branch (`/home/mustafa/telcobright-projects/odoo`) handles billing/subscription features.

### Merging workflow
- Work on `odoo-infra` branch in this worktree
- When ready, push and merge into `main`:
  ```bash
  git push origin odoo-infra
  # Then from main worktree or PR:
  git checkout main && git merge odoo-infra
  ```

## Architecture

### Tech Stack
| Component | Technology |
|-----------|-----------|
| Backend | Odoo 17 (Python), PostgreSQL on port 5433 |
| Frontend | React 19 + MUI 7 + Vite 8, port 5180 |
| Billing Engine | Kill Bill 0.24.16 (Java), port 18080 |
| SSH Operations | paramiko (Python) |

### Directory Layout
```
odoo/                              # (or odoo-infra/ worktree)
├── odoo-src/                      # Odoo 17 source
├── custom-addons/
│   ├── kb_integration/            # Kill Bill billing integration (14 models)
│   ├── infra_management/          # Infrastructure management (14 models)
│   └── artifact_management/       # Artifact & deploy pipelines (7 models)
├── killbill-billing/
│   └── billing-ui/                # React frontend (Vite)
│       ├── src/services/odoo.js   # Odoo RPC client (exports `call()`)
│       ├── src/services/infra.js  # Infra API functions
│       ├── src/services/artifacts.js # Artifact API functions
│       ├── src/pages/infra/       # Infrastructure UI pages
│       ├── src/pages/artifacts/   # Artifact/deploy UI pages
│       ├── src/context/ThemeContext.jsx # Theme system (btcl/telcobright)
│       └── src/theme/themes.js    # Theme definitions
├── odoo.conf                      # Odoo config (port 7169, pg port 5433)
├── start-odoo.sh                  # Start Odoo server
└── venv/                          # Python virtualenv
```

### Starting Services
```bash
# Odoo (port 7169)
cd /home/mustafa/telcobright-projects/odoo-infra
./start-odoo.sh

# React dev server (port 5180, proxies /odoo -> localhost:7169)
cd killbill-billing/billing-ui
npm run dev

# Kill Bill (port 18080) — only needed for billing features
cd killbill-billing && ./start.sh
```

### Module Install/Upgrade
```bash
# Install new module
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d odoo_billing -i module_name --stop-after-init --no-http

# Upgrade existing module after model changes
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d odoo_billing -u module_name --stop-after-init --no-http
```

## Module: infra_management (14 models)

### Entity Hierarchy
```
Partner (res.partner)
└── Region (infra.region)
    └── Availability Zone (infra.availability.zone)
        └── Datacenter (infra.datacenter)
            ├── Resource Pool (infra.resource.pool)
            │   └── Compute (infra.compute) — servers/VMs
            │       └── Container (infra.container) — LXC/Docker
            ├── Network Device (infra.network.device) — routers/switches
            ├── Storage (infra.storage) — SAN/NAS
            └── Networking (infra.networking) — VLAN/bridge
                └── IP Address (infra.ip.address) — polymorphic assignment
```

### Additional Models
- **infra.device.attribute** — Device role tags (9 seeded: Access Gateway PPPoE, Core Router, etc.)
- **infra.device.model** — Equipment catalog (9 MikroTik models seeded)
- **infra.ssh.key** — SSH key pairs (generate via ssh-keygen, stored as binary)
- **infra.ssh.credential** — Server SSH configs with deploy/verify/exec via paramiko

### Data Management
```bash
# Seed data (device attributes + MikroTik models)
cd custom-addons/infra_management
python seed/manage.py load|clean|reload

# Demo data (regions, DCs, computes, devices, networks)
python demo/manage.py load|clean|reload
```

### React UI Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/infra` | InfraMain.jsx | Split pane: tree (Region→Zone→DC→entity) + detail table |
| `/infra/catalog` | InfraDeviceCatalog.jsx | Device model CRUD (MikroTik catalog) |
| `/infra/ssh` | InfraSSH.jsx | SSH key generation, credentials, deploy/verify/exec |

## Module: artifact_management (7 models)

### Models
- **artifact.project** — Software project registry (jar/docker/lxc type)
- **artifact.version** — Built versions with git tag/commit/checksum
- **artifact.deployment** — What version deployed where (links to infra.compute + infra.ssh.credential)
- **artifact.deploy.template** — Reusable deploy step sequences with {variable} placeholders
- **artifact.deploy.template.step** — Individual template step (ssh/local/sftp type)
- **artifact.deploy.pipeline** — Running/completed deploy execution (background thread with paramiko)
- **artifact.deploy.step** — Step execution record with stdout/stderr/exit_code

### Seed Data
- "RouteSphere JAR Deploy" template with 9 steps (stop, kill, backup, upload, install, version file, history, start, verify) — mirrors `remote-deploy-v2.sh` from routesphere project

### Pipeline Executor
- `artifact.deploy.pipeline.action_execute()` spawns a daemon thread with its own cursor
- Opens one paramiko SSH session, runs steps sequentially
- Commits after each step so frontend can poll progress
- Supports ssh (remote exec), local (subprocess), sftp (file upload) step types

### React UI Route
| Route | Component | Description |
|-------|-----------|-------------|
| `/artifacts` | ArtifactsMain.jsx | 3 tabs: Projects, Versions, Deployments + PipelineViewer |

## Theme System
- Two themes: `btcl` (green primary) and `telcobright` (blue primary)
- ThemeContext provides `useAppTheme()` hook with `brand` colors for sidebar, infra tree
- Theme switcher in TopBar, persisted to localStorage
- Defined in `src/theme/themes.js`

## Odoo Model Patterns
- Models use `fields.Selection`, `fields.Many2one`, `fields.One2many`, `fields.Many2many`
- Security: `ir.model.access.csv` with admin (group_system) + user (group_user) rows per model
- Views: XML with tree/form/search views + actions + menus
- Seed data: XML with `noupdate="1"` in `seed/` directory
- Naming: model `infra.region` → class `InfraRegion` → table `infra_region` → access ID `model_infra_region`

## React Frontend Patterns
- API calls via `call(model, method, args, kwargs)` from `services/odoo.js`
- Pages: functional components with `useState`/`useEffect`/`useCallback`
- Tables: MUI `Table` + `TablePagination` with search/filter
- Modals: MUI `Dialog` with `Grid`-based forms, save callback
- Notifications: `useNotification()` hook → `success()`, `error()`, `warn()`

## Key Integration Points (for future work)
- Deploy artifacts to infra computes via SSH credentials
- MikroTik PPPoE user provisioning from Kill Bill subscriptions (planned)
- Network device management from billing events (planned)

## Database
- Database: `odoo_billing` on PostgreSQL port 5433, user `mustafa`
- Separate `odoo_documents` DB for binary document storage (doc.document model)
- Kill Bill uses MySQL at 127.0.0.1:3306, database `killbill`, user root/123456

## Important Notes
- JDK 21 for routesphere/general projects, JDK 17 for Kill Bill only
- paramiko installed in Odoo venv for SSH operations
- `@mui/x-tree-view` installed for infra tree component
- Vite config has `optimizeDeps.include` for `@mui/x-tree-view` (Vite 8 compatibility)
