# Odoo Setup Status

## Installation

| Setting | Value |
|---------|-------|
| Version | 17.0 Community (source install, NOT Enterprise) |
| Source | `/home/mustafa/telcobright-projects/odoo/odoo-src/` |
| Custom Addons | `/home/mustafa/telcobright-projects/odoo/custom-addons/` |
| Config | `/home/mustafa/telcobright-projects/odoo/odoo.conf` |
| Data/Filestore | `/home/mustafa/telcobright-projects/odoo/data/` |
| Python Venv | `/home/mustafa/telcobright-projects/odoo/venv/` |
| Start Script | `/home/mustafa/telcobright-projects/odoo/start-odoo.sh` |
| Log | `/home/mustafa/telcobright-projects/odoo/odoo.log` |
| HTTP Port | 7169 |
| Database | `odoo_billing` (PostgreSQL 16, port 5433) |
| DB User | `mustafa` (superuser, peer auth, no password) |
| Admin Login | `admin` / `admin` |

## Start/Stop

```bash
cd /home/mustafa/telcobright-projects/odoo

# Start
./start-odoo.sh

# Or manually
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d odoo_billing

# Stop
kill $(pgrep -f odoo-bin)
```

## PostgreSQL

- Port **5433** (not 5432)
- Config: `/etc/postgresql/16/main/conf.d/odoo_minimal.conf`
- max_connections=20, shared_buffers=64MB

## Installed Modules

| Module | Purpose |
|--------|---------|
| `base`, `contacts` | Partner/customer management |
| `account`, `account_payment` | Invoicing, accounting, payments |
| `l10n_bd` | Bangladesh fiscal localization (chart of accounts, BDT) |
| `sale_management` | Sales orders, quotations |
| `mail` | Email integration |
| `portal` | Customer self-service portal |
| `spreadsheet_dashboard` | Dashboards |
| `product` | Product catalog (auto-dependency) |

Total: 54 modules (including auto-resolved dependencies).

## Product Catalog (already created)

### Product Categories
- Internet Services > Bandwidth Plans
- Internet Services > Dedicated Internet
- SMS Services
- Voice Services
- Value Added Services

### Product Attributes
1. **Bandwidth** (radio): 10, 25, 50, 100, 200, 500 Mbps, 1 Gbps
2. **Billing Cycle** (select): Monthly, Quarterly, Yearly
3. **SMS Package** (radio): 10K, 50K, 100K, 500K, 1M SMS

### Products with Variants
| Product | Variants | Combos |
|---------|----------|--------|
| Shared Internet | 21 | 7 bandwidths × 3 billing cycles |
| Dedicated Internet Access (DIA) | 21 | 7 bandwidths × 3 billing cycles |
| Bulk SMS | 5 | 5 SMS package sizes |

### Sample Pricing (BDT)
**Shared Internet Monthly**: 10Mbps=3,000 | 25Mbps=6,000 | 50Mbps=10,000 | 100Mbps=18,000 | 200Mbps=30,000 | 500Mbps=60,000 | 1Gbps=100,000

**DIA**: ~2.5x shared pricing

**Bulk SMS**: 10K=4,000 | 50K=18,000 | 100K=32,000 | 500K=140,000 | 1M=250,000

### Simple Service Products (no variants)
IPLC=50,000 | IP Transit=25,000 | Colocation=15,000 | Domain & Hosting=2,000 | VoIP=5,000 | MPLS VPN=30,000

### Setup Script
`/home/mustafa/telcobright-projects/odoo/setup_products.py` — creates all categories, attributes, products, and variant prices via XML-RPC. Idempotent (safe to re-run).

## XML-RPC API

```
Auth:   http://localhost:7169/xmlrpc/2/common → authenticate(db, user, pass, {})
Models: http://localhost:7169/xmlrpc/2/object → execute_kw(db, uid, pass, model, method, args, kwargs)
```

Database: `odoo_billing`, User: `admin`, Password: `admin`

## NOT Yet Configured

1. `kb_integration` custom module (custom fields for KB integration)
2. Multi-company setup (single default company)
3. Payment journals (bKash, Nagad, Rocket, etc.)
4. 15% VAT tax
5. Payment terms (Net 7/15/30)
6. Fiscal year (July-June)
7. KB fields on existing products
