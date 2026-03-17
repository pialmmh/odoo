# Infrastructure Management Module

## Module: `infra_management`
Depends on: `base`, `contacts`
Location: `odoo-backend/custom-addons/infra_management/`

## Entity Hierarchy

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
                └── IP Address (infra.ip.address) — polymorphic
```

## Models (16 total)

### Core Topology (5)
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `infra.region` | name, code (unique), geographic_area, status | Top-level geographic grouping |
| `infra.availability.zone` | name, code (unique), region_id, zone_type, is_default | Zone within region |
| `infra.datacenter` | name, zone_id, dc_type, tier, partner_id, lat/lng | Physical/logical DC |
| `infra.resource.pool` | name, pool_type, datacenter_id, cpu/mem/storage totals | Compute resource pool |
| `infra.networking` | name, network_type (vlan/vxlan/bridge), cidr, vlan_id, gateway | Network config |

### Equipment (4)
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `infra.compute` | name, hostname, node_type (server/vm), datacenter_id, cpu/mem/disk, management_ip | Servers and VMs |
| `infra.container` | name, container_type (lxc/docker/...), image, compute_id, cpu/memory_limit | Containers on computes |
| `infra.network.device` | name, device_model_id, device_attribute_ids (M2M), management_ip, firmware | Routers/switches |
| `infra.storage` | name, storage_type (san/nas/local), capacity_gb, protocol | Storage devices |

### Catalog (3)
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `infra.device.attribute` | name, code (unique), category (role/capability/protocol) | Device role tags |
| `infra.device.model` | name, vendor, device_type, default_attribute_ids, port/cpu/memory specs | Equipment catalog |
| `infra.ip.address` | ip_address, ip_type, compute_id OR network_device_id OR container_id | Polymorphic IP assignment |

### SSH & Vault (4)
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `infra.ssh.key` | name, algorithm, key_storage (local/vault), private_key/vault_path, public_key, fingerprint | Key pair management |
| `infra.ssh.credential` | name, host, port, username, server_type, key_id, deploy_status, compute_id/network_device_id | Server SSH config |
| `infra.vault.config` | vault_url, vault_token, vault_mount, vault_ssh_key_prefix, is_active | Vault connection settings |

## SSH Operations (via paramiko)
- **Generate key**: `infra.ssh.key.action_generate_key(name, algorithm)` — runs `ssh-keygen`, stores in Odoo DB or Vault
- **Deploy key**: `infra.ssh.credential.action_deploy_key()` — pushes public key to server (needs one-time password)
- **Verify key**: `infra.ssh.credential.action_verify_key()` — tests key-based auth
- **Execute command**: `infra.ssh.credential.action_exec_command(cmd)` — runs command remotely
- **Migrate to Vault**: `infra.ssh.key.action_migrate_to_vault()` — moves key from Odoo DB to Vault

## Seed Data
- 9 device attributes: Access Gateway (PPPoE), Core Router, Edge Router, Distribution Switch, Access Switch, Firewall, Load Balancer, Wireless Controller, OLT
- 9 MikroTik device models with specs and default role assignments

## Data Management Scripts
```bash
cd odoo-backend/custom-addons/infra_management
python seed/manage.py load|clean|reload    # Device attributes + models
python demo/manage.py load|clean|reload    # Sample regions, DCs, computes
```

## React UI Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/infra` | InfraMain | Split pane: tree (left) + detail/list (right) |
| `/infra/catalog` | InfraDeviceCatalog | Device model CRUD |
| `/infra/ssh` | InfraSSH | SSH keys + credentials + deploy/verify/exec |

## Tree Features
- Click any node → detail card in right pane (region, zone, DC, compute, container, device)
- Click category node (Computes, Network Devices) → list table in right pane
- Right-click → context menu to add child (region>zone, zone>DC, DC>compute/device, compute>container)
- Computes show child containers as expandable sub-nodes
- Network devices shown as child nodes under DC

## Imported Inventories
- **BTCL**: 12 servers (SBC containers, Kafka cluster, SMS servers) imported from routesphere ssh-automation
