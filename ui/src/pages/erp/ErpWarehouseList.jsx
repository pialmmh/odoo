import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  makeStyles, tokens, Text, Spinner, Subtitle1, Button, Tooltip, Badge,
  Table, TableHeader, TableHeaderCell, TableRow, TableCell, TableBody,
} from '@fluentui/react-components';
import { ArrowClockwise20Regular, Building20Regular } from '@fluentui/react-icons';
import { listWarehouses } from '../../services/erpInventory';
import { useNotification } from '../../components/ErrorNotification';

// Warehouse list — minimal SMB view. Backed by GET /api/erp/warehouses,
// which the BFF resolves through the iDempiere MWarehouse model.

const useStyles = makeStyles({
  page: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalXXL,
    maxWidth: '1100px',
    marginLeft: 'auto', marginRight: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalM,
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  loaderWrap: { display: 'flex', justifyContent: 'center', paddingTop: 64, paddingBottom: 64 },
  rowClickable: { cursor: 'pointer' },
  empty: {
    paddingTop: tokens.spacingVerticalXXL, paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center', color: tokens.colorNeutralForeground3,
  },
});

export default function ErpWarehouseList() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { tenant } = useParams();
  const { error: notifyError } = useNotification();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    listWarehouses()
      .then(setItems)
      .catch((e) => notifyError('Failed to load warehouses', e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [notifyError]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Building20Regular />
          <Subtitle1>Warehouses</Subtitle1>
        </div>
        <Tooltip content="Refresh" relationship="label">
          <Button appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={reload} />
        </Tooltip>
      </div>

      {loading ? (
        <div className={styles.loaderWrap}><Spinner /></div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>No warehouses configured.</div>
      ) : (
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Search Key</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((w) => (
              <TableRow key={w.id} className={styles.rowClickable}
                onClick={() => navigate(`/${tenant}/erp/warehouse/${w.id}`)}>
                <TableCell>{w.value}</TableCell>
                <TableCell><Text weight="semibold">{w.name}</Text></TableCell>
                <TableCell>{w.description || ''}</TableCell>
                <TableCell>
                  {w.isInTransit
                    ? <Badge appearance="outline" size="small" color="informative">In-Transit</Badge>
                    : <Badge appearance="outline" size="small" color="success">Active</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
