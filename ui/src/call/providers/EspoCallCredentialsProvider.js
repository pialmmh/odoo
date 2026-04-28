import { get as crmGet } from '../../services/crm';

/**
 * Fetches SIP/Janus credentials for the currently-authenticated user
 * from the backend endpoint GET /api/crm/PbxExtension/myCredentials
 * (proxied through APISIX → Spring Boot → EspoCRM).
 *
 * The response shape matches CallAdapterConnectConfig from the call
 * library. If the user has no SIP extension provisioned (e.g. admins),
 * the endpoint returns { ready: false } and we return null — the
 * library will skip registration.
 */
export class EspoCallCredentialsProvider {
  async getConnectConfig(_agent) {
    try {
      const res = await crmGet('/PbxExtension/myCredentials');
      if (!res?.ready) return null;

      return {
        username:    res.username,
        password:    res.password,
        domain:      res.domain,
        authUser:    res.authUser,
        displayName: res.displayName,
        server:      res.server,
        proxy:       res.proxy,
        // Pass the extensionUuid through as an extra so CTI code can
        // correlate if it needs to.
        extensionUuid: res.extensionUuid,
      };
    } catch (e) {
      console.warn('[EspoCallCredentialsProvider] failed to fetch creds:', e?.message || e);
      return null;
    }
  }
}
