import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Button, Chip, IconButton,
  TextField, InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNotification } from '../../components/ErrorNotification';
import {
  getComputes, createCompute, updateCompute, deleteCompute,
  getNetworkDevices, createNetworkDevice, updateNetworkDevice, deleteNetworkDevice,
  getStorage, createStorage, updateStorage,
  getNetworks, createNetwork, updateNetwork,
  getDeviceModels, getDeviceAttributes, getIPAddresses,
} from '../../services/infra';
import { NetworkDeviceModal, ComputeModal } from './InfraEntityModal';

const STATUS_COLORS = { active: 'success', inactive: 'default', maintenance: 'warning', running: 'success', stopped: 'default', up: 'success', down: 'error', degraded: 'warning' };

export default function InfraDetailPane({ selection }) {
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
  const { success, error: notifyError } = useNotification();

  const entityType = selection?.type;
  const dcId = selection?.datacenter?.id;

  const loadData = useCallback(async () => {
    if (!entityType || !dcId) return;
    setLoading(true);
    setSearch('');
    setPage(0);
    try {
      const domain = [['datacenter_id', '=', dcId]];
      switch (entityType) {
        case 'computes':
          setData(await getComputes(domain));
          break;
        case 'network_devices': {
          const [devices, models, attrs] = await Promise.all([
            getNetworkDevices(domain), getDeviceModels(), getDeviceAttributes(),
          ]);
          setData(devices);
          setDeviceModels(models);
          setAttributes(attrs);
          break;
        }
        case 'storage':
          setData(await getStorage(domain));
          break;
        case 'networks':
          setData(await getNetworks(domain));
          break;
        default:
          setData([]);
      }
    } catch (e) {
      notifyError('Failed to load data', e.message);
    } finally {
      setLoading(false);
    }
  }, [entityType, dcId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = data.filter(d => !search || (d.name || '').toLowerCase().includes(search.toLowerCase()));

  const handleAdd = () => { setEditRecord(null); setModalOpen(true); };
  const handleEdit = (record) => { setEditRecord(record); setModalOpen(true); };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      if (entityType === 'computes') await deleteCompute(id);
      else if (entityType === 'network_devices') await deleteNetworkDevice(id);
      success('Deleted');
      loadData();
    } catch (e) {
      notifyError('Delete failed', e.message);
    }
  };

  const handleSaveDevice = async (vals) => {
    if (editRecord) {
      await updateNetworkDevice(editRecord.id, vals);
      success('Device updated');
    } else {
      await createNetworkDevice({ ...vals, datacenter_id: dcId });
      success('Device created');
    }
    loadData();
  };

  const handleSaveCompute = async (vals) => {
    if (editRecord) {
      await updateCompute(editRecord.id, vals);
      success('Compute updated');
    } else {
      await createCompute({ ...vals, datacenter_id: dcId });
      success('Compute created');
    }
    loadData();
  };

  // Load IPs when editing a network device
  useEffect(() => {
    if (editRecord && entityType === 'network_devices') {
      getIPAddresses([['network_device_id', '=', editRecord.id]]).then(setIpAddresses).catch(() => {});
    } else {
      setIpAddresses([]);
    }
  }, [editRecord, entityType]);

  if (!entityType || !dcId) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography>Select an item from the tree to view details</Typography>
      </Box>
    );
  }

  const TITLES = { computes: 'Compute Nodes', network_devices: 'Network Devices', storage: 'Storage', networks: 'Networks' };
  const title = TITLES[entityType] || entityType;
  const dcName = selection?.datacenter?.name || '';

  const attrMap = {};
  attributes.forEach(a => { attrMap[a.id] = a; });

  const renderTable = () => {
    const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    if (entityType === 'network_devices') {
      return (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Mgmt IP</TableCell>
              <TableCell>Op Status</TableCell>
              <TableCell>Criticality</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map(d => (
              <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleEdit(d)}>
                <TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell>
                <TableCell>{d.device_model_id ? d.device_model_id[1] : '-'}</TableCell>
                <TableCell>
                  {(d.device_attribute_ids || []).map(aid => (
                    <Chip key={aid} label={attrMap[aid]?.name || aid} size="small" sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell><Typography fontSize={12} fontFamily="monospace">{d.management_ip || '-'}</Typography></TableCell>
                <TableCell><Chip label={d.operational_status?.toUpperCase()} size="small" color={STATUS_COLORS[d.operational_status] || 'default'} /></TableCell>
                <TableCell>{d.criticality}</TableCell>
                <TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell>
                <TableCell align="center" onClick={e => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => handleEdit(d)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(d.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    if (entityType === 'computes') {
      return (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">CPU</TableCell>
              <TableCell align="right">Mem (GB)</TableCell>
              <TableCell align="right">Disk (GB)</TableCell>
              <TableCell>Mgmt IP</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map(d => (
              <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleEdit(d)}>
                <TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell>
                <TableCell>{d.hostname || '-'}</TableCell>
                <TableCell><Chip label={d.node_type === 'dedicated_server' ? 'Server' : 'VM'} size="small" variant="outlined" /></TableCell>
                <TableCell align="right">{d.cpu_cores}</TableCell>
                <TableCell align="right">{d.memory_gb}</TableCell>
                <TableCell align="right">{d.disk_gb}</TableCell>
                <TableCell><Typography fontSize={12} fontFamily="monospace">{d.management_ip || '-'}</Typography></TableCell>
                <TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell>
                <TableCell align="center" onClick={e => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => handleEdit(d)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(d.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    if (entityType === 'storage') {
      return (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Capacity (GB)</TableCell>
              <TableCell align="right">Used (GB)</TableCell>
              <TableCell>Protocol</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map(d => (
              <TableRow key={d.id} hover>
                <TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell>
                <TableCell>{d.storage_type}</TableCell>
                <TableCell align="right">{d.capacity_gb}</TableCell>
                <TableCell align="right">{d.used_gb}</TableCell>
                <TableCell>{d.protocol || '-'}</TableCell>
                <TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // networks
    return (
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>CIDR</TableCell>
            <TableCell>VLAN ID</TableCell>
            <TableCell>Gateway</TableCell>
            <TableCell>DHCP</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paged.map(d => (
            <TableRow key={d.id} hover>
              <TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell>
              <TableCell>{d.network_type}</TableCell>
              <TableCell><Typography fontSize={12} fontFamily="monospace">{d.cidr || '-'}</Typography></TableCell>
              <TableCell>{d.vlan_id || '-'}</TableCell>
              <TableCell><Typography fontSize={12} fontFamily="monospace">{d.gateway || '-'}</Typography></TableCell>
              <TableCell>{d.dhcp_enabled ? 'Yes' : 'No'}</TableCell>
              <TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} variant="outlined" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const canAdd = entityType === 'computes' || entityType === 'network_devices';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{dcName}</Typography>
        </Box>
        {canAdd && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd}>
            Add {entityType === 'network_devices' ? 'Device' : 'Compute'}
          </Button>
        )}
      </Box>

      <Card sx={{ mb: 2, p: 1.5, display: 'flex', gap: 2 }}>
        <TextField size="small" placeholder="Search..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 300 }}
        />
      </Card>

      <Card>
        <TableContainer>
          {loading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><Typography color="text.secondary">Loading...</Typography></Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><Typography color="text.secondary">No records found</Typography></Box>
          ) : renderTable()}
        </TableContainer>
        <TablePagination component="div" count={filtered.length}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 15, 25, 50]}
        />
      </Card>

      {entityType === 'network_devices' && (
        <NetworkDeviceModal
          open={modalOpen} onClose={() => setModalOpen(false)}
          onSave={handleSaveDevice} record={editRecord}
          deviceModels={deviceModels} attributes={attributes}
          ipAddresses={ipAddresses}
        />
      )}
      {entityType === 'computes' && (
        <ComputeModal
          open={modalOpen} onClose={() => setModalOpen(false)}
          onSave={handleSaveCompute} record={editRecord}
        />
      )}
    </Box>
  );
}
