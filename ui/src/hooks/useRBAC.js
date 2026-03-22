import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRBACConfig } from '../services/infra';
import {
  getPermissionsForRoles as getStaticPerms,
  canSeeMenu as staticCanSeeMenu,
  canDoAction as staticCanDoAction,
} from '../config/rbac';

// Cached RBAC config from Odoo — fetched once on login
let _cachedConfig = null;

/**
 * Hook for role-based access control.
 * Tries to fetch permissions from Odoo DB. Falls back to static config.
 */
export function useRBAC() {
  const { auth } = useAuth();
  const [config, setConfig] = useState(_cachedConfig);

  useEffect(() => {
    if (_cachedConfig || !auth) return;
    getRBACConfig().then(cfg => {
      _cachedConfig = cfg;
      setConfig(cfg);
    }).catch(() => {}); // fall back to static config
  }, [auth]);

  // Dynamic permissions from Odoo DB
  const dynamicPerms = useMemo(() => {
    if (!config || !auth?.roles) return null;
    const perms = new Set();
    for (const role of auth.roles) {
      const rolePerms = config.role_permissions?.[role];
      if (rolePerms) rolePerms.forEach(p => perms.add(p));
    }
    return [...perms];
  }, [config, auth?.roles]);

  // Static fallback permissions from rbac.js
  const staticPerms = useMemo(() => getStaticPerms(auth?.roles || []), [auth?.roles]);

  const permissions = dynamicPerms || staticPerms;

  const canMenu = (menuText) => {
    if (config?.menu_rules) {
      const required = config.menu_rules[menuText];
      if (!required || required.length === 0) return true;
      return required.every(p => permissions.includes(p));
    }
    return staticCanSeeMenu(permissions, menuText);
  };

  return {
    permissions,
    can: (perm) => permissions.includes(perm),
    canAll: (perms) => perms.every(p => permissions.includes(p)),
    canMenu,
    canAction: (actionKey) => {
      if (dynamicPerms) {
        const perm = actionKey.replace('.', ':');
        return permissions.includes(perm);
      }
      return staticCanDoAction(permissions, actionKey);
    },
  };
}
