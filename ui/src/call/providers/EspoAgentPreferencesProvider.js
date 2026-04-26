import { BehaviorSubject } from 'rxjs';
import { get as crmGet, post as crmPost } from '../../services/crm';

/**
 * DID list + selection, mirroring the SuiteCRM flow:
 *
 *   list  → POST {pbx}/FREESWITCHREST/get-did-assignment-by-partner-id
 *   set   → POST {pbx}/FREESWITCHREST/api/v1/extensions/update
 *           (outboundCallerIdName + outboundCallerIdNumber ← picked DID)
 *
 * Both server-side calls are proxied by the EspoCRM PbxExtension
 * controller (/api/v1/PbxExtension/myDids and /setActiveDid) so the
 * browser never hits FusionPBX directly.
 */
export class EspoAgentPreferencesProvider {
  getOutboundCallerIds(_agent) {
    const subject = new BehaviorSubject([]);
    crmGet('/PbxExtension/myDids')
      .then((res) => subject.next(Array.isArray(res?.list) ? res.list : []))
      .catch((e) => {
        console.error('[EspoAgentPreferences] DID fetch error:', e);
        subject.next([]);
      });
    return subject.asObservable();
  }

  getActiveCallerId(agent) {
    try {
      return localStorage.getItem(`selectedDid_${agent.id}`);
    } catch {
      return null;
    }
  }

  async setActiveCallerId(agent, caller) {
    try {
      localStorage.setItem(`selectedDid_${agent.id}`, caller.number);
    } catch { /* localStorage may be unavailable */ }

    try {
      await crmPost('/PbxExtension/setActiveDid', { didNumber: caller.number });
    } catch (e) {
      console.error('[EspoAgentPreferences] failed to apply DID on PBX:', e);
    }
  }
}
