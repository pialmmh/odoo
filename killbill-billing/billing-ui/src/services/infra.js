import { call } from './odoo';

// ── Regions ──

export async function getRegions(domain = []) {
  return call('infra.region', 'search_read', [domain], {
    fields: ['id', 'name', 'code', 'geographic_area', 'status', 'zone_count'],
    order: 'name',
  });
}

export async function createRegion(vals) {
  return call('infra.region', 'create', [vals]);
}

export async function updateRegion(id, vals) {
  return call('infra.region', 'write', [[id], vals]);
}

export async function deleteRegion(id) {
  return call('infra.region', 'unlink', [[id]]);
}

// ── Availability Zones ──

export async function getAvailabilityZones(domain = []) {
  return call('infra.availability.zone', 'search_read', [domain], {
    fields: ['id', 'name', 'code', 'region_id', 'zone_type', 'is_default', 'status', 'datacenter_count'],
    order: 'region_id, name',
  });
}

export async function createAvailabilityZone(vals) {
  return call('infra.availability.zone', 'create', [vals]);
}

export async function updateAvailabilityZone(id, vals) {
  return call('infra.availability.zone', 'write', [[id], vals]);
}

export async function deleteAvailabilityZone(id) {
  return call('infra.availability.zone', 'unlink', [[id]]);
}

// ── Datacenters ──

export async function getDatacenters(domain = []) {
  return call('infra.datacenter', 'search_read', [domain], {
    fields: [
      'id', 'name', 'zone_id', 'region_id', 'location_address',
      'dc_type', 'tier', 'partner_id', 'is_dr_site', 'latitude', 'longitude', 'status',
    ],
    order: 'name',
  });
}

export async function createDatacenter(vals) {
  return call('infra.datacenter', 'create', [vals]);
}

export async function updateDatacenter(id, vals) {
  return call('infra.datacenter', 'write', [[id], vals]);
}

export async function deleteDatacenter(id) {
  return call('infra.datacenter', 'unlink', [[id]]);
}

// ── Resource Pools ──

export async function getResourcePools(domain = []) {
  return call('infra.resource.pool', 'search_read', [domain], {
    fields: [
      'id', 'name', 'pool_type', 'datacenter_id', 'hypervisor',
      'total_cpu_cores', 'used_cpu_cores', 'total_memory_gb', 'used_memory_gb',
      'total_storage_tb', 'used_storage_tb', 'status',
    ],
  });
}

export async function createResourcePool(vals) {
  return call('infra.resource.pool', 'create', [vals]);
}

export async function updateResourcePool(id, vals) {
  return call('infra.resource.pool', 'write', [[id], vals]);
}

// ── Computes ──

export async function getComputes(domain = []) {
  return call('infra.compute', 'search_read', [domain], {
    fields: [
      'id', 'name', 'hostname', 'node_type', 'datacenter_id', 'pool_id',
      'cpu_cores', 'memory_gb', 'disk_gb', 'brand', 'model', 'serial_number',
      'rack_location', 'os_type', 'management_ip', 'status',
    ],
  });
}

export async function createCompute(vals) {
  return call('infra.compute', 'create', [vals]);
}

export async function updateCompute(id, vals) {
  return call('infra.compute', 'write', [[id], vals]);
}

export async function deleteCompute(id) {
  return call('infra.compute', 'unlink', [[id]]);
}

// ── Containers ──

export async function getContainers(domain = []) {
  return call('infra.container', 'search_read', [domain], {
    fields: [
      'id', 'name', 'container_type', 'image', 'compute_id',
      'cpu_limit', 'memory_limit', 'status',
    ],
  });
}

export async function createContainer(vals) {
  return call('infra.container', 'create', [vals]);
}

export async function updateContainer(id, vals) {
  return call('infra.container', 'write', [[id], vals]);
}

// ── Network Devices ──

export async function getNetworkDevices(domain = []) {
  return call('infra.network.device', 'search_read', [domain], {
    fields: [
      'id', 'name', 'device_model_id', 'device_attribute_ids',
      'serial_number', 'management_ip', 'management_port', 'management_protocol',
      'datacenter_id', 'rack_position', 'firmware',
      'status', 'operational_status', 'criticality', 'notes',
      'vendor_display', 'device_type_display',
    ],
  });
}

export async function createNetworkDevice(vals) {
  return call('infra.network.device', 'create', [vals]);
}

export async function updateNetworkDevice(id, vals) {
  return call('infra.network.device', 'write', [[id], vals]);
}

export async function deleteNetworkDevice(id) {
  return call('infra.network.device', 'unlink', [[id]]);
}

// ── Storage ──

export async function getStorage(domain = []) {
  return call('infra.storage', 'search_read', [domain], {
    fields: ['id', 'name', 'storage_type', 'capacity_gb', 'used_gb', 'protocol', 'datacenter_id', 'status'],
  });
}

export async function createStorage(vals) {
  return call('infra.storage', 'create', [vals]);
}

export async function updateStorage(id, vals) {
  return call('infra.storage', 'write', [[id], vals]);
}

// ── Networking ──

export async function getNetworks(domain = []) {
  return call('infra.networking', 'search_read', [domain], {
    fields: ['id', 'name', 'network_type', 'cidr', 'vlan_id', 'gateway', 'dhcp_enabled', 'datacenter_id', 'status'],
  });
}

export async function createNetwork(vals) {
  return call('infra.networking', 'create', [vals]);
}

export async function updateNetwork(id, vals) {
  return call('infra.networking', 'write', [[id], vals]);
}

// ── IP Addresses ──

export async function getIPAddresses(domain = []) {
  return call('infra.ip.address', 'search_read', [domain], {
    fields: [
      'id', 'ip_address', 'subnet_mask', 'ip_type', 'assignment_method',
      'compute_id', 'network_device_id', 'container_id', 'vlan_id',
      'is_primary', 'is_active', 'assigned_to_display',
    ],
  });
}

export async function createIPAddress(vals) {
  return call('infra.ip.address', 'create', [vals]);
}

export async function updateIPAddress(id, vals) {
  return call('infra.ip.address', 'write', [[id], vals]);
}

// ── Device Attributes ──

export async function getDeviceAttributes(domain = []) {
  return call('infra.device.attribute', 'search_read', [domain], {
    fields: ['id', 'name', 'code', 'category', 'description', 'color'],
    order: 'category, name',
  });
}

// ── Device Models ──

export async function getDeviceModels(domain = []) {
  return call('infra.device.model', 'search_read', [domain], {
    fields: [
      'id', 'name', 'vendor', 'device_type', 'default_attribute_ids',
      'port_count', 'cpu_cores', 'memory_mb', 'storage_gb', 'product_url', 'description',
    ],
    order: 'vendor, name',
  });
}

export async function createDeviceModel(vals) {
  return call('infra.device.model', 'create', [vals]);
}

export async function updateDeviceModel(id, vals) {
  return call('infra.device.model', 'write', [[id], vals]);
}

export async function deleteDeviceModel(id) {
  return call('infra.device.model', 'unlink', [[id]]);
}
