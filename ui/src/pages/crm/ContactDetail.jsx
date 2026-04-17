import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, Menu, MenuItem, CircularProgress,
  Alert, Link as MuiLink, Breadcrumbs,
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, MoreHoriz as MoreIcon,
  ContentCopy as DuplicateIcon, RssFeed as FollowIcon,
} from '@mui/icons-material';
import { getContact, deleteContact, createContact, followEntity, unfollowEntity } from '../../services/crm';
import { FieldRow, Panel } from './LeadPanelPrimitives';
import StreamPanel from './StreamPanel';
import { ActivitiesPanel, HistoryPanel, TasksPanel } from './SideListPanels';

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [row, setRow]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [sideRefresh, setSideRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRow(await getContact(id)); setError(null); }
    catch (e) { setError(e?.response?.data?.message || e.message || 'Load failed'); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setMenuAnchor(null);
    if (!confirm(`Delete contact "${row?.name}"?`)) return;
    try { await deleteContact(id); navigate('..'); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  const handleFollow = async () => {
    try {
      if (row.isFollowed) await unfollowEntity('Contact', id);
      else                await followEntity('Contact', id);
      load();
    } catch (e) { alert(e?.message); }
  };

  const handleDuplicate = async () => {
    setMenuAnchor(null);
    try {
      const { id: _i, createdAt, modifiedAt, createdById, modifiedById, createdByName, modifiedByName,
              isFollowed, followersIds, followersNames, ...rest } = row;
      const created = await createContact(rest);
      if (created?.id) navigate(`../${created.id}`);
    } catch (e) { alert('Duplicate failed: ' + (e?.response?.data?.message || e.message)); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error || !row) {
    return (
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <MuiLink component={RouterLink} to=".." underline="hover">Contacts</MuiLink>
          <Typography color="text.primary">Not found</Typography>
        </Breadcrumbs>
        <Alert severity="error">{error || 'Contact not found'}</Alert>
      </Box>
    );
  }

  const address = [row.addressStreet, row.addressCity, row.addressState, row.addressCountry, row.addressPostalCode]
    .filter(Boolean).join(', ');

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to=".." underline="hover">Contacts</MuiLink>
        <Typography color="text.primary">{row.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{row.name}</Typography>
        {row.title && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {row.title}{row.accountName ? ` · ${row.accountName}` : ''}
          </Typography>
        )}
      </Box>

      {/* Action bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, px: 1.5, py: 1, bgcolor: 'background.default', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
          <Button variant="contained" size="small" onClick={() => navigate('edit')}
            sx={{ bgcolor: 'grey.900', color: 'common.white', '&:hover': { bgcolor: 'grey.800' },
              borderTopRightRadius: 0, borderBottomRightRadius: 0, minWidth: 64 }}>
            Edit
          </Button>
          <IconButton size="small" onClick={e => setMenuAnchor(e.currentTarget)}
            sx={{ border: 1, borderColor: 'divider', borderLeft: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderRadius: 1, bgcolor: 'background.paper', px: 1 }}>
            <MoreIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem onClick={handleDuplicate}><DuplicateIcon fontSize="small" sx={{ mr: 1 }} /> Duplicate</MenuItem>
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Remove</MenuItem>
          </Menu>
        </Box>
        <Button variant={row.isFollowed ? 'contained' : 'outlined'}
          color={row.isFollowed ? 'success' : 'inherit'} size="small"
          startIcon={<FollowIcon fontSize="small" />}
          onClick={handleFollow}
          sx={{
            borderColor: 'divider',
            color: row.isFollowed ? 'common.white' : 'text.secondary',
            bgcolor: row.isFollowed ? 'success.main' : 'background.paper',
          }}>
          {row.isFollowed ? 'Followed' : 'Follow'}
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          {/* Single combined panel per detail.json — Contact has just one panel with 4 rows */}
          <Panel title="Overview">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FieldRow kind="person"  label="Name"       value={row.name} />
              <FieldRow kind="account" label="Accounts"   value={(row.accountsNames && Object.values(row.accountsNames).join(', ')) || row.accountName} />
              <FieldRow kind="email"   label="Email"      value={row.emailAddress} />
              <FieldRow kind="tel"     label="Phone"      value={row.phoneNumber} />
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <FieldRow kind="address" label="Address"  value={address} multiline />
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <FieldRow label="Description" value={row.description} multiline />
              </Box>
            </Box>
          </Panel>

          <StreamPanel entityType="Contact" id={row.id} />
        </Box>

        <Box>
          <Panel title="Overview" dense>
            <FieldRow label="Assigned User" value={row.assignedUserName} />
            <FieldRow label="Teams" value={(row.teamsNames && Object.values(row.teamsNames).join(', ')) || null} />
            <FieldRow label="Do Not Call" value={row.doNotCall ? 'Yes' : null} />
            <FieldRow label="Created"  value={row.createdAt  ? `${row.createdAt} · ${row.createdByName  || ''}` : null} />
            <FieldRow label="Modified" value={row.modifiedAt ? `${row.modifiedAt} · ${row.modifiedByName || ''}` : null} />
          </Panel>
          <ActivitiesPanel entityType="Contact" id={row.id} parentName={row.name}
            refreshKey={sideRefresh} onRefresh={() => setSideRefresh(n => n + 1)} />
          <HistoryPanel entityType="Contact" id={row.id} refreshKey={sideRefresh} />
          <TasksPanel   entityType="Contact" id={row.id} parentName={row.name}
            refreshKey={sideRefresh} onRefresh={() => setSideRefresh(n => n + 1)} />
        </Box>
      </Box>
    </Box>
  );
}
