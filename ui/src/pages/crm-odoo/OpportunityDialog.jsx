import EntityDialog from './_shared/EntityDialog';
import {
  LEAD_SOURCES, OPPORTUNITY_STAGES, OPPORTUNITY_PROBABILITY_MAP,
} from '../../services/crm-via-odoo';

export default function OpportunityDialog({ open, onClose, opportunity, onSaved }) {
  const isEdit = !!opportunity?.id;

  const rows = [
    // Row 1: Subject (12)
    [{ key: 'name', label: 'Opportunity Name', type: 'text', span: 12, required: true }],
    // Row 2: Account(6) + ContactName(6)
    [{ key: 'accountName',  label: 'Account / Company', type: 'text', span: 6 },
     { key: 'lastName',     label: 'Contact (Last Name)', type: 'text', span: 6 }],
    // Row 3: Email(6) + Phone(6)
    [{ key: 'emailAddress', label: 'Email', type: 'email', span: 6 },
     { key: 'phoneNumber',  label: 'Phone', type: 'tel',   span: 6 }],
    // Row 4: Stage(3) + Amount(3) + Probability(3) + Close Date(3)
    [{ key: 'status', label: 'Stage', type: 'select', span: 3,
        options: OPPORTUNITY_STAGES.map(s => ({ value: s, label: s })),
        required: true },
     { key: 'opportunityAmount', label: 'Amount',      type: 'number', span: 3 },
     { key: 'probability',       label: 'Probability', type: 'number', span: 3,
        placeholder: '%' },
     { key: 'closeDate',         label: 'Close Date',  type: 'date',   span: 3 }],
    // Row 5: Source(12)
    [{ key: 'source', label: 'Source', type: 'select', span: 12, allowEmpty: true,
        options: LEAD_SOURCES.map(s => ({ value: s, label: s })) }],
    // Row 6: Description(12)
    [{ key: 'description', label: 'Description', type: 'textarea', span: 12 }],
  ];

  return (
    <EntityDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Opportunity' : 'New Opportunity'}
      saveLabel={isEdit ? 'Save' : 'Create Opportunity'}
      rows={rows}
      initialValue={opportunity}
      emptyValue={{
        name: '', accountName: '', lastName: '', emailAddress: '', phoneNumber: '',
        status: 'Prospecting',
        opportunityAmount: '',
        probability: OPPORTUNITY_PROBABILITY_MAP['Prospecting'],
        closeDate: '',
        source: '', description: '',
      }}
      validate={(v) => v.name?.trim() ? null : 'Opportunity name is required'}
      onSave={async (v) => {
        // If user picked a stage but didn't override probability, fill in the
        // canonical probability for that stage.
        const stageDefault = OPPORTUNITY_PROBABILITY_MAP[v.status];
        const out = (v.probability === '' || v.probability == null) && stageDefault != null
          ? { ...v, probability: stageDefault }
          : v;
        if (typeof onSaved === 'function') await onSaved(out);
      }}
    />
  );
}
