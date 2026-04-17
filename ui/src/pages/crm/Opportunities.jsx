import { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Alert, TextField,
  InputAdornment, Button, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Link as MuiLink,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Delete as DeleteIcon,
  Refresh as RefreshIcon, ViewList as ListIcon, ViewKanban as KanbanIcon,
} from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { listOpportunities, deleteOpportunity, OPPORTUNITY_STAGES } from '../../services/crm';
import OpportunityKanban, { PERIODS } from './OpportunityKanban';
import PLATFORM from '../../config/platform';

// Columns mirror layouts/Opportunity/list.json
const COLUMNS = [
  { key: 'name',         label: 'Name' },
  { key: 'account',      label: 'Account' },
  { key: 'stage',        label: 'Stage' },
  { key: 'assignedUser', label: 'Assigned' },
  { key: 'createdAt',    label: 'Created' },
  { key: 'closeDate',    label: 'Close Date' },
  { key: 'amount',       label: 'Amount', align: 'right' },
];

const STAGE_CHIP = {
  'Prospecting':   { color: 'default' },
  'Qualification': { color: 'default' },
  'Proposal':      { color: 'primary' },
  'Negotiation':   { color: 'warning' },
  'Closed Won':    { color: 'success' },
  'Closed Lost':   { color: 'info' },
};

export default function Opportunities() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [view, setView] = useState('kanban');
  const defaultPeriod = PLATFORM.crmKanban?.defaultPeriod || '1y';
  const initialPeriod = PERIODS.some(p => p.key === defaultPeriod) ? defaultPeriod : '1y';
  const [periodKey, setPeriodKey] = useState(initialPeriod);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { maxSize: rowsPerPage, offset: page * rowsPerPage, orderBy: 'createdAt', order: 'desc' };
      let idx = 0;
      if (stageFilter !== 'all') {
        params[`where[${idx}][type]`]      = 'equals';
        params[`where[${idx}][attribute]`] = 'stage';
        params[`where[${idx}][value]`]     = stageFilter;
        idx++;
      }
      if (search.trim()) {
        params[`where[${idx}][type]`]  = 'textFilter';
        params[`where[${idx}][value]`] = search.trim();
      }
      const res = await listOpportunities(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
      setError(null);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, [page, rowsPerPage, search, stageFilter]);

  useEffect(() => { if (view === 'list') load(); }, [load, view]);

  const handleDelete = async (row, e) => {
    e.stopPropagation();
    if (!confirm(`Delete opportunity "${row.name}"?`)) return;
    try { await deleteOpportunity(row.id); load(); }
    catch (err) { alert('Delete failed: ' + (err?.response?.data?.message || err.message)); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Opportunities</Typography>
          <Typography variant="body2" color="text.secondary">
            {view === 'list' ? `${total} total` : 'Sales pipeline'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {view === 'kanban' && (
            <Box sx={(theme) => ({
              display: 'flex', alignItems: 'center', gap: 0.25,
              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.05),
              borderRadius: 999, p: 0.5, mr: 0.5,
            })}>
              {PERIODS.map(p => {
                const selected = p.key === periodKey;
                return (
                  <Box key={p.key} component="button" type="button"
                    onClick={() => setPeriodKey(p.key)}
                    sx={(theme) => ({
                      border: 0, cursor: 'pointer', outline: 0,
                      px: 1.25, py: 0.5, borderRadius: 999,
                      fontSize: 12, fontWeight: 600, lineHeight: 1,
                      bgcolor: selected ? theme.palette.primary.main : 'transparent',
                      color: selected ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                      transition: 'background 120ms, color 120ms',
                      '&:hover': !selected ? {
                        color: theme.palette.text.primary,
                      } : {},
                    })}>
                    {p.label}
                  </Box>
                );
              })}
            </Box>
          )}
          <ToggleButtonGroup size="small" exclusive value={view}
            onChange={(_, v) => v && setView(v)}
            sx={(theme) => ({
              '& .MuiToggleButton-root': {
                textTransform: 'none', fontWeight: 600, px: 1.5,
                color: 'text.secondary',
                borderColor: theme.palette.divider,
              },
              '& .MuiToggleButton-root.Mui-selected': {
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                borderColor: theme.palette.primary.main,
                '&:hover': { bgcolor: theme.palette.primary.dark },
              },
            })}>
            <ToggleButton value="kanban"><KanbanIcon fontSize="small" sx={{ mr: 0.5 }} />Pipeline</ToggleButton>
            <ToggleButton value="list"><ListIcon fontSize="small" sx={{ mr: 0.5 }} />List</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />}
            onClick={() => navigate('new')} sx={{ fontWeight: 600 }}>
            Create Opportunity
          </Button>
          {view === 'list' && (
            <Tooltip title="Refresh">
              <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {view === 'kanban' ? <OpportunityKanban periodKey={periodKey} /> : (<>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField size="small" placeholder="Search…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 280 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Stage</InputLabel>
          <Select value={stageFilter} label="Stage"
            onChange={e => { setStageFilter(e.target.value); setPage(0); }}>
            <MenuItem value="all">All Stages</MenuItem>
            {OPPORTUNITY_STAGES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
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
                    {COLUMNS.map(c => <TableCell key={c.key} align={c.align} sx={{ fontWeight: 600 }}>{c.label}</TableCell>)}
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(r => {
                    const stageColor = STAGE_CHIP[r.stage] || { color: 'default' };
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell>
                          <MuiLink component={RouterLink} to={r.id} underline="hover" sx={{ fontWeight: 600 }}>
                            {r.name || '—'}
                          </MuiLink>
                        </TableCell>
                        <TableCell><Typography variant="body2">{r.accountName || '—'}</Typography></TableCell>
                        <TableCell>{r.stage && <Chip label={r.stage} size="small" color={stageColor.color} />}</TableCell>
                        <TableCell><Typography variant="caption">{r.assignedUserName || '—'}</Typography></TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary">{r.createdAt || '—'}</Typography></TableCell>
                        <TableCell><Typography variant="caption">{r.closeDate || '—'}</Typography></TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {r.amount != null ? `${r.amountCurrency || ''} ${r.amount}`.trim() : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={e => handleDelete(r, e)} sx={{ color: 'error.main' }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={COLUMNS.length + 1} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No opportunities found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]} />
          </>
        )}
      </Card>
      </>)}
    </Box>
  );
}
