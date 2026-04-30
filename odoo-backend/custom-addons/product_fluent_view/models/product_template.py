from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    oem_no = fields.Char(string='OEM No.')
    version = fields.Integer(string='Version', default=1)
