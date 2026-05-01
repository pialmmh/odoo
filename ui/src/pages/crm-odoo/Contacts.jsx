// Contacts list (Fluent v9, Odoo-backed via res.partner is_company=False).

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Caption1, Link as FluentLink, tokens } from '@fluentui/react-components';
import EntityListPage, { NameCell } from './_shared/EntityListPage';
import ContactDialog from './ContactDialog';
import {
  listContacts, createContact, updateContact, deleteContact,
} from '../../services/crm-via-odoo';

export default function Contacts() {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState({ open: false, contact: null });
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async ({ search, page, rowsPerPage }) => {
    const params = { maxSize: rowsPerPage, offset: page * rowsPerPage, orderBy: 'createdAt', order: 'desc' };
    if (search.trim()) {
      params['where[0][type]']  = 'textFilter';
      params['where[0][value]'] = search.trim();
    }
    return listContacts(params);
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
        <NameCell
          sub={r.title ? `${r.title}${r.accountName ? ` · ${r.accountName}` : ''}` : r.accountName}
          onClick={() => navigate(r.id)}>{r.name}</NameCell>
      ) },
    { key: 'emailAddress', label: 'Email',
      render: (r) => r.emailAddress
        ? <FluentLink href={`mailto:${r.emailAddress}`}>{r.emailAddress}</FluentLink>
        : <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>—</Caption1> },
    { key: 'phoneNumber', label: 'Phone',
      render: (r) => r.phoneNumber || '—' },
    { key: 'accountName', label: 'Account', render: (r) => r.accountName || '—' },
    { key: 'createdAt', label: 'Created',
      render: (r) => <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{r.createdAt || '—'}</Caption1> },
  ];

  const onSaved = async (vals) => {
    if (dialog.contact?.id) await updateContact(dialog.contact.id, vals);
    else                    await createContact(vals);
    setReloadKey(k => k + 1);
  };

  return (
    <>
      <EntityListPage
        title="Contacts"
        countLabel={({ total }) => `${total} ${total === 1 ? 'contact' : 'contacts'} total`}
        load={load}
        columns={columns}
        onCreate={() => setDialog({ open: true, contact: null })}
        onEdit={(r) => setDialog({ open: true, contact: r })}
        onDelete={(r) => deleteContact(r.id)}
        rowLabel={(r) => r.name}
        createButtonLabel="Create Contact"
      />
      <ContactDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, contact: null })}
        contact={dialog.contact}
        onSaved={onSaved}
      />
    </>
  );
}
