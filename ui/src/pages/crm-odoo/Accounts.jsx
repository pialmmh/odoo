// Accounts list (Fluent v9, Odoo res.partner is_company=True).

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Caption1, Link as FluentLink, tokens } from '@fluentui/react-components';
import EntityListPage, { NameCell } from './_shared/EntityListPage';
import ContactDialog from './ContactDialog';
import {
  listAccounts, createAccount, updateAccount, deleteAccount,
} from '../../services/crm-via-odoo';

export default function Accounts() {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState({ open: false, account: null });
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async ({ search, page, rowsPerPage }) => {
    const params = { maxSize: rowsPerPage, offset: page * rowsPerPage, orderBy: 'createdAt', order: 'desc' };
    if (search.trim()) {
      params['where[0][type]']  = 'textFilter';
      params['where[0][value]'] = search.trim();
    }
    return listAccounts(params);
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
        <NameCell sub={r.industry} onClick={() => navigate(r.id)}>{r.name}</NameCell>
      ) },
    { key: 'emailAddress', label: 'Email',
      render: (r) => r.emailAddress
        ? <FluentLink href={`mailto:${r.emailAddress}`}>{r.emailAddress}</FluentLink>
        : <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>—</Caption1> },
    { key: 'phoneNumber', label: 'Phone', render: (r) => r.phoneNumber || '—' },
    { key: 'website',     label: 'Website',
      render: (r) => r.website
        ? <FluentLink href={r.website} target="_blank" rel="noreferrer">{r.website}</FluentLink>
        : '—' },
    { key: 'createdAt',   label: 'Created',
      render: (r) => <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{r.createdAt || '—'}</Caption1> },
  ];

  const onSaved = async (vals) => {
    if (dialog.account?.id) await updateAccount(dialog.account.id, vals);
    else                    await createAccount(vals);
    setReloadKey(k => k + 1);
  };

  return (
    <>
      <EntityListPage
        title="Accounts"
        countLabel={({ total }) => `${total} ${total === 1 ? 'account' : 'accounts'} total`}
        load={load}
        columns={columns}
        onCreate={() => setDialog({ open: true, account: null })}
        onEdit={(r) => setDialog({ open: true, account: r })}
        onDelete={(r) => deleteAccount(r.id)}
        rowLabel={(r) => r.name}
        createButtonLabel="Create Account"
      />
      <ContactDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, account: null })}
        contact={dialog.account}
        onSaved={onSaved}
        mode="account"
      />
    </>
  );
}
