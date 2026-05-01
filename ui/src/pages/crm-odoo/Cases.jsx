// Cases list (Fluent v9, Odoo project.task).

import { useState, useCallback } from 'react';
import { Badge, Caption1, MessageBar, tokens } from '@fluentui/react-components';
import EntityListPage, { NameCell } from './_shared/EntityListPage';
import CaseDialog from './CaseDialog';
import {
  listCases, createCase, updateCase, deleteCase,
  CASE_STATUSES, CASE_PRIORITIES,
} from '../../services/crm-via-odoo';

const STATUS_COLOR = {
  New: 'subtle', Assigned: 'warning', Pending: 'informative',
  Closed: 'success', Rejected: 'severe', Duplicate: 'subtle',
};
const PRIORITY_COLOR = { Low: 'subtle', Normal: 'subtle', High: 'warning', Urgent: 'severe' };

export default function Cases() {
  const [dialog, setDialog] = useState({ open: false, caseRow: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [backendOk, setBackendOk] = useState(true);

  const load = useCallback(async ({ search, page, rowsPerPage }) => {
    const res = await listCases({ search, maxSize: rowsPerPage, offset: page * rowsPerPage });
    setBackendOk(!res._backendUnavailable);
    return res;
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: 'name',     label: 'Subject',
      render: (r) => <NameCell sub={r.accountName} onClick={() => setDialog({ open: true, caseRow: r })}>{r.name}</NameCell> },
    { key: 'status',   label: 'Status',
      render: (r) => r.status ? <Badge appearance="filled" color={STATUS_COLOR[r.status] || 'subtle'}>{r.status}</Badge> : '—' },
    { key: 'priority', label: 'Priority',
      render: (r) => r.priority ? <Badge appearance="outline" color={PRIORITY_COLOR[r.priority] || 'subtle'}>{r.priority}</Badge> : '—' },
    { key: 'createdAt', label: 'Created',
      render: (r) => <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{r.createdAt || '—'}</Caption1> },
  ];

  const onSaved = async (vals) => {
    if (dialog.caseRow?.id) await updateCase(dialog.caseRow.id, vals);
    else                    await createCase(vals);
    setReloadKey(k => k + 1);
  };

  return (
    <>
      {!backendOk && (
        <MessageBar intent="warning" style={{ marginBottom: tokens.spacingVerticalM }}>
          The Odoo `project` module is not installed in this tenant DB — Cases backend is unavailable.
          Run: <code>./scripts/tenant.sh upgrade &lt;slug&gt; project</code> from <code>odoo-backend/</code>.
        </MessageBar>
      )}
      <EntityListPage
        title="Cases"
        countLabel={({ total }) => `${total} ${total === 1 ? 'case' : 'cases'} total`}
        load={load}
        columns={columns}
        onCreate={() => setDialog({ open: true, caseRow: null })}
        onEdit={(r) => setDialog({ open: true, caseRow: r })}
        onDelete={(r) => deleteCase(r.id)}
        rowLabel={(r) => r.name}
        createButtonLabel="Create Case"
      />
      <CaseDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, caseRow: null })}
        caseRow={dialog.caseRow}
        onSaved={onSaved}
      />
    </>
  );
}
