export default {
  tenant: { name: 'Telcobright', slug: 'telcobright', partnerId: 1, environment: 'production' },
  branding: { displayName: 'Telcobright', shortName: 'TB', theme: 'blue' },
  crm: {
    enabled: true,
    proxyBaseUrl: '/api/crm',
    espoBaseUrl: 'https://crm.telcobright.com',
  },
  features: {
    crm: true,
  },
};
