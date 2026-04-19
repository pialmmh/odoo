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
import Meetings    from './Meetings';
import MeetingEdit from './MeetingEdit';
import MeetingsDashboard from './meetings/MeetingsDashboard';
import MeetingControl    from './meetings/MeetingControl';
import MeetingRoom       from './meetings/MeetingRoom';
import MeetingRoomsAdmin from './meetings/MeetingRoomsAdmin';
import Calendar    from './Calendar';
import Emails      from './emails/Emails';

import Campaigns       from './campaigns/Campaigns';
import CampaignEdit    from './campaigns/CampaignEdit';
import CampaignDetail  from './campaigns/CampaignDetail';
import CampaignPolicies from './campaigns/Policies';

import AdminIndex    from './admin/AdminIndex';
import AdminStub     from './admin/AdminStub';
import Users         from './admin/users/Users';
import UserEdit      from './admin/users/UserEdit';
import Teams         from './admin/users/Teams';
import Roles         from './admin/users/Roles';
import AuthLog       from './admin/users/AuthLog';
import AuthTokens    from './admin/users/AuthTokens';
import ActionHistory from './admin/users/ActionHistory';
import ApiUsers      from './admin/users/ApiUsers';
import OutboundEmails from './admin/messaging/OutboundEmails';
import InboundEmails  from './admin/messaging/InboundEmails';
import Sms            from './admin/messaging/Sms';
import ChannelCredentials     from './admin/chat-settings/ChannelCredentials';
import ChannelCredentialEdit  from './admin/chat-settings/ChannelCredentialEdit';
import SmsSettings            from './admin/chat-settings/SmsSettings';
import SmsSettingEdit         from './admin/chat-settings/SmsSettingEdit';
import Conversations          from './admin/chat-settings/Conversations';
import Customers              from './admin/chat-settings/Customers';
import Handoffs               from './admin/chat-settings/Handoffs';
import DeletionRequests       from './admin/chat-settings/DeletionRequests';

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

      <Route path="meetings"                element={<Meetings />} />
      <Route path="meetings/dashboard"      element={<MeetingsDashboard />} />
      <Route path="meetings/rooms"          element={<MeetingRoomsAdmin />} />
      <Route path="meetings/new"            element={<MeetingEdit />} />
      <Route path="meetings/:id"            element={<MeetingEdit />} />
      <Route path="meetings/:id/edit"       element={<MeetingEdit />} />
      <Route path="meetings/:id/control"    element={<MeetingControl />} />
      <Route path="meetings/:id/room"       element={<MeetingRoom />} />

      <Route path="calendar"       element={<Calendar />} />

      <Route path="emails"         element={<Emails />} />
      <Route path="emails/:id"     element={<Emails />} />

      <Route path="campaigns"             element={<Campaigns />} />
      <Route path="campaigns/new"         element={<CampaignEdit />} />
      <Route path="campaigns/policies"    element={<CampaignPolicies />} />
      <Route path="campaigns/:id"         element={<CampaignDetail />} />
      <Route path="campaigns/:id/edit"    element={<CampaignEdit />} />

      <Route path="admin"                element={<AdminIndex />} />
      <Route path="admin/users"          element={<Users />} />
      <Route path="admin/users/new"      element={<UserEdit />} />
      <Route path="admin/users/:id/edit" element={<UserEdit />} />
      <Route path="admin/teams"          element={<Teams />} />
      <Route path="admin/roles"          element={<Roles />} />
      <Route path="admin/authLog"        element={<AuthLog />} />
      <Route path="admin/authTokens"     element={<AuthTokens />} />
      <Route path="admin/actionHistory"  element={<ActionHistory />} />
      <Route path="admin/apiUsers"       element={<ApiUsers />} />
      <Route path="admin/outboundEmails" element={<OutboundEmails />} />
      <Route path="admin/inboundEmails"  element={<InboundEmails />} />
      <Route path="admin/sms"            element={<Sms />} />

      <Route path="admin/channelCredentials"          element={<ChannelCredentials />} />
      <Route path="admin/channelCredentials/new"      element={<ChannelCredentialEdit />} />
      <Route path="admin/channelCredentials/:id/edit" element={<ChannelCredentialEdit />} />
      <Route path="admin/smsSettings"                 element={<SmsSettings />} />
      <Route path="admin/smsSettings/new"             element={<SmsSettingEdit />} />
      <Route path="admin/smsSettings/:id/edit"        element={<SmsSettingEdit />} />
      <Route path="admin/imConversations"             element={<Conversations />} />
      <Route path="admin/imCustomers"                 element={<Customers />} />
      <Route path="admin/imHandoffs"                  element={<Handoffs />} />
      <Route path="admin/imDeletionRequests"          element={<DeletionRequests />} />

      <Route path="admin/:key"           element={<AdminStub />} />

      <Route path="*" element={<Navigate to="leads" replace />} />
    </Routes>
  );
}
