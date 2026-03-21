import Keycloak from 'keycloak-js';
import config from '../config/platform';

const keycloak = new Keycloak({
  url: config.auth.keycloak.url,
  realm: config.auth.keycloak.realm,
  clientId: config.auth.keycloak.clientId,
});

let _initialized = false;

/**
 * Initialize Keycloak. login-required mode redirects to KC if not authenticated.
 * Must only be called once (StrictMode removed to ensure this).
 */
export async function initKeycloak() {
  if (_initialized) return keycloak.authenticated;

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
