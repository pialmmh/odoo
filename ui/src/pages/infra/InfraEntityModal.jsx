import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, FormControl, InputLabel, Select, MenuItem, Tab, Tabs, Box,
  Chip, Autocomplete, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Typography,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

// ── Region Modal ──
export function RegionModal({ open, onClose, onSave, record }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(record ? { name: record.name, code: record.code, geographic_area: record.geographic_area || '', status: record.status }
      : { name: '', code: '', geographic_area: '', status: 'active' });
  }, [record, open]);
  const handleSave = async () => {
    if (!form.name || !form.code) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{record ? 'Edit Region' : 'Add Region'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Code" required value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></Grid>
          <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Geographic Area" value={form.geographic_area || ''} onChange={e => setForm({ ...form, geographic_area: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem><MenuItem value="maintenance">Maintenance</MenuItem>
              </Select></FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Zone Modal ──
export function ZoneModal({ open, onClose, onSave, record, regions }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(record ? { name: record.name, code: record.code, region_id: record.region_id?.[0] || '', zone_type: record.zone_type, is_default: record.is_default, status: record.status }
      : { name: '', code: '', region_id: '', zone_type: 'standard', is_default: false, status: 'active' });
  }, [record, open]);
  const handleSave = async () => {
    if (!form.name || !form.code || !form.region_id) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{record ? 'Edit Zone' : 'Add Availability Zone'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Code" required value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>Region</InputLabel>
              <Select label="Region" required value={form.region_id || ''} onChange={e => setForm({ ...form, region_id: e.target.value })}>
                {(regions || []).map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
              <Select label="Type" value={form.zone_type || 'standard'} onChange={e => setForm({ ...form, zone_type: e.target.value })}>
                <MenuItem value="standard">Standard</MenuItem><MenuItem value="edge">Edge</MenuItem><MenuItem value="local">Local</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem><MenuItem value="maintenance">Maintenance</MenuItem>
              </Select></FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Datacenter Modal ──
export function DatacenterModal({ open, onClose, onSave, record, zones }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(record ? {
      name: record.name, zone_id: record.zone_id?.[0] || '', location_address: record.location_address || '',
      dc_type: record.dc_type, tier: record.tier || '', is_dr_site: record.is_dr_site || false,
      latitude: record.latitude || 0, longitude: record.longitude || 0, status: record.status,
    } : { name: '', zone_id: '', location_address: '', dc_type: 'owned', tier: '', is_dr_site: false, latitude: 0, longitude: 0, status: 'active' });
  }, [record, open]);
  const handleSave = async () => {
    if (!form.name || !form.zone_id) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? 'Edit Datacenter' : 'Add Datacenter'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Zone</InputLabel>
              <Select label="Zone" required value={form.zone_id || ''} onChange={e => setForm({ ...form, zone_id: e.target.value })}>
                {(zones || []).map(z => <MenuItem key={z.id} value={z.id}>{z.name}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Location Address" value={form.location_address || ''} onChange={e => setForm({ ...form, location_address: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>DC Type</InputLabel>
              <Select label="DC Type" value={form.dc_type || 'owned'} onChange={e => setForm({ ...form, dc_type: e.target.value })}>
                <MenuItem value="owned">Owned</MenuItem><MenuItem value="colocation">Colocation</MenuItem><MenuItem value="cloud">Cloud</MenuItem><MenuItem value="edge">Edge</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Tier</InputLabel>
              <Select label="Tier" value={form.tier || ''} onChange={e => setForm({ ...form, tier: e.target.value })}>
                <MenuItem value="">-</MenuItem><MenuItem value="1">Tier 1</MenuItem><MenuItem value="2">Tier 2</MenuItem><MenuItem value="3">Tier 3</MenuItem><MenuItem value="4">Tier 4</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem><MenuItem value="maintenance">Maintenance</MenuItem><MenuItem value="decommissioned">Decommissioned</MenuItem>
              </Select></FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Network Device Modal (tabbed) ──
export function NetworkDeviceModal({ open, onClose, onSave, record, deviceModels, attributes, ipAddresses = [] }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTab(0);
    if (record) {
      setForm({
        name: record.name, device_model_id: record.device_model_id?.[0] || '',
        device_attribute_ids: record.device_attribute_ids || [],
        serial_number: record.serial_number || '', status: record.status,
        operational_status: record.operational_status || 'up', criticality: record.criticality || 'medium',
        management_ip: record.management_ip || '', management_port: record.management_port || 22,
        management_protocol: record.management_protocol || 'ssh',
        rack_position: record.rack_position || '', firmware: record.firmware || '',
        notes: record.notes || '',
      });
    } else {
      setForm({
        name: '', device_model_id: '', device_attribute_ids: [],
        serial_number: '', status: 'active', operational_status: 'up', criticality: 'medium',
        management_ip: '', management_port: 22, management_protocol: 'ssh',
        rack_position: '', firmware: '', notes: '',
      });
    }
  }, [record, open]);

  const selectedAttrs = attributes.filter(a => form.device_attribute_ids?.includes(a.id));

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const vals = { ...form, device_attribute_ids: [[6, 0, form.device_attribute_ids || []]] };
      if (vals.device_model_id === '') delete vals.device_model_id;
      await onSave(vals);
      onClose();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{record ? 'Edit Network Device' : 'Add Network Device'}</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="General" /><Tab label="Network" /><Tab label="Details" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Device Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid size={{ xs: 4 }}>
              <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem><MenuItem value="maintenance">Maintenance</MenuItem><MenuItem value="decommissioned">Decommissioned</MenuItem>
                </Select></FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth size="small"><InputLabel>Device Model</InputLabel>
                <Select label="Device Model" value={form.device_model_id || ''} onChange={e => setForm({ ...form, device_model_id: e.target.value })}>
                  <MenuItem value="">- None -</MenuItem>
                  {(deviceModels || []).map(m => <MenuItem key={m.id} value={m.id}>{m.vendor} {m.name}</MenuItem>)}
                </Select></FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Autocomplete multiple size="small" options={attributes} getOptionLabel={a => a.name}
                value={selectedAttrs}
                onChange={(_, newVal) => setForm({ ...form, device_attribute_ids: newVal.map(a => a.id) })}
                renderInput={(params) => <TextField {...params} label="Device Roles" />}
                renderTags={(value, getTagProps) => value.map((opt, i) => <Chip {...getTagProps({ index: i })} key={opt.id} label={opt.name} size="small" />)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Serial Number" value={form.serial_number || ''} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></Grid>
            <Grid size={{ xs: 3 }}>
              <FormControl fullWidth size="small"><InputLabel>Op Status</InputLabel>
                <Select label="Op Status" value={form.operational_status || 'up'} onChange={e => setForm({ ...form, operational_status: e.target.value })}>
                  <MenuItem value="up">UP</MenuItem><MenuItem value="down">DOWN</MenuItem><MenuItem value="degraded">Degraded</MenuItem>
                </Select></FormControl>
            </Grid>
            <Grid size={{ xs: 3 }}>
              <FormControl fullWidth size="small"><InputLabel>Criticality</InputLabel>
                <Select label="Criticality" value={form.criticality || 'medium'} onChange={e => setForm({ ...form, criticality: e.target.value })}>
                  <MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="critical">Critical</MenuItem>
                </Select></FormControl>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 5 }}><TextField fullWidth size="small" label="Management IP" value={form.management_ip || ''} onChange={e => setForm({ ...form, management_ip: e.target.value })} /></Grid>
            <Grid size={{ xs: 3 }}><TextField fullWidth size="small" label="Port" type="number" value={form.management_port || 22} onChange={e => setForm({ ...form, management_port: +e.target.value })} /></Grid>
            <Grid size={{ xs: 4 }}>
              <FormControl fullWidth size="small"><InputLabel>Protocol</InputLabel>
                <Select label="Protocol" value={form.management_protocol || 'ssh'} onChange={e => setForm({ ...form, management_protocol: e.target.value })}>
                  <MenuItem value="ssh">SSH</MenuItem><MenuItem value="https">HTTPS</MenuItem><MenuItem value="snmp">SNMP</MenuItem><MenuItem value="api">API</MenuItem>
                </Select></FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Rack Position" value={form.rack_position || ''} onChange={e => setForm({ ...form, rack_position: e.target.value })} /></Grid>
          </Grid>
          {record && ipAddresses.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>IP Addresses</Typography>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>IP</TableCell><TableCell>Type</TableCell><TableCell>Primary</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {ipAddresses.map(ip => (
                    <TableRow key={ip.id}>
                      <TableCell>{ip.ip_address}</TableCell><TableCell>{ip.ip_type}</TableCell>
                      <TableCell>{ip.is_primary ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Firmware Version" value={form.firmware || ''} onChange={e => setForm({ ...form, firmware: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Notes" multiline rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></Grid>
          </Grid>
        </TabPanel>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Compute Modal ──
export function ComputeModal({ open, onClose, onSave, record }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (record) {
      setForm({
        name: record.name, hostname: record.hostname || '', node_type: record.node_type,
        cpu_cores: record.cpu_cores || 0, memory_gb: record.memory_gb || 0, disk_gb: record.disk_gb || 0,
        brand: record.brand || '', model: record.model || '', serial_number: record.serial_number || '',
        rack_location: record.rack_location || '', os_type: record.os_type || 'linux',
        management_ip: record.management_ip || '', status: record.status,
      });
    } else {
      setForm({ name: '', hostname: '', node_type: 'dedicated_server', cpu_cores: 0, memory_gb: 0, disk_gb: 0, brand: '', model: '', serial_number: '', rack_location: '', os_type: 'linux', management_ip: '', status: 'active' });
    }
  }, [record, open]);
  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? 'Edit Compute' : 'Add Compute'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Hostname" value={form.hostname || ''} onChange={e => setForm({ ...form, hostname: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
              <Select label="Type" value={form.node_type || 'dedicated_server'} onChange={e => setForm({ ...form, node_type: e.target.value })}>
                <MenuItem value="dedicated_server">Server</MenuItem><MenuItem value="vm">VM</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>OS</InputLabel>
              <Select label="OS" value={form.os_type || 'linux'} onChange={e => setForm({ ...form, os_type: e.target.value })}>
                <MenuItem value="linux">Linux</MenuItem><MenuItem value="windows">Windows</MenuItem><MenuItem value="esxi">ESXi</MenuItem><MenuItem value="other">Other</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem><MenuItem value="provisioning">Provisioning</MenuItem><MenuItem value="maintenance">Maintenance</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="CPU Cores" type="number" value={form.cpu_cores || 0} onChange={e => setForm({ ...form, cpu_cores: +e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Memory (GB)" type="number" value={form.memory_gb || 0} onChange={e => setForm({ ...form, memory_gb: +e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Disk (GB)" type="number" value={form.disk_gb || 0} onChange={e => setForm({ ...form, disk_gb: +e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Brand" value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Model" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Serial" value={form.serial_number || ''} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Management IP" value={form.management_ip || ''} onChange={e => setForm({ ...form, management_ip: e.target.value })} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Rack Location" value={form.rack_location || ''} onChange={e => setForm({ ...form, rack_location: e.target.value })} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Container Modal ──
export function ContainerModal({ open, onClose, onSave, record }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (record) {
      setForm({
        name: record.name, container_type: record.container_type, image: record.image || '',
        cpu_limit: record.cpu_limit || 0, memory_limit: record.memory_limit || 0, status: record.status,
      });
    } else {
      setForm({ name: '', container_type: 'lxc', image: 'debian-12', cpu_limit: 2, memory_limit: 4, status: 'stopped' });
    }
  }, [record, open]);
  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{record ? 'Edit Container' : 'Add Container'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
              <Select label="Type" value={form.container_type || 'lxc'} onChange={e => setForm({ ...form, container_type: e.target.value })}>
                <MenuItem value="lxc">LXC</MenuItem><MenuItem value="lxd">LXD</MenuItem><MenuItem value="docker">Docker</MenuItem><MenuItem value="podman">Podman</MenuItem><MenuItem value="kubernetes">K8s</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Image" value={form.image || ''} onChange={e => setForm({ ...form, image: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status || 'stopped'} onChange={e => setForm({ ...form, status: e.target.value })}>
                <MenuItem value="running">Running</MenuItem><MenuItem value="stopped">Stopped</MenuItem><MenuItem value="paused">Paused</MenuItem><MenuItem value="error">Error</MenuItem>
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="CPU Limit (cores)" type="number" value={form.cpu_limit || 0} onChange={e => setForm({ ...form, cpu_limit: +e.target.value })} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Memory Limit (GB)" type="number" value={form.memory_limit || 0} onChange={e => setForm({ ...form, memory_limit: +e.target.value })} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}
