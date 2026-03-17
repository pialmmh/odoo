#!/usr/bin/env python3
"""
Manage demo data (regions, zones, DCs, computes, devices, storage, networks, IPs).
Requires seed data to be loaded first (device attributes + models).

Usage:
  python manage.py load    # Insert demo data (skip existing)
  python manage.py clean   # Remove all demo data
  python manage.py reload  # Clean then load
"""
import sys
import xmlrpc.client

URL = 'http://localhost:7169'
DB = 'odoo_billing'
USER = 'admin'
PASS = 'admin'


def connect():
    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
    uid = common.authenticate(DB, USER, PASS, {})
    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')
    return uid, models


def call(models, uid, model, method, *args, **kwargs):
    return models.execute_kw(DB, uid, PASS, model, method, *args, **kwargs)


def find_or_skip(models, uid, model, domain, name_label):
    existing = call(models, uid, model, 'search', [domain])
    if existing:
        print(f"  . {name_label} exists (id={existing[0]})")
        return existing[0]
    return None


def create_one(models, uid, model, vals, name_label):
    rec_id = call(models, uid, model, 'create', [vals])
    print(f"  + {name_label} (id={rec_id})")
    return rec_id


def load(uid, models):
    # Lookup seed data
    dm_list = call(models, uid, 'infra.device.model', 'search_read', [[]], {'fields': ['id', 'name']})
    dm = {d['name']: d['id'] for d in dm_list}
    attr_list = call(models, uid, 'infra.device.attribute', 'search_read', [[]], {'fields': ['id', 'code']})
    attr = {a['code']: a['id'] for a in attr_list}

    if not dm or not attr:
        print("ERROR: Seed data not found. Run seed/manage.py load first.")
        sys.exit(1)

    # ── Regions ──
    print("\nRegions:")
    regions = {}
    for r in [
        {'name': 'Dhaka', 'code': 'DHK', 'geographic_area': 'Central Bangladesh'},
        {'name': 'Chittagong', 'code': 'CTG', 'geographic_area': 'Southeast Bangladesh'},
        {'name': 'Sylhet', 'code': 'SYL', 'geographic_area': 'Northeast Bangladesh'},
    ]:
        existing = find_or_skip(models, uid, 'infra.region', [['code', '=', r['code']]], f"Region {r['name']}")
        regions[r['code']] = existing or create_one(models, uid, 'infra.region', {**r, 'status': 'active'}, f"Region {r['name']}")

    # ── Availability Zones ──
    print("\nAvailability Zones:")
    zones = {}
    for z in [
        {'name': 'DK-AZ1', 'code': 'DHK-AZ1', 'region': 'DHK', 'zone_type': 'standard', 'is_default': True},
        {'name': 'DK-AZ2', 'code': 'DHK-AZ2', 'region': 'DHK', 'zone_type': 'standard', 'is_default': False},
        {'name': 'CT-AZ1', 'code': 'CTG-AZ1', 'region': 'CTG', 'zone_type': 'standard', 'is_default': True},
        {'name': 'SY-AZ1', 'code': 'SYL-AZ1', 'region': 'SYL', 'zone_type': 'edge', 'is_default': True},
    ]:
        existing = find_or_skip(models, uid, 'infra.availability.zone', [['code', '=', z['code']]], f"Zone {z['name']}")
        region_code = z.pop('region')
        zones[z['code']] = existing or create_one(models, uid, 'infra.availability.zone',
            {**z, 'region_id': regions[region_code], 'status': 'active'}, f"Zone {z['name']}")

    # ── Datacenters ──
    print("\nDatacenters:")
    dcs = {}
    for d in [
        {'name': 'Mohakhali DC', 'key': 'moh', 'zone': 'DHK-AZ1', 'location_address': 'Mohakhali DOHS, Dhaka', 'dc_type': 'owned', 'tier': '3', 'latitude': 23.7781, 'longitude': 90.4070},
        {'name': 'Banani DC', 'key': 'ban', 'zone': 'DHK-AZ1', 'location_address': 'Banani, Dhaka', 'dc_type': 'colocation', 'tier': '2', 'latitude': 23.7937, 'longitude': 90.4028},
        {'name': 'Uttara DC', 'key': 'utt', 'zone': 'DHK-AZ2', 'location_address': 'Uttara Sector 7, Dhaka', 'dc_type': 'owned', 'tier': '2', 'is_dr_site': True},
        {'name': 'Agrabad DC', 'key': 'agr', 'zone': 'CTG-AZ1', 'location_address': 'Agrabad C/A, Chittagong', 'dc_type': 'owned', 'tier': '2'},
        {'name': 'Zindabazar POP', 'key': 'zin', 'zone': 'SYL-AZ1', 'location_address': 'Zindabazar, Sylhet', 'dc_type': 'edge', 'tier': '1'},
    ]:
        existing = find_or_skip(models, uid, 'infra.datacenter', [['name', '=', d['name']]], f"DC {d['name']}")
        key = d.pop('key')
        zone_code = d.pop('zone')
        dcs[key] = existing or create_one(models, uid, 'infra.datacenter',
            {**d, 'zone_id': zones[zone_code], 'status': 'active'}, f"DC {d['name']}")

    # ── Resource Pools ──
    print("\nResource Pools:")
    pools = {}
    for p in [
        {'name': 'Mohakhali Compute Pool', 'key': 'moh', 'pool_type': 'compute', 'dc': 'moh', 'total_cpu_cores': 128, 'used_cpu_cores': 72, 'total_memory_gb': 512, 'used_memory_gb': 320},
        {'name': 'Banani VM Pool', 'key': 'ban', 'pool_type': 'vmware', 'dc': 'ban', 'hypervisor': 'ESXi 8.0', 'total_cpu_cores': 64, 'used_cpu_cores': 40, 'total_memory_gb': 256, 'used_memory_gb': 180},
    ]:
        existing = find_or_skip(models, uid, 'infra.resource.pool', [['name', '=', p['name']]], f"Pool {p['name']}")
        key = p.pop('key')
        dc_key = p.pop('dc')
        pools[key] = existing or create_one(models, uid, 'infra.resource.pool',
            {**p, 'datacenter_id': dcs[dc_key], 'status': 'active'}, f"Pool {p['name']}")

    # ── Computes ──
    print("\nComputes:")
    computes = {}
    for c in [
        {'name': 'SRV-MOH-01', 'key': 'srv1', 'hostname': 'srv-moh-01.infra.local', 'node_type': 'dedicated_server', 'dc': 'moh', 'pool': 'moh', 'cpu_cores': 32, 'memory_gb': 128, 'disk_gb': 2000, 'brand': 'Dell', 'model': 'PowerEdge R750', 'serial_number': 'DL-R750-001', 'rack_location': 'Rack A1, U1-U4', 'management_ip': '10.10.199.10'},
        {'name': 'SRV-MOH-02', 'key': 'srv2', 'hostname': 'srv-moh-02.infra.local', 'node_type': 'dedicated_server', 'dc': 'moh', 'pool': 'moh', 'cpu_cores': 32, 'memory_gb': 128, 'disk_gb': 2000, 'brand': 'Dell', 'model': 'PowerEdge R750', 'serial_number': 'DL-R750-002', 'rack_location': 'Rack A1, U5-U8', 'management_ip': '10.10.199.11'},
        {'name': 'SRV-MOH-03', 'key': 'srv3', 'hostname': 'srv-moh-03.infra.local', 'node_type': 'dedicated_server', 'dc': 'moh', 'pool': 'moh', 'cpu_cores': 64, 'memory_gb': 256, 'disk_gb': 4000, 'brand': 'HPE', 'model': 'ProLiant DL380 Gen11', 'serial_number': 'HP-DL380-001', 'rack_location': 'Rack A2, U1-U4', 'management_ip': '10.10.199.12'},
        {'name': 'VM-BAN-01', 'key': 'vm1', 'hostname': 'vm-ban-01.infra.local', 'node_type': 'vm', 'dc': 'ban', 'pool': 'ban', 'cpu_cores': 8, 'memory_gb': 32, 'disk_gb': 500, 'management_ip': '10.10.198.20'},
        {'name': 'VM-BAN-02', 'key': 'vm2', 'hostname': 'vm-ban-02.infra.local', 'node_type': 'vm', 'dc': 'ban', 'pool': 'ban', 'cpu_cores': 4, 'memory_gb': 16, 'disk_gb': 200, 'management_ip': '10.10.198.21'},
        {'name': 'SRV-AGR-01', 'key': 'agr1', 'hostname': 'srv-agr-01.infra.local', 'node_type': 'dedicated_server', 'dc': 'agr', 'pool': None, 'cpu_cores': 16, 'memory_gb': 64, 'disk_gb': 1000, 'brand': 'Dell', 'model': 'PowerEdge R650', 'management_ip': '10.10.197.10'},
    ]:
        existing = find_or_skip(models, uid, 'infra.compute', [['name', '=', c['name']]], f"Compute {c['name']}")
        key = c.pop('key')
        dc_key = c.pop('dc')
        pool_key = c.pop('pool')
        vals = {**c, 'datacenter_id': dcs[dc_key], 'os_type': 'linux', 'status': 'active'}
        if pool_key:
            vals['pool_id'] = pools[pool_key]
        computes[key] = existing or create_one(models, uid, 'infra.compute', vals, f"Compute {c['name']}")

    # ── Containers ──
    print("\nContainers:")
    for ct in [
        {'name': 'radius-01', 'container_type': 'lxc', 'image': 'debian-12', 'compute': 'srv1', 'cpu_limit': 4, 'memory_limit': 8, 'status': 'running'},
        {'name': 'dns-primary', 'container_type': 'lxc', 'image': 'debian-12', 'compute': 'srv1', 'cpu_limit': 2, 'memory_limit': 4, 'status': 'running'},
        {'name': 'billing-app', 'container_type': 'docker', 'image': 'billing:latest', 'compute': 'srv2', 'cpu_limit': 8, 'memory_limit': 16, 'status': 'running'},
        {'name': 'monitoring', 'container_type': 'docker', 'image': 'grafana/grafana:latest', 'compute': 'vm1', 'cpu_limit': 2, 'memory_limit': 4, 'status': 'running'},
    ]:
        existing = find_or_skip(models, uid, 'infra.container', [['name', '=', ct['name']]], f"Container {ct['name']}")
        if not existing:
            compute_key = ct.pop('compute')
            create_one(models, uid, 'infra.container', {**ct, 'compute_id': computes[compute_key]}, f"Container {ct['name']}")

    # ── Network Devices ──
    print("\nNetwork Devices:")
    devices = {}
    for nd in [
        {'name': 'GW-MOH-01', 'key': 'gw1', 'model': 'CCR1036-8G-2S+', 'attrs': ['access_gateway_pppoe'], 'serial': 'MT-CCR1036-0001', 'ip': '10.10.199.1', 'dc': 'moh', 'rack': 'Rack B1, U1', 'firmware': 'RouterOS 7.14.3', 'criticality': 'critical'},
        {'name': 'GW-MOH-02', 'key': 'gw2', 'model': 'RB4011iGS+5HacQ2HnD', 'attrs': ['access_gateway_pppoe'], 'serial': 'MT-RB4011-0001', 'ip': '10.10.199.2', 'dc': 'moh', 'rack': 'Rack B1, U2', 'firmware': 'RouterOS 7.14.3', 'criticality': 'high'},
        {'name': 'CR-MOH-01', 'key': 'cr1', 'model': 'CCR2116-12G-4S+', 'attrs': ['core_router'], 'serial': 'MT-CCR2116-0001', 'ip': '10.10.199.3', 'dc': 'moh', 'rack': 'Rack B2, U1', 'firmware': 'RouterOS 7.14.3', 'criticality': 'critical'},
        {'name': 'SW-MOH-01', 'key': 'sw1', 'model': 'CRS354-48G-4S+2Q+RM', 'attrs': ['distribution_switch'], 'serial': 'MT-CRS354-0001', 'ip': '10.10.199.4', 'dc': 'moh', 'rack': 'Rack B2, U3', 'firmware': 'SwitchOS 2.16', 'criticality': 'high'},
        {'name': 'SW-MOH-02', 'key': 'sw2', 'model': 'CSS610-8G-2S+IN', 'attrs': ['access_switch'], 'serial': 'MT-CSS610-0001', 'ip': '10.10.199.5', 'dc': 'moh', 'rack': 'Rack A1, U10', 'firmware': 'SwitchOS 2.16', 'criticality': 'medium'},
        {'name': 'ER-BAN-01', 'key': 'er1', 'model': 'RB5009UG+S+IN', 'attrs': ['edge_router'], 'serial': 'MT-RB5009-0001', 'ip': '10.10.198.1', 'dc': 'ban', 'rack': 'Rack A1, U1', 'firmware': 'RouterOS 7.14.3', 'criticality': 'high'},
        {'name': 'SW-BAN-01', 'key': 'sw3', 'model': 'CRS326-24G-2S+RM', 'attrs': ['distribution_switch'], 'serial': 'MT-CRS326-0001', 'ip': '10.10.198.2', 'dc': 'ban', 'rack': 'Rack A1, U3', 'firmware': 'SwitchOS 2.16', 'criticality': 'medium'},
        {'name': 'GW-AGR-01', 'key': 'gw_agr', 'model': 'hAP ac3', 'attrs': ['access_gateway_pppoe'], 'serial': 'MT-HAP-0001', 'ip': '10.10.197.1', 'dc': 'agr', 'rack': '', 'firmware': 'RouterOS 7.14.3', 'criticality': 'medium'},
        {'name': 'GW-SYL-01', 'key': 'gw_syl', 'model': 'CCR2004-1G-12S+2XS', 'attrs': ['access_gateway_pppoe', 'edge_router'], 'serial': 'MT-CCR2004-0001', 'ip': '10.10.196.1', 'dc': 'zin', 'rack': '', 'firmware': 'RouterOS 7.14.3', 'criticality': 'high'},
    ]:
        existing = find_or_skip(models, uid, 'infra.network.device', [['name', '=', nd['name']]], f"Device {nd['name']}")
        key = nd.pop('key')
        dc_key = nd.pop('dc')
        model_name = nd.pop('model')
        attr_codes = nd.pop('attrs')
        vals = {
            'name': nd['name'], 'device_model_id': dm.get(model_name),
            'device_attribute_ids': [(6, 0, [attr[c] for c in attr_codes if c in attr])],
            'serial_number': nd['serial'], 'management_ip': nd['ip'], 'management_port': 22,
            'management_protocol': 'ssh', 'datacenter_id': dcs[dc_key],
            'rack_position': nd['rack'], 'firmware': nd['firmware'],
            'status': 'active', 'operational_status': 'up', 'criticality': nd['criticality'],
        }
        devices[key] = existing or create_one(models, uid, 'infra.network.device', vals, f"Device {nd['name']}")

    # ── Storage ──
    print("\nStorage:")
    for st in [
        {'name': 'NAS-MOH-01', 'storage_type': 'nas', 'capacity_gb': 20000, 'used_gb': 12400, 'protocol': 'nfs', 'dc': 'moh'},
        {'name': 'SAN-MOH-01', 'storage_type': 'san', 'capacity_gb': 50000, 'used_gb': 31000, 'protocol': 'iscsi', 'dc': 'moh'},
        {'name': 'LOCAL-AGR-01', 'storage_type': 'local', 'capacity_gb': 4000, 'used_gb': 1800, 'dc': 'agr'},
    ]:
        existing = find_or_skip(models, uid, 'infra.storage', [['name', '=', st['name']]], f"Storage {st['name']}")
        if not existing:
            dc_key = st.pop('dc')
            create_one(models, uid, 'infra.storage', {**st, 'datacenter_id': dcs[dc_key], 'status': 'active'}, f"Storage {st['name']}")

    # ── Networking ──
    print("\nNetworks:")
    nets = {}
    for n in [
        {'name': 'MGMT-VLAN', 'key': 'mgmt_moh', 'network_type': 'vlan', 'cidr': '10.10.199.0/24', 'vlan_id': 100, 'gateway': '10.10.199.1', 'dc': 'moh'},
        {'name': 'PPPoE-POOL', 'key': 'pppoe', 'network_type': 'vlan', 'cidr': '100.64.0.0/16', 'vlan_id': 200, 'gateway': '100.64.0.1', 'dc': 'moh'},
        {'name': 'SERVER-VLAN', 'key': 'srv_moh', 'network_type': 'vlan', 'cidr': '10.10.199.128/25', 'vlan_id': 110, 'gateway': '10.10.199.129', 'dc': 'moh'},
        {'name': 'MGMT-BAN', 'key': 'mgmt_ban', 'network_type': 'vlan', 'cidr': '10.10.198.0/24', 'vlan_id': 100, 'gateway': '10.10.198.1', 'dc': 'ban'},
        {'name': 'MGMT-AGR', 'key': 'mgmt_agr', 'network_type': 'vlan', 'cidr': '10.10.197.0/24', 'vlan_id': 100, 'gateway': '10.10.197.1', 'dc': 'agr'},
    ]:
        existing = find_or_skip(models, uid, 'infra.networking', [['name', '=', n['name']]], f"Network {n['name']}")
        key = n.pop('key')
        dc_key = n.pop('dc')
        nets[key] = existing or create_one(models, uid, 'infra.networking',
            {**n, 'datacenter_id': dcs[dc_key], 'dhcp_enabled': False, 'status': 'active'}, f"Network {n['name']}")

    # ── IP Addresses ──
    print("\nIP Addresses:")
    ip_entries = [
        {'ip_address': '10.10.199.10', 'ip_type': 'management', 'compute_id': computes['srv1'], 'vlan_id': nets['mgmt_moh'], 'is_primary': True},
        {'ip_address': '10.10.199.11', 'ip_type': 'management', 'compute_id': computes['srv2'], 'vlan_id': nets['mgmt_moh'], 'is_primary': True},
        {'ip_address': '10.10.199.12', 'ip_type': 'management', 'compute_id': computes['srv3'], 'vlan_id': nets['mgmt_moh'], 'is_primary': True},
        {'ip_address': '10.10.199.1', 'ip_type': 'management', 'network_device_id': devices['gw1'], 'vlan_id': nets['mgmt_moh'], 'is_primary': True},
        {'ip_address': '10.10.199.2', 'ip_type': 'management', 'network_device_id': devices['gw2'], 'vlan_id': nets['mgmt_moh'], 'is_primary': True},
        {'ip_address': '10.10.199.3', 'ip_type': 'management', 'network_device_id': devices['cr1'], 'vlan_id': nets['mgmt_moh'], 'is_primary': True},
        {'ip_address': '10.10.199.4', 'ip_type': 'management', 'network_device_id': devices['sw1'], 'vlan_id': nets['mgmt_moh'], 'is_primary': True},
        {'ip_address': '100.64.0.1', 'ip_type': 'service', 'network_device_id': devices['gw1'], 'vlan_id': nets['pppoe'], 'is_primary': False},
        {'ip_address': '10.10.198.1', 'ip_type': 'management', 'network_device_id': devices['er1'], 'vlan_id': nets['mgmt_ban'], 'is_primary': True},
        {'ip_address': '10.10.197.1', 'ip_type': 'management', 'network_device_id': devices['gw_agr'], 'vlan_id': nets['mgmt_agr'], 'is_primary': True},
    ]
    for ip in ip_entries:
        existing = find_or_skip(models, uid, 'infra.ip.address', [['ip_address', '=', ip['ip_address']]], f"IP {ip['ip_address']}")
        if not existing:
            create_one(models, uid, 'infra.ip.address', {**ip, 'assignment_method': 'static'}, f"IP {ip['ip_address']}")


def clean(uid, models):
    # Delete in reverse dependency order
    for model, label in [
        ('infra.ip.address', 'IP addresses'),
        ('infra.networking', 'networks'),
        ('infra.storage', 'storage'),
        ('infra.network.device', 'network devices'),
        ('infra.container', 'containers'),
        ('infra.compute', 'computes'),
        ('infra.resource.pool', 'resource pools'),
        ('infra.datacenter', 'datacenters'),
        ('infra.availability.zone', 'availability zones'),
        ('infra.region', 'regions'),
    ]:
        ids = call(models, uid, model, 'search', [[]])
        if ids:
            call(models, uid, model, 'unlink', [ids])
            print(f"  - Deleted {len(ids)} {label}")


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'load'
    uid, m = connect()

    if action == 'load':
        print("Loading demo data...")
        load(uid, m)
    elif action == 'clean':
        print("Cleaning demo data...")
        clean(uid, m)
    elif action == 'reload':
        print("Reloading demo data...")
        clean(uid, m)
        load(uid, m)
    else:
        print(f"Unknown action: {action}. Use: load, clean, reload")
        sys.exit(1)

    print("\nDone.")
