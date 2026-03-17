import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  MenuItem, Select, FormControl, InputLabel, IconButton, InputAdornment,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNotification } from '../../components/ErrorNotification';
import { getDeviceModels, createDeviceModel, updateDeviceModel, deleteDeviceModel, getDeviceAttributes } from '../../services/infra';

const DEVICE_TYPES = [
  { value: 'router', label: 'Router' },
  { value: 'switch', label: 'Switch' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'access_point', label: 'Access Point' },
  { value: 'olt', label: 'OLT' },
  { value: 'load_balancer', label: 'Load Balancer' },
  { value: 'gateway', label: 'Gateway' },
];

function DeviceModelModal({ open, onClose, onSave, model, attributes }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (model) {
      setForm({
        name: model.name || '',
        vendor: model.vendor || '',
        device_type: model.device_type || 'router',
        default_attribute_ids: model.default_attribute_ids || [],
        port_count: model.port_count || 0,
        cpu_cores: model.cpu_cores || 0,
        memory_mb: model.memory_mb || 0,
        storage_gb: model.storage_gb || 0,
        product_url: model.product_url || '',
        description: model.description || '',
      });
    } else {
      setForm({
        name: '', vendor: 'MikroTik', device_type: 'router',
        default_attribute_ids: [], port_count: 0, cpu_cores: 0,
        memory_mb: 0, storage_gb: 0, product_url: '', description: '',
      });
    }
  }, [model, open]);

  const selectedAttrs = attributes.filter(a => form.default_attribute_ids?.includes(a.id));

  const handleSave = async () => {
    if (!form.name || !form.vendor) return;
    setSaving(true);
    try {
      const vals = {
        ...form,
        default_attribute_ids: [[6, 0, form.default_attribute_ids || []]],
      };
      if (model) {
        await updateDeviceModel(model.id, vals);
      } else {
        await createDeviceModel(vals);
      }
      onSave();
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{model ? 'Edit Device Model' : 'Add Device Model'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 8 }}>
            <TextField fullWidth size="small" label="Model Name" required
              value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="Vendor" required
              value={form.vendor || ''} onChange={e => setForm({ ...form, vendor: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Device Type</InputLabel>
              <Select label="Device Type" value={form.device_type || 'router'}
                onChange={e => setForm({ ...form, device_type: e.target.value })}>
                {DEVICE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Autocomplete
              multiple size="small"
              options={attributes}
              getOptionLabel={a => a.name}
              value={selectedAttrs}
              onChange={(_, newVal) => setForm({ ...form, default_attribute_ids: newVal.map(a => a.id) })}
              renderInput={(params) => <TextField {...params} label="Default Roles" />}
              renderTags={(value, getTagProps) =>
                value.map((opt, i) => <Chip {...getTagProps({ index: i })} key={opt.id} label={opt.name} size="small" />)
              }
            />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <TextField fullWidth size="small" label="Ports" type="number"
              value={form.port_count || 0} onChange={e => setForm({ ...form, port_count: +e.target.value })} />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <TextField fullWidth size="small" label="CPU Cores" type="number"
              value={form.cpu_cores || 0} onChange={e => setForm({ ...form, cpu_cores: +e.target.value })} />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <TextField fullWidth size="small" label="Memory (MB)" type="number"
              value={form.memory_mb || 0} onChange={e => setForm({ ...form, memory_mb: +e.target.value })} />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <TextField fullWidth size="small" label="Storage (GB)" type="number"
              value={form.storage_gb || 0} onChange={e => setForm({ ...form, storage_gb: +e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Product URL"
              value={form.product_url || ''} onChange={e => setForm({ ...form, product_url: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Description" multiline rows={2}
              value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function InfraDeviceCatalog() {
  const [models, setModels] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [editModel, setEditModel] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { success, error: notifyError } = useNotification();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([getDeviceModels(), getDeviceAttributes()]);
      setModels(m);
      setAttributes(a);
    } catch (e) {
      notifyError('Failed to load device catalog', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = models.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase())
      || m.vendor.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || m.device_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this device model?')) return;
    try {
      await deleteDeviceModel(id);
      success('Device model deleted');
      loadData();
    } catch (e) {
      notifyError('Delete failed', e.message);
    }
  };

  const attrMap = {};
  attributes.forEach(a => { attrMap[a.id] = a; });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Device Catalog</Typography>
          <Typography variant="body2" color="text.secondary">Equipment models and specifications</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditModel(null); setModalOpen(true); }}>
            Add Model
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 2, p: 2, display: 'flex', gap: 2 }}>
        <TextField size="small" placeholder="Search models..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Types</MenuItem>
            {DEVICE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Model</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Default Roles</TableCell>
                <TableCell align="right">Ports</TableCell>
                <TableCell align="right">CPU</TableCell>
                <TableCell align="right">Memory</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No device models found</TableCell></TableRow>
              ) : (
                filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(m => (
                  <TableRow key={m.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => { setEditModel(m); setModalOpen(true); }}>
                    <TableCell><Typography fontWeight={600} fontSize={13}>{m.name}</Typography></TableCell>
                    <TableCell>{m.vendor}</TableCell>
                    <TableCell>
                      <Chip label={DEVICE_TYPES.find(t => t.value === m.device_type)?.label || m.device_type}
                        size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {(m.default_attribute_ids || []).map(aid => (
                        <Chip key={aid} label={attrMap[aid]?.name || aid} size="small" sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell align="right">{m.port_count}</TableCell>
                    <TableCell align="right">{m.cpu_cores}</TableCell>
                    <TableCell align="right">{m.memory_mb >= 1024 ? `${(m.memory_mb / 1024).toFixed(0)} GB` : `${m.memory_mb} MB`}</TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => { setEditModel(m); setModalOpen(true); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(m.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={filtered.length}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 15, 25, 50]}
        />
      </Card>

      <DeviceModelModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={() => { success(editModel ? 'Model updated' : 'Model created'); loadData(); }}
        model={editModel}
        attributes={attributes}
      />
    </Box>
  );
}
