import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, Menu, MenuItem, CircularProgress,
  Alert, Chip, Link as MuiLink, Breadcrumbs, Grid,
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon,
  MoreHoriz as MoreIcon,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  RssFeed as FollowIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import {
  getLead, deleteLead, listLeads, createLead,
  followEntity, unfollowEntity,
  LEAD_NOT_ACTUAL_STATUSES,
} from '../../services/crm';
import { useRBAC } from '../../hooks/useRBAC';
import ConvertDialog from './ConvertDialog';
import StreamPanel from './StreamPanel';
import { FieldRow, Panel } from './LeadPanelPrimitives';
import { ActivitiesPanel, HistoryPanel, TasksPanel } from './SideListPanels';

// Layout mirrors client/res/templates/record/detail.tpl + side.tpl +
// clientDefs/Lead.json sidePanels.detail:
//   record-grid
//     .left  (main)  → Overview panel / Details panel / Stream panel
//     .side          → Default side panel / Converted To / Activities / History / Tasks

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAction } = useRBAC();
  const canEdit = canAction('crm.edit');

  const [lead, setLead]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [menuAnchor, setMenuAnchor]   = useState(null);
  const [neighborIds, setNeighborIds] = useState({ prev: null, next: null });
  const [sideRefresh, setSideRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLead(await getLead(id));
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load lead');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Prev/next in the same default ordering the list uses.
  useEffect(() => {
    let live = true;
    listLeads({ maxSize: 200, orderBy: 'createdAt', order: 'desc', select: 'id' })
      .then(res => {
        if (!live) return;
        const list = res.list || [];
        const idx = list.findIndex(r => r.id === id);
        setNeighborIds({
          prev: idx > 0 ? list[idx - 1].id : null,
          next: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
        });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [id]);

  const handleDelete = async () => {
    setMenuAnchor(null);
    if (!confirm(`Delete lead "${lead?.name}"? This cannot be undone.`)) return;
    try {
      await deleteLead(id);
      navigate('..');
    } catch (e) {
      alert('Delete failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  const handleFollowToggle = async () => {
    setMenuAnchor(null);
    try {
      if (lead.isFollowed) await unfollowEntity('Lead', id);
      else                 await followEntity('Lead', id);
      load();
    } catch (e) {
      alert('Follow toggle failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  const handleDuplicate = async () => {
    setMenuAnchor(null);
    try {
      // Strip id + audit fields, prepend "Copy of " to the name hint.
      const {
        id: _id, createdAt, modifiedAt, createdById, modifiedById,
        createdByName, modifiedByName, isFollowed, followersIds, followersNames,
        convertedAt, createdAccountId, createdAccountName,
        createdContactId, createdContactName,
        createdOpportunityId, createdOpportunityName,
        status, ...rest
      } = lead;
      const copy = { ...rest, status: 'New' };
      const created = await createLead(copy);
      if (created?.id) navigate(`../${created.id}`);
    } catch (e) {
      alert('Duplicate failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  const isConvertable = lead?.status && !LEAD_NOT_ACTUAL_STATUSES.includes(lead.status);
  const hasConvertedTo = lead?.createdAccountId || lead?.createdContactId || lead?.createdOpportunityId;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  if (error || !lead) {
    return (
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <MuiLink component={RouterLink} to=".." underline="hover">Leads</MuiLink>
          <Typography color="text.primary">Not found</Typography>
        </Breadcrumbs>
        <Alert severity="error">{error || 'Lead not found'}</Alert>
      </Box>
    );
  }

  // ── Header area ──
  const header = (
    <>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Enquiries</MuiLink>
        <Typography color="text.primary">{lead.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ minWidth: 0, mb: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {lead.name || '(unnamed)'}
        </Typography>
        {lead.title && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {lead.title}{lead.accountName ? ` · ${lead.accountName}` : ''}
          </Typography>
        )}
      </Box>

      {/* Action bar — mirrors record/detail.tpl:
          left:  btn-group { Edit } + kebab
          right: btn-group { prev / next } */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
        gap: 2,
        px: 1.5,
        py: 1,
        bgcolor: 'background.default',
        borderRadius: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('edit')}
              sx={{
                bgcolor: 'grey.900', color: 'common.white',
                borderTopRightRadius: 0, borderBottomRightRadius: 0,
                '&:hover': { bgcolor: 'grey.800' },
                minWidth: 64,
              }}
            >
              Edit
            </Button>
            <IconButton
              size="small"
              onClick={e => setMenuAnchor(e.currentTarget)}
              sx={{
                border: 1, borderColor: 'divider', borderLeft: 0,
                borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                borderRadius: 1,
                bgcolor: 'background.paper',
                px: 1,
              }}
            >
              <MoreIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
              <MenuItem onClick={handleDuplicate}>
                <DuplicateIcon fontSize="small" sx={{ mr: 1 }} /> Duplicate
              </MenuItem>
              <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Remove
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex' }}>
            <IconButton
              size="small"
              disabled={!neighborIds.prev}
              onClick={() => neighborIds.prev && navigate(`../${neighborIds.prev}`)}
              title="Previous Entry"
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              disabled={!neighborIds.next}
              onClick={() => neighborIds.next && navigate(`../${neighborIds.next}`)}
              title="Next Entry"
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Follow + Convert button group (right side) */}
          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
            <Button
              variant={lead.isFollowed ? 'contained' : 'outlined'}
              color={lead.isFollowed ? 'success' : 'inherit'}
              size="small"
              startIcon={<FollowIcon fontSize="small" />}
              onClick={handleFollowToggle}
              sx={{
                borderColor: 'divider',
                color: lead.isFollowed ? 'common.white' : 'text.secondary',
                bgcolor: lead.isFollowed ? 'success.main' : 'background.paper',
                fontWeight: 500,
                borderTopRightRadius: isConvertable ? 0 : undefined,
                borderBottomRightRadius: isConvertable ? 0 : undefined,
              }}
            >
              {lead.isFollowed ? 'Followed' : 'Follow'}
            </Button>
            {isConvertable && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => setConvertOpen(true)}
                sx={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  fontWeight: 500,
                }}
              >
                Convert
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );

  // ── Main (left) panels ──
  const main = (
    <>
      <Panel title="Overview">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FieldRow kind="person" label="Name"    value={lead.name} />
            <FieldRow kind="email"  label="Email"   value={lead.emailAddress} />
            <FieldRow               label="Title"   value={lead.title} />
            <FieldRow kind="address" label="Address" value={formatAddress(lead)} multiline />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FieldRow kind="account" label="Account Name" value={lead.accountName} />
            <FieldRow kind="tel"     label="Phone"        value={lead.phoneNumber} />
            <FieldRow kind="url"     label="Website"      value={lead.website} />
          </Grid>
        </Grid>
      </Panel>

      <Panel title="Details">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FieldRow label="Status" value={lead.status ? <StatusChip status={lead.status} /> : null} />
            <FieldRow label="Opportunity Amount"
              value={lead.opportunityAmount != null
                ? `${lead.opportunityAmountCurrency || ''} ${lead.opportunityAmount}`.trim()
                : null} />
            <FieldRow label="Industry"    value={lead.industry} />
            <FieldRow label="Description" value={lead.description} multiline />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FieldRow label="Source"   value={lead.source} />
            <FieldRow label="Campaign" value={lead.campaignName} />
            {lead.doNotCall && <FieldRow label="Do Not Call" value="Yes" />}
          </Grid>
        </Grid>
      </Panel>

      <StreamPanel entityType="Lead" id={lead.id} />
    </>
  );

  // ── Side (right) panels ──
  const side = (
    <>
      <Panel dense>
        <FieldRow label="Assigned User" value={lead.assignedUserName} />
        <FieldRow label="Teams" value={
          lead.teamsNames ? Object.values(lead.teamsNames).join(', ') : null
        } />
        {lead.convertedAt && <FieldRow label="Converted At" value={lead.convertedAt} />}
        <FieldRow label="Created"  value={formatAudit(lead.createdAt,  lead.createdByName)} />
        <FieldRow label="Modified" value={formatAudit(lead.modifiedAt, lead.modifiedByName)} />
      </Panel>

      {hasConvertedTo && (
        <Panel title="Converted To" styleHint="success" dense>
          <FieldRow label="Account"     value={lead.createdAccountName} />
          <FieldRow label="Contact"     value={lead.createdContactName} />
          <FieldRow label="Opportunity" value={lead.createdOpportunityName} />
        </Panel>
      )}

      <ActivitiesPanel
        entityType="Lead" id={lead.id} parentName={lead.name}
        refreshKey={sideRefresh}
        onRefresh={() => setSideRefresh(n => n + 1)}
      />
      <HistoryPanel
        entityType="Lead" id={lead.id}
        refreshKey={sideRefresh}
      />
      <TasksPanel
        entityType="Lead" id={lead.id} parentName={lead.name}
        refreshKey={sideRefresh}
        onRefresh={() => setSideRefresh(n => n + 1)}
      />
    </>
  );

  return (
    <Box>
      {header}

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        gap: 2,
      }}>
        <Box sx={{ minWidth: 0 }}>{main}</Box>
        <Box>{side}</Box>
      </Box>

      <ConvertDialog
        open={convertOpen}
        lead={lead}
        onClose={() => setConvertOpen(false)}
        onConverted={load}
      />
    </Box>
  );
}

// ── Small helpers ──
const STATUS_CHIP = {
  'New':        { color: 'default' },
  'Assigned':   { color: 'warning' },
  'In Process': { color: 'primary' },
  'Converted':  { color: 'success' },
  'Recycled':   { color: 'info'    },
  'Dead':       { color: 'default' },
};
function StatusChip({ status }) {
  const s = STATUS_CHIP[status] || { color: 'default' };
  return <Chip label={status} size="small" color={s.color} variant="filled" />;
}

function formatAddress(l) {
  const parts = [l.addressStreet, l.addressCity, l.addressState, l.addressCountry, l.addressPostalCode];
  const v = parts.filter(Boolean).join(', ');
  return v || null;
}

function formatAudit(ts, who) {
  if (!ts) return null;
  return who ? `${ts} · ${who}` : ts;
}
