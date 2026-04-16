import { Routes, Route, Navigate } from 'react-router-dom';
import Leads from './Leads';
import LeadDetail from './LeadDetail';

export default function CrmIndex() {
  return (
    <Routes>
      <Route index element={<Navigate to="leads" replace />} />
      <Route path="leads" element={<Leads />} />
      <Route path="leads/:id" element={<LeadDetail />} />
      <Route path="*" element={<Navigate to="leads" replace />} />
    </Routes>
  );
}
