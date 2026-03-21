import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Grid, Card, CardContent, Typography, Box,
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, LinearProgress, CircularProgress,
} from '@mui/material';
import {
  Dns as ComputeIcon,
  Router as DeviceIcon,
  ViewInAr as ContainerIcon,
  VpnKey as KeyIcon,
  Business as DcIcon,
  Public as RegionIcon,
  Storage as StorageIcon,
  RocketLaunch as DeployIcon,
  CheckCircle as OkIcon,
  Error as ErrIcon,
  Inventory2 as ArtifactIcon,
} from '@mui/icons-material';
import { call } from '../services/odoo';
import { useTenant } from '../context/TenantContext';

function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ color }}>{icon}</Box>
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography fontSize={11} color="text.secondary">{title}</Typography>
            <Typography fontSize={20} fontWeight={700}>{value}</Typography>
            {subtitle && <Typography fontSize={10} color="text.secondary">{subtitle}</Typography>}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }) {
  return <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, mt: 2, letterSpacing: 1 }}>{children}</Typography>;
}

const STATUS_COLORS = { active: 'success', running: 'success', stopped: 'default', deployed: 'warning', verified: 'success', pending: 'default', failed: 'error' };

export default function Dashboard() {
  const navigate = useNavigate();
  const { tenant: tenantSlug } = useParams();
  const { activeTenant, partnerId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [infra, setInfra] = useState({});
  const [sshKeys, setSSHKeys] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, [partnerId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const dcDomain = partnerId ? [['partner_id', '=', partnerId]] : [];

      const [regions, zones, dcs, computes, containers, devices, storage, networks, keys, creds, deps, projs] = await Promise.all([
        call('infra.region', 'search_count', [[]]),
        call('infra.availability.zone', 'search_count', [[]]),
        call('infra.datacenter', 'search_count', [dcDomain]),
        call('infra.compute', 'search_count', [dcDomain.length ? [['datacenter_id.partner_id', '=', partnerId]] : []]),
        call('infra.container', 'search_count', [[]]),
        call('infra.network.device', 'search_count', [dcDomain.length ? [['datacenter_id.partner_id', '=', partnerId]] : []]),
        call('infra.storage', 'search_count', [[]]),
        call('infra.networking', 'search_count', [[]]),
        call('infra.ssh.key', 'search_read', [[]], { fields: ['id', 'name', 'algorithm', 'key_storage', 'fingerprint', 'credential_count', 'created_date'], limit: 5, order: 'created_date desc' }),
        call('infra.ssh.credential', 'search_read', [[]], { fields: ['id', 'name', 'host', 'port', 'deploy_status', 'linked_entity'], limit: 10, order: 'id desc' }),
        call('artifact.deployment', 'search_read', [[]], { fields: ['id', 'name', 'status', 'started_at', 'finished_at', 'deployed_by'], limit: 5, order: 'started_at desc' }).catch(() => []),
        call('artifact.project', 'search_read', [[]], { fields: ['id', 'name', 'project_type', 'version_count', 'deployment_count'], order: 'name' }).catch(() => []),
      ]);

      setInfra({ regions, zones, dcs, computes, containers, devices, storage, networks });
      setSSHKeys(keys);
      setCredentials(creds);
      setDeployments(deps);
      setProjects(projs);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  const base = tenantSlug ? `/${tenantSlug}` : '';
  const verifiedCreds = credentials.filter(c => c.deploy_status === 'verified').length;
  const pendingCreds = credentials.filter(c => c.deploy_status === 'pending').length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        {activeTenant?.name || 'Platform'} Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Infrastructure and deployment overview</Typography>

      {/* ── Infrastructure Stats ── */}
      <SectionTitle>Infrastructure</SectionTitle>
      <Grid container spacing={1.5} sx={{ mb: 1 }}>
        <Grid item xs={6} sm={4} md={2}><StatCard title="Regions" value={infra.regions} icon={<RegionIcon />} color="#6366f1" /></Grid>
        <Grid item xs={6} sm={4} md={2}><StatCard title="Datacenters" value={infra.dcs} icon={<DcIcon />} color="#0ea5e9" /></Grid>
        <Grid item xs={6} sm={4} md={2}><StatCard title="Computes" value={infra.computes} icon={<ComputeIcon />} color="#10b981" /></Grid>
        <Grid item xs={6} sm={4} md={2}><StatCard title="Containers" value={infra.containers} icon={<ContainerIcon />} color="#8b5cf6" /></Grid>
        <Grid item xs={6} sm={4} md={2}><StatCard title="Net Devices" value={infra.devices} icon={<DeviceIcon />} color="#f59e0b" /></Grid>
        <Grid item xs={6} sm={4} md={2}><StatCard title="Networks" value={infra.networks} icon={<StorageIcon />} color="#64748b" /></Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0 }}>
        {/* ── SSH Keys ── */}
        <Grid item xs={12} md={6}>
          <SectionTitle>SSH Keys</SectionTitle>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Key</TableCell><TableCell>Algorithm</TableCell><TableCell>Storage</TableCell><TableCell align="right">Used By</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {sshKeys.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No SSH keys</TableCell></TableRow>
                  ) : sshKeys.map(k => (
                    <TableRow key={k.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/infra/ssh`)}>
                      <TableCell><Typography fontSize={12} fontWeight={600}>{k.name}</Typography></TableCell>
                      <TableCell><Chip label={k.algorithm} size="small" variant="outlined" sx={{ fontSize: 10 }} /></TableCell>
                      <TableCell><Chip label={k.key_storage === 'vault' ? 'Vault' : 'Local'} size="small" color={k.key_storage === 'vault' ? 'success' : 'default'} sx={{ fontSize: 10 }} /></TableCell>
                      <TableCell align="right">{k.credential_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* ── SSH Credentials Status ── */}
        <Grid item xs={12} md={6}>
          <SectionTitle>SSH Credentials ({credentials.length})</SectionTitle>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography fontSize={24} fontWeight={700} color="success.main">{verifiedCreds}</Typography>
                    <Typography fontSize={11} color="text.secondary">Verified</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography fontSize={24} fontWeight={700} color="warning.main">{credentials.length - verifiedCreds - pendingCreds}</Typography>
                    <Typography fontSize={11} color="text.secondary">Deployed</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography fontSize={24} fontWeight={700} color="text.secondary">{pendingCreds}</Typography>
                    <Typography fontSize={11} color="text.secondary">Pending</Typography>
                  </Box>
                </Grid>
              </Grid>
              {credentials.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress variant="determinate" value={credentials.length > 0 ? (verifiedCreds / credentials.length) * 100 : 0}
                    sx={{ height: 6, borderRadius: 3 }} color="success" />
                  <Typography fontSize={10} color="text.secondary" sx={{ mt: 0.5 }}>{Math.round((verifiedCreds / credentials.length) * 100)}% verified</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0 }}>
        {/* ── Software Projects ── */}
        <Grid item xs={12} md={6}>
          <SectionTitle>Software Projects</SectionTitle>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Project</TableCell><TableCell>Type</TableCell><TableCell align="right">Versions</TableCell><TableCell align="right">Deploys</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {projects.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No projects registered</TableCell></TableRow>
                  ) : projects.map(p => (
                    <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/artifacts`)}>
                      <TableCell><Typography fontSize={12} fontWeight={600}>{p.name}</Typography></TableCell>
                      <TableCell><Chip label={p.project_type} size="small" variant="outlined" sx={{ fontSize: 10 }} /></TableCell>
                      <TableCell align="right">{p.version_count}</TableCell>
                      <TableCell align="right">{p.deployment_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Recent Deployments ── */}
        <Grid item xs={12} md={6}>
          <SectionTitle>Recent Deployments</SectionTitle>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Deployment</TableCell><TableCell>Status</TableCell><TableCell>When</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {deployments.length === 0 ? (
                    <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>No deployments yet</TableCell></TableRow>
                  ) : deployments.map(d => (
                    <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/artifacts`)}>
                      <TableCell><Typography fontSize={12} fontWeight={600}>{d.name}</Typography></TableCell>
                      <TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} sx={{ fontSize: 10 }} /></TableCell>
                      <TableCell><Typography fontSize={11} color="text.secondary">{d.started_at ? new Date(d.started_at).toLocaleDateString() : '-'}</Typography></TableCell>
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
