from odoo import models, fields


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    x_kb_subscription_id = fields.Char(
        string='KB Subscription ID', copy=False, readonly=True,
        help='Kill Bill subscriptionId (UUID)')
