import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment, Button, IconButton, Tooltip,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Chip, Link as MuiLink,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon, OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  listRoles, createRole, updateRole, deleteRole,
  ASSIGNMENT_PERMISSIONS,
} from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';
import { ESPO_BASE_URL } from '../adminPanelSpec';

function RoleDialog({ open, onClose, role, onSaved }) {
  const isEdit = !!role?.id;
  const [form, setForm] = useState({});
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setErr(null);
      setForm(isEdit ? {
        name: role.name || '',
        assignmentPermission: role.assignmentPermission || 'all',
        userPermission: role.userPermission || 'all',
        portalPermission: role.portalPermission || 'not-set',
      } : {
        name: '',
        assignmentPermission: 'all',
        userPermission: 'all',
        portalPermission: 'not-set',
      });
    }
  }, [open, role, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (isEdit) await updateRole(role.id, form); else await createRole(form);
      onSaved?.(); onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
    setSaving(false);
  };

  const espoEditUrl = isEdit ? `${ESPO_BASE_URL}/#Role/edit/${role.id}` : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Edit Role — ${role.name}` : 'Create Role'}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Basic role fields are editable here. For the full scope/field-level ACL matrix, edit in EspoCRM.
          {espoEditUrl && (
            <>
              {' '}
              <MuiLink href={espoEditUrl} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                Open ACL editor <OpenInNewIcon sx={{ fontSize: 13 }} />
              </MuiLink>
            </>
          )}
        </Alert>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Name *"
              value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Assignment Permission</InputLabel>
              <Select value={form.assignmentPermission || 'all'} label="Assignment Permission"
                onChange={(e) => set('assignmentPermission', e.target.value)}>
                {ASSIGNMENT_PERMISSIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>User Permission</InputLabel>
              <Select value={form.userPermission || 'all'} label="User Permission"
                onChange={(e) => set('userPermission', e.target.value)}>
                {ASSIGNMENT_PERMISSIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Portal Permission</InputLabel>
              <Select value={form.portalPermission || 'not-set'} label="Portal Permission"
                onChange={(e) => set('portalPermission', e.target.value)}>
                <MenuItem value="not-set">not-set</MenuItem>
                <MenuItem value="all">all</MenuItem>
                <MenuItem value="account">account</MenuItem>
                <MenuItem value="contact">contact</MenuItem>
                <MenuItem value="own">own</MenuItem>
                <MenuItem value="no">no</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !form.name}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Roles() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(20);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rpp, offset: page * rpp, orderBy: 'name', order: 'asc' };
      if (search.trim()) {
        params['where[0][type]'] = 'textFilter';
        params['where[0][value]'] = search.trim();
      }
      const res = await listRoles(params);
      setRows(res.list || []); setTotal(res.total ?? 0); setErr(null);
    } catch (e) {
      setErr('Failed to load roles: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, search]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (r) => {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try { await deleteRole(r.id); load(); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader sectionLabel="Users" title="Roles" subtitle="Roles management."
        actions={
          <>
            <Button variant="contained" size="small" startIcon={<AddIcon />}
              onClick={() => { setEditing(null); setDialogOpen(true); }}>Create Role</Button>
            <Tooltip title="Refresh"><IconButton size="small" onClick={load}><RefreshIcon /></IconButton></Tooltip>
          </>
        }
      />
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Box>

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assignment</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Portal</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => { setEditing(r); setDialogOpen(true); }}>
                      <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                      <TableCell><Chip size="small" label={r.assignmentPermission || '—'} variant="outlined" sx={{ fontSize: 11 }} /></TableCell>
                      <TableCell><Chip size="small" label={r.userPermission || '—'} variant="outlined" sx={{ fontSize: 11 }} /></TableCell>
                      <TableCell><Chip size="small" label={r.portalPermission || '—'} variant="outlined" sx={{ fontSize: 11 }} /></TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(r.createdAt)}</TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Edit in EspoCRM (full ACL)">
                          <IconButton size="small" component="a" target="_blank" rel="noopener"
                            href={`${ESPO_BASE_URL}/#Role/edit/${r.id}`}>
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(r); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(r)} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No roles found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rpp}
              onRowsPerPageChange={(e) => { setRpp(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]} />
          </>
        )}
      </Card>

      <RoleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} role={editing} onSaved={load} />
    </Box>
  );
}
