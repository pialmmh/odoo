import { Box, Grid, Card, CardContent, Typography, LinearProgress, Chip, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Dns as ServerIcon,
  ViewInAr as ContainerIcon,
  Computer as VmIcon,
  Storage as DbIcon,
  Speed as NetIcon,
  CheckCircle as OkIcon,
  Warning as WarnIcon,
  Error as ErrIcon,
} from '@mui/icons-material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// ─── Mock data ──────────────────────────────────────────────────────────────
// Palette keys (not hex) — resolved via MUI theme at render time so the UI
// tracks the tenant/mode palette.
const FLEET = [
  { label: 'Servers',          value: 12,  icon: <ServerIcon />,    palette: 'primary' },
  { label: 'Virtual Machines', value: 34,  icon: <VmIcon />,        palette: 'success' },
  { label: 'Containers',       value: 118, icon: <ContainerIcon />, palette: 'warning' },
  { label: 'Databases',        value: 9,   icon: <DbIcon />,        palette: 'info' },
];

const HEALTH = [
  { label: 'Healthy', value: 156, color: 'success' },
  { label: 'Warning', value: 11,  color: 'warning' },
  { label: 'Critical', value: 3,  color: 'error' },
];

const SERVICES = [
  { name: 'Galera Cluster (db-prod)',    kind: 'Galera', nodes: '3/3 synced',                                 status: 'healthy' },
  { name: 'MySQL Primary (db-analytics)', kind: 'MySQL',  nodes: '1/1 up',                                     status: 'healthy' },
  { name: 'Kafka Cluster (events)',       kind: 'Kafka',  nodes: '3/3 brokers',                                status: 'warning' },
  { name: 'Redis Sentinel (cache)',       kind: 'Redis',  nodes: '1 master, 2 replicas, 3 sentinels',          status: 'healthy' },
  { name: 'Redis Sentinel (session)',     kind: 'Redis',  nodes: 'failover in progress',                       status: 'critical' },
];

const HOSTS = [
  { host: 'host-01.dc1', cpu: 42, mem: 68, disk: 55, netIn: 180, netOut: 96  },
  { host: 'host-02.dc1', cpu: 81, mem: 74, disk: 42, netIn: 310, netOut: 220 },
  { host: 'host-03.dc1', cpu: 23, mem: 45, disk: 62, netIn: 78,  netOut: 55  },
  { host: 'host-04.dc2', cpu: 95, mem: 88, disk: 71, netIn: 420, netOut: 385 },
  { host: 'host-05.dc2', cpu: 51, mem: 60, disk: 49, netIn: 140, netOut: 120 },
];

const CPU_TREND = Array.from({ length: 30 }, (_, i) => ({
  t: i,
  cpu: 40 + Math.round(20 * Math.sin(i / 3) + 10 * Math.random()),
  mem: 55 + Math.round(10 * Math.cos(i / 4) + 5 * Math.random()),
}));

const ALERTS = [
  { severity: 'critical', source: 'host-04.dc2',    msg: 'CPU > 90% sustained for 5m',              when: '2m ago'  },
  { severity: 'critical', source: 'redis-session',  msg: 'Sentinel failover triggered',             when: '4m ago'  },
  { severity: 'warning',  source: 'kafka-broker-2', msg: 'Under-replicated partitions: 7',          when: '11m ago' },
  { severity: 'warning',  source: 'host-02.dc1',    msg: 'Memory > 70%',                            when: '22m ago' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function statusChip(status) {
  if (status === 'healthy') return <Chip size="small" icon={<OkIcon />}   label="Healthy"  color="success" variant="outlined" />;
  if (status === 'warning') return <Chip size="small" icon={<WarnIcon />} label="Warning"  color="warning" variant="outlined" />;
  return                           <Chip size="small" icon={<ErrIcon />}  label="Critical" color="error"   variant="outlined" />;
}

function severityChip(sev) {
  const c = sev === 'critical' ? 'error' : sev === 'warning' ? 'warning' : 'default';
  return <Chip size="small" label={sev.toUpperCase()} color={c} sx={{ fontWeight: 'var(--font-weight-bold)', minWidth: 72 }} />;
}

function Meter({ value }) {
  const clr = value >= 85 ? 'error' : value >= 70 ? 'warning' : 'primary';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LinearProgress variant="determinate" value={value} color={clr} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
      <Typography variant="caption" fontWeight={600} sx={{ minWidth: 34, textAlign: 'right' }}>{value}%</Typography>
    </Box>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function NmsOverview() {
  const theme = useTheme();
  const chartCpu = theme.palette.success.main;
  const chartMem = theme.palette.primary.main;
  const tickSize = Number(getComputedStyle(document.documentElement).getPropertyValue('--font-size-xs')) || 11;

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>Network Operations</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Fleet-wide health across servers, virtual machines, containers, and platform services.
      </Typography>

      {/* Fleet summary */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {FLEET.map(f => {
          const main = theme.palette[f.palette].main;
          return (
            <Grid item xs={6} md={3} key={f.label}>
              <Card>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 1.5,
                    bgcolor: alpha(main, 0.15), color: main,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{f.icon}</Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                    <Typography variant="h6" fontWeight={700}>{f.value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={1.5}>
        {/* Health breakdown */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Health Breakdown</Typography>
              {HEALTH.map(h => (
                <Box key={h.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Chip size="small" label={h.label} color={h.color} variant="outlined" />
                  <Typography variant="h6" fontWeight={700}>{h.value}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Trend chart */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Fleet CPU / Memory — last 30 min</Typography>
              <Box sx={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <AreaChart data={CPU_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={chartCpu} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={chartCpu} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={chartMem} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={chartMem} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tick={{ fontSize: tickSize }} />
                    <YAxis tick={{ fontSize: tickSize }} domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="cpu" stroke={chartCpu} fill="url(#gCpu)" strokeWidth={2} />
                    <Area type="monotone" dataKey="mem" stroke={chartMem} fill="url(#gMem)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Hosts table */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Hosts</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Host</TableCell>
                    <TableCell sx={{ width: 160 }}>CPU</TableCell>
                    <TableCell sx={{ width: 160 }}>Memory</TableCell>
                    <TableCell sx={{ width: 160 }}>Disk</TableCell>
                    <TableCell>Net In / Out (Mbps)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {HOSTS.map(h => (
                    <TableRow key={h.host} hover>
                      <TableCell><Typography variant="body2" fontWeight={600}>{h.host}</Typography></TableCell>
                      <TableCell><Meter value={h.cpu}  /></TableCell>
                      <TableCell><Meter value={h.mem}  /></TableCell>
                      <TableCell><Meter value={h.disk} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <NetIcon sx={{ fontSize: 'var(--font-size-md)', color: 'text.secondary' }} />
                          <Typography variant="body2">{h.netIn} / {h.netOut}</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Active Alerts</Typography>
              {ALERTS.map((a, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75,
                  borderBottom: i === ALERTS.length - 1 ? 'none' : '1px solid',
                  borderColor: 'divider',
                }}>
                  {severityChip(a.severity)}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{a.source}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.msg}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{a.when}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Services */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Platform Services</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Topology</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {SERVICES.map(s => (
                    <TableRow key={s.name} hover>
                      <TableCell><Typography variant="body2" fontWeight={600}>{s.name}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{s.kind}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{s.nodes}</Typography></TableCell>
                      <TableCell>{statusChip(s.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
