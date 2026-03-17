from odoo import models, fields


class AccountPayment(models.Model):
    _inherit = 'account.payment'

    x_kb_payment_id = fields.Char(
        string='KB Payment ID', copy=False, readonly=True,
        help='Kill Bill paymentId (UUID)')
