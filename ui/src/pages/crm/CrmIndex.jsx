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
import Cases       from './Cases';
import CaseDetail  from './CaseDetail';
import CaseEdit    from './CaseEdit';
import Tasks       from './Tasks';
import TaskDetail  from './TaskDetail';
import TaskEdit    from './TaskEdit';
import Calendar    from './Calendar';
import Emails      from './emails/Emails';

import VoiceCampaigns      from './campaign/voice/VoiceCampaigns';
import VoiceCampaignEdit   from './campaign/voice/VoiceCampaignEdit';
import VoiceCampaignDetail from './campaign/voice/VoiceCampaignDetail';
import VoicePolicies       from './campaign/voice/VoicePolicies';

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

      <Route path="cases"          element={<Cases />} />
      <Route path="cases/new"      element={<CaseEdit />} />
      <Route path="cases/:id"      element={<CaseDetail />} />
      <Route path="cases/:id/edit" element={<CaseEdit />} />

      <Route path="tasks"          element={<Tasks />} />
      <Route path="tasks/new"      element={<TaskEdit />} />
      <Route path="tasks/:id"      element={<TaskDetail />} />
      <Route path="tasks/:id/edit" element={<TaskEdit />} />

      <Route path="calendar"       element={<Calendar />} />

      <Route path="emails"         element={<Emails />} />
      <Route path="emails/:id"     element={<Emails />} />

      <Route path="campaign/voice"             element={<VoiceCampaigns />} />
      <Route path="campaign/voice/new"         element={<VoiceCampaignEdit />} />
      <Route path="campaign/voice/:id"         element={<VoiceCampaignDetail />} />
      <Route path="campaign/voice/:id/edit"    element={<VoiceCampaignEdit />} />
      <Route path="campaign/voice/policies"    element={<VoicePolicies />} />

      <Route path="*" element={<Navigate to="leads" replace />} />
    </Routes>
  );
}
