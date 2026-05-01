// Leads list (Fluent v9, Odoo crm.lead with type='lead'). Mirrors the
// Contacts/Accounts/Opportunities pattern so all four list pages share one
// look (`EntityListPage`).

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Caption1, Link as FluentLink, tokens,
} from '@fluentui/react-components';
import EntityListPage, { NameCell } from './_shared/EntityListPage';
import LeadDialog from './LeadDialog';
import { useRBAC } from '../../hooks/useRBAC';
import {
  listLeads, deleteLead, createLead, updateLead,
  LEAD_STATUSES,
} from '../../services/crm-via-odoo';

// Status badge colors map to the same semantic palette used by the kanban
// (informative/warning/brand/success/subtle), so the visual language is
// consistent across all CRM pages.
const STATUS_COLOR = {
  'New':        'subtle',
  'Assigned':   'warning',
  'In Process': 'brand',
  'Converted':  'success',
  'Recycled':   'informative',
  'Dead':       'subtle',
};

export default function Leads() {
  const { canAction } = useRBAC();
  const canEdit = canAction('crm.edit');
  const navigate = useNavigate();

  const [dialog, setDialog] = useState({ open: false, lead: null });
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async ({ search, statusFilter, page, rowsPerPage }) => {
    const params = { maxSize: rowsPerPage, offset: page * rowsPerPage, orderBy: 'createdAt', order: 'desc' };
    let idx = 0;
    // Always restrict to type='lead' (the model is dual-typed with opportunity).
    params[`where[${idx}][type]`]      = 'equals';
    params[`where[${idx}][attribute]`] = 'type';
    params[`where[${idx}][value]`]     = 'lead';
    idx++;
    if (statusFilter !== 'all') {
      params[`where[${idx}][type]`]      = 'equals';
      params[`where[${idx}][attribute]`] = 'status';
      params[`where[${idx}][value]`]     = statusFilter;
      idx++;
    }
    if (search.trim()) {
      params[`where[${idx}][type]`]  = 'textFilter';
      params[`where[${idx}][value]`] = search.trim();
    }
    return listLeads(params);
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+Space = create new lead (kept from the original Espo pixel-clone).
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.code === 'Space' && !dialog.open) {
        e.preventDefault();
        setDialog({ open: true, lead: null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dialog.open]);

  const columns = [
    { key: 'name', label: 'Name', render: (r) => {
        const fullName = r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—';
        return <NameCell sub={r.accountName} onClick={() => navigate(r.id)}>{fullName}</NameCell>;
      } },
    { key: 'status', label: 'Status', render: (r) => r.status
        ? <Badge appearance="filled" color={STATUS_COLOR[r.status] || 'subtle'}>{r.status}</Badge>
        : '—' },
    { key: 'emailAddress', label: 'Email',
      render: (r) => r.emailAddress
        ? <FluentLink href={`mailto:${r.emailAddress}`}>{r.emailAddress}</FluentLink>
        : <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>—</Caption1> },
    { key: 'assignedUserName', label: 'Assigned User',
      render: (r) => r.assignedUserName || '—' },
    { key: 'createdAt', label: 'Created',
      render: (r) => <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{r.createdAt || '—'}</Caption1> },
  ];

  const onSaved = async (vals) => {
    if (dialog.lead?.id) await updateLead(dialog.lead.id, vals);
    else                 await createLead(vals);
    setReloadKey(k => k + 1);
  };

  return (
    <>
      <EntityListPage
        title="Leads"
        countLabel={({ total }) => `${total} ${total === 1 ? 'lead' : 'leads'} total`}
        statuses={LEAD_STATUSES}
        load={load}
        columns={columns}
        onCreate={canEdit ? () => setDialog({ open: true, lead: null }) : undefined}
        onEdit={canEdit ? (r) => setDialog({ open: true, lead: r }) : undefined}
        onDelete={canEdit ? (r) => deleteLead(r.id) : undefined}
        rowLabel={(r) => r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim() || `#${r.id}`}
        createButtonLabel="Create Lead"
      />
      <LeadDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, lead: null })}
        lead={dialog.lead}
        onSaved={onSaved}
      />
    </>
  );
}
