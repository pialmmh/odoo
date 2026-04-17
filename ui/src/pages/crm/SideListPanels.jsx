import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, IconButton, Tooltip } from '@mui/material';
import {
  Email as EmailIcon, Event as EventIcon, Phone as PhoneIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { getActivities, getHistory, getRelatedTasks } from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

// Side-panel cards from clientDefs/Lead.json sidePanels.detail:
//   activities (upcoming calls/meetings/tasks)
//   history    (past calls/meetings/emails)
//   tasks      (open tasks)
// The screenshot shows Activities with email/calendar/phone/more icons in header.

function ItemList({ loading, items, emptyText = 'No Data' }) {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  if (!items.length) return <Typography variant="body2" color="text.disabled" sx={{ fontSize: 13 }}>{emptyText}</Typography>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((it, i) => (
        <Box key={it.id || i} sx={{ borderBottom: 1, borderColor: 'divider', pb: 0.75, '&:last-child': { borderBottom: 0 } }}>
          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }} noWrap>
            {it.name || '(untitled)'}
          </Typography>
          {it.dateStart && (
            <Typography variant="caption" color="text.secondary">{it.dateStart}</Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

export function ActivitiesPanel({ entityType, id }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getActivities(entityType, id)
      .then(res => { if (live) setItems(res.list || []); })
      .catch(() => { if (live) setItems([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [entityType, id]);

  const actions = (
    <>
      <Tooltip title="Compose Email"><IconButton size="small"><EmailIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Schedule Meeting"><IconButton size="small"><EventIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Log Call"><IconButton size="small"><PhoneIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="New Task"><IconButton size="small"><AddIcon fontSize="small" /></IconButton></Tooltip>
    </>
  );

  return (
    <Panel title="Activities" actions={actions} dense>
      <ItemList loading={loading} items={items} />
    </Panel>
  );
}

export function HistoryPanel({ entityType, id }) {
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
  }, [entityType, id]);

  return (
    <Panel title="History" dense>
      <ItemList loading={loading} items={items} />
    </Panel>
  );
}

export function TasksPanel({ entityType, id }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getRelatedTasks(entityType, id, { maxSize: 10 })
      .then(res => { if (live) setItems(res.list || []); })
      .catch(() => { if (live) setItems([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [entityType, id]);

  const actions = (
    <Tooltip title="New Task"><IconButton size="small"><AddIcon fontSize="small" /></IconButton></Tooltip>
  );

  return (
    <Panel title="Tasks" actions={actions} dense>
      <ItemList loading={loading} items={items} />
    </Panel>
  );
}
