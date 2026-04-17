import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, CircularProgress, Alert, Button, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup, FormControl, Select, MenuItem, Chip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  ChevronLeft, ChevronRight, Today as TodayIcon, Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  listMeetings, listCalls, listTasks, updateTask,
} from '../../services/crm';

// Per EspoCRM Calendar defaults
const TYPE_TONE = {
  Meeting: 'primary',
  Call:    'error',
  Task:    'success',
};

const SCOPES = [
  { key: 'Meeting', label: 'Meetings' },
  { key: 'Call',    label: 'Calls' },
  { key: 'Task',    label: 'Tasks' },
];

function toneHex(theme, tone) {
  return theme.palette[tone]?.main || theme.palette.primary.main;
}

// EspoCRM uses 'YYYY-MM-DD HH:mm:ss' — strip seconds so FullCalendar parses as local.
function espoToIso(s) {
  if (!s) return null;
  // all-day date-only (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // 'YYYY-MM-DD HH:mm[:ss]' — treat as UTC (EspoCRM stores UTC)
  return s.replace(' ', 'T') + 'Z';
}

export default function Calendar() {
  const navigate = useNavigate();
  const calRef = useRef(null);
  const theme = useTheme();
  const toneHexMap = useMemo(() => ({
    Meeting: theme.palette.primary.main,
    Call:    theme.palette.error.main,
    Task:    theme.palette.success.main,
  }), [theme]);

  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [scopes, setScopes]   = useState(['Meeting', 'Call', 'Task']);
  const [view, setView]       = useState('dayGridMonth');
  const [title, setTitle]     = useState('');
  const rangeRef = useRef({ start: null, end: null });

  const loadRange = useCallback(async (rangeStart, rangeEnd) => {
    setLoading(true); setError(null);
    try {
      const afterIso  = rangeStart.toISOString().replace(/\.\d+Z$/, '');
      const beforeIso = rangeEnd.toISOString().replace(/\.\d+Z$/, '');
      const calls = [];
      const wantMeeting = scopes.includes('Meeting');
      const wantCall    = scopes.includes('Call');
      const wantTask    = scopes.includes('Task');

      const common = {
        maxSize: 500,
        'where[0][type]': 'after',  'where[0][attribute]': 'dateStart', 'where[0][value]': afterIso,
        'where[1][type]': 'before', 'where[1][attribute]': 'dateStart', 'where[1][value]': beforeIso,
      };
      if (wantMeeting) calls.push(listMeetings({ ...common, select: 'id,name,dateStart,dateEnd,status,assignedUserName' }).then(r => ({ scope: 'Meeting', list: r.list || [] })));
      if (wantCall)    calls.push(listCalls({ ...common, select: 'id,name,dateStart,dateEnd,status,assignedUserName' }).then(r => ({ scope: 'Call', list: r.list || [] })));
      if (wantTask) {
        const taskParams = {
          maxSize: 500,
          'where[0][type]': 'after',  'where[0][attribute]': 'dateEnd', 'where[0][value]': afterIso,
          'where[1][type]': 'before', 'where[1][attribute]': 'dateEnd', 'where[1][value]': beforeIso,
          select: 'id,name,dateStart,dateEnd,status,priority,isOverdue,assignedUserName',
        };
        calls.push(listTasks(taskParams).then(r => ({ scope: 'Task', list: r.list || [] })));
      }
      const results = await Promise.all(calls);
      const merged = [];
      for (const { scope, list } of results) {
        for (const r of list) {
          const start = espoToIso(r.dateStart || r.dateStartDate || r.dateEnd || r.dateEndDate);
          const end   = espoToIso(r.dateEnd   || r.dateEndDate);
          if (!start) continue;
          merged.push({
            id: `${scope}:${r.id}`,
            title: r.name || '(untitled)',
            start,
            end: end && end !== start ? end : null,
            allDay: /^\d{4}-\d{2}-\d{2}$/.test(start),
            extendedProps: { scope, entityId: r.id, raw: r },
          });
        }
      }
      setEvents(merged);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Load failed');
    }
    setLoading(false);
  }, [scopes]);

  useEffect(() => {
    if (rangeRef.current.start && rangeRef.current.end) {
      loadRange(rangeRef.current.start, rangeRef.current.end);
    }
  }, [loadRange]);

  const onDatesSet = (info) => {
    rangeRef.current = { start: info.start, end: info.end };
    setTitle(info.view.title);
    loadRange(info.start, info.end);
  };

  const eventClick = (info) => {
    const { scope, entityId } = info.event.extendedProps;
    // Meeting/Call don't have dedicated routes yet — Tasks do.
    if (scope === 'Task') navigate(`../tasks/${entityId}`);
    else alert(`${scope}: ${info.event.title}\n(No dedicated route yet for ${scope}.)`);
  };

  const eventDrop = async (info) => {
    const { scope, entityId } = info.event.extendedProps;
    if (scope !== 'Task') {
      info.revert();
      return;
    }
    const newDate = info.event.start;
    const iso = newDate.toISOString().slice(0, 10);
    try {
      await updateTask(entityId, { dateEndDate: iso });
    } catch (e) {
      alert('Move failed: ' + (e?.response?.data?.message || e.message));
      info.revert();
    }
  };

  const counts = useMemo(() => {
    const c = { Meeting: 0, Call: 0, Task: 0 };
    events.forEach(e => c[e.extendedProps.scope]++);
    return c;
  }, [events]);

  const nav = (dir) => {
    const api = calRef.current?.getApi();
    if (!api) return;
    if (dir === 'prev') api.prev();
    else if (dir === 'next') api.next();
    else api.today();
  };
  const switchView = (v) => {
    setView(v);
    calRef.current?.getApi().changeView(v);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6">Calendar</Typography>
          <Typography variant="body2" color="text.secondary">
            {counts.Meeting} meetings · {counts.Call} calls · {counts.Task} tasks
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />}
            onClick={() => navigate('../tasks/new')} sx={{ fontWeight: 600 }}>
            Create Task
          </Button>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => { if (rangeRef.current.start) loadRange(rangeRef.current.start, rangeRef.current.end); }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={(theme) => ({
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        mb: 2, px: 1.5, py: 1, flexWrap: 'wrap', gap: 1,
        bgcolor: 'background.default',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
      })}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => nav('prev')}><ChevronLeft fontSize="small" /></IconButton>
          <Button size="small" variant="outlined" startIcon={<TodayIcon />} onClick={() => nav('today')}>Today</Button>
          <IconButton size="small" onClick={() => nav('next')}><ChevronRight fontSize="small" /></IconButton>
          <Typography sx={{ fontWeight: 700, ml: 1 }}>{title}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" exclusive value={view}
            onChange={(_, v) => v && switchView(v)}
            sx={(theme) => ({
              '& .MuiToggleButton-root.Mui-selected': {
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                '&:hover': { bgcolor: theme.palette.primary.dark },
              },
            })}>
            <ToggleButton value="dayGridMonth">Month</ToggleButton>
            <ToggleButton value="timeGridWeek">Week</ToggleButton>
            <ToggleButton value="timeGridDay">Day</ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select multiple value={scopes}
              onChange={e => setScopes(e.target.value)}
              renderValue={(sel) => sel.length === SCOPES.length ? 'All types' : sel.join(', ')}>
              {SCOPES.map(s => (
                <MenuItem key={s.key} value={s.key}>
                  <Chip size="small" label={s.label}
                    sx={(theme) => ({
                      mr: 1, height: 20, fontSize: 10,
                      bgcolor: toneHex(theme, TYPE_TONE[s.key]),
                      color: theme.palette.getContrastText(toneHex(theme, TYPE_TONE[s.key])),
                    })} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Box sx={(theme) => ({
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        p: 1.5,
        position: 'relative',
        // FullCalendar theming via CSS vars so it inherits the palette
        '--fc-border-color':     theme.palette.divider,
        '--fc-page-bg-color':    theme.palette.background.paper,
        '--fc-neutral-bg-color': alpha(theme.palette.text.primary, 0.04),
        '--fc-today-bg-color':   alpha(theme.palette.primary.main, 0.08),
        '--fc-event-text-color': '#fff',
        '--fc-list-event-hover-bg-color': alpha(theme.palette.primary.main, 0.06),
        '& .fc': { fontFamily: 'inherit' },
        '& .fc-theme-standard td, & .fc-theme-standard th': { borderColor: theme.palette.divider },
        '& .fc-col-header-cell-cushion': {
          color: theme.palette.text.secondary,
          fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', padding: '6px 4px',
        },
        '& .fc-daygrid-day-number': {
          color: theme.palette.text.primary, fontSize: 12, padding: '4px 6px',
        },
        '& .fc-day-today': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
        '& .fc-event': {
          border: 0, borderRadius: 4, padding: '2px 4px',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
        },
        // hide FullCalendar's built-in toolbar since we render our own
        '& .fc-header-toolbar': { display: 'none' },
      })}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6), zIndex: 2 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          height="calc(100vh - 280px)"
          events={events}
          datesSet={onDatesSet}
          eventClick={eventClick}
          editable
          eventDrop={eventDrop}
          eventDidMount={(info) => {
            const scope = info.event.extendedProps.scope;
            info.el.style.backgroundColor = toneHexMap[scope] || theme.palette.primary.main;
          }}
          dayMaxEvents={3}
          nowIndicator
          firstDay={0}
          headerToolbar={false}
        />
      </Box>
    </Box>
  );
}
