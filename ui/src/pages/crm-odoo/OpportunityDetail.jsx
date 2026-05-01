// OpportunityDetail — Fluent UI v9 clone of pages/crm/OpportunityDetail.jsx.
// Same layout primitives as LeadDetail, just different field set.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  tokens, Badge, Spinner, MessageBar, Button,
  Menu, MenuItem, MenuList, MenuPopover, MenuTrigger,
  Link as FluentLink,
} from '@fluentui/react-components';
import {
  Edit20Regular, Delete20Regular, MoreHorizontal20Regular,
  ChevronLeft20Regular, ChevronRight20Regular,
  Rss20Regular, Copy20Regular,
  ArrowTrending24Regular,
  Building20Regular, Mail20Regular, Phone20Regular,
  Money20Regular, Calendar20Regular, Tag20Regular,
  Mail20Filled, CallAdd20Regular, Add20Regular,
} from '@fluentui/react-icons';
import EntityDetailLayout from './_shared/EntityDetailLayout';
import Panel from './_shared/Panel';
import { Field, FieldGrid, EmptyData } from './_shared/FieldRow';
import OpportunityDialog from './OpportunityDialog';
import { getOpportunity, deleteOpportunity } from '../../services/crm-via-odoo';

const STAGE_COLOR = {
  Prospecting: 'subtle',  Qualification: 'informative', Proposal: 'brand',
  Negotiation: 'warning', 'Closed Won': 'success',     'Closed Lost': 'subtle',
};

function fmtMoney(v, cur) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return `${cur ? cur + ' ' : ''}${n.toLocaleString()}`;
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRow(await getOpportunity(id)); setError(null); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirm(`Delete opportunity "${row?.name}"?`)) return;
    try { await deleteOpportunity(id); navigate('..'); }
    catch (e) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalXXL }}><Spinner /></div>;
  }
  if (error || !row) {
    return <MessageBar intent="error">{error || 'Opportunity not found'}</MessageBar>;
  }

  const stageColor = STAGE_COLOR[row.stage] || 'subtle';
  const moneyText  = fmtMoney(row.amount, row.amountCurrency);
  const weighted   = row.amountWeightedConverted != null ? row.amountWeightedConverted.toFixed(2) : null;

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
        <Button appearance="subtle" icon={<ChevronLeft20Regular />} aria-label="Previous" />
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
          <Field label="Name"        value={row.name} />
          <Field label="Account"     icon={<Building20Regular />} value={row.accountName} />
          <Field label="Stage"       icon={<Tag20Regular />} value={
            row.stage ? <Badge appearance="filled" color={stageColor}>{row.stage}</Badge> : null
          } />
          <Field label="Amount"      icon={<Money20Regular />} value={moneyText} />
          <Field label="Probability" value={row.probability != null ? `${row.probability}%` : null} />
          <Field label="Close Date"  icon={<Calendar20Regular />} value={row.closeDate} />
          <Field label="Contacts"    value={(row.contactsNames && Object.values(row.contactsNames).join(', ')) || null} />
          <Field label="Lead Source" value={row.source} />
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
          <Field half={false} label="Assigned User"   value={row.assignedUserName} />
          <Field half={false} label="Teams"           value={row.teamsNames ? Object.values(row.teamsNames).join(', ') : null} />
          <Field half={false} label="Weighted Amount" value={weighted} />
          <Field half={false} label="Created"         value={row.createdAt  ? `${row.createdAt} · ${row.createdByName  || ''}` : null} />
          <Field half={false} label="Modified"        value={row.modifiedAt ? `${row.modifiedAt} · ${row.modifiedByName || ''}` : null} />
        </FieldGrid>
      </Panel>

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

      <Panel title="Tasks" headerExtra={
        <Button appearance="subtle" size="small" icon={<Add20Regular />} aria-label="Add task" />
      }>
        <EmptyData />
      </Panel>
    </>
  );

  return (
    <>
      <EntityDetailLayout
        icon={<ArrowTrending24Regular />}
        breadcrumbLabel="Opportunities"
        title={row.name || '—'}
        subtitle={row.accountName || null}
        actionBar={actionBar}
        mainPanels={mainPanels}
        sidePanels={sidePanels}
      />
      <OpportunityDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        opportunity={row}
        onSaved={load}
      />
    </>
  );
}
