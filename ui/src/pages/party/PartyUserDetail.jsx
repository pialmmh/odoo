import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Tabs, Tab,
  Button, CircularProgress, Checkbox, FormControlLabel,
  Table, TableHead, TableBody, TableRow, TableCell,
  TextField, MenuItem, IconButton,
} from '@mui/material';
import { Delete, Add as AddIcon } from '@mui/icons-material';
import { partyUsersApi, rolesApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartyTenantGate from './PartyTenantGate';

export default function PartyUserDetail() {
  return <PartyTenantGate render={tenantId => <Inner tenantId={tenantId} />} />;
}

function Inner({ tenantId }) {
  const { tenant, userId } = useParams();
  const nav = useNavigate();
  const { error: notifyError } = useNotification();
  const [u, setU] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setU(await partyUsersApi.get(tenantId, Number(userId)));
      } catch (e) {
        notifyError(extractError(e).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, userId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (!u) return null;

  return (
    <Box>
      <Button size="small" onClick={() => nav(`/${tenant}/party/users`)} sx={{ mb: 2 }}>
        ← All users
      </Button>
      <Typography variant="h6">{u.email}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        User #{u.id} · Partner #{u.partnerId}
      </Typography>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Overview" />
          <Tab label="Roles" />
          <Tab label="IP Rules" />
          <Tab label="Menu Perms" />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <Box sx={{ fontSize: 'var(--font-size-sm)' }}>
              <Row k="Email" v={u.email} />
              <Row k="Name" v={`${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'} />
              <Row k="Phone" v={u.phone || '—'} />
              <Row k="Partner" v={`#${u.partnerId}`} />
              <Row k="Status" v={<PartyStatusChip status={u.userStatus} />} />
            </Box>
          )}
          {tab === 1 && <RolesTab tenantId={tenantId} userId={Number(userId)} />}
          {tab === 2 && <IpRulesTab tenantId={tenantId} userId={Number(userId)} />}
          {tab === 3 && <MenuPermsTab tenantId={tenantId} userId={Number(userId)} />}
        </CardContent>
      </Card>
    </Box>
  );
}

function Row({ k, v }) {
  return (
    <Box sx={{ display: 'flex', py: 0.5 }}>
      <Typography sx={{ width: 140, color: 'text.secondary', fontSize: 'var(--font-size-sm)' }}>{k}</Typography>
      <Typography sx={{ fontSize: 'var(--font-size-sm)' }}>{v}</Typography>
    </Box>
  );
}

function RolesTab({ tenantId, userId }) {
  const { success, error: notifyError } = useNotification();
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setRoles(await rolesApi.list(tenantId));
      } catch (e) {
        notifyError(extractError(e).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  const save = async () => {
    try {
      setSaving(true);
      await partyUsersApi.replaceRoles(tenantId, userId, Array.from(selected));
      success('Roles saved');
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress size={24} />;

  return (
    <Box>
      {roles.map(r => (
        <FormControlLabel
          key={r.id}
          sx={{ display: 'block', '.MuiFormControlLabel-label': { fontSize: 'var(--font-size-sm)' } }}
          control={
            <Checkbox
              checked={selected.has(r.id)}
              onChange={e => {
                const next = new Set(selected);
                if (e.target.checked) next.add(r.id); else next.delete(r.id);
                setSelected(next);
              }}
            />
          }
          label={`${r.name}${r.description ? ` — ${r.description}` : ''}`}
        />
      ))}
      <Button variant="contained" onClick={save} disabled={saving} sx={{ mt: 2 }}>
        {saving ? 'Saving…' : 'Save roles'}
      </Button>
    </Box>
  );
}

function IpRulesTab({ tenantId, userId }) {
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ip, setIp] = useState('');
  const [kind, setKind] = useState('ALLOW');

  const load = async () => {
    try {
      setLoading(true);
      setRows(await partyUsersApi.listIpRules(tenantId, userId));
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tenantId, userId]);

  const add = async () => {
    if (!/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip)) {
      notifyError('Must be a valid IPv4 address or CIDR');
      return;
    }
    try {
      await partyUsersApi.addIpRule(tenantId, userId, { ip, permissionType: kind });
      setIp('');
      success('Rule added');
      load();
    } catch (e) {
      notifyError(extractError(e).message);
    }
  };

  const del = async (id) => {
    try {
      await partyUsersApi.deleteIpRule(tenantId, userId, id);
      load();
    } catch (e) {
      notifyError(extractError(e).message);
    }
  };

  if (loading) return <CircularProgress size={24} />;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
        <TextField label="IP or CIDR" size="small" value={ip} onChange={e => setIp(e.target.value)} sx={{ flex: 1 }} />
        <TextField select label="Type" size="small" value={kind} onChange={e => setKind(e.target.value)} sx={{ width: 140 }}>
          <MenuItem value="ALLOW">Allow</MenuItem>
          <MenuItem value="DENY">Deny</MenuItem>
        </TextField>
        <Button variant="contained" startIcon={<AddIcon />} onClick={add}>Add</Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No IP rules.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>IP / CIDR</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.ip}</TableCell>
                <TableCell>{r.permissionType}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => del(r.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

function MenuPermsTab({ tenantId, userId }) {
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await partyUsersApi.getMenuPerms(tenantId, userId);
      setRows((data || []).map(m => ({ menuKey: m.menuKey, level: m.level })));
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tenantId, userId]);

  const save = async () => {
    try {
      setSaving(true);
      await partyUsersApi.putMenuPerms(tenantId, userId, rows);
      success('Menu permissions saved');
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress size={24} />;

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Menu key</TableCell>
            <TableCell>Level</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>
                <TextField size="small" value={r.menuKey}
                  onChange={e => setRows(rs => rs.map((x, idx) => idx === i ? { ...x, menuKey: e.target.value } : x))}
                  placeholder="e.g. billing:invoices" />
              </TableCell>
              <TableCell>
                <TextField select size="small" value={r.level} sx={{ width: 160 }}
                  onChange={e => setRows(rs => rs.map((x, idx) => idx === i ? { ...x, level: e.target.value } : x))}>
                  <MenuItem value="NONE">None</MenuItem>
                  <MenuItem value="READONLY">Read-only</MenuItem>
                  <MenuItem value="FULL">Full</MenuItem>
                </TextField>
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))}>
                  <Delete fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button startIcon={<AddIcon />}
          onClick={() => setRows(rs => [...rs, { menuKey: '', level: 'READONLY' }])}>
          Add row
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}
