import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Button, Chip, Tab, Tabs,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  MenuItem, Select, FormControl, InputLabel, IconButton, InputAdornment,
  Autocomplete, Switch, FormControlLabel, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  Edit as EditIcon, Delete as DeleteIcon, Security as SecurityIcon,
} from '@mui/icons-material';
import { useNotification } from '../components/ErrorNotification';
import {
  getPermissions, createPermission, updatePermission, deletePermission,
  getRoles, createRole, updateRole, deleteRole,
  getUrlPatterns, createUrlPattern, updateUrlPattern, deleteUrlPattern,
} from '../services/rbac';

const MODULES = [
  { value: 'infra', label: 'Infrastructure' },
  { value: 'ssh', label: 'SSH Management' },
  { value: 'artifact', label: 'Artifacts & Deploy' },
  { value: 'billing', label: 'Billing' },
  { value: 'catalog', label: 'Device Catalog' },
  { value: 'settings', label: 'Settings' },
  { value: 'admin', label: 'Administration' },
];

const ACTIONS = [
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit / Create' },
  { value: 'delete', label: 'Delete' },
  { value: 'manage', label: 'Full Manage' },
  { value: 'deploy', label: 'Deploy / Execute' },
  { value: 'switch', label: 'Switch / Select' },
];

// ── Permission Dialog ──
function PermissionDialog({ open, onClose, onSave, record }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(record
      ? { name: record.name, code: record.code, module: record.module, action: record.action, description: record.description || '', is_active: record.is_active }
      : { name: '', code: '', module: 'infra', action: 'view', description: '', is_active: true });
  }, [record, open]);

  const handleSave = async () => {
    if (!form.name || !form.code) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? 'Edit Permission' : 'Add Permission'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 7 }}>
            <TextField fullWidth size="small" label="Name" required
              value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })}
              helperText='e.g. "View Infrastructure"' />
          </Grid>
          <Grid size={{ xs: 5 }}>
            <TextField fullWidth size="small" label="Code" required
              value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })}
              helperText='e.g. "infra:view"' />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>Module</InputLabel>
              <Select label="Module" value={form.module || 'infra'} onChange={e => setForm({ ...form, module: e.target.value })}>
                {MODULES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Action</InputLabel>
              <Select label="Action" value={form.action || 'view'} onChange={e => setForm({ ...form, action: e.target.value })}>
                {ACTIONS.map(a => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 2 }}>
            <FormControlLabel control={<Switch checked={form.is_active ?? true} onChange={e => setForm({ ...form, is_active: e.target.checked })} />} label="Active" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Description" multiline rows={2}
              value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Role Dialog ──
function RoleDialog({ open, onClose, onSave, record, allPermissions }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(record
      ? { name: record.name, code: record.code, description: record.description || '', sequence: record.sequence || 10, is_active: record.is_active, permission_ids: record.permission_ids || [] }
      : { name: '', code: '', description: '', sequence: 10, is_active: true, permission_ids: [] });
  }, [record, open]);

  const selectedPerms = allPermissions.filter(p => form.permission_ids?.includes(p.id));

  const handleSave = async () => {
    if (!form.name || !form.code) return;
    setSaving(true);
    try {
      const vals = { ...form, permission_ids: [[6, 0, form.permission_ids || []]] };
      await onSave(vals);
      onClose();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? 'Edit Role' : 'Add Role'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 7 }}>
            <TextField fullWidth size="small" label="Role Name" required
              value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 5 }}>
            <TextField fullWidth size="small" label="Code" required
              value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })}
              helperText="Must match Keycloak role" />
          </Grid>
          <Grid size={{ xs: 9 }}>
            <TextField fullWidth size="small" label="Description"
              value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <FormControlLabel control={<Switch checked={form.is_active ?? true} onChange={e => setForm({ ...form, is_active: e.target.checked })} />} label="Active" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Autocomplete multiple size="small" options={allPermissions}
              getOptionLabel={p => `${p.code} — ${p.name}`}
              groupBy={p => MODULES.find(m => m.value === p.module)?.label || p.module}
              value={selectedPerms}
              onChange={(_, newVal) => setForm({ ...form, permission_ids: newVal.map(p => p.id) })}
              renderInput={(params) => <TextField {...params} label="Permissions" />}
              renderTags={(value, getTagProps) => value.map((opt, i) =>
                <Chip {...getTagProps({ index: i })} key={opt.id} label={opt.code} size="small" />
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── URL Pattern Dialog ──
function UrlPatternDialog({ open, onClose, onSave, record, allPermissions }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(record
      ? { name: record.name, url_pattern: record.url_pattern, http_methods: record.http_methods || 'ALL', menu_label: record.menu_label || '', permission_ids: record.permission_ids || [], description: record.description || '', sequence: record.sequence || 10, is_active: record.is_active }
      : { name: '', url_pattern: '', http_methods: 'ALL', menu_label: '', permission_ids: [], description: '', sequence: 10, is_active: true });
  }, [record, open]);

  const selectedPerms = allPermissions.filter(p => form.permission_ids?.includes(p.id));

  const handleSave = async () => {
    if (!form.name || !form.url_pattern) return;
    setSaving(true);
    try {
      const vals = { ...form, permission_ids: [[6, 0, form.permission_ids || []]] };
      await onSave(vals);
      onClose();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? 'Edit URL Pattern' : 'Add URL Pattern'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 7 }}>
            <TextField fullWidth size="small" label="Name" required
              value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 5 }}>
            <TextField fullWidth size="small" label="URL Pattern" required
              value={form.url_pattern || ''} onChange={e => setForm({ ...form, url_pattern: e.target.value })}
              helperText='e.g. "/*/infra", "/*/infra/*"' />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="HTTP Methods"
              value={form.http_methods || 'ALL'} onChange={e => setForm({ ...form, http_methods: e.target.value })}
              helperText="ALL or GET,POST,..." />
          </Grid>
          <Grid size={{ xs: 5 }}>
            <TextField fullWidth size="small" label="Menu Label"
              value={form.menu_label || ''} onChange={e => setForm({ ...form, menu_label: e.target.value })}
              helperText='Sidebar label, e.g. "Infra"' />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <FormControlLabel control={<Switch checked={form.is_active ?? true} onChange={e => setForm({ ...form, is_active: e.target.checked })} />} label="Active" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Autocomplete multiple size="small" options={allPermissions}
              getOptionLabel={p => `${p.code} — ${p.name}`}
              value={selectedPerms}
              onChange={(_, newVal) => setForm({ ...form, permission_ids: newVal.map(p => p.id) })}
              renderInput={(params) => <TextField {...params} label="Required Permissions" />}
              renderTags={(value, getTagProps) => value.map((opt, i) =>
                <Chip {...getTagProps({ index: i })} key={opt.id} label={opt.code} size="small" />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Description" multiline rows={2}
              value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Main Page ──
export default function RBACManagement() {
  const [tab, setTab] = useState(0);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [urlPatterns, setUrlPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [permOpen, setPermOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const { success, error: notifyError } = useNotification();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, u] = await Promise.all([getPermissions(), getRoles(), getUrlPatterns()]);
      setPermissions(p);
      setRoles(r);
      setUrlPatterns(u);
    } catch (e) {
      notifyError('Failed to load RBAC config', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const permMap = {};
  permissions.forEach(p => { permMap[p.id] = p; });

  const filtered = (list) => list.filter(item =>
    !search || (item.name || '').toLowerCase().includes(search.toLowerCase())
    || (item.code || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDeletePerm = async (id) => {
    if (!confirm('Delete this permission?')) return;
    try { await deletePermission(id); success('Permission deleted'); loadData(); } catch (e) { notifyError('Delete failed', e.message); }
  };
  const handleDeleteRole = async (id) => {
    if (!confirm('Delete this role?')) return;
    try { await deleteRole(id); success('Role deleted'); loadData(); } catch (e) { notifyError('Delete failed', e.message); }
  };
  const handleDeleteUrl = async (id) => {
    if (!confirm('Delete this URL pattern?')) return;
    try { await deleteUrlPattern(id); success('URL pattern deleted'); loadData(); } catch (e) { notifyError('Delete failed', e.message); }
  };

  const handleSavePerm = async (vals) => {
    if (editRecord) { await updatePermission(editRecord.id, vals); success('Permission updated'); }
    else { await createPermission(vals); success('Permission created'); }
    loadData();
  };
  const handleSaveRole = async (vals) => {
    if (editRecord) { await updateRole(editRecord.id, vals); success('Role updated'); }
    else { await createRole(vals); success('Role created'); }
    loadData();
  };
  const handleSaveUrl = async (vals) => {
    if (editRecord) { await updateUrlPattern(editRecord.id, vals); success('URL pattern updated'); }
    else { await createUrlPattern(vals); success('URL pattern created'); }
    loadData();
  };

  const addButtons = [
    <Button key="0" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditRecord(null); setPermOpen(true); }}>Add Permission</Button>,
    <Button key="1" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditRecord(null); setRoleOpen(true); }}>Add Role</Button>,
    <Button key="2" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditRecord(null); setUrlOpen(true); }}>Add URL Pattern</Button>,
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>RBAC Configuration</Typography>
          <Typography variant="body2" color="text.secondary">Manage roles, permissions, and URL access patterns</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
          {addButtons[tab]}
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(''); }} sx={{ mb: 2 }}>
        <Tab icon={<SecurityIcon />} iconPosition="start" label={`Permissions (${permissions.length})`} />
        <Tab label={`Roles (${roles.length})`} />
        <Tab label={`URL Patterns (${urlPatterns.length})`} />
      </Tabs>

      <Card sx={{ mb: 2, p: 1.5 }}>
        <TextField size="small" placeholder="Search..." value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 300 }} />
      </Card>

      {/* Permissions Tab */}
      {tab === 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Module</TableCell>
                <TableCell>Action</TableCell><TableCell>Active</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                ) : filtered(permissions).map(p => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => { setEditRecord(p); setPermOpen(true); }}>
                    <TableCell><Typography fontWeight={600} fontSize={13}>{p.name}</Typography></TableCell>
                    <TableCell><Chip label={p.code} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} /></TableCell>
                    <TableCell><Chip label={MODULES.find(m => m.value === p.module)?.label || p.module} size="small" /></TableCell>
                    <TableCell>{ACTIONS.find(a => a.value === p.action)?.label || p.action}</TableCell>
                    <TableCell><Chip label={p.is_active ? 'Yes' : 'No'} size="small" color={p.is_active ? 'success' : 'default'} /></TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => { setEditRecord(p); setPermOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeletePerm(p.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Roles Tab */}
      {tab === 1 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Role</TableCell><TableCell>Code (Keycloak)</TableCell>
                <TableCell>Permissions</TableCell><TableCell>Active</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                ) : filtered(roles).map(r => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => { setEditRecord(r); setRoleOpen(true); }}>
                    <TableCell>
                      <Typography fontWeight={600} fontSize={13}>{r.name}</Typography>
                      {r.description && <Typography fontSize={11} color="text.secondary">{r.description}</Typography>}
                    </TableCell>
                    <TableCell><Chip label={r.code} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} /></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(r.permission_ids || []).slice(0, 6).map(pid => (
                          <Chip key={pid} label={permMap[pid]?.code || pid} size="small" sx={{ fontSize: 10 }} />
                        ))}
                        {(r.permission_ids || []).length > 6 && (
                          <Chip label={`+${r.permission_ids.length - 6} more`} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={r.is_active ? 'Yes' : 'No'} size="small" color={r.is_active ? 'success' : 'default'} /></TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => { setEditRecord(r); setRoleOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteRole(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* URL Patterns Tab */}
      {tab === 2 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Name</TableCell><TableCell>URL Pattern</TableCell><TableCell>Methods</TableCell>
                <TableCell>Menu Label</TableCell><TableCell>Permissions</TableCell><TableCell>Active</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                ) : filtered(urlPatterns).map(u => (
                  <TableRow key={u.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => { setEditRecord(u); setUrlOpen(true); }}>
                    <TableCell><Typography fontWeight={600} fontSize={13}>{u.name}</Typography></TableCell>
                    <TableCell><Typography fontSize={12} fontFamily="monospace">{u.url_pattern}</Typography></TableCell>
                    <TableCell><Chip label={u.http_methods || 'ALL'} size="small" variant="outlined" /></TableCell>
                    <TableCell>{u.menu_label || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(u.permission_ids || []).map(pid => (
                          <Chip key={pid} label={permMap[pid]?.code || pid} size="small" sx={{ fontSize: 10 }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={u.is_active ? 'Yes' : 'No'} size="small" color={u.is_active ? 'success' : 'default'} /></TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => { setEditRecord(u); setUrlOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteUrl(u.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <PermissionDialog open={permOpen} onClose={() => setPermOpen(false)} onSave={handleSavePerm} record={editRecord} />
      <RoleDialog open={roleOpen} onClose={() => setRoleOpen(false)} onSave={handleSaveRole} record={editRecord} allPermissions={permissions} />
      <UrlPatternDialog open={urlOpen} onClose={() => setUrlOpen(false)} onSave={handleSaveUrl} record={editRecord} allPermissions={permissions} />
    </Box>
  );
}
