export default {
  tenant: { name: 'BTCL', slug: 'btcl', partnerId: 8, environment: 'development' },
  branding: { displayName: 'BTCL', shortName: 'TB', theme: 'green' },
  crm: {
    enabled: true,
    proxyBaseUrl: '/api/crm',
    espoBaseUrl: 'http://localhost:7080',
  },
  features: {
    crm: true,
  },
};
