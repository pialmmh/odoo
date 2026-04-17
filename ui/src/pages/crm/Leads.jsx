import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Select,
  MenuItem, FormControl, InputLabel, Link as MuiLink,
  Menu, Checkbox, ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import {
  listLeads, deleteLead,
  LEAD_STATUSES,
} from '../../services/crm';
import { useRBAC } from '../../hooks/useRBAC';
import LeadDialog from './LeadDialog';

// Status chip colors — mirror Lead.json → fields.status.style
const STATUS_COLORS = {
  'New':        { bg: 'grey.200',       color: 'text.primary' },
  'Assigned':   { bg: 'warning.light',  color: 'warning.dark' },
  'In Process': { bg: 'primary.light',  color: 'primary.contrastText' },
  'Converted':  { bg: 'success.light',  color: 'success.contrastText' },
  'Recycled':   { bg: 'info.light',     color: 'info.dark' },
  'Dead':       { bg: 'grey.300',       color: 'text.secondary' },
};

// Columns match layouts/Lead/list.json. "hidden" defaults to espo's hidden flag
// — user can toggle via the column picker.
const COLUMNS = [
  { key: 'name',         label: 'Name',          alwaysShown: true },
  { key: 'status',       label: 'Status',        defaultVisible: true },
  { key: 'emailAddress', label: 'Email',         defaultVisible: true },
  { key: 'phoneNumber',  label: 'Phone',         defaultVisible: false },
  { key: 'source',       label: 'Source',        defaultVisible: false },
  { key: 'assignedUser', label: 'Assigned User', defaultVisible: true },
  { key: 'createdAt',    label: 'Created',       defaultVisible: true },
];

export default function Leads() {
  const { canAction } = useRBAC();
  const canEdit = canAction('crm.edit');

  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [colMenu, setColMenu] = useState(null);
  const [visibleCols, setVisibleCols] = useState(
    () => new Set(COLUMNS.filter(c => c.alwaysShown || c.defaultVisible).map(c => c.key))
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        maxSize: rowsPerPage,
        offset: page * rowsPerPage,
        orderBy: 'createdAt',
        order: 'desc',
      };
      let idx = 0;
      if (statusFilter !== 'all') {
        params[`where[${idx}][type]`]      = 'equals';
        params[`where[${idx}][attribute]`] = 'status';
        params[`where[${idx}][value]`]     = statusFilter;
        idx++;
      }
      if (search.trim()) {
        params[`where[${idx}][type]`]  = 'textFilter';
        params[`where[${idx}][value]`] = search.trim();
      }
      const res = await listLeads(params);
      setLeads(res.list || []);
      setTotal(res.total ?? (res.list?.length || 0));
      setError(null);
    } catch (e) {
      setError('Failed to load leads: ' + (e?.response?.data?.message || e.message));
    }
    setLoading(false);
  }, [page, rowsPerPage, statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // Ctrl+Space = create new lead (mirrors EspoCRM's keyboard shortcut).
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.code === 'Space' && !dialogOpen) {
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dialogOpen]);

  const handleDelete = async (lead, e) => {
    e.stopPropagation();
    const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    if (!confirm(`Delete lead "${name}"? This cannot be undone.`)) return;
    try {
      await deleteLead(lead.id);
      loadData();
    } catch (err) {
      alert('Delete failed: ' + (err?.response?.data?.message || err.message));
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (lead, e) => {
    e?.stopPropagation?.();
    setEditing(lead);
    setDialogOpen(true);
  };

  const toggleCol = (key) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const shownCols = COLUMNS.filter(c => c.alwaysShown || visibleCols.has(c.key));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Leads</Typography>
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'lead' : 'leads'} total
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Create button — cloned from EspoCRM list.js setupCreateButton():
              'Create <Scope>' label, fa-plus icon, default style, title Ctrl+Space. */}
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={openNew}
            title="Ctrl+Space"
            sx={{
              bgcolor: 'grey.900',
              color: 'common.white',
              fontWeight: 600,
              '&:hover': { bgcolor: 'grey.800' },
            }}
          >
            Create Lead
          </Button>
          <Tooltip title="Columns">
            <IconButton onClick={e => setColMenu(e.currentTarget)} size="small">
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
          <Menu anchorEl={colMenu} open={!!colMenu} onClose={() => setColMenu(null)}>
            {COLUMNS.filter(c => !c.alwaysShown).map(col => (
              <MenuItem key={col.key} onClick={() => toggleCol(col.key)} dense>
                <Checkbox size="small" checked={visibleCols.has(col.key)} />
                <ListItemText primary={col.label} />
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search leads…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status"
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {LEAD_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
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
                    {shownCols.map(col => (
                      <TableCell key={col.key} sx={{ fontWeight: 600 }}>{col.label}</TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leads.map(lead => {
                    const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—';
                    const sc = STATUS_COLORS[lead.status] || { bg: 'grey.100', color: 'text.secondary' };
                    return (
                      <TableRow key={lead.id} hover>
                        {shownCols.map(col => {
                          if (col.key === 'name') return (
                            <TableCell key="name">
                              <MuiLink component={RouterLink} to={lead.id}
                                underline="hover" sx={{ fontWeight: 600 }}>
                                {name}
                              </MuiLink>
                              {lead.accountName && (
                                <Typography variant="caption" color="text.secondary" component="div">
                                  {lead.accountName}
                                </Typography>
                              )}
                            </TableCell>
                          );
                          if (col.key === 'status') return (
                            <TableCell key="status">
                              {lead.status && (
                                <Chip label={lead.status} size="small"
                                  sx={{ bgcolor: sc.bg, color: sc.color, fontSize: 11, fontWeight: 500 }} />
                              )}
                            </TableCell>
                          );
                          if (col.key === 'emailAddress') return (
                            <TableCell key="email">
                              <Typography variant="body2" sx={{ fontSize: 12 }}>
                                {lead.emailAddress || '—'}
                              </Typography>
                            </TableCell>
                          );
                          if (col.key === 'phoneNumber') return (
                            <TableCell key="phone">
                              <Typography variant="body2" sx={{ fontSize: 12 }}>
                                {lead.phoneNumber || '—'}
                              </Typography>
                            </TableCell>
                          );
                          if (col.key === 'source') return (
                            <TableCell key="source">
                              <Typography variant="caption" color="text.secondary">
                                {lead.source || '—'}
                              </Typography>
                            </TableCell>
                          );
                          if (col.key === 'assignedUser') return (
                            <TableCell key="assignedUser">
                              <Typography variant="caption">
                                {lead.assignedUserName || '—'}
                              </Typography>
                            </TableCell>
                          );
                          if (col.key === 'createdAt') return (
                            <TableCell key="createdAt">
                              <Typography variant="caption" color="text.secondary">
                                {lead.createdAt || '—'}
                              </Typography>
                            </TableCell>
                          );
                          return <TableCell key={col.key}>{lead[col.key] || '—'}</TableCell>;
                        })}
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={e => openEdit(lead, e)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={e => handleDelete(lead, e)}
                              sx={{ color: 'error.main' }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={shownCols.length + 1} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No leads found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </Card>

      <LeadDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        lead={editing}
        onSaved={loadData}
      />
    </Box>
  );
}
