import { Routes, Route, Navigate } from 'react-router-dom';
import Leads from './Leads';
import LeadDetail from './LeadDetail';
import LeadEdit from './LeadEdit';

export default function CrmIndex() {
  return (
    <Routes>
      <Route index element={<Navigate to="leads" replace />} />
      <Route path="leads" element={<Leads />} />
      <Route path="leads/new" element={<LeadEdit />} />
      <Route path="leads/:id" element={<LeadDetail />} />
      <Route path="leads/:id/edit" element={<LeadEdit />} />
      <Route path="*" element={<Navigate to="leads" replace />} />
    </Routes>
  );
}
