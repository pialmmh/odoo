from odoo import models, fields, api


class PlatformTenantConfig(models.Model):
    _name = 'platform.tenant.config'
    _description = 'Platform Tenant Configuration'
    _rec_name = 'slug'

    partner_id = fields.Many2one('res.partner', string='Partner (Company)',
                                 domain=[('is_company', '=', True)], required=True)
    slug = fields.Char(string='URL Slug', required=True, index=True)
    is_active = fields.Boolean(string='Active', default=True)

    # Billing credentials
    kb_api_key = fields.Char(string='KB API Key')
    kb_api_secret = fields.Char(string='KB API Secret')
    currency = fields.Char(string='Currency', default='BDT')
    timezone = fields.Char(string='Timezone', default='Asia/Dhaka')

    # Branding
    login_title = fields.Char(string='Login Page Title')
    login_subtitle = fields.Char(string='Login Page Subtitle')
    app_name = fields.Char(string='Application Name')
    app_short_name = fields.Char(string='Short Name')
    theme = fields.Selection([
        ('green', 'Green'), ('blue', 'Blue'), ('red', 'Red'),
        ('gray', 'Gray'), ('orange', 'Orange'),
        ('light-green', 'Light Green'), ('light-blue', 'Light Blue'),
        ('light-red', 'Light Red'), ('light-gray', 'Light Gray'),
    ], string='Theme', default='green')

    # Overdue policy
    overdue_warning_days = fields.Integer(string='Warning Days', default=7)
    overdue_suspend_days = fields.Integer(string='Suspend Days', default=14)
    overdue_disconnect_days = fields.Integer(string='Disconnect Days', default=30)

    _sql_constraints = [
        ('slug_unique', 'UNIQUE(slug)', 'Tenant slug must be unique'),
    ]

    @api.model
    def get_all_active(self):
        """Return all active tenant configs as a list of dicts for the API."""
        configs = self.search([('is_active', '=', True)])
        return [self._to_dict(c) for c in configs]

    @api.model
    def get_by_slug(self, slug):
        """Return a single tenant config dict by slug."""
        config = self.search([('slug', '=', slug)], limit=1)
        if not config:
            return None
        return self._to_dict(config)

    def _to_dict(self, rec):
        return {
            'id': rec.id,
            'partnerId': rec.partner_id.id,
            'partnerName': rec.partner_id.name,
            'slug': rec.slug,
            'isActive': rec.is_active,
            'billing': {
                'apiKey': rec.kb_api_key or '',
                'apiSecret': rec.kb_api_secret or '',
                'currency': rec.currency or 'BDT',
                'timezone': rec.timezone or 'Asia/Dhaka',
            },
            'branding': {
                'loginTitle': rec.login_title or '',
                'loginSubtitle': rec.login_subtitle or '',
                'appName': rec.app_name or '',
                'appShortName': rec.app_short_name or '',
                'theme': rec.theme or 'green',
            },
            'overdue': {
                'warningDays': rec.overdue_warning_days,
                'suspendDays': rec.overdue_suspend_days,
                'disconnectDays': rec.overdue_disconnect_days,
            },
        }
