export default {
  tenant: { name: 'BTCL', slug: 'btcl', partnerId: 8, environment: 'staging' },
  branding: { displayName: 'BTCL', shortName: 'TB', theme: 'green' },
  crm: {
    enabled: true,
    proxyBaseUrl: '/api/crm',
    espoBaseUrl: 'https://crm-staging.btcl.internal',
  },
  features: {
    crm: true,
  },
};
