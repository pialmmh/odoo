import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell,
  CircularProgress, Button,
} from '@mui/material';
import { operatorsApi, partyTenantsApi } from '../../services/party';
import { useNotification } from '../../components/ErrorNotification';
import { extractError } from '../../services/errorHelper';
import PartyStatusChip from './PartyStatusChip';
import PartySuperGuard from './PartySuperGuard';

export default function OperatorDetail() {
  return (
    <PartySuperGuard>
      <Inner />
    </PartySuperGuard>
  );
}

function Inner() {
  const { tenant, operatorId } = useParams();
  const nav = useNavigate();
  const { error: notifyError } = useNotification();
  const [op, setOp] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [o, t] = await Promise.all([
          operatorsApi.get(Number(operatorId)),
          partyTenantsApi.listByOperator(Number(operatorId)),
        ]);
        setOp(o);
        setTenants(t);
      } catch (e) {
        notifyError(extractError(e).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [operatorId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (!op) return null;

  return (
    <Box>
      <Button size="small" onClick={() => nav(`/${tenant}/party/admin/operators`)} sx={{ mb: 2 }}>
        ← All operators
      </Button>
      <Typography variant="h6">{op.shortName} — {op.fullName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Operator #{op.id} · {op.operatorType}
      </Typography>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Overview" />
          <Tab label={`Tenants (${tenants.length})`} />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <Box sx={{ fontSize: 'var(--font-size-sm)' }}>
              <Row k="Company" v={op.companyName || '—'} />
              <Row k="Address" v={op.address1 || '—'} />
              <Row k="City" v={op.city || '—'} />
              <Row k="Country" v={op.country || '—'} />
              <Row k="Phone" v={op.phone || '—'} />
              <Row k="Email" v={op.email || '—'} />
              <Row k="Status" v={<PartyStatusChip status={op.status} />} />
            </Box>
          )}
          {tab === 1 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Short name</TableCell>
                  <TableCell>Full name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>DB name</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No tenants under this operator
                    </TableCell>
                  </TableRow>
                ) : tenants.map(t => (
                  <TableRow key={t.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {t.shortName}
                    </TableCell>
                    <TableCell>{t.fullName}</TableCell>
                    <TableCell><PartyStatusChip status={t.status} /></TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {t.dbName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
