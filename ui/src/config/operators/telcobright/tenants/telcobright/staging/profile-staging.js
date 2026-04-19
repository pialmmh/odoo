export default {
  tenant: { name: 'Telcobright', slug: 'telcobright', partnerId: 1, environment: 'staging' },
  branding: { displayName: 'Telcobright', shortName: 'TB', theme: 'blue' },
  crm: {
    enabled: true,
    proxyBaseUrl: '/api/crm',
    espoBaseUrl: 'https://crm-staging.telcobright.com',
  },
  features: {
    crm: true,
  },
};
