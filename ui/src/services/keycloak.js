import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:7104',
  realm: 'telcobright',
  clientId: 'platform-ui',
});

let _initPromise = null;

/**
 * Initialize Keycloak. Safe to call multiple times — deduplicates via promise.
 * Returns true if user is authenticated (has valid token).
 */
export async function initKeycloak() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      const authenticated = await keycloak.init({
        onLoad: 'login-required',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      });
      // Auto-refresh token before expiry
      setInterval(async () => {
        try {
          await keycloak.updateToken(30);
        } catch {
          keycloak.login();
        }
      }, 10000);
      return authenticated;
    } catch (e) {
      console.error('Keycloak init failed:', e);
      _initPromise = null; // Allow retry on failure
      return false;
    }
  })();
  return _initPromise;
}

export function getToken() {
  return keycloak.token || '';
}

export function getRefreshToken() {
  return keycloak.refreshToken || '';
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
  };
}

export function hasRole(role) {
  return keycloak.hasRealmRole(role);
}

export function isSuper() {
  return hasRole('super_admin');
}

export function logout() {
  keycloak.logout({ redirectUri: window.location.origin + '/login' });
}

export function login() {
  keycloak.login();
}

export default keycloak;
