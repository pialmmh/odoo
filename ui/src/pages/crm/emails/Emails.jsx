import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, InputAdornment,
  CircularProgress, Alert, Tooltip, Divider, Checkbox, Avatar, Chip,
  List, ListItemButton, ListItemIcon, ListItemText, Badge,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Inbox as InboxIcon, Send as SentIcon, Drafts as DraftsIcon,
  Delete as TrashIcon, Archive as ArchiveIcon, Star as StarIcon,
  StarBorder as StarOutlineIcon, AllInbox as AllIcon, Label as LabelIcon,
  Search as SearchIcon, Refresh as RefreshIcon, Edit as ComposeIcon,
  Close as CloseIcon, Reply as ReplyIcon, ReplyAll as ReplyAllIcon,
  Forward as ForwardIcon, AttachFile as AttachIcon,
  MarkEmailUnread as UnreadIcon, MarkEmailRead as ReadIcon,
  MoreVert as MoreIcon, Link as LinkIcon,
} from '@mui/icons-material';
import {
  listEmails, getEmail, listEmailFolders, markEmailsRead, moveEmailsToFolder,
  deleteEmail, updateEmail, attachmentDownloadUrl, linkEmailToParent,
} from '../../../services/crm';
import { useAppTheme } from '../../../context/ThemeContext';
import MessageBody from './MessageBody';
import ComposeDialog from './ComposeDialog';

// System folders map — mirror EspoCRM's special values.
// `tone` maps to theme palette key so colors adapt to light/dark/tenant.
const SYSTEM_FOLDERS = [
  { id: 'all',       name: 'All',       icon: <AllIcon fontSize="small" /> },
  { id: 'inbox',     name: 'Inbox',     tone: '#2563eb', icon: <InboxIcon fontSize="small" /> },
  { id: 'important', name: 'Important', icon: <StarIcon fontSize="small" /> },
  { id: 'sent',      name: 'Sent',      tone: '#0ea5e9', icon: <SentIcon fontSize="small" /> },
  { id: 'drafts',    name: 'Drafts',    icon: <DraftsIcon fontSize="small" /> },
  { id: 'archive',   name: 'Archive',   icon: <ArchiveIcon fontSize="small" /> },
  { id: 'trash',     name: 'Trash',     icon: <TrashIcon fontSize="small" /> },
];

function buildFolderWhere(folderId) {
  // Returns array of where clauses for EspoCRM list endpoint
  switch (folderId) {
    case 'all':
      return [];
    case 'inbox':
      return [{ type: 'equals', attribute: 'status', value: 'Received' }];
    case 'sent':
      return [{ type: 'equals', attribute: 'status', value: 'Sent' }];
    case 'drafts':
      return [{ type: 'equals', attribute: 'status', value: 'Draft' }];
    case 'trash':
      return [{ type: 'isTrue', attribute: 'inTrash' }];
    case 'archive':
      return [{ type: 'isTrue', attribute: 'inArchive' }];
    case 'important':
      return [{ type: 'isTrue', attribute: 'isImportant' }];
    default:
      // Custom EmailFolder
      return [{ type: 'equals', attribute: 'folderId', value: folderId }];
  }
}

function whereParams(clauses, searchText) {
  const params = {};
  clauses.forEach((c, i) => {
    params[`where[${i}][type]`] = c.type;
    params[`where[${i}][attribute]`] = c.attribute;
    if (c.value !== undefined) params[`where[${i}][value]`] = c.value;
  });
  if (searchText && searchText.trim()) {
    const i = clauses.length;
    params[`where[${i}][type]`] = 'textFilter';
    params[`where[${i}][value]`] = searchText.trim();
  }
  return params;
}

function initials(nameOrEmail) {
  const s = (nameOrEmail || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function formatDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString([], sameYear
      ? { month: 'short', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return s; }
}

export default function Emails() {
  const theme = useTheme();
  const { mode } = useAppTheme();
  const [folderId, setFolderId] = useState('inbox');
  const [folders, setFolders]   = useState([]);
  const [rows, setRows]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoad]  = useState(true);
  const [err, setErr]       = useState(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewId, setViewId] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [compose, setCompose] = useState(null); // null | { ... } opens dialog

  const loadFolders = useCallback(async () => {
    try {
      const res = await listEmailFolders({ select: 'id,name' });
      setFolders(res.list || []);
    } catch { /* may 403 if perm disabled */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoad(true); setErr(null);
    try {
      const params = {
        maxSize: 50, offset: 0,
        orderBy: 'dateSent', order: 'desc',
        select: 'id,name,fromName,fromEmailAddress,dateSent,isRead,isImportant,hasAttachment,status,parentType,parentId,parentName',
        ...whereParams(buildFolderWhere(folderId), search),
      };
      const res = await listEmails(params);
      setRows(res.list || []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Load failed');
    }
    setLoad(false);
  }, [folderId, search]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    const t = setInterval(loadList, 60000);
    return () => clearInterval(t);
  }, [loadList]);

  const openEmail = useCallback(async (id) => {
    setViewId(id); setViewLoading(true);
    try {
      const row = await getEmail(id);
      setViewRow(row);
      if (!row.isRead) {
        updateEmail(id, { isRead: true }).catch(() => {});
        setRows(rs => rs.map(r => r.id === id ? { ...r, isRead: true } : r));
      }
    } catch (e) { setErr(e?.message); }
    setViewLoading(false);
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleSelectAll = () => {
    setSelectedIds(sel => sel.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  };

  const bulkMarkRead = async (isRead) => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setRows(rs => rs.map(r => ids.includes(r.id) ? { ...r, isRead } : r));
    try { await markEmailsRead(ids, isRead); } catch { loadList(); }
  };
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} email(s)?`)) return;
    const ids = [...selectedIds];
    setRows(rs => rs.filter(r => !ids.includes(r.id)));
    setSelectedIds(new Set());
    try { await Promise.all(ids.map(id => deleteEmail(id))); } catch { loadList(); }
  };

  const toggleImportant = async (row, e) => {
    e?.stopPropagation();
    const next = !row.isImportant;
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, isImportant: next } : r));
    try { await updateEmail(row.id, { isImportant: next }); } catch { loadList(); }
  };

  const onReply = (all = false) => {
    if (!viewRow) return;
    const quoted = `<br><br><blockquote>${viewRow.body || viewRow.bodyPlain || ''}</blockquote>`;
    setCompose({
      to: viewRow.fromEmailAddress || '',
      cc: all ? (viewRow.cc || '') : '',
      subject: viewRow.name?.startsWith('Re: ') ? viewRow.name : `Re: ${viewRow.name || ''}`,
      body: quoted,
      replied: viewRow.id,
      parentType: viewRow.parentType,
      parentId: viewRow.parentId,
    });
  };
  const onForward = () => {
    if (!viewRow) return;
    const quoted = `<br><br>---------- Forwarded ----------<br><b>From:</b> ${viewRow.fromName || ''} &lt;${viewRow.fromEmailAddress || ''}&gt;<br><b>Subject:</b> ${viewRow.name || ''}<br><br>${viewRow.body || viewRow.bodyPlain || ''}`;
    setCompose({
      subject: viewRow.name?.startsWith('Fwd: ') ? viewRow.name : `Fwd: ${viewRow.name || ''}`,
      body: quoted,
      forward: true,
    });
  };

  const unreadCount = useMemo(() => rows.filter(r => !r.isRead).length, [rows]);

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box>
          <Typography variant="h6">Emails</Typography>
          <Typography variant="body2" color="text.secondary">
            {unreadCount > 0 ? `${unreadCount} unread · ` : ''}{total} total
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small"
            startIcon={<ComposeIcon />} onClick={() => setCompose({})}
            sx={{ fontWeight: 600 }}>
            Compose
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 1.5 }}>
        {/* Folder sidebar */}
        <Box sx={(theme) => ({
          width: 220, flexShrink: 0, overflowY: 'auto',
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5, p: 0.5,
        })}>
          <List dense disablePadding>
            {SYSTEM_FOLDERS.map(f => {
              const selected = folderId === f.id;
              const tone = f.tone;
              return (
                <ListItemButton key={f.id} selected={selected}
                  onClick={() => { setFolderId(f.id); setViewId(null); setSelectedIds(new Set()); }}
                  sx={(theme) => ({
                    borderRadius: 1, mb: 0.25,
                    '&.Mui-selected': tone ? {
                      bgcolor: alpha(tone, 0.14),
                      '&:hover': { bgcolor: alpha(tone, 0.22) },
                    } : {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: theme.palette.primary.main,
                      '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.18) },
                    },
                  })}>
                  <ListItemIcon sx={{ minWidth: 32, color: tone || undefined }}>
                    {f.icon}
                  </ListItemIcon>
                  <ListItemText primary={f.name}
                    primaryTypographyProps={{
                      fontSize: 13,
                      fontWeight: selected ? 700 : 600,
                      color: selected && tone ? tone : undefined,
                    }} />
                </ListItemButton>
              );
            })}
            {folders.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary"
                  sx={{ px: 1.5, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Labels
                </Typography>
                {folders.map(f => (
                  <ListItemButton key={f.id} selected={folderId === f.id}
                    onClick={() => setFolderId(f.id)}
                    sx={{ borderRadius: 1, mb: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}><LabelIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary={f.name} primaryTypographyProps={{ fontSize: 13 }} />
                  </ListItemButton>
                ))}
              </>
            )}
          </List>
        </Box>

        {/* Email list */}
        <Box sx={(theme) => ({
          width: viewId ? 420 : '100%',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', minHeight: 0,
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5,
        })}>
          {/* Toolbar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
            <Checkbox size="small" checked={rows.length > 0 && selectedIds.size === rows.length}
              indeterminate={selectedIds.size > 0 && selectedIds.size < rows.length}
              onChange={toggleSelectAll} />
            {selectedIds.size > 0 ? (
              <>
                <Tooltip title="Mark as read"><IconButton size="small" onClick={() => bulkMarkRead(true)}><ReadIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Mark as unread"><IconButton size="small" onClick={() => bulkMarkRead(false)}><UnreadIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={bulkDelete}><TrashIcon fontSize="small" /></IconButton></Tooltip>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{selectedIds.size} selected</Typography>
              </>
            ) : (
              <>
                <Tooltip title="Refresh"><IconButton size="small" onClick={loadList}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
                <TextField size="small" placeholder="Search mail"
                  value={search} onChange={e => setSearch(e.target.value)}
                  sx={{ flex: 1, ml: 1 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
              </>
            )}
          </Box>

          {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ m: 1 }}>{err}</Alert>}

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : rows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <InboxIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">No emails</Typography>
              </Box>
            ) : rows.map(r => (
              <EmailRow key={r.id} row={r}
                selected={viewId === r.id}
                checked={selectedIds.has(r.id)}
                onCheck={() => toggleSelect(r.id)}
                onOpen={() => openEmail(r.id)}
                onToggleImportant={(e) => toggleImportant(r, e)} />
            ))}
          </Box>
        </Box>

        {/* Viewer */}
        {viewId && (
          <Box sx={(theme) => ({
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1.5,
          })}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Reply"><IconButton size="small" onClick={() => onReply(false)}><ReplyIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Reply all"><IconButton size="small" onClick={() => onReply(true)}><ReplyAllIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Forward"><IconButton size="small" onClick={onForward}><ForwardIcon fontSize="small" /></IconButton></Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="Delete"><IconButton size="small" onClick={async () => { await deleteEmail(viewId); setViewId(null); setViewRow(null); loadList(); }}><TrashIcon fontSize="small" /></IconButton></Tooltip>
              </Box>
              <IconButton size="small" onClick={() => { setViewId(null); setViewRow(null); }}><CloseIcon fontSize="small" /></IconButton>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {viewLoading || !viewRow ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
              ) : (
                <>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    {viewRow.name || '(no subject)'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                    <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                      {initials(viewRow.fromName || viewRow.fromEmailAddress)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                        {viewRow.fromName || viewRow.fromEmailAddress}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        &lt;{viewRow.fromEmailAddress}&gt; to {viewRow.to || 'me'}
                        {viewRow.cc ? ` · cc: ${viewRow.cc}` : ''}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(viewRow.dateSent)}
                    </Typography>
                  </Box>

                  {viewRow.parentType && viewRow.parentName && (
                    <Chip size="small" icon={<LinkIcon fontSize="small" />}
                      label={`${viewRow.parentType}: ${viewRow.parentName}`}
                      sx={{ mb: 1.5 }} color="primary" variant="outlined" />
                  )}

                  <MessageBody html={viewRow.body} plainText={viewRow.bodyPlain} themeMode={mode} />

                  {viewRow.attachmentsIds && viewRow.attachmentsIds.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                        {viewRow.attachmentsIds.length} attachment(s)
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        {viewRow.attachmentsIds.map(aid => (
                          <Chip key={aid} size="small" icon={<AttachIcon fontSize="small" />}
                            label={viewRow.attachmentsNames?.[aid] || aid}
                            component="a" href={attachmentDownloadUrl(aid)} target="_blank"
                            clickable />
                        ))}
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>

      <ComposeDialog open={!!compose} initial={compose || {}}
        onClose={() => setCompose(null)}
        onSent={() => { setCompose(null); loadList(); }} />
    </Box>
  );
}

function EmailRow({ row, selected, checked, onCheck, onOpen, onToggleImportant }) {
  const unread = !row.isRead;
  return (
    <Box onClick={onOpen}
      sx={(theme) => ({
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1, py: 1, cursor: 'pointer',
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: selected
          ? alpha(theme.palette.primary.main, 0.10)
          : unread ? 'background.paper' : alpha(theme.palette.text.primary, 0.015),
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
      })}>
      <Checkbox size="small" checked={checked}
        onClick={e => e.stopPropagation()}
        onChange={onCheck}
        sx={{ p: 0.5 }} />
      <IconButton size="small" onClick={onToggleImportant} sx={{ p: 0.25,
        color: row.isImportant ? 'warning.main' : 'text.disabled' }}>
        {row.isImportant ? <StarIcon fontSize="small" /> : <StarOutlineIcon fontSize="small" />}
      </IconButton>
      <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: 'primary.main' }}>
        {initials(row.fromName || row.fromEmailAddress)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: unread ? 700 : 500, fontSize: 13, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.fromName || row.fromEmailAddress || '(unknown)'}
          </Typography>
          {row.hasAttachment && <AttachIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
          <Typography variant="caption" color={unread ? 'text.primary' : 'text.secondary'}
            sx={{ fontWeight: unread ? 600 : 400, whiteSpace: 'nowrap' }}>
            {formatDate(row.dateSent)}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: unread ? 'text.primary' : 'text.secondary',
          fontWeight: unread ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name || '(no subject)'}
        </Typography>
        {row.parentName && (
          <Typography variant="caption" color="primary" sx={{ fontSize: 10 }}>
            {row.parentType}: {row.parentName}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
