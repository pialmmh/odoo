import EntityDialog from './_shared/EntityDialog';
import { CASE_STATUSES, CASE_PRIORITIES } from '../../services/crm-via-odoo';

export default function CaseDialog({ open, onClose, caseRow, onSaved }) {
  const isEdit = !!caseRow?.id;

  const rows = [
    // Row 1: Subject(12)
    [{ key: 'name', label: 'Subject', type: 'text', span: 12, required: true }],
    // Row 2: Status(6) + Priority(6)
    [{ key: 'status',   label: 'Status',   type: 'select', span: 6,
        options: CASE_STATUSES.map(s => ({ value: s, label: s })) },
     { key: 'priority', label: 'Priority', type: 'select', span: 6,
        options: CASE_PRIORITIES.map(s => ({ value: s, label: s })) }],
    // Row 3: Account(12)
    [{ key: 'accountName', label: 'Account', type: 'text', span: 12 }],
    // Row 4: Description(12)
    [{ key: 'description', label: 'Description', type: 'textarea', span: 12 }],
  ];

  return (
    <EntityDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Case' : 'New Case'}
      saveLabel={isEdit ? 'Save' : 'Create Case'}
      rows={rows}
      initialValue={caseRow}
      emptyValue={{ name: '', status: 'New', priority: 'Normal', accountName: '', description: '' }}
      validate={(v) => v.name?.trim() ? null : 'Subject is required'}
      onSave={async (v) => { if (typeof onSaved === 'function') await onSaved(v); }}
    />
  );
}
