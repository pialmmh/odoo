import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment, Button, IconButton, Tooltip,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  listTeams, createTeam, updateTeam, deleteTeam,
} from '../../../../services/crm';
import { AdminPageHeader, fmtDate } from '../_shared';

function TeamDialog({ open, onClose, team, onSaved }) {
  const isEdit = !!team?.id;
  const [form, setForm] = useState({ name: '' });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setErr(null);
      setForm({ name: team?.name || '' });
    }
  }, [open, team]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (isEdit) await updateTeam(team.id, form); else await createTeam(form);
      onSaved?.(); onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Edit Team — ${team.name}` : 'Create Team'}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <TextField fullWidth size="small" label="Name" sx={{ mt: 1 }}
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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

export default function Teams() {
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
      const res = await listTeams(params);
      setRows(res.list || []); setTotal(res.total ?? 0); setErr(null);
    } catch (e) {
      setErr('Failed to load teams: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rpp, search]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (t) => {
    if (!confirm(`Delete team "${t.name}"?`)) return;
    try { await deleteTeam(t.id); load(); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <AdminPageHeader sectionLabel="Users" title="Teams" subtitle="Teams management."
        actions={
          <>
            <Button variant="contained" size="small" startIcon={<AddIcon />}
              onClick={() => { setEditing(null); setDialogOpen(true); }}>Create Team</Button>
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
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => { setEditing(t); setDialogOpen(true); }}>
                      <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtDate(t.createdAt)}</TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(t); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(t)} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>No teams found</TableCell></TableRow>}
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

      <TeamDialog open={dialogOpen} onClose={() => setDialogOpen(false)} team={editing} onSaved={load} />
    </Box>
  );
}
