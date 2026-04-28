import { EspoAgentIdentityProvider }    from './EspoAgentIdentityProvider';
import { EspoCallCredentialsProvider }  from './EspoCallCredentialsProvider';
import { EspoAgentPreferencesProvider } from './EspoAgentPreferencesProvider';
import { StubCrmIntegrationProvider }   from './StubCrmIntegrationProvider';
import { BdPhoneNormalizer }            from './BdPhoneNormalizer';

/**
 * Build the provider bundle the call library's `createCallClient`
 * factory expects. `auth` is the object from AuthContext — required
 * so the AgentIdentityProvider has something to emit on subscribe.
 */
export function buildEspoCallProviders(auth) {
  return {
    agentIdentity:    new EspoAgentIdentityProvider(auth),
    callCredentials:  new EspoCallCredentialsProvider(),
    agentPreferences: new EspoAgentPreferencesProvider(),
    crmIntegration:   new StubCrmIntegrationProvider(),
    phoneNormalizer:  new BdPhoneNormalizer(),
  };
}

export {
  EspoAgentIdentityProvider,
  EspoCallCredentialsProvider,
  EspoAgentPreferencesProvider,
  StubCrmIntegrationProvider,
  BdPhoneNormalizer,
};
