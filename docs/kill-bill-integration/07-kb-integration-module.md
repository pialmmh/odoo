# `kb_integration` Odoo Module Spec

## Location

`/home/mustafa/telcobright-projects/odoo/custom-addons/kb_integration/`

## File Structure

```
kb_integration/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   ├── res_company.py          # KB tenant fields (multi-tenancy mapping)
│   ├── res_partner.py          # KB account fields + verification
│   ├── product_template.py     # KB product name + category
│   ├── product_product.py      # KB plan name + billing period + trial
│   ├── account_move.py         # KB invoice ID
│   ├── account_payment.py      # KB payment ID
│   ├── sale_order_line.py      # KB subscription ID
│   └── kb_sync_log.py          # Sync operation tracking
├── views/
│   ├── res_company_views.xml   # KB tab on company form
│   ├── res_partner_views.xml   # KB tab on partner form
│   ├── product_views.xml       # KB fields on product forms
│   ├── account_move_views.xml  # KB invoice ID on invoice form
│   ├── account_payment_views.xml
│   ├── sale_order_views.xml    # KB subscription ID on SO lines
│   └── kb_sync_log_views.xml   # Sync log list/form/search + menu
├── security/
│   └── ir.model.access.csv
└── data/
    └── ir_sequence_data.xml    # Sequence for kb.sync.log (KB/SYNC/00001)
```

## `__manifest__.py`

```python
{
    'name': 'Kill Bill Integration',
    'version': '17.0.1.0.0',
    'category': 'Accounting',
    'summary': 'Kill Bill billing engine integration fields and sync tracking',
    'depends': ['base', 'contacts', 'account', 'sale_management', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'views/res_company_views.xml',
        'views/res_partner_views.xml',
        'views/product_views.xml',
        'views/account_move_views.xml',
        'views/account_payment_views.xml',
        'views/sale_order_views.xml',
        'views/kb_sync_log_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
```

## Custom Fields

### `res.company`
| Field | Type | Purpose |
|---|---|---|
| `x_kb_api_key` | Char | KB tenant API key (e.g. `telcobright-isp`) |
| `x_kb_api_secret` | Char | KB tenant API secret |
| `x_kb_tenant_id` | Char | KB tenant UUID (set after tenant creation) |

### `res.partner`
| Field | Type | Purpose |
|---|---|---|
| `x_external_key` | Char | KB `externalKey` (e.g. `ISP-001`) |
| `x_kb_account_id` | Char | KB accountId (UUID), set by sync |
| `x_nid_passport` | Char | National ID or passport number |
| `x_verification_status` | Selection | `pending`, `verified`, `rejected` |
| `x_document_attachment` | Binary | Uploaded NID/passport scan |
| `x_kb_balance` | Float | Current KB account balance |

### `product.template`
| Field | Type | Purpose |
|---|---|---|
| `x_kb_product_name` | Char | KB product name (e.g. `Internet-100Mbps`) |
| `x_kb_category` | Selection | `BASE` or `ADD_ON` |

### `product.product` (variants)
| Field | Type | Purpose |
|---|---|---|
| `x_kb_plan_name` | Char | KB plan name (e.g. `internet-100mbps-monthly`) |
| `x_kb_billing_period` | Selection | `MONTHLY`, `QUARTERLY`, `ANNUAL` |
| `x_kb_has_trial` | Boolean | Whether plan has trial phase |
| `x_kb_trial_days` | Integer | Trial duration in days (default 0) |

### `account.move`
| Field | Type | Purpose |
|---|---|---|
| `x_kb_invoice_id` | Char | KB invoiceId (UUID) — idempotency key |

### `account.payment`
| Field | Type | Purpose |
|---|---|---|
| `x_kb_payment_id` | Char | KB paymentId (UUID) — idempotency key |

### `sale.order.line`
| Field | Type | Purpose |
|---|---|---|
| `x_kb_subscription_id` | Char | KB subscriptionId (UUID) — idempotency key |

### `kb.sync.log` (new model)

Tracks every Kafka message consumption result. Each consumed message (from odoo.* or kb.* topics) creates one log entry.

| Field | Type | Purpose |
|---|---|---|
| `name` | Char | Auto-sequence (KB/SYNC/00001) |
| `operation` | Selection | `partner_to_kb`, `catalog_upload`, `subscription_create`, `invoice_from_kb`, `payment_from_kb`, `subscription_state`, `overdue_state` |
| `direction` | Selection | `odoo_to_kb`, `kb_to_odoo` |
| `status` | Selection | `pending`, `success`, `failed`, `retrying` |
| `kb_object_id` | Char | KB UUID |
| `odoo_object` | Char | Model + ID (e.g. `res.partner,42`) |
| `request_payload` | Text | Kafka message payload (JSON) |
| `response_payload` | Text | API response from KB or Odoo |
| `error_message` | Text | Error details if failed |
| `retry_count` | Integer | Retries attempted |
| `catalog_hash` | Char | SHA256 for catalog change detection |
| `kafka_topic` | Char | Source Kafka topic (e.g. `odoo.partner.verified`, `kb.invoice.created`) |
| `kafka_event_id` | Char | Unique event ID from Kafka message (UUID, for deduplication) |
| `company_id` | Many2one → res.company | Tenant scope |

## Model Code

### `res_company.py`
```python
from odoo import models, fields

class ResCompany(models.Model):
    _inherit = 'res.company'

    x_kb_api_key = fields.Char(string='KB API Key', help='Kill Bill tenant API key (X-Killbill-ApiKey header)')
    x_kb_api_secret = fields.Char(string='KB API Secret', help='Kill Bill tenant API secret (X-Killbill-ApiSecret header)')
    x_kb_tenant_id = fields.Char(string='KB Tenant ID', help='Kill Bill tenant UUID (set after tenant creation)')
```

### `res_partner.py`
```python
from odoo import models, fields

class ResPartner(models.Model):
    _inherit = 'res.partner'

    x_external_key = fields.Char(string='External Key', help='Kill Bill externalKey (e.g. ISP-001)')
    x_kb_account_id = fields.Char(string='KB Account ID', help='Kill Bill accountId (UUID), set by sync')
    x_nid_passport = fields.Char(string='NID/Passport', help='National ID or passport number')
    x_verification_status = fields.Selection([
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ], string='Verification Status', default='pending')
    x_document_attachment = fields.Binary(string='ID Document', help='Uploaded NID/passport scan')
    x_kb_balance = fields.Float(string='KB Balance', help='Current Kill Bill account balance')
```

### `product_template.py`
```python
from odoo import models, fields

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    x_kb_product_name = fields.Char(string='KB Product Name', help='Kill Bill product name (e.g. Internet-100Mbps)')
    x_kb_category = fields.Selection([
        ('BASE', 'Base'),
        ('ADD_ON', 'Add-On'),
    ], string='KB Category', help='Kill Bill product category')
```

### `product_product.py`
```python
from odoo import models, fields

class ProductProduct(models.Model):
    _inherit = 'product.product'

    x_kb_plan_name = fields.Char(string='KB Plan Name', help='Kill Bill plan name (e.g. internet-100mbps-monthly)')
    x_kb_billing_period = fields.Selection([
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('ANNUAL', 'Annual'),
    ], string='KB Billing Period')
    x_kb_has_trial = fields.Boolean(string='Has Trial', default=False, help='Whether plan has a trial phase')
    x_kb_trial_days = fields.Integer(string='Trial Days', default=0, help='Trial duration in days')
```

### `account_move.py`
```python
from odoo import models, fields

class AccountMove(models.Model):
    _inherit = 'account.move'

    x_kb_invoice_id = fields.Char(string='KB Invoice ID', help='Kill Bill invoiceId (UUID)')
```

### `account_payment.py`
```python
from odoo import models, fields

class AccountPayment(models.Model):
    _inherit = 'account.payment'

    x_kb_payment_id = fields.Char(string='KB Payment ID', help='Kill Bill paymentId (UUID)')
```

### `sale_order_line.py`
```python
from odoo import models, fields

class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    x_kb_subscription_id = fields.Char(string='KB Subscription ID', help='Kill Bill subscriptionId (UUID)')
```

### `kb_sync_log.py`
```python
from odoo import models, fields

class KbSyncLog(models.Model):
    _name = 'kb.sync.log'
    _description = 'Kill Bill Sync Log'
    _order = 'create_date desc'

    name = fields.Char(string='Reference', required=True, copy=False, readonly=True, default='New')
    operation = fields.Selection([
        ('partner_to_kb', 'Partner → KB'),
        ('catalog_upload', 'Catalog Upload'),
        ('subscription_create', 'Subscription Create'),
        ('invoice_from_kb', 'Invoice from KB'),
        ('payment_from_kb', 'Payment from KB'),
        ('subscription_state', 'Subscription State Change'),
        ('overdue_state', 'Overdue State Change'),
    ], string='Operation', required=True)
    direction = fields.Selection([
        ('odoo_to_kb', 'Odoo → Kill Bill'),
        ('kb_to_odoo', 'Kill Bill → Odoo'),
    ], string='Direction', required=True)
    status = fields.Selection([
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('retrying', 'Retrying'),
    ], string='Status', default='pending', required=True)
    kb_object_id = fields.Char(string='KB Object ID', help='Kill Bill UUID')
    odoo_object = fields.Char(string='Odoo Object', help='Model + ID (e.g. res.partner,42)')
    request_payload = fields.Text(string='Kafka Message', help='Kafka message payload (JSON)')
    response_payload = fields.Text(string='API Response', help='Response from KB or Odoo API call')
    error_message = fields.Text(string='Error')
    retry_count = fields.Integer(string='Retries', default=0)
    catalog_hash = fields.Char(string='Catalog Hash', help='SHA256 for catalog change detection')
    kafka_topic = fields.Char(string='Kafka Topic', help='Source topic (e.g. odoo.partner.verified)')
    kafka_event_id = fields.Char(string='Kafka Event ID', help='Unique event UUID from message, for deduplication')
    company_id = fields.Many2one('res.company', string='Company', required=True,
                                  default=lambda self: self.env.company)

    def create(self, vals_list):
        if isinstance(vals_list, dict):
            vals_list = [vals_list]
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('kb.sync.log') or 'New'
        return super().create(vals_list)
```

## Views

### `res_company_views.xml`
Extend company form — add "Kill Bill" group/tab with KB API Key, API Secret, Tenant ID fields.

### `res_partner_views.xml`
Extend partner form — add "Kill Bill" tab with: External Key, KB Account ID, Verification Status, NID/Passport, Document, KB Balance.

### `product_views.xml`
- Product template form: add KB Product Name, KB Category
- Product variant form: add KB Plan Name, Billing Period, Has Trial, Trial Days

### `account_move_views.xml`
Invoice form: add `x_kb_invoice_id` (read-only, in "Other Info" tab).

### `account_payment_views.xml`
Payment form: add `x_kb_payment_id` (read-only).

### `sale_order_views.xml`
SO line tree/form: add `x_kb_subscription_id` (read-only).

### `kb_sync_log_views.xml`
- List view: name, operation, direction, status, kb_object_id, create_date, company_id
- Form view: all fields
- Search view: filters by operation, direction, status
- Menu item: top-level "Kill Bill" menu or under Settings

## Security

`ir.model.access.csv`:
```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_kb_sync_log_admin,kb.sync.log admin,model_kb_sync_log,base.group_system,1,1,1,1
access_kb_sync_log_user,kb.sync.log user,model_kb_sync_log,base.group_user,1,0,0,0
```

## Sequence Data

`data/ir_sequence_data.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <record id="seq_kb_sync_log" model="ir.sequence">
            <field name="name">Kill Bill Sync Log</field>
            <field name="code">kb.sync.log</field>
            <field name="prefix">KB/SYNC/</field>
            <field name="padding">5</field>
        </record>
    </data>
</odoo>
```

## Installation

```bash
cd /home/mustafa/telcobright-projects/odoo
kill $(pgrep -f odoo-bin); sleep 2; ./start-odoo.sh
```
Then: Settings > Apps > Update Apps List > search "Kill Bill" > Install.

## Verification

1. Settings > Companies > edit default company → KB fields visible
2. Contacts > any contact → "Kill Bill" tab visible
3. Sales > Products > any product → KB Product Name, KB Category visible
4. Product variant → KB Plan Name, Billing Period, Has Trial, Trial Days visible
5. Accounting > Invoice form → KB Invoice ID visible
6. Payment form → KB Payment ID visible
7. Kill Bill menu → Sync Log accessible
