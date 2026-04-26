import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Grid, TextField, Button, Alert,
  CircularProgress, FormControl, InputLabel, Select, MenuItem, Divider,
  Typography, Chip,
} from '@mui/material';
import { ArrowBack as BackIcon, Save as SaveIcon, AddCircle as AddIcon } from '@mui/icons-material';
import { listPbxExtensions, assignPbxExtension, createAndAssignPbxExtension } from '../../../../services/crm';
import { AdminPageHeader } from '../_shared';

function extFromContact(contact) {
  if (!contact) return null;
  const m = String(contact).match(/^user\/([^@]+)@/);
  return m ? m[1] : null;
}

export default function AgentEdit() {
  const navigate = useNavigate();
  const { tenant, agentUuid } = useParams();
  const base = tenant ? `/${tenant}` : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [data, setData] = useState({ extensions: [], agents: [], domainName: '' });
  const [selectedExtUuid, setSelectedExtUuid] = useState('');
  const [newExt, setNewExt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null); // {extension, password}

  const load = async ({ initial = false } = {}) => {
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      const res = await listPbxExtensions();
      setData({
        extensions: res.extensions || [],
        agents: res.agents || [],
        domainName: res.domainName || '',
      });
      if (initial) setErr(null);
    } catch (e) {
      setErr('Failed to load: ' + (e?.response?.data?.message || e.message));
    }
    if (initial) setLoading(false); else setRefreshing(false);
  };

  useEffect(() => { load({ initial: true }); }, []);

  const agent = useMemo(
    () => data.agents.find((a) => a.call_center_agent_uuid === agentUuid),
    [data.agents, agentUuid],
  );

  // Extension currently assigned to this agent (parsed from its agent_contact).
  const currentExt = useMemo(() => {
    if (!agent) return null;
    const num = extFromContact(agent.agent_contact);
    if (!num) return null;
    return data.extensions.find((e) => e.extension === num) || null;
  }, [agent, data.extensions]);

  // Pre-select currently assigned extension on first load.
  useEffect(() => {
    if (currentExt && !selectedExtUuid) setSelectedExtUuid(currentExt.extensionUuid);
  }, [currentExt]); // eslint-disable-line

  // Agent currently holding the selected extension (if any, and not this agent).
  const extensionHeldBy = useMemo(() => {
    if (!selectedExtUuid) return null;
    const ext = data.extensions.find((e) => e.extensionUuid === selectedExtUuid);
    if (!ext) return null;
    const holder = data.agents.find((a) => extFromContact(a.agent_contact) === ext.extension);
    if (!holder || holder.call_center_agent_uuid === agentUuid) return null;
    return holder;
  }, [selectedExtUuid, data.extensions, data.agents, agentUuid]);

  const createNew = async () => {
    const num = newExt.trim();
    if (!/^\d{3,6}$/.test(num)) { setErr('Extension must be 3-6 digits.'); return; }
    if (data.extensions.some((e) => String(e.extension) === num)) {
      setErr(`Extension ${num} already exists in this domain. Pick a different number or select it from the dropdown above.`);
      return;
    }
    setCreating(true); setErr(null); setOk(null); setCreatedInfo(null);
    try {
      const res = await createAndAssignPbxExtension({
        extension:           num,
        callCenterAgentUuid: agent.call_center_agent_uuid,
        agentName:           agent.agent_name,
      });
      setCreatedInfo({ extension: res.extension, password: res.password });
      setOk(`Extension ${res.extension} created and assigned.`);
      setNewExt('');
      await load();
    } catch (e) {
      const body = e?.response?.data;
      const msg  = body?.messageTranslation?.data?.reason
                || body?.message
                || e.message
                || 'Create failed';
      setErr(msg);
    }
    setCreating(false);
  };

  const save = async () => {
    if (!selectedExtUuid) { setErr('Pick an extension.'); return; }
    const ext = data.extensions.find((e) => e.extensionUuid === selectedExtUuid);
    if (!ext) { setErr('Selected extension not found.'); return; }

    setSaving(true); setErr(null); setOk(null);
    try {
      await assignPbxExtension({
        extensionUuid:       ext.extensionUuid,
        extension:           ext.extension,
        password:            ext.password || '',
        callCenterAgentUuid: agent.call_center_agent_uuid,
        agentName:           agent.agent_name,
        // Clear whichever agent currently holds this extension (if different).
        previousAgentUuid:   extensionHeldBy?.call_center_agent_uuid || null,
      });
      setOk('Extension assigned.');
      await load();
    } catch (e) {
      setErr('Save failed: ' + (e?.response?.data?.message || e.message));
    }
    setSaving(false);
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  if (!agent) {
    return (
      <Box sx={{ px: 3, py: 2.5 }}>
        <Alert severity="error">Agent not found.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 780 }}>
      <AdminPageHeader
        sectionLabel="Telephony"
        title={agent.agent_name}
        subtitle={data.domainName}
        actions={
          <>
            <Button type="button" size="small" startIcon={<BackIcon />}
              onClick={() => navigate(`${base}/crm/admin/pbxExtensions`)}>
              Back
            </Button>
            <Button type="button" size="small" variant="contained" startIcon={<SaveIcon />}
              disabled={saving} onClick={(e) => { e.preventDefault(); save(); }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok  && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Card>
        <CardContent sx={{ px: 3, py: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>Agent</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Name" value={agent.agent_name} disabled />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Type" value={agent.agent_type} disabled />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Status" value={agent.agent_status} disabled />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Current Contact" value={agent.agent_contact || '—'} disabled />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Assign Extension
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Currently Assigned"
                value={currentExt ? `${currentExt.extension} — ${currentExt.effectiveCallerIdName || ''}` : '— unassigned —'}
                disabled />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Extension</InputLabel>
                <Select value={selectedExtUuid} label="Extension"
                  onChange={(e) => setSelectedExtUuid(e.target.value)}>
                  {data.extensions
                    .slice()
                    .sort((a, b) => String(a.extension).localeCompare(String(b.extension), undefined, { numeric: true }))
                    .map((e) => {
                      const holder = data.agents.find((a) => extFromContact(a.agent_contact) === e.extension);
                      const tag = holder
                        ? (holder.call_center_agent_uuid === agentUuid ? ' (current)' : ` — held by ${holder.agent_name}`)
                        : ' — free';
                      return (
                        <MenuItem key={e.extensionUuid} value={e.extensionUuid}>
                          {e.extension}{tag}
                        </MenuItem>
                      );
                    })}
                </Select>
              </FormControl>
            </Grid>
            {extensionHeldBy && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  Extension is currently held by <b>{extensionHeldBy.agent_name}</b> — saving will
                  unassign them.
                </Alert>
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 2.5 }}>OR</Divider>

          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Create &amp; Assign New Extension
          </Typography>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="New extension number"
                value={newExt}
                onChange={(e) => setNewExt(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createNew(); } }}
                placeholder="e.g. 1021"
                helperText="3-6 digits. Must not already exist in this domain." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button type="button" variant="outlined" startIcon={<AddIcon />}
                disabled={creating || !newExt.trim()}
                onClick={(e) => { e.preventDefault(); createNew(); }}>
                {creating ? 'Creating…' : 'Create & Assign'}
              </Button>
            </Grid>
            {createdInfo && (
              <Grid item xs={12}>
                <Alert severity="success" sx={{ py: 0.5 }}>
                  Created extension <b>{createdInfo.extension}</b> — password <code>{createdInfo.password}</code>. Save this; it won't be shown again.
                </Alert>
              </Grid>
            )}
          </Grid>

          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            Saving will: (1) clear the previous holder's agentContact if different, (2) set
            this agent's agentContact to <code>user/&lt;ext&gt;@{data.domainName}</code>, and (3) update
            the extension's Caller-ID Name to this agent's name.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
