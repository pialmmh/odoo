import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPermissionsForRoles, hasPermission, canSeeMenu, canDoAction } from '../config/rbac';

/**
 * Hook for role-based access control.
 *
 * Usage:
 *   const { can, canMenu, canAction, permissions } = useRBAC();
 *   if (can('infra:edit')) { ... }
 *   if (canMenu('SSH')) { ... }
 *   if (canAction('ssh.deploy_key')) { ... }
 */
export function useRBAC() {
  const { auth } = useAuth();

  const permissions = useMemo(() => {
    const roles = auth?.roles || [];
    return getPermissionsForRoles(roles);
  }, [auth?.roles]);

  return {
    permissions,
    can: (perm) => permissions.includes(perm),
    canAll: (perms) => hasPermission(permissions, perms),
    canMenu: (menuText) => canSeeMenu(permissions, menuText),
    canAction: (actionKey) => canDoAction(permissions, actionKey),
  };
}
