import { useState, useEffect } from 'react';
import {
  Box, Typography, CircularProgress, IconButton, Tooltip, Chip, Menu, MenuItem,
} from '@mui/material';
import {
  Email as EmailIcon, EventAvailable as EventIcon,
  Phone as PhoneIcon, MoreHoriz as MoreIcon,
  Add as AddIcon, Task as TaskIcon,
} from '@mui/icons-material';
import {
  getActivities, getHistory, getRelatedTasks,
} from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';
import NewActivityDialog from './NewActivityDialog';

// Each item in Activities/History is a Meeting/Call/Email wrapped with _scope.
// The item list shows name + date + type badge.

const SCOPE_LABEL = {
  Meeting: 'Meeting',
  Call:    'Call',
  Email:   'Email',
  Task:    'Task',
};
const SCOPE_COLOR = {
  Meeting: 'primary',
  Call:    'info',
  Email:   'default',
  Task:    'success',
};

function ItemList({ loading, items, emptyText = 'No Data' }) {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  if (!items.length) return <Typography variant="body2" color="text.disabled" sx={{ fontSize: 13 }}>{emptyText}</Typography>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {items.map((it, i) => (
        <Box key={it.id || i} sx={{
          borderBottom: 1, borderColor: 'divider', pb: 1,
          '&:last-child': { borderBottom: 0, pb: 0 },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
            {it._scope && (
              <Chip label={SCOPE_LABEL[it._scope] || it._scope}
                size="small"
                color={SCOPE_COLOR[it._scope] || 'default'}
                variant="outlined"
                sx={{ height: 18, fontSize: 10, fontWeight: 600 }} />
            )}
            {it.status && (
              <Typography variant="caption" color="text.secondary">{it.status}</Typography>
            )}
          </Box>
          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }} noWrap>
            {it.name || '(untitled)'}
          </Typography>
          {(it.dateStart || it.dateDue) && (
            <Typography variant="caption" color="text.secondary">
              {it.dateStart || it.dateDue}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

// ── Activities panel (upcoming) ─────────────────────────────────────────
export function ActivitiesPanel({ entityType, id, parentName, refreshKey, onRefresh }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dialog, setDialog]     = useState(null);   // 'Meeting' | 'Call' | 'Task' | null
  const [moreMenu, setMoreMenu] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getActivities(entityType, id)
      .then(res => { if (live) setItems(res.list || []); })
      .catch(() => { if (live) setItems([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [entityType, id, refreshKey]);

  const handleCreated = () => {
    onRefresh?.();
  };

  const actions = (
    <>
      <Tooltip title="Compose Email (requires SMTP)">
        <span>
          <IconButton size="small" disabled>
            <EmailIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Schedule Meeting">
        <IconButton size="small" onClick={() => setDialog('Meeting')}>
          <EventIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Log Call">
        <IconButton size="small" onClick={() => setDialog('Call')}>
          <PhoneIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="More">
        <IconButton size="small" onClick={e => setMoreMenu(e.currentTarget)}>
          <MoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={moreMenu} open={!!moreMenu} onClose={() => setMoreMenu(null)}>
        <MenuItem onClick={() => { setMoreMenu(null); setDialog('Task'); }}>
          <TaskIcon fontSize="small" sx={{ mr: 1 }} /> New Task
        </MenuItem>
      </Menu>
    </>
  );

  return (
    <>
      <Panel title="Activities" actions={actions} dense>
        <ItemList loading={loading} items={items} />
      </Panel>
      <NewActivityDialog
        open={!!dialog}
        kind={dialog}
        parentType={entityType}
        parentId={id}
        parentName={parentName}
        onClose={() => setDialog(null)}
        onCreated={handleCreated}
      />
    </>
  );
}

// ── History panel (completed / past) ───────────────────────────────────
export function HistoryPanel({ entityType, id, refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getHistory(entityType, id)
      .then(res => { if (live) setItems(res.list || []); })
      .catch(() => { if (live) setItems([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [entityType, id, refreshKey]);

  return (
    <Panel title="History" dense>
      <ItemList loading={loading} items={items} />
    </Panel>
  );
}

// ── Tasks panel ────────────────────────────────────────────────────────
export function TasksPanel({ entityType, id, parentName, refreshKey, onRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getRelatedTasks(entityType, id, { maxSize: 10 })
      .then(res => { if (live) setItems(res.list || []); })
      .catch(() => { if (live) setItems([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [entityType, id, refreshKey]);

  const actions = (
    <Tooltip title="New Task">
      <IconButton size="small" onClick={() => setDialog(true)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  return (
    <>
      <Panel title="Tasks" actions={actions} dense>
        <ItemList loading={loading} items={items} />
      </Panel>
      <NewActivityDialog
        open={dialog}
        kind="Task"
        parentType={entityType}
        parentId={id}
        parentName={parentName}
        onClose={() => setDialog(false)}
        onCreated={() => onRefresh?.()}
      />
    </>
  );
}
