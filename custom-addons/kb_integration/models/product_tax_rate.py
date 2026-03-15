import logging
from datetime import date

from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class ProductTaxRate(models.Model):
    _name = 'product.tax.rate'
    _description = 'Product Tax Rate History (VAT/AIT by category with effective dates)'
    _order = 'effective_date desc, id desc'

    name = fields.Char(string='Name', compute='_compute_name', store=True)

    tax_type = fields.Selection([
        ('vat', 'VAT'),
        ('ait', 'AIT (Advanced Income Tax)'),
        ('sd', 'Supplementary Duty'),
        ('other', 'Other'),
    ], string='Tax Type', required=True, default='vat', index=True)

    categ_id = fields.Many2one(
        'product.category', string='Product Category', index=True,
        help='Apply to this category. Leave blank for default rate.')
    product_tmpl_id = fields.Many2one(
        'product.template', string='Product (Override)', index=True,
        help='Override rate for a specific product. Takes priority over category.')

    rate = fields.Float(
        string='Rate (%)', required=True, digits=(5, 2),
        help='Tax rate as percentage (e.g. 15.0 for 15%)')
    is_deduction = fields.Boolean(
        string='Is Deduction', default=False,
        help='If true, this tax is deducted at source (e.g. AIT)')

    effective_date = fields.Date(
        string='Effective Date', required=True, index=True,
        default=fields.Date.today)
    end_date = fields.Date(
        string='End Date', index=True,
        help='Leave blank for currently active rate')

    is_active = fields.Boolean(
        string='Currently Active', compute='_compute_is_active', store=True)

    gazette_ref = fields.Char(
        string='Gazette/SRO Reference',
        help='Government gazette or SRO number authorizing this rate')
    reason = fields.Char(string='Reason for Change')
    changed_by = fields.Many2one(
        'res.users', string='Changed By',
        default=lambda self: self.env.user, readonly=True)
    company_id = fields.Many2one(
        'res.company', string='Company', required=True,
        default=lambda self: self.env.company, index=True)
    notes = fields.Text(string='Notes')

    odoo_tax_id = fields.Many2one(
        'account.tax', string='Odoo Tax Record',
        help='Linked Odoo tax record for invoice computation')

    _sql_constraints = [
        ('date_range_check',
         'CHECK(end_date IS NULL OR end_date >= effective_date)',
         'End date must be on or after effective date.'),
    ]

    @api.depends('tax_type', 'rate', 'categ_id', 'product_tmpl_id')
    def _compute_name(self):
        for rec in self:
            target = ''
            if rec.product_tmpl_id:
                target = rec.product_tmpl_id.name
            elif rec.categ_id:
                target = rec.categ_id.complete_name or rec.categ_id.name
            else:
                target = 'Default'

            type_label = dict(self._fields['tax_type'].selection).get(rec.tax_type, '')
            rec.name = f"{type_label} {rec.rate}% — {target}"

    @api.depends('effective_date', 'end_date')
    def _compute_is_active(self):
        today = date.today()
        for rec in self:
            started = rec.effective_date and rec.effective_date <= today
            not_ended = not rec.end_date or rec.end_date >= today
            rec.is_active = bool(started and not_ended)

    @api.model
    def get_applicable_taxes(self, product_tmpl_id=None, categ_id=None,
                              target_date=None, tax_type=None):
        """Get all applicable tax rates for a product on a given date.

        Priority: product-specific > category-specific > default (no category).
        Returns list of matching tax rate records.
        """
        if not target_date:
            target_date = date.today()

        domain = [
            ('effective_date', '<=', target_date),
            '|', ('end_date', '=', False), ('end_date', '>=', target_date),
        ]
        if tax_type:
            domain.append(('tax_type', '=', tax_type))

        all_rates = self.search(domain, order='effective_date desc')

        result = {}  # keyed by tax_type to return one per type

        for rate in all_rates:
            tt = rate.tax_type
            if tt in result:
                continue  # already found a higher-priority match

            # Product-specific match
            if rate.product_tmpl_id and rate.product_tmpl_id.id == product_tmpl_id:
                result[tt] = rate
            # Category match
            elif rate.categ_id and rate.categ_id.id == categ_id and tt not in result:
                result[tt] = rate
            # Default (no product, no category)
            elif not rate.product_tmpl_id and not rate.categ_id and tt not in result:
                result[tt] = rate

        return list(result.values())
