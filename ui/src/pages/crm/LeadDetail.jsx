import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, IconButton, Tooltip, CircularProgress,
  Alert, Divider, Chip, Link as MuiLink, Breadcrumbs, Menu, MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon, Edit as EditIcon, Delete as DeleteIcon,
  SyncAlt as ConvertIcon, MoreVert as MoreIcon,
} from '@mui/icons-material';
import {
  getLead, updateLead, deleteLead,
  LEAD_STATUSES, LEAD_NOT_ACTUAL_STATUSES,
} from '../../services/crm';
import StatusPipelineBar from './StatusPipelineBar';
import LeadDialog from './LeadDialog';
import ConvertDialog from './ConvertDialog';
import { useRBAC } from '../../hooks/useRBAC';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAction } = useRBAC();
  const canEdit = canAction('crm.edit');

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLead(id);
      setLead(data);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load lead');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (newStatus) => {
    try {
      await updateLead(id, { status: newStatus });
      load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Status change failed');
    }
  };

  // TODO: Self-assign needs Keycloak→EspoCRM user ID mapping (OIDC JWT forward).
  // Currently all requests go through one API user, so a "self-assign" target
  // is ambiguous. Re-enable once per-user JWT passthrough is wired.

  const handleDelete = async () => {
    if (!confirm(`Delete lead "${lead?.name}"? This cannot be undone.`)) return;
    try {
      await deleteLead(id);
      navigate('..');
    } catch (e) {
      alert('Delete failed: ' + (e?.response?.data?.message || e.message));
    }
  };

  const isConvertable = lead?.status && !LEAD_NOT_ACTUAL_STATUSES.includes(lead.status);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
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

  return (
    <Box>
      {/* Header */}
      <Breadcrumbs sx={{ mb: 1 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Leads</MuiLink>
        <Typography color="text.primary">{lead.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Tooltip title="Back to Leads">
            <IconButton size="small" onClick={() => navigate('..')}><BackIcon /></IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
              {lead.name || '(unnamed)'}
            </Typography>
            {lead.title && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {lead.title}{lead.accountName ? ` · ${lead.accountName}` : ''}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {canEdit && isConvertable && (
            <Button variant="contained" color="success" size="small"
              startIcon={<ConvertIcon />}
              onClick={() => setConvertOpen(true)}>
              Convert
            </Button>
          )}
          {canEdit && (
            <Button variant="outlined" size="small" startIcon={<EditIcon />}
              onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
          <IconButton size="small" onClick={e => setActionMenu(e.currentTarget)}>
            <MoreIcon />
          </IconButton>
          <Menu anchorEl={actionMenu} open={!!actionMenu} onClose={() => setActionMenu(null)}>
            {canEdit && (
              <MenuItem onClick={() => { setActionMenu(null); handleDelete(); }}
                sx={{ color: 'error.main' }}>
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
              </MenuItem>
            )}
          </Menu>
        </Box>
      </Box>

      {/* Status pipeline bar */}
      <Box sx={{ mb: 3 }}>
        <StatusPipelineBar
          statuses={LEAD_STATUSES}
          current={lead.status}
          disabled={!canEdit}
          onChange={handleStatusChange}
        />
      </Box>

      {/* Two-column layout: main + side */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        {/* Main */}
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          <Section title="Overview">
            <Row label="Name" value={lead.name} />
            <Row label="Account" value={lead.accountName} />
            <Row label="Email"   value={lead.emailAddress} kind="email" />
            <Row label="Phone"   value={lead.phoneNumber}  kind="tel" />
            <Row label="Title"   value={lead.title} />
            <Row label="Website" value={lead.website} kind="url" />
            <Row label="Address" value={formatAddress(lead)} />
          </Section>

          <Section title="Details">
            <Row label="Status" value={
              lead.status ? <Chip label={lead.status} size="small" /> : null
            } />
            <Row label="Source"   value={lead.source} />
            <Row label="Opportunity Amount"
                 value={lead.opportunityAmount != null
                   ? `${lead.opportunityAmountCurrency || ''} ${lead.opportunityAmount}`.trim()
                   : null} />
            <Row label="Campaign" value={lead.campaignName} />
            <Row label="Industry" value={lead.industry} />
            <Row label="Do Not Call" value={lead.doNotCall ? 'Yes' : null} />
            <Row label="Description" value={lead.description} multiline />
          </Section>

          {(lead.createdAccountId || lead.createdContactId || lead.createdOpportunityId) && (
            <Section title="Converted To">
              {lead.createdAccountName && (
                <Row label="Account"
                     value={<MuiLink>{lead.createdAccountName}</MuiLink>} />
              )}
              {lead.createdContactName && (
                <Row label="Contact"
                     value={<MuiLink>{lead.createdContactName}</MuiLink>} />
              )}
              {lead.createdOpportunityName && (
                <Row label="Opportunity"
                     value={<MuiLink>{lead.createdOpportunityName}</MuiLink>} />
              )}
              {lead.convertedAt && <Row label="Converted At" value={lead.convertedAt} />}
            </Section>
          )}
        </Box>

        {/* Side panel */}
        <Box sx={{ flex: '0 0 320px', maxWidth: { xs: '100%', md: 320 } }}>
          <Section title="Assignment" dense>
            <Row label="Assigned User" value={lead.assignedUserName || '—'} dense />
            <Row label="Teams" value={
              (lead.teamsNames && Object.values(lead.teamsNames).join(', ')) || '—'
            } dense />
          </Section>

          <Section title="Status" dense>
            <Row label="Converted At" value={lead.convertedAt || '—'} dense />
            <Row label="Stream Updated" value={lead.streamUpdatedAt || '—'} dense />
          </Section>

          <Section title="Record" dense>
            <Row label="Created"  value={formatAudit(lead.createdAt,  lead.createdByName)}  dense />
            <Row label="Modified" value={formatAudit(lead.modifiedAt, lead.modifiedByName)} dense />
          </Section>
        </Box>
      </Box>

      <LeadDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lead={lead}
        onSaved={load}
      />

      <ConvertDialog
        open={convertOpen}
        lead={lead}
        onClose={() => setConvertOpen(false)}
        onConverted={load}
      />
    </Box>
  );
}

// ── Helpers ──
function formatAddress(l) {
  const parts = [l.addressStreet, l.addressCity, l.addressState, l.addressCountry, l.addressPostalCode];
  const v = parts.filter(Boolean).join(', ');
  return v || null;
}

function formatAudit(ts, who) {
  if (!ts) return null;
  return who ? `${ts} · ${who}` : ts;
}

function Section({ title, children, dense }) {
  return (
    <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{
        px: 2, py: 1.25, bgcolor: 'background.default',
        borderBottom: 1, borderColor: 'divider',
      }}>
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 1 }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: dense ? 1.5 : 2 }}>
        {children}
      </Box>
    </Paper>
  );
}

function Row({ label, value, kind, multiline, dense }) {
  if (value == null || value === '') return null;
  let display = value;
  if (kind === 'email' && typeof value === 'string') {
    display = <MuiLink href={`mailto:${value}`}>{value}</MuiLink>;
  } else if (kind === 'tel' && typeof value === 'string') {
    display = <MuiLink href={`tel:${value}`}>{value}</MuiLink>;
  } else if (kind === 'url' && typeof value === 'string') {
    const href = /^https?:/.test(value) ? value : `https://${value}`;
    display = <MuiLink href={href} target="_blank" rel="noopener">{value}</MuiLink>;
  }

  return (
    <Box sx={{
      display: 'flex',
      alignItems: multiline ? 'flex-start' : 'center',
      py: dense ? 0.5 : 0.75,
      borderBottom: '1px dashed',
      borderColor: 'divider',
      '&:last-child': { borderBottom: 'none' },
      gap: 2,
    }}>
      <Typography variant="caption" sx={{
        minWidth: dense ? 110 : 160,
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {label}
      </Typography>
      <Box sx={{
        flex: 1, minWidth: 0, fontSize: 13,
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
        wordBreak: 'break-word',
      }}>
        {display}
      </Box>
    </Box>
  );
}
