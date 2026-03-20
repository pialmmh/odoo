import Keycloak from 'keycloak-js';
import config from '../config/platform';

const keycloak = new Keycloak({
  url: config.auth.keycloak.url,
  realm: config.auth.keycloak.realm,
  clientId: config.auth.keycloak.clientId,
});

let _initialized = false;
let _initializing = false;

/**
 * Initialize Keycloak. Handles React Strict Mode double-invoke.
 */
export async function initKeycloak() {
  // Already done
  if (_initialized) return keycloak.authenticated;

  // Already in progress — wait for it
  if (_initializing) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (_initialized) {
          clearInterval(check);
          resolve(keycloak.authenticated);
        }
      }, 100);
      // Timeout after 10s
      setTimeout(() => { clearInterval(check); resolve(false); }, 10000);
    });
  }

  _initializing = true;
  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      checkLoginIframe: false,
      pkceMethod: 'S256',
    });
    _initialized = true;
    _initializing = false;

    if (authenticated) {
      // Auto-refresh token
      setInterval(async () => {
        try { await keycloak.updateToken(30); } catch { keycloak.login(); }
      }, 10000);
    }
    return authenticated;
  } catch (e) {
    _initializing = false;
    console.error('Keycloak init failed:', e);
    return false;
  }
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
  keycloak.logout({ redirectUri: window.location.origin });
}

export function login() {
  keycloak.login();
}

export default keycloak;
