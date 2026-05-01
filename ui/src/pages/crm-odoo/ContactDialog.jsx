import EntityDialog from './_shared/EntityDialog';
import { LEAD_SALUTATIONS } from '../../services/crm-via-odoo';

export default function ContactDialog({ open, onClose, contact, onSaved, mode = 'contact' }) {
  // mode: 'contact' (is_company=False) | 'account' (is_company=True)
  const isAccount = mode === 'account';
  const isEdit = !!contact?.id;

  const rows = isAccount
    ? [
        // Row 1: Account name (12)
        [{ key: 'name', label: 'Account Name', type: 'text', span: 12, required: true }],
        // Row 2: Email(6) + Phone(6)
        [{ key: 'emailAddress', label: 'Email', type: 'email', span: 6 },
         { key: 'phoneNumber',  label: 'Phone', type: 'tel',   span: 6 }],
        // Row 3: Website(6) + Industry(6)
        [{ key: 'website', label: 'Website', type: 'text', span: 6 },
         { key: 'industry', label: 'Industry', type: 'text', span: 6 }],
        // Row 4: Address(12)
        [{ key: 'addressStreet', label: 'Street Address', type: 'text', span: 12 }],
        // Row 5: City(4) + State(4) + Postal(4)
        [{ key: 'addressCity',       label: 'City',     type: 'text', span: 4 },
         { key: 'addressState',      label: 'State',    type: 'text', span: 4 },
         { key: 'addressPostalCode', label: 'Postal',   type: 'text', span: 4 }],
      ]
    : [
        // Row 1: Salutation(2) + FirstName(5) + LastName(5)
        [{ key: 'salutationName', label: 'Title', type: 'select', span: 2,
            options: LEAD_SALUTATIONS.map(s => ({ value: s, label: s || '—' })) },
         { key: 'firstName', label: 'First Name', type: 'text', span: 5 },
         { key: 'lastName',  label: 'Last Name',  type: 'text', span: 5, required: true }],
        // Row 2: JobTitle(6) + Account/Company(6)
        [{ key: 'title',       label: 'Job Title', type: 'text', span: 6 },
         { key: 'accountName', label: 'Account / Company', type: 'text', span: 6 }],
        // Row 3: Email(6) + Phone(6)
        [{ key: 'emailAddress', label: 'Email', type: 'email', span: 6 },
         { key: 'phoneNumber',  label: 'Phone', type: 'tel',   span: 6 }],
        // Row 4: Mobile(6) + Website(6)
        [{ key: 'mobileNumber', label: 'Mobile',  type: 'tel',  span: 6 },
         { key: 'website',      label: 'Website', type: 'text', span: 6 }],
        // Row 5: Description(12)
        [{ key: 'description', label: 'Description', type: 'textarea', span: 12 }],
      ];

  const empty = isAccount
    ? { name: '', emailAddress: '', phoneNumber: '', website: '', industry: '',
        addressStreet: '', addressCity: '', addressState: '', addressPostalCode: '' }
    : { salutationName: '', firstName: '', lastName: '', title: '',
        accountName: '', emailAddress: '', phoneNumber: '', mobileNumber: '',
        website: '', description: '' };

  return (
    <EntityDialog
      open={open}
      onClose={onClose}
      title={isEdit ? (isAccount ? 'Edit Account' : 'Edit Contact') : (isAccount ? 'New Account' : 'New Contact')}
      saveLabel={isEdit ? 'Save' : (isAccount ? 'Create Account' : 'Create Contact')}
      rows={rows}
      initialValue={contact}
      emptyValue={empty}
      validate={(v) => {
        if (isAccount && !v.name?.trim())  return 'Account name is required';
        if (!isAccount && !v.lastName?.trim()) return 'Last name is required';
        return null;
      }}
      onSave={async (v) => {
        // The dialog returns Espo-shape. The list/detail page handles persist.
        if (typeof onSaved === 'function') await onSaved(v);
      }}
    />
  );
}
