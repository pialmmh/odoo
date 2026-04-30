#!/usr/bin/env python3
"""
Manage seed data (device attributes + device models).
Seed data is also loaded by Odoo module install via XML, but this script
allows reload/clean outside of module upgrade.

Usage:
  python manage.py load    # Insert seed data (skip existing)
  python manage.py clean   # Remove all seed data
  python manage.py reload  # Clean then load
"""
import sys
import xmlrpc.client

URL = 'http://localhost:7169'
DB = 'odoo_billing'
USER = 'admin'
PASS = 'admin'

ATTRIBUTES = [
    {'name': 'Access Gateway (PPPoE)', 'code': 'access_gateway_pppoe', 'category': 'role', 'description': 'PPPoE concentrator / BNG for subscriber access', 'color': 1},
    {'name': 'Core Router', 'code': 'core_router', 'category': 'role', 'description': 'Core network backbone router', 'color': 2},
    {'name': 'Edge Router', 'code': 'edge_router', 'category': 'role', 'description': 'Edge/border router for upstream peering', 'color': 3},
    {'name': 'Distribution Switch', 'code': 'distribution_switch', 'category': 'role', 'description': 'Layer 2/3 distribution switch', 'color': 4},
    {'name': 'Access Switch', 'code': 'access_switch', 'category': 'role', 'description': 'Access layer switch for end devices', 'color': 5},
    {'name': 'Firewall', 'code': 'firewall', 'category': 'role', 'description': 'Network security firewall', 'color': 6},
    {'name': 'Load Balancer', 'code': 'load_balancer', 'category': 'role', 'description': 'Traffic load balancer', 'color': 7},
    {'name': 'Wireless Controller', 'code': 'wireless_controller', 'category': 'role', 'description': 'Wi-Fi access point controller', 'color': 8},
    {'name': 'OLT (GPON/EPON)', 'code': 'olt_gpon_epon', 'category': 'role', 'description': 'Optical Line Terminal for fiber access', 'color': 9},
]

DEVICE_MODELS = [
    {'name': 'CCR1036-8G-2S+', 'vendor': 'MikroTik', 'device_type': 'router', 'default_attr': 'core_router', 'port_count': 8, 'cpu_cores': 36, 'memory_mb': 4096, 'description': 'High-performance core router, 36-core Tilera, 8x GbE, 2x SFP+'},
    {'name': 'CCR2004-1G-12S+2XS', 'vendor': 'MikroTik', 'device_type': 'router', 'default_attr': 'core_router', 'port_count': 15, 'cpu_cores': 4, 'memory_mb': 4096, 'description': 'Compact core router, 4-core ARM, 1x GbE, 12x SFP+, 2x 25G SFP28'},
    {'name': 'CCR2116-12G-4S+', 'vendor': 'MikroTik', 'device_type': 'router', 'default_attr': 'core_router', 'port_count': 16, 'cpu_cores': 16, 'memory_mb': 16384, 'description': 'Enterprise core router, 16-core ARM, 12x GbE, 4x SFP+'},
    {'name': 'RB4011iGS+5HacQ2HnD', 'vendor': 'MikroTik', 'device_type': 'router', 'default_attr': 'access_gateway_pppoe', 'port_count': 11, 'cpu_cores': 4, 'memory_mb': 1024, 'description': 'Mid-range access gateway, 4-core ARM, 10x GbE, 1x SFP+, dual-band Wi-Fi'},
    {'name': 'hAP ac3', 'vendor': 'MikroTik', 'device_type': 'router', 'default_attr': 'access_gateway_pppoe', 'port_count': 5, 'cpu_cores': 4, 'memory_mb': 256, 'description': 'Small access gateway, 4-core ARM, 5x GbE, dual-band Wi-Fi'},
    {'name': 'RB5009UG+S+IN', 'vendor': 'MikroTik', 'device_type': 'router', 'default_attr': 'edge_router', 'port_count': 9, 'cpu_cores': 4, 'memory_mb': 1024, 'description': 'Edge router, 4-core ARM, 7x GbE, 1x 2.5GbE, 1x SFP+'},
    {'name': 'CRS326-24G-2S+RM', 'vendor': 'MikroTik', 'device_type': 'switch', 'default_attr': 'distribution_switch', 'port_count': 26, 'cpu_cores': 1, 'memory_mb': 512, 'description': '24-port distribution switch, 24x GbE, 2x SFP+, rackmount'},
    {'name': 'CRS354-48G-4S+2Q+RM', 'vendor': 'MikroTik', 'device_type': 'switch', 'default_attr': 'distribution_switch', 'port_count': 54, 'cpu_cores': 1, 'memory_mb': 512, 'description': '48-port distribution switch, 48x GbE, 4x SFP+, 2x QSFP+, rackmount'},
    {'name': 'CSS610-8G-2S+IN', 'vendor': 'MikroTik', 'device_type': 'switch', 'default_attr': 'access_switch', 'port_count': 10, 'cpu_cores': 1, 'memory_mb': 256, 'description': 'Compact access switch, 8x GbE, 2x SFP+'},
]


def connect():
    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
    uid = common.authenticate(DB, USER, PASS, {})
    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')
    return uid, models


def call(models, uid, model, method, *args, **kwargs):
    return models.execute_kw(DB, uid, PASS, model, method, *args, **kwargs)


def load(uid, models):
    # Attributes
    for attr in ATTRIBUTES:
        existing = call(models, uid, 'infra.device.attribute', 'search', [[['code', '=', attr['code']]]])
        if not existing:
            call(models, uid, 'infra.device.attribute', 'create', [attr])
            print(f"  + Attribute: {attr['name']}")
        else:
            print(f"  . Attribute exists: {attr['name']}")

    # Build attr code→id map
    attrs = call(models, uid, 'infra.device.attribute', 'search_read', [[]], {'fields': ['id', 'code']})
    attr_map = {a['code']: a['id'] for a in attrs}

    # Device models
    for dm in DEVICE_MODELS:
        existing = call(models, uid, 'infra.device.model', 'search', [[['name', '=', dm['name']]]])
        if not existing:
            attr_id = attr_map.get(dm.pop('default_attr'))
            vals = {**dm, 'default_attribute_ids': [(6, 0, [attr_id])] if attr_id else []}
            call(models, uid, 'infra.device.model', 'create', [vals])
            print(f"  + Model: {dm['name']}")
        else:
            dm.pop('default_attr', None)
            print(f"  . Model exists: {dm['name']}")


def clean(uid, models):
    # Device models first (they reference attributes)
    dm_ids = call(models, uid, 'infra.device.model', 'search', [[]])
    if dm_ids:
        call(models, uid, 'infra.device.model', 'unlink', [dm_ids])
        print(f"  - Deleted {len(dm_ids)} device models")

    attr_ids = call(models, uid, 'infra.device.attribute', 'search', [[]])
    if attr_ids:
        call(models, uid, 'infra.device.attribute', 'unlink', [attr_ids])
        print(f"  - Deleted {len(attr_ids)} device attributes")

    if not dm_ids and not attr_ids:
        print("  (nothing to clean)")


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'load'
    uid, m = connect()

    if action == 'load':
        print("Loading seed data...")
        load(uid, m)
    elif action == 'clean':
        print("Cleaning seed data...")
        clean(uid, m)
    elif action == 'reload':
        print("Reloading seed data...")
        clean(uid, m)
        load(uid, m)
    else:
        print(f"Unknown action: {action}. Use: load, clean, reload")
        sys.exit(1)

    print("Done.")
