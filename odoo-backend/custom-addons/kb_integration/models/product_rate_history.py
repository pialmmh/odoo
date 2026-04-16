import logging
from datetime import date

from odoo import models, fields, api
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class ProductRateHistory(models.Model):
    _name = 'product.rate.history'
    _description = 'Product Rate / Pricing History'
    _order = 'effective_date desc, id desc'
    _rec_name = 'display_name'

    product_tmpl_id = fields.Many2one(
        'product.template', string='Product', index=True,
        ondelete='cascade')
    product_id = fields.Many2one(
        'product.product', string='Variant', index=True,
        ondelete='cascade',
        help='Specific variant. If blank, rate applies to the product template.')
    variant_display = fields.Char(
        string='Variant Name', compute='_compute_variant_display', store=True)

    price = fields.Float(string='Price', required=True, digits=(16, 2))
    currency_id = fields.Many2one(
        'res.currency', string='Currency', required=True,
        default=lambda self: self.env.company.currency_id)
    tax_included = fields.Boolean(
        string='Tax Included', default=False,
        help='Whether the price includes tax (VAT)')

    effective_date = fields.Date(
        string='Effective Date', required=True, index=True,
        default=fields.Date.today,
        help='Date from which this rate is active')
    end_date = fields.Date(
        string='End Date', index=True,
        help='Last day this rate is active. Leave blank for currently active rate.')

    is_active = fields.Boolean(
        string='Currently Active', compute='_compute_is_active', store=True,
        help='Whether this rate is active today')

    pricelist_id = fields.Many2one(
        'product.pricelist', string='Pricelist',
        help='Associated pricelist, if any')
    pricelist_tier = fields.Selection([
        ('standard', 'Standard'),
        ('enterprise', 'Enterprise'),
        ('government', 'Government'),
        ('wholesale', 'Wholesale'),
        ('custom', 'Custom'),
    ], string='Tier', default='standard')

    reason = fields.Char(
        string='Reason',
        help='Reason for price change (e.g. "Annual rate revision", "Market adjustment")')
    changed_by = fields.Many2one(
        'res.users', string='Changed By',
        default=lambda self: self.env.user, readonly=True)
    company_id = fields.Many2one(
        'res.company', string='Company', required=True,
        default=lambda self: self.env.company, index=True)
    notes = fields.Text(string='Notes')

    _sql_constraints = [
        ('date_range_check',
         'CHECK(end_date IS NULL OR end_date >= effective_date)',
         'End date must be on or after effective date.'),
    ]

    @api.depends('product_id', 'product_tmpl_id')
    def _compute_variant_display(self):
        for rec in self:
            if rec.product_id:
                rec.variant_display = rec.product_id.name
            elif rec.product_tmpl_id:
                rec.variant_display = rec.product_tmpl_id.name
            else:
                rec.variant_display = ''

    @api.depends('effective_date', 'end_date')
    def _compute_is_active(self):
        today = date.today()
        for rec in self:
            started = rec.effective_date and rec.effective_date <= today
            not_ended = not rec.end_date or rec.end_date >= today
            rec.is_active = bool(started and not_ended)

    @api.model
    def get_rate_at_date(self, product_tmpl_id=None, product_id=None,
                         target_date=None, tier='standard'):
        """Get the applicable rate for a product on a given date.

        Returns the most recently effective rate on or before target_date
        that hasn't ended yet.
        """
        if not target_date:
            target_date = date.today()

        domain = [
            ('effective_date', '<=', target_date),
            ('pricelist_tier', '=', tier),
            '|', ('end_date', '=', False), ('end_date', '>=', target_date),
        ]
        if product_id:
            domain.append(('product_id', '=', product_id))
        elif product_tmpl_id:
            domain.append(('product_tmpl_id', '=', product_tmpl_id))
        else:
            return None

        rate = self.search(domain, order='effective_date desc', limit=1)
        return rate if rate else None

    @api.model
    def get_current_rates_bulk(self, variant_ids=None, tmpl_ids=None, tier='standard'):
        """Bulk-fetch current active dated rates keyed by variant/template id.

        Returns { 'variants': {id: price}, 'templates': {id: price} }.
        Only includes products that have a currently-active rate_history row.
        Callers should fall back to list_price when a key is missing.
        """
        today = date.today()
        base = [
            ('effective_date', '<=', today),
            ('pricelist_tier', '=', tier),
            '|', ('end_date', '=', False), ('end_date', '>=', today),
        ]
        variant_map = {}
        tmpl_map = {}

        if variant_ids:
            rows = self.search(
                base + [('product_id', 'in', list(variant_ids))],
                order='effective_date desc')
            for r in rows:
                vid = r.product_id.id
                key = str(vid) if vid else None
                if key and key not in variant_map:
                    variant_map[key] = r.price

        if tmpl_ids:
            rows = self.search(
                base + [('product_tmpl_id', 'in', list(tmpl_ids)),
                        ('product_id', '=', False)],
                order='effective_date desc')
            for r in rows:
                tid = r.product_tmpl_id.id
                key = str(tid) if tid else None
                if key and key not in tmpl_map:
                    tmpl_map[key] = r.price

        return {'variants': variant_map, 'templates': tmpl_map}

    @api.model
    def get_price_history(self, product_tmpl_id=None, product_id=None, tier=None):
        """Get full price history for a product, newest first."""
        domain = []
        if product_id:
            domain.append(('product_id', '=', product_id))
        elif product_tmpl_id:
            domain.append(('product_tmpl_id', '=', product_tmpl_id))
        if tier:
            domain.append(('pricelist_tier', '=', tier))
        return self.search(domain, order='effective_date desc')

    @api.model
    def record_rate_change(self, product_tmpl_id=None, product_id=None,
                           price=0, effective_date=None, end_date=None,
                           tier='standard', reason='', pricelist_id=None):
        """Record a new rate entry. Automatically closes the previous active rate."""
        if not effective_date:
            effective_date = date.today()

        # Close previous active rate for same product/tier
        domain = [
            ('pricelist_tier', '=', tier),
            ('is_active', '=', True),
            '|', ('end_date', '=', False), ('end_date', '>=', effective_date),
        ]
        if product_id:
            domain.append(('product_id', '=', product_id))
        elif product_tmpl_id:
            domain.append(('product_tmpl_id', '=', product_tmpl_id))

        prev_rates = self.search(domain)
        for prev in prev_rates:
            if not prev.end_date or prev.end_date >= effective_date:
                # Close the day before new rate starts
                close_date = effective_date - __import__('datetime').timedelta(days=1)
                if close_date >= prev.effective_date:
                    prev.write({'end_date': close_date})

        vals = {
            'product_tmpl_id': product_tmpl_id,
            'product_id': product_id,
            'price': price,
            'effective_date': effective_date,
            'end_date': end_date,
            'pricelist_tier': tier,
            'reason': reason,
            'pricelist_id': pricelist_id,
            'company_id': self.env.company.id,
        }
        return self.create(vals)
