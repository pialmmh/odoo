import { Routes, Route, Navigate } from 'react-router-dom';
import Leads       from './Leads';
import LeadDetail  from './LeadDetail';
import LeadEdit    from './LeadEdit';
import Contacts    from './Contacts';
import ContactDetail from './ContactDetail';
import ContactEdit from './ContactEdit';
import Accounts    from './Accounts';
import AccountDetail from './AccountDetail';
import AccountEdit from './AccountEdit';
import Opportunities from './Opportunities';
import OpportunityDetail from './OpportunityDetail';
import OpportunityEdit from './OpportunityEdit';

export default function CrmIndex() {
  return (
    <Routes>
      <Route index element={<Navigate to="leads" replace />} />

      <Route path="leads"          element={<Leads />} />
      <Route path="leads/new"      element={<LeadEdit />} />
      <Route path="leads/:id"      element={<LeadDetail />} />
      <Route path="leads/:id/edit" element={<LeadEdit />} />

      <Route path="contacts"          element={<Contacts />} />
      <Route path="contacts/new"      element={<ContactEdit />} />
      <Route path="contacts/:id"      element={<ContactDetail />} />
      <Route path="contacts/:id/edit" element={<ContactEdit />} />

      <Route path="accounts"          element={<Accounts />} />
      <Route path="accounts/new"      element={<AccountEdit />} />
      <Route path="accounts/:id"      element={<AccountDetail />} />
      <Route path="accounts/:id/edit" element={<AccountEdit />} />

      <Route path="opportunities"          element={<Opportunities />} />
      <Route path="opportunities/new"      element={<OpportunityEdit />} />
      <Route path="opportunities/:id"      element={<OpportunityDetail />} />
      <Route path="opportunities/:id/edit" element={<OpportunityEdit />} />

      <Route path="*" element={<Navigate to="leads" replace />} />
    </Routes>
  );
}
