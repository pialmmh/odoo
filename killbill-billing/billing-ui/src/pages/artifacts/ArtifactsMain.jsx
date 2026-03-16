import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Tab, Tabs,
  MenuItem, Select, FormControl, InputLabel, IconButton, InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  RocketLaunch as DeployIcon, Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNotification } from '../../components/ErrorNotification';
import {
  getProjects, createProject, updateProject,
  getVersions, createVersion,
  getDeployments, createDeployment, triggerDeploy,
  getDeployTemplates, getComputes, getSSHCredentials,
} from '../../services/artifacts';
import PipelineViewer from './PipelineViewer';

const PROJECT_TYPES = [{ value: 'jar', label: 'Java JAR' }, { value: 'docker', label: 'Docker' }, { value: 'lxc', label: 'LXC' }];
const STATUS_COLORS = { draft: 'default', released: 'success', deprecated: 'warning', running: 'info', success: 'success', failed: 'error', rolled_back: 'warning' };

// ── Project Dialog ──
function ProjectDialog({ open, onClose, onSave, record }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(record ? { name: record.name, project_type: record.project_type, repo_url: record.repo_url || '', artifact_path: record.artifact_path || '', deploy_base_path: record.deploy_base_path || '', description: record.description || '' }
      : { name: '', project_type: 'jar', repo_url: '', artifact_path: '', deploy_base_path: '/opt/app', description: '' });
  }, [record, open]);
  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? 'Edit Project' : 'Add Project'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 8 }}><TextField fullWidth size="small" label="Project Name" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
              <Select label="Type" value={form.project_type || 'jar'} onChange={e => setForm({ ...form, project_type: e.target.value })}>
                {PROJECT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Repository URL" value={form.repo_url || ''} onChange={e => setForm({ ...form, repo_url: e.target.value })} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Artifact Path" value={form.artifact_path || ''} onChange={e => setForm({ ...form, artifact_path: e.target.value })} helperText="e.g. target/app-runner.jar" /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Deploy Base Path" value={form.deploy_base_path || ''} onChange={e => setForm({ ...form, deploy_base_path: e.target.value })} helperText="e.g. /opt/routesphere" /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Description" multiline rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Version Dialog ──
function VersionDialog({ open, onClose, onSave, projects }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm({ project_id: '', git_tag: '', git_commit: '', git_branch: 'main', artifact_path: '', built_by: '', notes: '' }); }, [open]);
  const handleSave = async () => {
    if (!form.project_id || !form.git_tag) return;
    setSaving(true);
    try { await onSave(form); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Register Version</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>Project</InputLabel>
              <Select label="Project" required value={form.project_id || ''} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                {(projects || []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Git Tag" required value={form.git_tag || ''} onChange={e => setForm({ ...form, git_tag: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Git Commit" value={form.git_commit || ''} onChange={e => setForm({ ...form, git_commit: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Git Branch" value={form.git_branch || ''} onChange={e => setForm({ ...form, git_branch: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth size="small" label="Built By" value={form.built_by || ''} onChange={e => setForm({ ...form, built_by: e.target.value })} /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Artifact Path (local)" value={form.artifact_path || ''} onChange={e => setForm({ ...form, artifact_path: e.target.value })} helperText="Full path to built JAR on this server" /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Notes" multiline rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

// ── Deploy Dialog ──
function DeployDialog({ open, onClose, onDeploy, projects, versions, computes, credentials, templates }) {
  const [form, setForm] = useState({});
  const [deploying, setDeploying] = useState(false);
  useEffect(() => { setForm({ project_id: '', version_id: '', compute_id: '', ssh_credential_id: '', deploy_template_id: '', variables: '{}' }); }, [open]);

  const filteredVersions = (versions || []).filter(v => !form.project_id || v.project_id?.[0] === form.project_id);
  const filteredCreds = (credentials || []).filter(c => !form.compute_id || c.compute_id?.[0] === form.compute_id);

  const handleDeploy = async () => {
    if (!form.version_id || !form.compute_id || !form.ssh_credential_id) return;
    setDeploying(true);
    try { await onDeploy(form); onClose(); } catch (e) { alert(e.message); } finally { setDeploying(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Deployment</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>Project</InputLabel>
              <Select label="Project" value={form.project_id || ''} onChange={e => setForm({ ...form, project_id: e.target.value, version_id: '' })}>
                {(projects || []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>Version</InputLabel>
              <Select label="Version" required value={form.version_id || ''} onChange={e => setForm({ ...form, version_id: e.target.value })}>
                {filteredVersions.map(v => <MenuItem key={v.id} value={v.id}>{v.git_tag} ({v.git_commit})</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>Target Compute</InputLabel>
              <Select label="Target Compute" required value={form.compute_id || ''} onChange={e => setForm({ ...form, compute_id: e.target.value })}>
                {(computes || []).map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.management_ip})</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>SSH Credential</InputLabel>
              <Select label="SSH Credential" required value={form.ssh_credential_id || ''} onChange={e => setForm({ ...form, ssh_credential_id: e.target.value })}>
                {filteredCreds.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.username}@{c.host})</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small"><InputLabel>Deploy Template</InputLabel>
              <Select label="Deploy Template" value={form.deploy_template_id || ''} onChange={e => setForm({ ...form, deploy_template_id: e.target.value })}>
                <MenuItem value="">- Use project default -</MenuItem>
                {(templates || []).map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select></FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Variables (JSON)" value={form.variables || '{}'} onChange={e => setForm({ ...form, variables: e.target.value })} helperText='e.g. {"tenant":"bdcom","profile":"dev"}' /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" startIcon={<DeployIcon />} onClick={handleDeploy} disabled={deploying}>
          {deploying ? 'Creating...' : 'Deploy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ──
export default function ArtifactsMain() {
  const [tab, setTab] = useState(0);
  const [projects, setProjects] = useState([]);
  const [versions, setVersions] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [computes, setComputes] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const [projectOpen, setProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [viewPipelineId, setViewPipelineId] = useState(null);

  const { success, error: notifyError } = useNotification();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, v, d, t, c, cr] = await Promise.all([
        getProjects(), getVersions(), getDeployments(),
        getDeployTemplates(), getComputes(), getSSHCredentials(),
      ]);
      setProjects(p); setVersions(v); setDeployments(d);
      setTemplates(t); setComputes(c); setCredentials(cr);
    } catch (e) {
      notifyError('Failed to load', e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveProject = async (vals) => {
    if (editProject) { await updateProject(editProject.id, vals); success('Project updated'); }
    else { await createProject(vals); success('Project created'); }
    loadData();
  };

  const handleSaveVersion = async (vals) => {
    await createVersion(vals);
    success('Version registered');
    loadData();
  };

  const handleDeploy = async (form) => {
    const depId = await createDeployment({
      version_id: form.version_id,
      compute_id: form.compute_id,
      ssh_credential_id: form.ssh_credential_id,
      deploy_template_id: form.deploy_template_id || false,
      variables: form.variables || '{}',
    });
    success('Deployment created, triggering...');
    try {
      const result = await triggerDeploy(depId);
      if (result?.pipeline_id) setViewPipelineId(result.pipeline_id);
    } catch (e) {
      notifyError('Deploy trigger failed', e.message);
    }
    loadData();
  };

  const filtered = (items) => items.filter(i => !search || JSON.stringify(i).toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Artifacts</Typography>
          <Typography variant="body2" color="text.secondary">Software registry, versions, deployments</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
          {tab === 0 && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditProject(null); setProjectOpen(true); }}>Add Project</Button>}
          {tab === 1 && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setVersionOpen(true)}>Register Version</Button>}
          {tab === 2 && <Button variant="contained" color="warning" startIcon={<DeployIcon />} onClick={() => setDeployOpen(true)}>New Deployment</Button>}
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(''); setPage(0); }} sx={{ mb: 2 }}>
        <Tab label={`Projects (${projects.length})`} />
        <Tab label={`Versions (${versions.length})`} />
        <Tab label={`Deployments (${deployments.length})`} />
      </Tabs>

      <Card sx={{ mb: 2, p: 1.5 }}>
        <TextField size="small" placeholder="Search..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 300 }} />
      </Card>

      {/* Projects Tab */}
      {tab === 0 && (
        <Card><TableContainer><Table size="small">
          <TableHead><TableRow>
            <TableCell>Project</TableCell><TableCell>Type</TableCell><TableCell>Deploy Path</TableCell>
            <TableCell align="right">Versions</TableCell><TableCell align="right">Deploys</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
            : filtered(projects).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(p => (
              <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setEditProject(p); setProjectOpen(true); }}>
                <TableCell><Typography fontWeight={600} fontSize={13}>{p.name}</Typography></TableCell>
                <TableCell><Chip label={PROJECT_TYPES.find(t => t.value === p.project_type)?.label} size="small" variant="outlined" /></TableCell>
                <TableCell><Typography fontSize={12} fontFamily="monospace">{p.deploy_base_path}</Typography></TableCell>
                <TableCell align="right">{p.version_count}</TableCell>
                <TableCell align="right">{p.deployment_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></TableContainer>
        <TablePagination component="div" count={filtered(projects).length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }} rowsPerPageOptions={[10, 15, 25]} />
        </Card>
      )}

      {/* Versions Tab */}
      {tab === 1 && (
        <Card><TableContainer><Table size="small">
          <TableHead><TableRow>
            <TableCell>Project</TableCell><TableCell>Tag</TableCell><TableCell>Commit</TableCell>
            <TableCell>Branch</TableCell><TableCell>Size</TableCell><TableCell>Status</TableCell>
            <TableCell>Built</TableCell><TableCell align="right">Deploys</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
            : filtered(versions).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(v => (
              <TableRow key={v.id} hover>
                <TableCell>{v.project_id?.[1]}</TableCell>
                <TableCell><Typography fontWeight={600} fontSize={13}>{v.git_tag}</Typography></TableCell>
                <TableCell><Typography fontSize={12} fontFamily="monospace">{v.git_commit}</Typography></TableCell>
                <TableCell>{v.git_branch}</TableCell>
                <TableCell>{v.file_size_display}</TableCell>
                <TableCell><Chip label={v.status} size="small" color={STATUS_COLORS[v.status] || 'default'} /></TableCell>
                <TableCell><Typography fontSize={12}>{v.build_date ? new Date(v.build_date).toLocaleDateString() : ''}</Typography></TableCell>
                <TableCell align="right">{v.deployment_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></TableContainer>
        <TablePagination component="div" count={filtered(versions).length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }} rowsPerPageOptions={[10, 15, 25]} />
        </Card>
      )}

      {/* Deployments Tab */}
      {tab === 2 && (
        <Card><TableContainer><Table size="small">
          <TableHead><TableRow>
            <TableCell>Deployment</TableCell><TableCell>Version</TableCell><TableCell>Target</TableCell>
            <TableCell>Status</TableCell><TableCell>By</TableCell><TableCell>Started</TableCell>
            <TableCell align="center">Pipeline</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
            : filtered(deployments).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(d => (
              <TableRow key={d.id} hover>
                <TableCell><Typography fontWeight={600} fontSize={13}>{d.name}</Typography></TableCell>
                <TableCell>{d.version_id?.[1]}</TableCell>
                <TableCell>{d.compute_id?.[1]}</TableCell>
                <TableCell><Chip label={d.status} size="small" color={STATUS_COLORS[d.status] || 'default'} /></TableCell>
                <TableCell>{d.deployed_by?.[1]}</TableCell>
                <TableCell><Typography fontSize={12}>{d.started_at ? new Date(d.started_at).toLocaleString() : '-'}</Typography></TableCell>
                <TableCell align="center">
                  {d.pipeline_id && (
                    <Tooltip title="View pipeline">
                      <IconButton size="small" onClick={() => setViewPipelineId(d.pipeline_id[0])}><ViewIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></TableContainer>
        <TablePagination component="div" count={filtered(deployments).length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }} rowsPerPageOptions={[10, 15, 25]} />
        </Card>
      )}

      <ProjectDialog open={projectOpen} onClose={() => setProjectOpen(false)} onSave={handleSaveProject} record={editProject} />
      <VersionDialog open={versionOpen} onClose={() => setVersionOpen(false)} onSave={handleSaveVersion} projects={projects} />
      <DeployDialog open={deployOpen} onClose={() => setDeployOpen(false)} onDeploy={handleDeploy} projects={projects} versions={versions} computes={computes} credentials={credentials} templates={templates} />
      {viewPipelineId && <PipelineViewer open={!!viewPipelineId} onClose={() => { setViewPipelineId(null); loadData(); }} pipelineId={viewPipelineId} />}
    </Box>
  );
}
