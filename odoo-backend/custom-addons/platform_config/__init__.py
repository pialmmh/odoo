from . import models


def _post_init_hook(env):
    _seed_tenant_configs(env)


def _seed_tenant_configs(env):
    """Seed initial tenant configs from known partners."""
    TenantConfig = env['platform.tenant.config']

    seeds = [
        {
            'partner_name': 'BTCL',
            'slug': 'btcl',
            'is_active': True,
            'kb_api_key': 'btcl',
            'kb_api_secret': 'btcl-secret',
            'login_title': 'BTCL Service Portal',
            'login_subtitle': 'Bangladesh Telecommunications Company Limited',
            'app_name': 'BTCL Portal',
            'app_short_name': 'BTCL',
            'theme': 'green',
        },
        {
            'partner_name': 'Telcobright',
            'slug': 'telcobright',
            'is_active': True,
            'kb_api_key': 'telcobright',
            'kb_api_secret': 'telcobright-secret',
            'login_title': 'Telcobright Platform',
            'login_subtitle': 'ISP Management & Billing Portal',
            'app_name': 'Telcobright Platform',
            'app_short_name': 'TB',
            'theme': 'blue',
        },
        {
            'partner_name': 'ABC',
            'slug': 'abc-isp',
            'is_active': False,
            'kb_api_key': 'abc-isp',
            'kb_api_secret': 'abc-isp-secret',
            'login_title': 'ABC ISP Portal',
            'login_subtitle': 'Internet Service Management',
            'app_name': 'ABC ISP',
            'app_short_name': 'ABC',
            'theme': 'orange',
        },
    ]

    for seed in seeds:
        if TenantConfig.search_count([('slug', '=', seed['slug'])]) > 0:
            continue
        partner = env['res.partner'].search(
            [('is_company', '=', True), ('name', 'ilike', seed['partner_name'])],
            limit=1
        )
        if not partner:
            continue
        partner_name = seed.pop('partner_name')
        TenantConfig.create({**seed, 'partner_id': partner.id})
