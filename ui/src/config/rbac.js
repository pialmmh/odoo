/**
 * RBAC Configuration — Single source of truth
 *
 * Defines: roles, permissions, URL patterns, and UI visibility rules.
 * Used by: React (UI hiding), APISIX (route protection), Spring Boot (API enforcement)
 */

// ── Permissions ──
export const PERMISSIONS = {
  // Infra
  INFRA_VIEW: 'infra:view',
  INFRA_EDIT: 'infra:edit',
  INFRA_DELETE: 'infra:delete',
  SSH_VIEW: 'ssh:view',
  SSH_MANAGE: 'ssh:manage',
  SSH_DEPLOY: 'ssh:deploy',

  // Artifacts
  ARTIFACT_VIEW: 'artifact:view',
  ARTIFACT_DEPLOY: 'artifact:deploy',
  ARTIFACT_MANAGE: 'artifact:manage',

  // Billing
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',

  // Device Catalog
  CATALOG_VIEW: 'catalog:view',
  CATALOG_MANAGE: 'catalog:manage',

  // Settings / Admin
  SETTINGS_VIEW: 'settings:view',
  TENANT_SWITCH: 'tenant:switch',
  USER_MANAGE: 'user:manage',
};

// ── Role → Permissions mapping ──
export const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS), // all permissions

  tenant_admin: [
    PERMISSIONS.INFRA_VIEW,
    PERMISSIONS.SSH_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_MANAGE,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.ARTIFACT_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],

  operator: [
    PERMISSIONS.INFRA_VIEW,
    PERMISSIONS.INFRA_EDIT,
    PERMISSIONS.SSH_VIEW,
    PERMISSIONS.SSH_MANAGE,
    PERMISSIONS.SSH_DEPLOY,
    PERMISSIONS.ARTIFACT_VIEW,
    PERMISSIONS.ARTIFACT_DEPLOY,
    PERMISSIONS.ARTIFACT_MANAGE,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.CATALOG_MANAGE,
  ],

  readonly: [
    PERMISSIONS.INFRA_VIEW,
    PERMISSIONS.SSH_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.ARTIFACT_VIEW,
  ],
};

// ── URL pattern → required permissions ──
export const ROUTE_PERMISSIONS = {
  '/':                  [],                                    // tenant selector — public
  '/*/':                [],                                    // dashboard — any authenticated
  '/*/infra':           [PERMISSIONS.INFRA_VIEW],
  '/*/infra/catalog':   [PERMISSIONS.CATALOG_VIEW],
  '/*/infra/ssh':       [PERMISSIONS.SSH_VIEW],
  '/*/customers':       [PERMISSIONS.BILLING_VIEW],
  '/*/subscriptions':   [PERMISSIONS.BILLING_VIEW],
  '/*/invoices':        [PERMISSIONS.BILLING_VIEW],
  '/*/payments':        [PERMISSIONS.BILLING_VIEW],
  '/*/catalog':         [PERMISSIONS.BILLING_VIEW],
  '/*/products':        [PERMISSIONS.BILLING_VIEW],
  '/*/pricing':         [PERMISSIONS.BILLING_VIEW],
  '/*/rate-history':    [PERMISSIONS.BILLING_VIEW],
  '/*/reports/ar':      [PERMISSIONS.BILLING_VIEW],
  '/*/artifacts':       [PERMISSIONS.ARTIFACT_VIEW],
  '/*/settings':        [PERMISSIONS.SETTINGS_VIEW],
  '/*/tenants':         [PERMISSIONS.USER_MANAGE],
};

// ── Sidebar menu → required permissions ──
export const MENU_PERMISSIONS = {
  'Dashboard':       [],
  'Customers':       [PERMISSIONS.BILLING_VIEW],
  'Subscriptions':   [PERMISSIONS.BILLING_VIEW],
  'Invoices':        [PERMISSIONS.BILLING_VIEW],
  'Payments':        [PERMISSIONS.BILLING_VIEW],
  'Catalog':         [PERMISSIONS.BILLING_VIEW],
  'Products':        [PERMISSIONS.BILLING_VIEW],
  'Pricing':         [PERMISSIONS.BILLING_VIEW],
  'Rate History':    [PERMISSIONS.BILLING_VIEW],
  'AR Report':       [PERMISSIONS.BILLING_VIEW],
  'Purchase':        [PERMISSIONS.BILLING_MANAGE],
  'Infra':           [PERMISSIONS.INFRA_VIEW],
  'Device Catalog':  [PERMISSIONS.CATALOG_VIEW],
  'SSH':             [PERMISSIONS.SSH_VIEW],
  'Artifacts':       [PERMISSIONS.ARTIFACT_VIEW],
  'RBAC':            [PERMISSIONS.USER_MANAGE],
  'Settings':        [PERMISSIONS.SETTINGS_VIEW],
  'Tenants':         [PERMISSIONS.USER_MANAGE],
};

// ── Action buttons → required permissions ──
export const ACTION_PERMISSIONS = {
  'infra.edit':           [PERMISSIONS.INFRA_EDIT],
  'infra.delete':         [PERMISSIONS.INFRA_DELETE],
  'infra.add':            [PERMISSIONS.INFRA_EDIT],
  'ssh.generate_key':     [PERMISSIONS.SSH_MANAGE],
  'ssh.deploy_key':       [PERMISSIONS.SSH_DEPLOY],
  'ssh.setup':            [PERMISSIONS.SSH_DEPLOY],
  'ssh.exec':             [PERMISSIONS.SSH_DEPLOY],
  'artifact.deploy':      [PERMISSIONS.ARTIFACT_DEPLOY],
  'artifact.add_project': [PERMISSIONS.ARTIFACT_MANAGE],
  'catalog.add':          [PERMISSIONS.CATALOG_MANAGE],
  'catalog.edit':         [PERMISSIONS.CATALOG_MANAGE],
  'catalog.delete':       [PERMISSIONS.CATALOG_MANAGE],
  'billing.create':       [PERMISSIONS.BILLING_MANAGE],
  'billing.edit':         [PERMISSIONS.BILLING_MANAGE],
};

// ── Helper functions ──

/**
 * Get all permissions for a user's roles.
 * @param {string[]} roles - Keycloak realm_access.roles
 * @returns {string[]} - Flat list of permissions
 */
export function getPermissionsForRoles(roles) {
  const perms = new Set();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (rolePerms) rolePerms.forEach(p => perms.add(p));
  }
  return [...perms];
}

/**
 * Check if user has a specific permission.
 */
export function hasPermission(userPermissions, required) {
  if (!required || required.length === 0) return true;
  return required.every(p => userPermissions.includes(p));
}

/**
 * Check if user can see a menu item.
 */
export function canSeeMenu(userPermissions, menuText) {
  const required = MENU_PERMISSIONS[menuText];
  if (!required) return true;
  return hasPermission(userPermissions, required);
}

/**
 * Check if user can perform an action.
 */
export function canDoAction(userPermissions, actionKey) {
  const required = ACTION_PERMISSIONS[actionKey];
  if (!required) return true;
  return hasPermission(userPermissions, required);
}
