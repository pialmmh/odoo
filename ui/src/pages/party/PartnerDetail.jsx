import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Tabs, Tab,
  TextField, Button, CircularProgress,
} from '@mui/material';
import { partnersApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartyTenantGate from './PartyTenantGate';

export default function PartnerDetail() {
  return <PartyTenantGate render={tenantId => <Inner tenantId={tenantId} />} />;
}

function Inner({ tenantId }) {
  const { tenant, partnerId } = useParams();
  const nav = useNavigate();
  const { error: notifyError, success } = useNotification();
  const [p, setP] = useState(null);
  const [extra, setExtra] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [partner, ex] = await Promise.all([
          partnersApi.get(tenantId, Number(partnerId)),
          partnersApi.getExtra(tenantId, Number(partnerId)).catch(() => ({})),
        ]);
        setP(partner);
        setExtra(ex || {});
      } catch (e) {
        notifyError(extractError(e).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, partnerId]);

  const saveExtra = async () => {
    try {
      setSaving(true);
      await partnersApi.putExtra(tenantId, Number(partnerId), extra);
      success('Extra saved');
    } catch (e) {
      notifyError(extractError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const setX = (f) => (e) => setExtra(x => ({ ...x, [f]: e.target.value }));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (!p) return null;

  return (
    <Box>
      <Button size="small" onClick={() => nav(`/${tenant}/party/partners`)} sx={{ mb: 2 }}>
        ← All partners
      </Button>
      <Typography variant="h6">{p.partnerName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Partner #{p.id} · {p.partnerType}
      </Typography>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Overview" />
          <Tab label="Extra" />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <Box sx={{ fontSize: 'var(--font-size-sm)' }}>
              <Row k="Email" v={p.email || '—'} />
              <Row k="Phone" v={p.telephone || '—'} />
              <Row k="Address" v={[p.address1, p.address2].filter(Boolean).join(', ') || '—'} />
              <Row k="City / State" v={[p.city, p.state].filter(Boolean).join(', ') || '—'} />
              <Row k="Postal / Country" v={[p.postalCode, p.country].filter(Boolean).join(' / ') || '—'} />
              <Row k="Prepaid" v={p.customerPrepaid ? 'Yes' : 'No'} />
              <Row k="Default currency" v={String(p.defaultCurrency)} />
              <Row k="VAT reg" v={p.vatRegistrationNo || '—'} />
              <Row k="Status" v={<PartyStatusChip status={p.status} />} />
            </Box>
          )}
          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 560 }}>
              <TextField label="Address 1" size="small" value={extra.address1 || ''} onChange={setX('address1')} />
              <TextField label="Address 2" size="small" value={extra.address2 || ''} onChange={setX('address2')} />
              <TextField label="Address 3" size="small" value={extra.address3 || ''} onChange={setX('address3')} />
              <TextField label="Address 4" size="small" value={extra.address4 || ''} onChange={setX('address4')} />
              <TextField label="City" size="small" value={extra.city || ''} onChange={setX('city')} />
              <TextField label="State" size="small" value={extra.state || ''} onChange={setX('state')} />
              <TextField label="Postal code" size="small" value={extra.postalCode || ''} onChange={setX('postalCode')} />
              <TextField label="Country (ISO-2)" size="small" value={extra.countryCode || ''} onChange={setX('countryCode')} />
              <TextField label="National ID" size="small" value={extra.nid || ''} onChange={setX('nid')} />
              <TextField label="Trade license" size="small" value={extra.tradeLicense || ''} onChange={setX('tradeLicense')} />
              <TextField label="TIN" size="small" value={extra.tin || ''} onChange={setX('tin')} />
              <TextField label="Tax return date (YYYY-MM-DD)" size="small" value={extra.taxReturnDate || ''} onChange={setX('taxReturnDate')} />
              <Button variant="contained" onClick={saveExtra} disabled={saving} sx={{ alignSelf: 'flex-start', mt: 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function Row({ k, v }) {
  return (
    <Box sx={{ display: 'flex', py: 0.5 }}>
      <Typography sx={{ width: 160, color: 'text.secondary', fontSize: 'var(--font-size-sm)' }}>{k}</Typography>
      <Typography sx={{ fontSize: 'var(--font-size-sm)' }}>{v}</Typography>
    </Box>
  );
}
