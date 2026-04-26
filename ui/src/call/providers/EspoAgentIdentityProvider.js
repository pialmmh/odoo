import { BehaviorSubject } from 'rxjs';

/**
 * Maps the Keycloak-authenticated user to an AgentProfile the call
 * library understands. We get the user record from AuthContext once,
 * then push it through a BehaviorSubject so the library's async
 * subscribe() pattern works.
 */
export class EspoAgentIdentityProvider {
  constructor(auth) {
    // auth is the `auth` object from AuthContext (or null if logged out).
    this._subject = new BehaviorSubject(auth ? this._toAgent(auth) : null);
  }

  getCurrentAgent() {
    return this._subject.asObservable();
  }

  update(auth) {
    this._subject.next(auth ? this._toAgent(auth) : null);
  }

  _toAgent(auth) {
    // The tenant slug comes from the Keycloak groups claim
    // (/tenants/<slug>) — the first one wins.
    const tenantGroup = (auth.groups || []).find((g) => g.startsWith('/tenants/'));
    const tenantId = tenantGroup ? tenantGroup.slice('/tenants/'.length) : '';
    return {
      id:          auth.username,
      tenantId,
      username:    auth.username,
      displayName: auth.name || auth.username,
      email:       auth.email,
      extras:      { roles: auth.roles || [] },
    };
  }
}
