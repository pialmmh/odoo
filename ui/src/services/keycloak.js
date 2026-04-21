import Keycloak from 'keycloak-js';
import config from '../config/platform';

const keycloak = new Keycloak({
  url: config.auth.keycloak.url,
  realm: config.auth.keycloak.realm,
  clientId: config.auth.keycloak.clientId,
});

let _initialized = false;

// Paths that render as guests — do NOT force Keycloak login on these.
// Pattern: /:tenant/join/:token (used by the public magic-link flow).
const PUBLIC_ROUTE_PATTERNS = [
  /^\/[^/]+\/join\/[^/]+\/?$/,
];

export function isPublicRoute(pathname = window.location.pathname) {
  return PUBLIC_ROUTE_PATTERNS.some((re) => re.test(pathname));
}

/**
 * Initialize Keycloak. login-required mode redirects to KC if not authenticated.
 * Must only be called once (StrictMode removed to ensure this).
 *
 * For public routes (magic-link guest join), we skip Keycloak entirely so
 * unauthenticated visitors don't get redirected away.
 */
export async function initKeycloak() {
  if (_initialized) return keycloak.authenticated;
  if (isPublicRoute()) {
    _initialized = true;
    return false; // render as guest; no KC session
  }

  try {
    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
      pkceMethod: 'S256',
    });
    _initialized = true;

    if (authenticated) {
      // Auto-refresh token before expiry
      setInterval(async () => {
        try { await keycloak.updateToken(30); } catch { keycloak.login(); }
      }, 10000);
    }
    return authenticated;
  } catch (e) {
    console.error('Keycloak init failed:', e);
    return false;
  }
}

export function getToken() {
  return keycloak.token || '';
}

export function isAuthenticated() {
  return !!keycloak.authenticated;
}

export function getUser() {
  if (!keycloak.tokenParsed) return null;
  const tp = keycloak.tokenParsed;
  return {
    id: tp.sub,
    username: tp.preferred_username,
    email: tp.email,
    firstName: tp.given_name,
    lastName: tp.family_name,
    name: tp.name || tp.preferred_username,
    roles: tp.realm_access?.roles || [],
    groups: tp.groups || [],
  };
}

/**
 * Extract tenant slugs from Keycloak groups.
 * Groups like "/tenants/btcl" → "btcl"
 */
export function getTenantSlugs() {
  const user = getUser();
  if (!user) return [];
  return user.groups
    .filter(g => g.startsWith('/tenants/'))
    .map(g => g.replace('/tenants/', ''));
}

export function hasRole(role) {
  return keycloak.hasRealmRole(role);
}

export function isSuper() {
  return hasRole('super_admin');
}

export function logout() {
  keycloak.logout({ redirectUri: window.location.origin });
}

export function login() {
  keycloak.login();
}

export default keycloak;
