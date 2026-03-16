import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Tab, Tabs,
  MenuItem, Select, FormControl, InputLabel, IconButton, InputAdornment,
  Tooltip, Alert,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Refresh as RefreshIcon,
  VpnKey as KeyIcon, Delete as DeleteIcon, ContentCopy as CopyIcon,
  CloudUpload as DeployIcon, VerifiedUser as VerifyIcon,
  Terminal as ExecIcon, Download as DownloadIcon,
} from '@mui/icons-material';
import { useNotification } from '../../components/ErrorNotification';
import {
  getSSHKeys, generateSSHKey, deleteSSHKey, getSSHKeyPublicKey, getSSHKeyPrivateKey,
  getSSHCredentials, createSSHCredential, updateSSHCredential, deleteSSHCredential,
  deploySSHKey, verifySSHKey, execSSHCommand,
} from '../../services/infra';

const ALGOS = [
  { value: 'ed25519', label: 'ED25519' },
  { value: 'rsa2048', label: 'RSA 2048' },
  { value: 'rsa4096', label: 'RSA 4096' },
  { value: 'ecdsa256', label: 'ECDSA 256' },
  { value: 'ecdsa384', label: 'ECDSA 384' },
];

const SERVER_TYPES = [
  { value: 'linux', label: 'Linux' },
  { value: 'mikrotik', label: 'MikroTik' },
  { value: 'cisco', label: 'Cisco' },
  { value: 'generic', label: 'Generic' },
];

const STATUS_COLORS = { pending: 'default', deployed: 'warning', failed: 'error', verified: 'success' };

// ── Generate Key Dialog ──
function GenerateKeyDialog({ open, onClose, onGenerated }) {
  const [form, setForm] = useState({ name: '', algorithm: 'ed25519', comment: '' });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) { setForm({ name: '', algorithm: 'ed25519', comment: '' }); setResult(null); }
  }, [open]);

  const handleGenerate = async () => {
    if (!form.name) return;
    setGenerating(true);
    try {
      const res = await generateSSHKey(form.name, form.algorithm, form.comment);
      setResult(res);
      onGenerated?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate SSH Key</DialogTitle>
      <DialogContent>
        {result ? (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>Key "{result.name}" generated successfully</Alert>
            <Typography variant="subtitle2" gutterBottom>Fingerprint</Typography>
            <Typography variant="body2" fontFamily="monospace" sx={{ mb: 2, wordBreak: 'break-all' }}>{result.fingerprint}</Typography>
            <Typography variant="subtitle2" gutterBottom>Public Key</Typography>
            <TextField fullWidth multiline rows={3} value={result.public_key || ''} size="small"
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 11 } }} />
          </Box>
        ) : (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 7 }}>
              <TextField fullWidth size="small" label="Key Name" required
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                helperText="Unique identifier, e.g. deploy-key-prod" />
            </Grid>
            <Grid size={{ xs: 5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Algorithm</InputLabel>
                <Select label="Algorithm" value={form.algorithm}
                  onChange={e => setForm({ ...form, algorithm: e.target.value })}>
                  {ALGOS.map(a => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" label="Comment (optional)"
                value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button variant="contained" startIcon={<KeyIcon />} onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Credential Dialog ──
function CredentialDialog({ open, onClose, onSave, record, sshKeys }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        name: record.name, host: record.host, port: record.port, username: record.username,
        server_type: record.server_type, sudo_enabled: record.sudo_enabled,
        description: record.description || '', tags: record.tags || '',
        key_id: record.key_id?.[0] || '',
      });
    } else {
      setForm({ name: '', host: '', port: 22, username: 'root', server_type: 'linux', sudo_enabled: false, description: '', tags: '', key_id: '' });
    }
  }, [record, open]);

  const handleSave = async () => {
    if (!form.name || !form.host || !form.username) return;
    setSaving(true);
    try {
      const vals = { ...form, key_id: form.key_id || false };
      await onSave(vals);
      onClose();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? 'Edit Credential' : 'Add SSH Credential'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Name" required
              value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField fullWidth size="small" label="Host" required
              value={form.host || ''} onChange={e => setForm({ ...form, host: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <TextField fullWidth size="small" label="Port" type="number"
              value={form.port || 22} onChange={e => setForm({ ...form, port: +e.target.value })} />
          </Grid>
          <Grid size={{ xs: 3 }}>
            <TextField fullWidth size="small" label="Username" required
              value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Server Type</InputLabel>
              <Select label="Server Type" value={form.server_type || 'linux'}
                onChange={e => setForm({ ...form, server_type: e.target.value })}>
                {SERVER_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>SSH Key</InputLabel>
              <Select label="SSH Key" value={form.key_id || ''}
                onChange={e => setForm({ ...form, key_id: e.target.value })}>
                <MenuItem value="">- None -</MenuItem>
                {(sshKeys || []).map(k => <MenuItem key={k.id} value={k.id}>{k.name} ({k.algorithm})</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 8 }}>
            <TextField fullWidth size="small" label="Tags (comma-separated)"
              value={form.tags || ''} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Sudo</InputLabel>
              <Select label="Sudo" value={form.sudo_enabled ? 'yes' : 'no'}
                onChange={e => setForm({ ...form, sudo_enabled: e.target.value === 'yes' })}>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Description" multiline rows={2}
              value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Deploy Key Dialog ──
function DeployDialog({ open, onClose, credential, onDeployed }) {
  const [password, setPassword] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [log, setLog] = useState('');

  useEffect(() => { if (open) { setPassword(''); setLog(''); } }, [open]);

  const handleDeploy = async () => {
    if (!password) return;
    setDeploying(true);
    try {
      const res = await deploySSHKey(credential.id, password);
      setLog(res?.log || (res?.success ? 'Deployed successfully' : 'Deploy failed'));
      if (res?.success) onDeployed?.();
    } catch (e) {
      setLog(`Error: ${e.message}`);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Deploy Key to {credential?.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the server password for initial key deployment. The password is used once to push the public key and is not stored.
        </Typography>
        <TextField fullWidth size="small" label="Server Password" type="password"
          value={password} onChange={e => setPassword(e.target.value)}
          disabled={deploying} autoFocus />
        {log && (
          <TextField fullWidth multiline rows={6} value={log} size="small" sx={{ mt: 2 }}
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 11 } }} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {!log && (
          <Button variant="contained" startIcon={<DeployIcon />} onClick={handleDeploy} disabled={deploying || !password}>
            {deploying ? 'Deploying...' : 'Deploy'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Exec Command Dialog ──
function ExecDialog({ open, onClose, credential }) {
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { if (open) { setCommand(''); setResult(null); } }, [open]);

  const handleExec = async () => {
    if (!command) return;
    setRunning(true);
    try {
      const res = await execSSHCommand(credential.id, command);
      setResult(res);
    } catch (e) {
      setResult({ exit_code: -1, stdout: '', stderr: e.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Execute on {credential?.name} ({credential?.host})</DialogTitle>
      <DialogContent>
        <TextField fullWidth size="small" label="Command" value={command}
          onChange={e => setCommand(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleExec(); }}
          InputProps={{ sx: { fontFamily: 'monospace' } }} />
        {result && (
          <Box sx={{ mt: 2 }}>
            <Chip label={`Exit: ${result.exit_code}`} size="small"
              color={result.exit_code === 0 ? 'success' : 'error'} sx={{ mb: 1 }} />
            {result.stdout && (
              <TextField fullWidth multiline rows={8} value={result.stdout} size="small" label="stdout" sx={{ mb: 1 }}
                InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 11 } }} />
            )}
            {result.stderr && (
              <TextField fullWidth multiline rows={3} value={result.stderr} size="small" label="stderr"
                InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 11, color: '#c62828' } }} />
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<ExecIcon />} onClick={handleExec} disabled={running}>
          {running ? 'Running...' : 'Run'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main SSH Page ──
export default function InfraSSH() {
  const [tab, setTab] = useState(0);
  const [keys, setKeys] = useState([]);
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [genOpen, setGenOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [editCred, setEditCred] = useState(null);
  const [deployTarget, setDeployTarget] = useState(null);
  const [execTarget, setExecTarget] = useState(null);
  const { success, error: notifyError } = useNotification();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [k, c] = await Promise.all([getSSHKeys(), getSSHCredentials()]);
      setKeys(k);
      setCreds(c);
    } catch (e) {
      notifyError('Failed to load SSH data', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    success('Copied to clipboard');
  };

  const handleDeleteKey = async (id) => {
    if (!confirm('Delete this SSH key? Credentials using it will lose their key reference.')) return;
    try { await deleteSSHKey(id); success('Key deleted'); loadData(); } catch (e) { notifyError('Delete failed', e.message); }
  };

  const handleDeleteCred = async (id) => {
    if (!confirm('Delete this credential?')) return;
    try { await deleteSSHCredential(id); success('Credential deleted'); loadData(); } catch (e) { notifyError('Delete failed', e.message); }
  };

  const handleSaveCred = async (vals) => {
    if (editCred) {
      await updateSSHCredential(editCred.id, vals);
      success('Credential updated');
    } else {
      await createSSHCredential(vals);
      success('Credential created');
    }
    loadData();
  };

  const handleVerify = async (cred) => {
    try {
      const res = await verifySSHKey(cred.id);
      if (res?.success) success('Key verification passed');
      else notifyError('Verification failed', res?.log || '');
      loadData();
    } catch (e) {
      notifyError('Verify failed', e.message);
    }
  };

  const handleDownloadPrivateKey = async (key) => {
    try {
      const pem = await getSSHKeyPrivateKey(key.id);
      const blob = new Blob([pem], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = key.name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notifyError('Download failed', e.message);
    }
  };

  const filteredKeys = keys.filter(k => !search || k.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCreds = creds.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.host || '').includes(search));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>SSH Management</Typography>
          <Typography variant="body2" color="text.secondary">Key pairs, credentials, deployment</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
          {tab === 0 && (
            <Button variant="contained" startIcon={<KeyIcon />} onClick={() => setGenOpen(true)}>Generate Key</Button>
          )}
          {tab === 1 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditCred(null); setCredOpen(true); }}>Add Credential</Button>
          )}
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(''); setPage(0); }} sx={{ mb: 2 }}>
        <Tab label={`SSH Keys (${keys.length})`} />
        <Tab label={`Credentials (${creds.length})`} />
      </Tabs>

      <Card sx={{ mb: 2, p: 1.5 }}>
        <TextField size="small" placeholder="Search..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 300 }}
        />
      </Card>

      {/* Keys Tab */}
      {tab === 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Algorithm</TableCell>
                  <TableCell>Fingerprint</TableCell>
                  <TableCell>Comment</TableCell>
                  <TableCell align="right">Used By</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                ) : filteredKeys.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>No SSH keys. Click "Generate Key" to create one.</TableCell></TableRow>
                ) : (
                  filteredKeys.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(k => (
                    <TableRow key={k.id} hover>
                      <TableCell><Typography fontWeight={600} fontSize={13}>{k.name}</Typography></TableCell>
                      <TableCell><Chip label={k.algorithm} size="small" variant="outlined" /></TableCell>
                      <TableCell><Typography fontSize={11} fontFamily="monospace" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.fingerprint}</Typography></TableCell>
                      <TableCell>{k.comment}</TableCell>
                      <TableCell align="right">{k.credential_count}</TableCell>
                      <TableCell><Typography fontSize={12}>{k.created_date ? new Date(k.created_date).toLocaleDateString() : ''}</Typography></TableCell>
                      <TableCell align="center">
                        <Tooltip title="Copy public key">
                          <IconButton size="small" onClick={() => copyToClipboard(k.public_key)}><CopyIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Download private key">
                          <IconButton size="small" onClick={() => handleDownloadPrivateKey(k)}><DownloadIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteKey(k.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filteredKeys.length}
            page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
            rowsPerPageOptions={[10, 15, 25]} />
        </Card>
      )}

      {/* Credentials Tab */}
      {tab === 1 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Host</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>SSH Key</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Linked To</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
                ) : filteredCreds.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No credentials. Click "Add Credential" to create one.</TableCell></TableRow>
                ) : (
                  filteredCreds.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(c => (
                    <TableRow key={c.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => { setEditCred(c); setCredOpen(true); }}>
                      <TableCell><Typography fontWeight={600} fontSize={13}>{c.name}</Typography></TableCell>
                      <TableCell><Typography fontSize={12} fontFamily="monospace">{c.host}:{c.port}</Typography></TableCell>
                      <TableCell>{c.username}</TableCell>
                      <TableCell><Chip label={SERVER_TYPES.find(t => t.value === c.server_type)?.label || c.server_type} size="small" variant="outlined" /></TableCell>
                      <TableCell>{c.key_id ? c.key_id[1] : <Typography fontSize={12} color="text.secondary">None</Typography>}</TableCell>
                      <TableCell><Chip label={c.deploy_status} size="small" color={STATUS_COLORS[c.deploy_status] || 'default'} /></TableCell>
                      <TableCell><Typography fontSize={12}>{c.linked_entity}</Typography></TableCell>
                      <TableCell align="center" onClick={e => e.stopPropagation()}>
                        {c.key_id && c.deploy_status !== 'verified' && (
                          <Tooltip title="Deploy key">
                            <IconButton size="small" color="primary" onClick={() => setDeployTarget(c)}><DeployIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        )}
                        {c.key_id && (c.deploy_status === 'deployed' || c.deploy_status === 'verified') && (
                          <Tooltip title="Verify key auth">
                            <IconButton size="small" onClick={() => handleVerify(c)}><VerifyIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        )}
                        {c.deploy_status === 'verified' && (
                          <Tooltip title="Execute command">
                            <IconButton size="small" onClick={() => setExecTarget(c)}><ExecIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteCred(c.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filteredCreds.length}
            page={page} onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
            rowsPerPageOptions={[10, 15, 25]} />
        </Card>
      )}

      <GenerateKeyDialog open={genOpen} onClose={() => setGenOpen(false)} onGenerated={loadData} />
      <CredentialDialog open={credOpen} onClose={() => setCredOpen(false)} onSave={handleSaveCred} record={editCred} sshKeys={keys} />
      {deployTarget && <DeployDialog open={!!deployTarget} onClose={() => setDeployTarget(null)} credential={deployTarget} onDeployed={loadData} />}
      {execTarget && <ExecDialog open={!!execTarget} onClose={() => setExecTarget(null)} credential={execTarget} />}
    </Box>
  );
}
