export default {
  tenant: { name: 'Telcobright', slug: 'telcobright', partnerId: 1, environment: 'development' },
  branding: { displayName: 'Telcobright', shortName: 'TB', theme: 'blue' },
  crm: {
    enabled: true,
    proxyBaseUrl: '/api/crm',
    espoBaseUrl: 'http://localhost:7080',
  },
  features: {
    crm: true,
  },
};
