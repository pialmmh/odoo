import { useEffect, useRef, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Table, TableHead, TableBody, TableRow, TableCell,
  LinearProgress, Tabs, Tab, Paper, IconButton, Tooltip as MuiTooltip, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Storage as DbIcon,
  CheckCircle as OkIcon,
  Warning as WarnIcon,
  Error as ErrIcon,
  Refresh as RefreshIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const tick = { fontSize: 'var(--font-size-xs)' };

const CLUSTER = {
  name: 'db-prod (galera-1)',
  size: 3,
  primary: true,
  state: 'PRIMARY',
  uuid: 'f8c9a1d2-...-e0b47',
  segment: 0,
  weightedQuorum: '3 / 3',
  seqno: 948721,
};

const NODES = [
  { name: 'galera-node-1', host: '10.10.199.11', role: 'synced', wsrep: 'Synced', ready: true, queueSend: 0, queueRecv: 0, flowCtrlPaused: 0.00, committed: 948721, connected: true, cpu: 38, mem: 62, disk: 51 },
  { name: 'galera-node-2', host: '10.10.199.12', role: 'synced', wsrep: 'Synced', ready: true, queueSend: 1, queueRecv: 0, flowCtrlPaused: 0.01, committed: 948721, connected: true, cpu: 44, mem: 65, disk: 49 },
  { name: 'galera-node-3', host: '10.10.199.13', role: 'donor/desynced', wsrep: 'Donor/Desynced', ready: true, queueSend: 12, queueRecv: 3, flowCtrlPaused: 0.08, committed: 948715, connected: true, cpu: 72, mem: 81, disk: 58 },
];

const REPL_TREND = Array.from({ length: 40 }, (_, i) => ({
  t: i,
  n1: Math.max(0, Math.round(2 * Math.sin(i / 3) + Math.random() * 2)),
  n2: Math.max(0, Math.round(3 * Math.sin(i / 3 + 1) + Math.random() * 2)),
  n3: Math.max(0, Math.round(8 + 4 * Math.sin(i / 4) + Math.random() * 3)),
}));

const COMMIT_TREND = Array.from({ length: 40 }, (_, i) => ({
  t: i,
  commits: 120 + Math.round(30 * Math.sin(i / 5) + 20 * Math.random()),
  conflicts: Math.max(0, Math.round(2 * Math.sin(i / 6) + Math.random())),
}));

const ALERTS = [
  { severity: 'warning', node: 'galera-node-3', msg: 'Flow control paused 8% of last minute', when: '1m ago' },
  { severity: 'warning', node: 'galera-node-3', msg: 'Send queue depth > 10', when: '2m ago' },
  { severity: 'info',    node: 'galera-node-3', msg: 'SST donor role active (incremental)', when: '6m ago' },
  { severity: 'info',    node: 'cluster',       msg: 'Quorum re-validated (3/3)', when: '14m ago' },
];

const INITIAL_LOG = [
  { t: '14:22:01', node: 'galera-node-1', lvl: 'INFO',  msg: 'WSREP: Member 0 (galera-node-1) synced with group.' },
  { t: '14:22:02', node: 'galera-node-2', lvl: 'INFO',  msg: 'WSREP: Member 1 (galera-node-2) synced with group.' },
  { t: '14:22:05', node: 'galera-node-3', lvl: 'INFO',  msg: 'WSREP: New cluster view: primary = yes, members = 3' },
  { t: '14:22:40', node: 'galera-node-3', lvl: 'INFO',  msg: 'WSREP: Initiating SST transfer to joiner (incremental IST)' },
  { t: '14:23:11', node: 'galera-node-3', lvl: 'WARN',  msg: 'WSREP: Flow control: paused sending 0.08 (tx queue 12)' },
  { t: '14:23:48', node: 'galera-node-2', lvl: 'INFO',  msg: 'WSREP: Applier thread 3 committed seqno 948712' },
  { t: '14:24:02', node: 'galera-node-3', lvl: 'WARN',  msg: 'WSREP: cert index size exceeded 512MB — consider gcache tuning' },
  { t: '14:24:21', node: 'galera-node-1', lvl: 'INFO',  msg: 'WSREP: Recv queue empty, applier caught up (seqno 948721)' },
];

function wsrepChip(wsrep) {
  const map = {
    'Synced': { color: 'success', icon: <OkIcon /> },
    'Donor/Desynced': { color: 'warning', icon: <WarnIcon /> },
    'Joining': { color: 'info', icon: <DotIcon /> },
    'Joined': { color: 'info', icon: <DotIcon /> },
    'Disconnected': { color: 'error', icon: <ErrIcon /> },
  };
  const { color, icon } = map[wsrep] || { color: 'default', icon: <DotIcon /> };
  return <Chip size="small" icon={icon} label={wsrep} color={color} variant="outlined" />;
}

function sevChip(sev) {
  const map = { critical: 'error', warning: 'warning', info: 'info' };
  return <Chip size="small" label={sev.toUpperCase()} color={map[sev] || 'default'} sx={{ fontWeight: 'var(--font-weight-bold)', minWidth: 72 }} />;
}

function lvlCssVar(lvl) {
  if (lvl === 'ERROR') return 'var(--color-log-level-error)';
  if (lvl === 'WARN') return 'var(--color-log-level-warn)';
  if (lvl === 'INFO') return 'var(--color-log-level-info)';
  return 'var(--color-log-level-debug)';
}

function Meter({ value }) {
  const clr = value >= 85 ? 'error' : value >= 70 ? 'warning' : 'primary';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LinearProgress variant="determinate" value={value} color={clr} sx={{ flex: 1, height: 6, borderRadius: 'var(--radius-sm)' }} />
      <Typography sx={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', minWidth: 34, textAlign: 'right' }}>{value}%</Typography>
    </Box>
  );
}

export default function NmsGalera() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [logs, setLogs] = useState(INITIAL_LOG);
  const logBoxRef = useRef(null);

  const series1 = theme.palette.success.main;
  const series2 = theme.palette.info.main;
  const series3 = theme.palette.error.main;

  useEffect(() => {
    const id = setInterval(() => {
      const nodes = NODES.map(n => n.name);
      const lvls = ['INFO', 'INFO', 'INFO', 'WARN'];
      const msgs = [
        'WSREP: Applier thread committed seqno ' + (948721 + Math.floor(Math.random() * 1000)),
        'WSREP: Recv queue drained, applier caught up',
        'WSREP: Flow control: paused sending ' + (Math.random() * 0.1).toFixed(2),
        'WSREP: cert index prune complete',
        'WSREP: Heartbeat received from all peers',
      ];
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const entry = {
        t: `${hh}:${mm}:${ss}`,
        node: nodes[Math.floor(Math.random() * nodes.length)],
        lvl: lvls[Math.floor(Math.random() * lvls.length)],
        msg: msgs[Math.floor(Math.random() * msgs.length)],
      };
      setLogs(prev => {
        const next = [...prev, entry];
        return next.length > 200 ? next.slice(-200) : next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <DbIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" fontWeight={700}>Galera Cluster</Typography>
        <Chip size="small" label={CLUSTER.name} />
        <Chip size="small" label="PRIMARY" color="success" sx={{ fontWeight: 'var(--font-weight-bold)' }} />
        <Box sx={{ flex: 1 }} />
        <MuiTooltip title="Refresh (mock)"><IconButton size="small"><RefreshIcon fontSize="small" /></IconButton></MuiTooltip>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Multi-master synchronous replication cluster. Live WSREP state, replication queues, flow control, logs and alerts.
      </Typography>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <Card><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Cluster Size</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{CLUSTER.size} / 3</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="success.main">Quorum healthy</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Cluster State</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{CLUSTER.state}</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Segment {CLUSTER.segment}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Last Committed Seqno</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{CLUSTER.seqno.toLocaleString()}</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Trailing node: −6</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Synced Nodes</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>2 / 3</Typography>
            <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="warning.main">1 donor/desynced</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ borderRadius: 'var(--radius-2xl)' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid var(--color-border-subtle)', px: 1 }}>
          <Tab label="Nodes" />
          <Tab label="Replication" />
          <Tab label="Live Logs" />
          <Tab label="Alerts" />
        </Tabs>

        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Node</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Host</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>WSREP State</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Send Q</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Recv Q</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Flow Ctrl Paused</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Seqno</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)', width: 140 }}>CPU</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)', width: 140 }}>Memory</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {NODES.map(n => (
                  <TableRow key={n.name} hover>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>{n.name}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)' }}>{n.host}</TableCell>
                    <TableCell>{wsrepChip(n.wsrep)}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)', color: n.queueSend > 10 ? 'warning.main' : 'inherit', fontWeight: n.queueSend > 10 ? 'var(--font-weight-bold)' : 'var(--font-weight-regular)' }}>{n.queueSend}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)' }}>{n.queueRecv}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)', color: n.flowCtrlPaused > 0.05 ? 'warning.main' : 'inherit', fontWeight: n.flowCtrlPaused > 0.05 ? 'var(--font-weight-bold)' : 'var(--font-weight-regular)' }}>
                      {(n.flowCtrlPaused * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)' }}>{n.committed.toLocaleString()}</TableCell>
                    <TableCell><Meter value={n.cpu} /></TableCell>
                    <TableCell><Meter value={n.mem} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography sx={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', mb: 1 }}>Send Queue Depth (per node)</Typography>
                <Box sx={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={REPL_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="t" tick={tick} />
                      <YAxis tick={tick} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 'var(--font-size-xs)' }} />
                      <Line type="monotone" dataKey="n1" name="node-1" stroke={series1} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="n2" name="node-2" stroke={series2} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="n3" name="node-3" stroke={series3} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography sx={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', mb: 1 }}>Commits / Cert Conflicts per sec</Typography>
                <Box sx={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={COMMIT_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="t" tick={tick} />
                      <YAxis tick={tick} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 'var(--font-size-xs)' }} />
                      <Line type="monotone" dataKey="commits" name="commits/s" stroke={series1} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="conflicts" name="cert conflicts/s" stroke={series3} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}><Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Cluster UUID</Typography><Typography sx={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>{CLUSTER.uuid}</Typography></Grid>
              <Grid item xs={6} md={3}><Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Weighted Quorum</Typography><Typography sx={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>{CLUSTER.weightedQuorum}</Typography></Grid>
              <Grid item xs={6} md={3}><Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">Primary Component</Typography><Typography sx={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>Yes</Typography></Grid>
              <Grid item xs={6} md={3}><Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">GCache Size</Typography><Typography sx={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>512 MB</Typography></Grid>
            </Grid>
          </Box>
        )}

        {tab === 2 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <DotIcon sx={{ fontSize: 'var(--font-size-xs)', color: 'success.main' }} />
              <Typography sx={{ fontSize: 'var(--font-size-sm)' }} color="text.secondary">Live — streaming WSREP log from all nodes</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 'var(--font-size-xs)' }} color="text.secondary">{logs.length} lines</Typography>
            </Box>
            <Box
              ref={logBoxRef}
              sx={{
                fontFamily: 'monospace',
                fontSize: 'var(--font-size-sm)',
                bgcolor: 'var(--color-log-bg)',
                color: 'var(--color-log-text)',
                borderRadius: 'var(--radius-sm)',
                p: 1.5,
                height: 420,
                overflowY: 'auto',
              }}
            >
              {logs.map((l, i) => (
                <Box key={i} sx={{ whiteSpace: 'pre', display: 'flex', gap: 1 }}>
                  <span style={{ color: 'var(--color-log-dim)' }}>{l.t}</span>
                  <span style={{ color: 'var(--color-log-accent)', minWidth: 120 }}>{l.node}</span>
                  <span style={{ color: lvlCssVar(l.lvl), fontWeight: 'var(--font-weight-bold)', minWidth: 50 }}>{l.lvl}</span>
                  <span>{l.msg}</span>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {tab === 3 && (
          <Box sx={{ p: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)', width: 100 }}>Severity</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Source</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)' }}>Message</TableCell>
                  <TableCell sx={{ fontSize: 'var(--font-size-xs)', width: 100 }}>When</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ALERTS.map((a, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{sevChip(a.severity)}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>{a.node}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)' }}>{a.msg}</TableCell>
                    <TableCell sx={{ fontSize: 'var(--font-size-sm)', color: 'text.secondary' }}>{a.when}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
