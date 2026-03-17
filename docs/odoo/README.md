# Odoo Backend

## Overview
Odoo 17 serves as the ORM, admin UI, and business logic layer. Three custom modules handle billing integration, infrastructure management, and artifact deployment.

## Configuration
- Config: `odoo-backend/odoo.conf`
- Port: 7169
- Database: `odoo_billing` on PostgreSQL :5433 (user: mustafa)
- Addons: `odoo-backend/custom-addons/`
- Start: `cd odoo-backend && ./start-odoo.sh`

## Module Install/Upgrade
```bash
cd odoo-backend
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d odoo_billing -i module_name --stop-after-init --no-http  # install
./venv/bin/python odoo-src/odoo-bin -c odoo.conf -d odoo_billing -u module_name --stop-after-init --no-http  # upgrade
```

## Custom Modules

### 1. kb_integration (14 models)
Kill Bill billing integration. Extends `res.partner`, `product.template`, `account.move` etc.
- Partner → KB account sync (PG NOTIFY queue)
- Product catalog → KB XML generation
- Invoice/payment sync
- Document management with separate DB
- Tax rate history with gazette references

Key models: `kb.sync.log`, `product.tax.rate`, `product.rate.history`, `doc.document`, `doc.mapping`

### 2. infra_management (16 models)
Infrastructure and SSH management.
See [../infra/](../infra/) for full details.

### 3. artifact_management (7 models)
Software artifact registry and deployment pipelines.
See [../artifacts/](../artifacts/) for full details.

## ORM Patterns

### Model definition
```python
class InfraRegion(models.Model):
    _name = 'infra.region'           # dot-separated model name
    _description = 'Region'
    _order = 'name'

    name = fields.Char(required=True, index=True)
    status = fields.Selection([('active', 'Active'), ('inactive', 'Inactive')])
    zone_ids = fields.One2many('infra.availability.zone', 'region_id')
```

### Naming conventions
| Concept | Convention | Example |
|---------|-----------|---------|
| Model name | dot.separated | `infra.region` |
| Python class | PascalCase | `InfraRegion` |
| DB table | underscored | `infra_region` |
| View XML ID | `view_{model}_{type}` | `view_infra_region_tree` |
| Access rule ID | `access_{model}_{group}` | `access_infra_region_admin` |

### Security (ir.model.access.csv)
```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_infra_region_admin,infra.region admin,model_infra_region,base.group_system,1,1,1,1
access_infra_region_user,infra.region user,model_infra_region,base.group_user,1,1,1,0
```

### API from React
All Odoo model methods are callable via the Spring Boot proxy:
```
POST /api/odoo/{model}/{method}
Body: { "args": [...], "kwargs": {...} }
Header: Authorization: Bearer <keycloak-jwt>
```
