from odoo import models, fields


class AccountMove(models.Model):
    _inherit = 'account.move'

    x_kb_invoice_id = fields.Char(
        string='KB Invoice ID', copy=False, readonly=True,
        help='Kill Bill invoiceId (UUID)')
