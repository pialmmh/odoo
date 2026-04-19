// Operator + tenant list for this deployment.
// Mirrors api/src/main/resources/application.yml → orchestrix.{operator,tenants}.
//
// One deployment = one operator. Tenants are clients of that operator.
// Config files live at:
//   src/config/operators/{OPERATOR}/tenants/{name}/{profile}/profile-{profile}.js

export const OPERATOR = 'telcobright';

export const TENANTS = [
  { name: 'btcl',        enabled: true, profile: 'dev' },
  { name: 'telcobright', enabled: true, profile: 'dev' },
];
