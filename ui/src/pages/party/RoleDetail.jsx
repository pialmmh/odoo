import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Tabs, Tab,
  Button, CircularProgress, Checkbox, FormControlLabel,
} from '@mui/material';
import { rolesApi, permissionsApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyTenantGate from './PartyTenantGate';

export default function RoleDetail() {
  return <PartyTenantGate render={tenantId => <Inner tenantId={tenantId} />} />;
}

function Inner({ tenantId }) {
  const { tenant, roleId } = useParams();
  const nav = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [role, setRole] = useState(null);
  const [perms, setPerms] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [r, p] = await Promise.all([
          rolesApi.get(tenantId, Number(roleId)),
          permissionsApi.list(tenantId),
        ]);
        setRole(r);
        setPerms(p);
      } catch (e) {
        notifyError(extractError(e).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, roleId]);

  const save = async () => {
    try {
      setSaving(true);
      await rolesApi.replacePermissions(tenantId, Number(roleId), Array.from(selected));
      success('Permissions saved');
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>;
  }
  if (!role) return null;

  return (
    <Box>
      <Button size="small" onClick={() => nav(`/${tenant}/party/roles`)} sx={{ mb: 2 }}>
        ← All roles
      </Button>
      <Typography variant="h6">{role.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Role #{role.id}
      </Typography>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Overview" />
          <Tab label={`Permissions (${perms.length})`} />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <Typography sx={{ fontSize: 'var(--font-size-sm)' }}>
              {role.description || '—'}
            </Typography>
          )}
          {tab === 1 && (
            <Box>
              {perms.map(p => (
                <FormControlLabel
                  key={p.id}
                  sx={{ display: 'block', '.MuiFormControlLabel-label': { fontSize: 'var(--font-size-sm)' } }}
                  control={
                    <Checkbox
                      checked={selected.has(p.id)}
                      onChange={e => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(p.id); else next.delete(p.id);
                        setSelected(next);
                      }}
                    />
                  }
                  label={p.name}
                />
              ))}
              <Button variant="contained" onClick={save} disabled={saving} sx={{ mt: 2 }}>
                {saving ? 'Saving…' : 'Save permissions'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
