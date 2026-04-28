import { useEffect, useState } from 'react';
import { useTenant } from '../context/TenantContext';
import { resolveTenantIdBySlug } from '../services/party';

/**
 * Resolves the active Party-service tenant ID from the current URL slug.
 * Returns { partyTenantId, loading, error }.
 */
export function usePartyTenantId() {
  const { tenantSlug } = useTenant();
  const [partyTenantId, setId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!tenantSlug) {
      setId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    resolveTenantIdBySlug(tenantSlug)
      .then(id => {
        if (cancelled) return;
        setId(id);
        if (!id) setError(new Error(`No Party tenant for slug "${tenantSlug}"`));
      })
      .catch(e => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  return { partyTenantId, loading, error };
}
