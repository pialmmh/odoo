import { Alert, Box, CircularProgress } from '@mui/material';
import { usePartyTenantId } from '../../hooks/usePartyTenantId';

/**
 * Resolves the Party tenant ID from the URL slug and renders children with it.
 * Handles the loading and "no matching tenant" states uniformly.
 */
export default function PartyTenantGate({ render }) {
  const { partyTenantId, loading, error } = usePartyTenantId();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (!partyTenantId) {
    return (
      <Alert severity="warning">
        {error?.message || 'This tenant has no matching Party registry entry yet.'}
      </Alert>
    );
  }
  return render(partyTenantId);
}
