from odoo import models, fields, api


class RbacRole(models.Model):
    _name = 'rbac.role'
    _description = 'RBAC Role'
    _order = 'sequence, name'

    name = fields.Char(string='Role Name', required=True, index=True)
    code = fields.Char(string='Code', required=True, index=True,
        help='Must match Keycloak realm role name, e.g. "super_admin"')
    description = fields.Text(string='Description')
    sequence = fields.Integer(string='Sequence', default=10)
    is_active = fields.Boolean(string='Active', default=True)
    permission_ids = fields.Many2many(
        'rbac.permission',
        'rbac_role_permission_rel',
        'role_id', 'permission_id',
        string='Permissions',
    )
    permission_count = fields.Integer(string='Permissions', compute='_compute_permission_count')

    _sql_constraints = [
        ('code_uniq', 'unique(code)', 'Role code must be unique.'),
    ]

    def _compute_permission_count(self):
        for rec in self:
            rec.permission_count = len(rec.permission_ids)

    @api.model
    def get_permissions_for_roles(self, role_codes):
        """Called from React: given a list of Keycloak role names,
        return the flat list of permission codes."""
        roles = self.search([('code', 'in', role_codes), ('is_active', '=', True)])
        perms = set()
        for role in roles:
            for perm in role.permission_ids:
                if perm.is_active:
                    perms.add(perm.code)
        return list(perms)

    @api.model
    def get_full_rbac_config(self):
        """Return the complete RBAC config for the React app.
        Called once on login, cached in memory."""
        roles = self.search([('is_active', '=', True)])
        role_perms = {}
        for role in roles:
            role_perms[role.code] = [p.code for p in role.permission_ids if p.is_active]

        url_patterns = self.env['rbac.url.pattern'].search([('is_active', '=', True)])
        url_rules = []
        for pat in url_patterns:
            url_rules.append({
                'pattern': pat.url_pattern,
                'permissions': [p.code for p in pat.permission_ids],
                'methods': pat.http_methods or 'ALL',
            })

        menu_rules = {}
        menu_patterns = self.env['rbac.url.pattern'].search([
            ('is_active', '=', True), ('menu_label', '!=', False),
        ])
        for pat in menu_patterns:
            menu_rules[pat.menu_label] = [p.code for p in pat.permission_ids]

        return {
            'role_permissions': role_perms,
            'url_rules': url_rules,
            'menu_rules': menu_rules,
        }
