export default {
  tenant: { name: 'BTCL', slug: 'btcl', partnerId: 8, environment: 'production' },
  branding: { displayName: 'BTCL', shortName: 'TB', theme: 'green' },
  crm: {
    enabled: true,
    proxyBaseUrl: '/api/crm',
    espoBaseUrl: 'https://crm.btcl.com.bd',
  },
  features: {
    crm: true,
  },
};
