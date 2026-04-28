import { Alert } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

/**
 * Gate for super-admin-only Party screens. Renders the child only when isSuper.
 */
export default function PartySuperGuard({ children }) {
  const { isSuper } = useAuth();
  if (!isSuper) {
    return <Alert severity="warning">Only super admin can manage this area.</Alert>;
  }
  return children;
}
