# Move KB Tenant Credentials from platform.js to Tenant Config YAML

**Task:** #2
**Priority:** Medium
**Depends on:** #3 (config loader API must exist to serve credentials)

## What
Currently KB apiKey/apiSecret are hardcoded in `ui/src/config/platform.js`:
```js
kbTenants: {
  btcl:        { apiKey: 'btcl',        apiSecret: 'btcl-secret' },
  telcobright: { apiKey: 'telcobright', apiSecret: 'telcobright-secret' },
  'abc-isp':   { apiKey: 'abc-isp',     apiSecret: 'abc-isp-secret' },
}
```

These should come from `config/tenants/{slug}/{profile}/profile-{profile}.yml` where they already exist under `platform.billing.api-key` and `platform.billing.api-secret`.

## Steps
1. Build config loader API (#3) that serves tenant config
2. TenantContext.jsx fetches KB credentials from API instead of hardcoded map
3. Remove `kbTenants` from platform.js
4. Ensure credentials are never exposed to browser beyond what's needed (apiKey/secret are sent as headers to Spring Boot which forwards to KB)

## Security note
KB api-secret in browser is acceptable because Spring Boot proxy strips JWT and replaces with Basic Auth before forwarding to KB. The api-key/secret are tenant identifiers, not authentication secrets.
