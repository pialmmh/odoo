import json
import logging

from odoo import models, fields

_logger = logging.getLogger(__name__)


class ProductProduct(models.Model):
    _inherit = 'product.product'

    x_kb_plan_name = fields.Char(
        string='KB Plan Name',
        help='Kill Bill plan name (e.g. internet-100mbps-monthly)')
    x_kb_billing_period = fields.Selection([
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('ANNUAL', 'Annual'),
    ], string='KB Billing Period')
    x_kb_has_trial = fields.Boolean(
        string='Has Trial', default=False,
        help='Whether plan has a trial phase')
    x_kb_trial_days = fields.Integer(
        string='Trial Days', default=0,
        help='Trial duration in days')

    def write(self, vals):
        res = super().write(vals)
        if any(f in vals for f in ('x_kb_plan_name', 'x_kb_billing_period', 'x_kb_has_trial',
                                    'x_kb_trial_days', 'lst_price', 'active')):
            for variant in self:
                if variant.x_kb_plan_name:
                    self.env['kb.sync.log'].sudo().create({
                        'operation': 'catalog_upload',
                        'direction': 'odoo_to_kb',
                        'status': 'pending',
                        'odoo_object': f'product.product,{variant.id}',
                        'request_payload': json.dumps({
                            'plan_name': variant.x_kb_plan_name,
                            'trigger': 'product_variant_write',
                        }),
                        'company_id': self.env.company.id,
                    })
                    _logger.info('KB sync queued: catalog change for plan %s', variant.x_kb_plan_name)
        return res
