import json
import logging

from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    x_kb_product_name = fields.Char(
        string='KB Product Name',
        help='Kill Bill product name (e.g. Internet-100Mbps)')
    x_kb_category = fields.Selection([
        ('BASE', 'Base'),
        ('ADD_ON', 'Add-On'),
    ], string='KB Category', help='Kill Bill product category')

    def write(self, vals):
        res = super().write(vals)
        if any(f in vals for f in ('x_kb_product_name', 'x_kb_category', 'list_price', 'active')):
            self._kb_queue_catalog_change()
        return res

    def _kb_queue_catalog_change(self):
        """Queue a catalog change event when KB-relevant product fields change."""
        for tmpl in self:
            if tmpl.x_kb_product_name:
                self.env['kb.sync.log'].sudo().create({
                    'operation': 'catalog_upload',
                    'direction': 'odoo_to_kb',
                    'status': 'pending',
                    'odoo_object': f'product.template,{tmpl.id}',
                    'request_payload': json.dumps({
                        'product_name': tmpl.x_kb_product_name,
                        'category': tmpl.x_kb_category,
                        'trigger': 'product_template_write',
                    }),
                    'company_id': self.env.company.id,
                })
                _logger.info('KB sync queued: catalog change for %s', tmpl.x_kb_product_name)
