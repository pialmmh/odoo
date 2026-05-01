// AccountDetail — Fluent UI v9 clone of pages/crm/AccountDetail.jsx.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  tokens, Spinner, MessageBar, Button,
  Menu, MenuItem, MenuList, MenuPopover, MenuTrigger,
  Link as FluentLink,
} from '@fluentui/react-components';
import {
  Edit20Regular, Delete20Regular, MoreHorizontal20Regular,
  ChevronLeft20Regular, ChevronRight20Regular,
  Rss20Regular, Copy20Regular,
  Building24Regular, Building20Regular, Mail20Regular, Phone20Regular,
  Globe20Regular, Location20Regular, Tag20Regular,
  Mail20Filled, Calendar20Regular, CallAdd20Regular, Add20Regular,
} from '@fluentui/react-icons';
import EntityDetailLayout from './_shared/EntityDetailLayout';
import Panel from './_shared/Panel';
import { Field, FieldGrid, EmptyData } from './_shared/FieldRow';
import ContactDialog from './ContactDialog';
import { getAccount, deleteAccount } from '../../services/crm-via-odoo';

function formatAddress(c) {
  const parts = [c.addressStreet, c.addressCity, c.addressState, c.addressCountry, c.addressPostalCode];
  return parts.filter(Boolean).join(', ');
}

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRow(await getAccount(id)); setError(null); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirm(`Delete account "${row?.name}"?`)) return;
    try { await deleteAccount(id); navigate('..'); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}><Spinner /></div>;
  }
  if (error || !row) {
    return <MessageBar intent="error">{error || 'Account not found'}</MessageBar>;
  }

  const address = formatAddress(row);

  const actionBar = (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', columnGap: tokens.spacingHorizontalS }}>
        <Button appearance="primary" icon={<Edit20Regular />} onClick={() => setEditOpen(true)}>Edit</Button>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="outline" icon={<MoreHorizontal20Regular />} aria-label="More" />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<Copy20Regular />}>Duplicate</MenuItem>
              <MenuItem icon={<Delete20Regular />} onClick={handleDelete}>Remove</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', columnGap: tokens.spacingHorizontalS }}>
        <Button appearance="subtle" icon={<ChevronLeft20Regular  />} aria-label="Previous" />
        <Button appearance="subtle" icon={<ChevronRight20Regular />} aria-label="Next" />
        <Button
          appearance={row.isFollowed ? 'primary' : 'outline'}
          icon={<Rss20Regular />}
          style={row.isFollowed ? {
            backgroundColor: tokens.colorPaletteGreenBackground3,
            borderColor: tokens.colorPaletteGreenBorderActive,
          } : undefined}
        >
          {row.isFollowed ? 'Followed' : 'Follow'}
        </Button>
      </div>
    </>
  );

  const mainPanels = (
    <>
      <Panel title="Overview">
        <FieldGrid>
          <Field label="Name"     icon={<Building20Regular />} value={row.name} />
          <Field label="Industry" icon={<Tag20Regular />}      value={row.industry} />
          <Field label="Email"    icon={<Mail20Regular />}     value={row.emailAddress
            ? <FluentLink href={`mailto:${row.emailAddress}`}>{row.emailAddress}</FluentLink> : null} />
          <Field label="Phone"    icon={<Phone20Regular />}    value={row.phoneNumber
            ? <FluentLink href={`tel:${row.phoneNumber}`}>{row.phoneNumber}</FluentLink> : null} />
          <Field label="Website"  icon={<Globe20Regular />}    value={row.website
            ? <FluentLink href={row.website} target="_blank" rel="noreferrer">{row.website}</FluentLink> : null} />
          <Field label="Type"     value={row.type} />
          <Field half={false} label="Address" icon={<Location20Regular />} value={address} />
          <Field half={false} label="Description" value={row.description} />
        </FieldGrid>
      </Panel>

      <Panel title="Stream">
        <div style={{
          width: '100%',
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          borderRadius: tokens.borderRadiusMedium,
          padding: tokens.spacingVerticalM,
          color: tokens.colorNeutralForeground3,
          fontSize: tokens.fontSizeBase300,
          backgroundColor: tokens.colorNeutralBackground1,
        }}>
          Write your comment here
        </div>
      </Panel>
    </>
  );

  const sidePanels = (
    <>
      <Panel title="Overview">
        <FieldGrid>
          <Field half={false} label="Assigned User" value={row.assignedUserName} />
          <Field half={false} label="Created"  value={row.createdAt || null} />
          <Field half={false} label="Modified" value={row.modifiedAt || null} />
        </FieldGrid>
      </Panel>

      <Panel title="Contacts"><EmptyData /></Panel>

      <Panel title="Opportunities"><EmptyData /></Panel>

      <Panel title="Activities" headerExtra={
        <div style={{ display: 'inline-flex', columnGap: tokens.spacingHorizontalS }}>
          <Button appearance="subtle" size="small" icon={<Mail20Filled        />} aria-label="New email"   />
          <Button appearance="subtle" size="small" icon={<Calendar20Regular   />} aria-label="New meeting" />
          <Button appearance="subtle" size="small" icon={<CallAdd20Regular    />} aria-label="New call"    />
          <Button appearance="subtle" size="small" icon={<MoreHorizontal20Regular />} aria-label="More"    />
        </div>
      }>
        <EmptyData />
      </Panel>

      <Panel title="History"><EmptyData /></Panel>
    </>
  );

  return (
    <>
      <EntityDetailLayout
        icon={<Building24Regular />}
        breadcrumbLabel="Accounts"
        title={row.name || '—'}
        subtitle={row.industry || null}
        actionBar={actionBar}
        mainPanels={mainPanels}
        sidePanels={sidePanels}
      />
      <ContactDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        contact={row}
        onSaved={load}
        mode="account"
      />
    </>
  );
}
