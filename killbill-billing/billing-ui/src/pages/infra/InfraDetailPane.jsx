import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Button, Chip, IconButton,
  TextField, InputAdornment, Grid,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon,
  Delete as DeleteIcon, ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNotification } from '../../components/ErrorNotification';
import {
  getComputes, createCompute, updateCompute, deleteCompute,
  getNetworkDevices, createNetworkDevice, updateNetworkDevice, deleteNetworkDevice,
  getStorage, getNetworks,
  getDeviceModels, getDeviceAttributes, getIPAddresses,
  getContainers, createContainer, updateContainer,
  createRegion, updateRegion, createAvailabilityZone, updateAvailabilityZone,
  createDatacenter, updateDatacenter,
  getRegions, getAvailabilityZones,
} from '../../services/infra';
import {
  RegionModal, ZoneModal, DatacenterModal,
  NetworkDeviceModal, ComputeModal, ContainerModal,
} from './InfraEntityModal';

const STATUS_COLORS = { active: 'success', inactive: 'default', maintenance: 'warning', running: 'success', stopped: 'default', up: 'success', down: 'error', degraded: 'warning' };

// ── Generic detail card renderer ──
function DetailField({ label, value, mono, bold, xs = 4 }) {
  return (
    <Grid size={{ xs }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontSize={13} fontWeight={bold ? 600 : 400} fontFamily={mono ? 'monospace' : 'inherit'}>{value || '-'}</Typography>
    </Grid>
  );
}

function DetailHeader({ title, subtitle, chips = [], onEdit, onBack }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      {onBack && <IconButton size="small" onClick={onBack}><BackIcon fontSize="small" /></IconButton>}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
      {chips.map((ch, i) => <Chip key={i} label={ch.label} size="small" color={ch.color || 'default'} variant={ch.variant || 'filled'} />)}
      {onEdit && <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={onEdit}>Edit</Button>}
    </Box>
  );
}

// ── Main Detail Pane ──
export default function InfraDetailPane({ selection, onNavigate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deviceModels, setDeviceModels] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [ipAddresses, setIpAddresses] = useState([]);
  const [regions, setRegions] = useState([]);
  const [zones, setZones] = useState([]);
  const { success, error: notifyError } = useNotification();

  const entityType = selection?.type;
  const dcId = selection?.datacenter?.id;

  const isListView = ['computes', 'network_devices', 'storage', 'networks'].includes(entityType);

  // Load list data
  const loadData = useCallback(async () => {
    if (!isListView || !dcId) return;
    setLoading(true); setSearch(''); setPage(0);
    try {
      const domain = [['datacenter_id', '=', dcId]];
      if (entityType === 'computes') setData(await getComputes(domain));
      else if (entityType === 'network_devices') {
        const [devs, models, attrs] = await Promise.all([getNetworkDevices(domain), getDeviceModels(), getDeviceAttributes()]);
        setData(devs); setDeviceModels(models); setAttributes(attrs);
      }
      else if (entityType === 'storage') setData(await getStorage(domain));
      else if (entityType === 'networks') setData(await getNetworks(domain));
      else setData([]);
    } catch (e) { notifyError('Failed to load', e.message); } finally { setLoading(false); }
  }, [entityType, dcId, isListView]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load ref data for modals
  useEffect(() => {
    if (['device_detail', 'add_network_device'].includes(entityType)) {
      if (attributes.length === 0) getDeviceAttributes().then(setAttributes).catch(() => {});
      if (deviceModels.length === 0) getDeviceModels().then(setDeviceModels).catch(() => {});
    }
    if (['add_zone', 'add_datacenter'].includes(entityType)) {
      getRegions().then(setRegions).catch(() => {});
      getAvailabilityZones().then(setZones).catch(() => {});
    }
  }, [entityType]);

  // Auto-open modal for add_* actions
  useEffect(() => {
    if (entityType?.startsWith('add_')) {
      setEditRecord(null);
      setModalOpen(true);
    }
  }, [entityType, selection]);

  useEffect(() => {
    if (editRecord && entityType === 'network_devices')
      getIPAddresses([['network_device_id', '=', editRecord.id]]).then(setIpAddresses).catch(() => {});
    else setIpAddresses([]);
  }, [editRecord, entityType]);

  const filtered = data.filter(d => !search || (d.name || '').toLowerCase().includes(search.toLowerCase()));
  const handleAdd = () => { setEditRecord(null); setModalOpen(true); };
  const handleEdit = (record) => { setEditRecord(record); setModalOpen(true); };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      if (entityType === 'computes') await deleteCompute(id);
      else if (entityType === 'network_devices') await deleteNetworkDevice(id);
      success('Deleted'); loadData();
    } catch (e) { notifyError('Delete failed', e.message); }
  };

  // ── Save handlers ──
  const handleSaveRegion = async (vals) => {
    if (editRecord) { await updateRegion(editRecord.id, vals); success('Region updated'); }
    else { await createRegion(vals); success('Region created'); }
  };
  const handleSaveZone = async (vals) => {
    if (editRecord) { await updateAvailabilityZone(editRecord.id, vals); success('Zone updated'); }
    else { await createAvailabilityZone(vals); success('Zone created'); }
  };
  const handleSaveDC = async (vals) => {
    if (editRecord) { await updateDatacenter(editRecord.id, vals); success('Datacenter updated'); }
    else { await createDatacenter(vals); success('Datacenter created'); }
  };
  const handleSaveCompute = async (vals) => {
    if (editRecord) { await updateCompute(editRecord.id, vals); success('Compute updated'); }
    else { await createCompute({ ...vals, datacenter_id: dcId }); success('Compute created'); }
    loadData();
  };
  const handleSaveDevice = async (vals) => {
    if (editRecord) { await updateNetworkDevice(editRecord.id, vals); success('Device updated'); }
    else { await createNetworkDevice({ ...vals, datacenter_id: dcId }); success('Device created'); }
    loadData();
  };
  const handleSaveContainer = async (vals) => {
    const computeId = selection?.compute?.id;
    if (editRecord) { await updateContainer(editRecord.id, vals); success('Container updated'); }
    else { await createContainer({ ...vals, compute_id: computeId }); success('Container created'); }
  };

  // ── Region detail ──
  if (entityType === 'region_detail' && selection.region) {
    const r = selection.region;
    return (
      <>
        <DetailHeader title={r.name} subtitle={`Code: ${r.code}`}
          chips={[{ label: r.status, color: STATUS_COLORS[r.status] || 'default', variant: 'outlined' }]}
          onEdit={() => { setEditRecord(r); setModalOpen(true); }} />
        <Card sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <DetailField label="Code" value={r.code} xs={4} />
            <DetailField label="Geographic Area" value={r.geographic_area} xs={4} />
            <DetailField label="Status" value={r.status} xs={4} />
            <DetailField label="Zones" value={r.zone_count} xs={4} bold />
          </Grid>
        </Card>
        <RegionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveRegion} record={editRecord} />
      </>
    );
  }

  // ── Zone detail ──
  if (entityType === 'zone_detail' && selection.zone) {
    const z = selection.zone;
    return (
      <>
        <DetailHeader title={z.name} subtitle={`Code: ${z.code} — Region: ${selection.region?.name || ''}`}
          chips={[
            { label: z.zone_type, variant: 'outlined' },
            { label: z.status, color: STATUS_COLORS[z.status] || 'default', variant: 'outlined' },
          ]}
          onBack={() => onNavigate?.({ type: 'region_detail', region: selection.region })}
          onEdit={() => { setEditRecord(z); setModalOpen(true); }} />
        <Card sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <DetailField label="Code" value={z.code} xs={3} />
            <DetailField label="Zone Type" value={z.zone_type} xs={3} />
            <DetailField label="Default" value={z.is_default ? 'Yes' : 'No'} xs={3} />
            <DetailField label="Datacenters" value={z.datacenter_count} xs={3} bold />
          </Grid>
        </Card>
        <ZoneModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveZone} record={editRecord} regions={regions.length ? regions : [selection.region]} />
      </>
    );
  }

  // ── Datacenter detail ──
  if (entityType === 'datacenter_detail' && selection.datacenter) {
    const dc = selection.datacenter;
    return (
      <>
        <DetailHeader title={dc.name} subtitle={`Zone: ${selection.zone?.name || ''}`}
          chips={[
            { label: dc.dc_type, variant: 'outlined' },
            dc.tier ? { label: `Tier ${dc.tier}`, variant: 'outlined' } : null,
            dc.is_dr_site ? { label: 'DR Site', color: 'warning' } : null,
            { label: dc.status, color: STATUS_COLORS[dc.status] || 'default', variant: 'outlined' },
          ].filter(Boolean)}
          onBack={() => onNavigate?.({ type: 'zone_detail', region: selection.region, zone: selection.zone })}
          onEdit={() => { setEditRecord(dc); setModalOpen(true); }} />
        <Card sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <DetailField label="Location" value={dc.location_address} xs={6} />
            <DetailField label="DC Type" value={dc.dc_type} xs={3} />
            <DetailField label="Tier" value={dc.tier ? `Tier ${dc.tier}` : ''} xs={3} />
            <DetailField label="Partner" value={dc.partner_id?.[1]} xs={4} />
            <DetailField label="Latitude" value={dc.latitude} xs={4} />
            <DetailField label="Longitude" value={dc.longitude} xs={4} />
          </Grid>
        </Card>
        <DatacenterModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveDC} record={editRecord} zones={zones.length ? zones : [selection.zone]} />
      </>
    );
  }

  // ── Compute detail ──
  if (entityType === 'compute_detail' && selection.compute) {
    const c = selection.compute;
    return (
      <>
        <DetailHeader title={c.name} subtitle={c.hostname || ''}
          chips={[
            { label: c.node_type === 'dedicated_server' ? 'Server' : 'VM', variant: 'outlined' },
            { label: c.status, color: STATUS_COLORS[c.status] || 'default', variant: 'outlined' },
          ]}
          onBack={() => onNavigate?.({ ...selection, type: 'computes' })}
          onEdit={() => { setEditRecord(c); setModalOpen(true); }} />
        <Card sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <DetailField label="Hostname" value={c.hostname} xs={6} />
            <DetailField label="Management IP" value={c.management_ip} xs={6} mono />
            <DetailField label="CPU Cores" value={c.cpu_cores} xs={3} bold />
            <DetailField label="Memory (GB)" value={c.memory_gb} xs={3} bold />
            <DetailField label="Disk (GB)" value={c.disk_gb} xs={3} bold />
            <DetailField label="OS" value={c.os_type} xs={3} />
            <DetailField label="Brand" value={c.brand} xs={4} />
            <DetailField label="Model" value={c.model} xs={4} />
            <DetailField label="Serial" value={c.serial_number} xs={4} />
            <DetailField label="Rack Location" value={c.rack_location} xs={6} />
            <DetailField label="Datacenter" value={c.datacenter_id?.[1]} xs={6} />
          </Grid>
        </Card>
        <ComputeModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveCompute} record={editRecord} />
      </>
    );
  }

  // ── Container detail ──
  if (entityType === 'container_detail' && selection.container) {
    const ct = selection.container;
    return (
      <>
        <DetailHeader title={ct.name} subtitle={ct.image || ''}
          chips={[
            { label: ct.container_type, variant: 'outlined' },
            { label: ct.status, color: STATUS_COLORS[ct.status] || 'default', variant: 'outlined' },
          ]}
          onBack={() => onNavigate?.({ ...selection, type: 'compute_detail' })}
          onEdit={() => { setEditRecord(ct); setModalOpen(true); }} />
        <Card sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <DetailField label="Container Type" value={ct.container_type} xs={4} />
            <DetailField label="Image" value={ct.image} xs={4} mono />
            <DetailField label="Host" value={ct.compute_id?.[1]} xs={4} />
            <DetailField label="CPU Limit" value={`${ct.cpu_limit || '-'} cores`} xs={4} bold />
            <DetailField label="Memory Limit" value={`${ct.memory_limit || '-'} GB`} xs={4} bold />
            <DetailField label="Status" value={ct.status} xs={4} />
          </Grid>
        </Card>
        <ContainerModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveContainer} record={editRecord} />
      </>
    );
  }

  // ── Device detail ──
  if (entityType === 'device_detail' && selection.device) {
    const d = selection.device;
    const attrMap = {}; attributes.forEach(a => { attrMap[a.id] = a; });
    return (
      <>
        <DetailHeader title={d.name} subtitle={d.device_model_id?.[1] || ''}
          chips={[
            { label: d.operational_status?.toUpperCase(), color: STATUS_COLORS[d.operational_status] || 'default' },
            { label: d.status, color: STATUS_COLORS[d.status] || 'default', variant: 'outlined' },
          ]}
          onBack={() => onNavigate?.({ ...selection, type: 'network_devices' })}
          onEdit={() => { setEditRecord(d); setModalOpen(true); }} />
        <Card sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <DetailField label="Management IP" value={d.management_ip} xs={4} mono />
            <DetailField label="Port" value={d.management_port} xs={2} />
            <DetailField label="Protocol" value={d.management_protocol} xs={2} />
            <DetailField label="Criticality" value={d.criticality} xs={4} />
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">Roles</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.3 }}>
                {(d.device_attribute_ids || []).map(aid => <Chip key={aid} label={attrMap[aid]?.name || aid} size="small" />)}
                {(!d.device_attribute_ids || d.device_attribute_ids.length === 0) && <Typography fontSize={13}>-</Typography>}
              </Box>
            </Grid>
            <DetailField label="Serial" value={d.serial_number} xs={3} />
            <DetailField label="Firmware" value={d.firmware} xs={3} />
            <DetailField label="Rack" value={d.rack_position} xs={3} />
            <DetailField label="Datacenter" value={d.datacenter_id?.[1]} xs={3} />
          </Grid>
        </Card>
        <NetworkDeviceModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveDevice} record={editRecord} deviceModels={deviceModels} attributes={attributes} ipAddresses={ipAddresses} />
      </>
    );
  }

  // ── Add actions (open modal immediately) ──
  if (entityType === 'add_region') {
    return <><Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Add Region</Typography>
      <RegionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveRegion} record={null} /></>;
  }
  if (entityType === 'add_zone') {
    return <><Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Add Zone under {selection.region?.name}</Typography>
      <ZoneModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={(vals) => handleSaveZone({ ...vals, region_id: selection.region?.id || vals.region_id })} record={null} regions={regions.length ? regions : [selection.region]} /></>;
  }
  if (entityType === 'add_datacenter') {
    return <><Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Add Datacenter in {selection.zone?.name}</Typography>
      <DatacenterModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={(vals) => handleSaveDC({ ...vals, zone_id: selection.zone?.id || vals.zone_id })} record={null} zones={zones.length ? zones : [selection.zone]} /></>;
  }
  if (entityType === 'add_compute') {
    return <><Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Add Compute in {selection.datacenter?.name}</Typography>
      <ComputeModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={(vals) => handleSaveCompute({ ...vals, datacenter_id: selection.datacenter?.id })} record={null} /></>;
  }
  if (entityType === 'add_network_device') {
    return <><Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Add Network Device in {selection.datacenter?.name}</Typography>
      <NetworkDeviceModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={(vals) => handleSaveDevice({ ...vals, datacenter_id: selection.datacenter?.id })} record={null} deviceModels={deviceModels} attributes={attributes} ipAddresses={[]} /></>;
  }
  if (entityType === 'add_container') {
    return <><Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Add Container on {selection.compute?.name}</Typography>
      <ContainerModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={(vals) => handleSaveContainer({ ...vals, compute_id: selection.compute?.id })} record={null} /></>;
  }

  // ── Empty state ──
  if (!isListView) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography>Select an item from the tree to view details</Typography>
      </Box>
    );
  }

  // ── List views ──
  const TITLES = { computes: 'Compute Nodes', network_devices: 'Network Devices', storage: 'Storage', networks: 'Networks' };
  const title = TITLES[entityType] || entityType;
  const dcName = selection?.datacenter?.name || '';
  const attrMap = {}; attributes.forEach(a => { attrMap[a.id] = a; });

  const renderTable = () => {
    const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    if (entityType === 'network_devices') {
      return (<Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Model</TableCell><TableCell>Roles</TableCell><TableCell>Mgmt IP</TableCell><TableCell>Op Status</TableCell><TableCell>Criticality</TableCell><TableCell>Status</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead><TableBody>
        {paged.map(d => (<TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleEdit(d)}><TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell><TableCell>{d.device_model_id ? d.device_model_id[1] : '-'}</TableCell><TableCell>{(d.device_attribute_ids || []).map(aid => <Chip key={aid} label={attrMap[aid]?.name || aid} size="small" sx={{ mr: 0.5 }} />)}</TableCell><TableCell><Typography fontSize={12} fontFamily="monospace">{d.management_ip || '-'}</Typography></TableCell><TableCell><Chip label={d.operational_status?.toUpperCase()} size="small" color={STATUS_COLORS[d.operational_status] || 'default'} /></TableCell><TableCell>{d.criticality}</TableCell><TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell><TableCell align="center" onClick={e => e.stopPropagation()}><IconButton size="small" onClick={() => handleEdit(d)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => handleDelete(d.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>))}
      </TableBody></Table>);
    }
    if (entityType === 'computes') {
      return (<Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Hostname</TableCell><TableCell>Type</TableCell><TableCell align="right">CPU</TableCell><TableCell align="right">Mem</TableCell><TableCell align="right">Disk</TableCell><TableCell>IP</TableCell><TableCell>Status</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead><TableBody>
        {paged.map(d => (<TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleEdit(d)}><TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell><TableCell>{d.hostname || '-'}</TableCell><TableCell><Chip label={d.node_type === 'dedicated_server' ? 'Server' : 'VM'} size="small" variant="outlined" /></TableCell><TableCell align="right">{d.cpu_cores}</TableCell><TableCell align="right">{d.memory_gb}</TableCell><TableCell align="right">{d.disk_gb}</TableCell><TableCell><Typography fontSize={12} fontFamily="monospace">{d.management_ip || '-'}</Typography></TableCell><TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell><TableCell align="center" onClick={e => e.stopPropagation()}><IconButton size="small" onClick={() => handleEdit(d)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => handleDelete(d.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>))}
      </TableBody></Table>);
    }
    if (entityType === 'storage') {
      return (<Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell align="right">Capacity</TableCell><TableCell align="right">Used</TableCell><TableCell>Protocol</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>
        {paged.map(d => (<TableRow key={d.id} hover><TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell><TableCell>{d.storage_type}</TableCell><TableCell align="right">{d.capacity_gb} GB</TableCell><TableCell align="right">{d.used_gb} GB</TableCell><TableCell>{d.protocol || '-'}</TableCell><TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell></TableRow>))}
      </TableBody></Table>);
    }
    return (<Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell>CIDR</TableCell><TableCell>VLAN</TableCell><TableCell>Gateway</TableCell><TableCell>DHCP</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>
      {paged.map(d => (<TableRow key={d.id} hover><TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell><TableCell>{d.network_type}</TableCell><TableCell><Typography fontSize={12} fontFamily="monospace">{d.cidr || '-'}</Typography></TableCell><TableCell>{d.vlan_id || '-'}</TableCell><TableCell><Typography fontSize={12} fontFamily="monospace">{d.gateway || '-'}</Typography></TableCell><TableCell>{d.dhcp_enabled ? 'Yes' : 'No'}</TableCell><TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell></TableRow>))}
    </TableBody></Table>);
  };

  const canAdd = entityType === 'computes' || entityType === 'network_devices';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box><Typography variant="h6" fontWeight={700}>{title}</Typography><Typography variant="body2" color="text.secondary">{dcName}</Typography></Box>
        {canAdd && <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd}>Add {entityType === 'network_devices' ? 'Device' : 'Compute'}</Button>}
      </Box>
      <Card sx={{ mb: 2, p: 1.5 }}>
        <TextField size="small" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ width: 300 }} />
      </Card>
      <Card>
        <TableContainer>
          {loading ? <Box sx={{ py: 4, textAlign: 'center' }}><Typography color="text.secondary">Loading...</Typography></Box>
          : filtered.length === 0 ? <Box sx={{ py: 4, textAlign: 'center' }}><Typography color="text.secondary">No records found</Typography></Box>
          : renderTable()}
        </TableContainer>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }} rowsPerPageOptions={[10, 15, 25, 50]} />
      </Card>
      {entityType === 'network_devices' && <NetworkDeviceModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveDevice} record={editRecord} deviceModels={deviceModels} attributes={attributes} ipAddresses={ipAddresses} />}
      {entityType === 'computes' && <ComputeModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveCompute} record={editRecord} />}
    </Box>
  );
}
