import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';
const APISIX = 'http://localhost:9080';
const KC = 'http://localhost:7104';
const API = 'http://localhost:8180';

async function getKCToken(request) {
  const resp = await request.post(`${KC}/realms/telcobright/protocol/openid-connect/token`, {
    form: {
      grant_type: 'password',
      client_id: 'platform-ui',
      client_secret: 'T3HRg6Jf72Botb5Tgx1Hbd61VLBGrkbf',
      username: 'admin',
      password: 'password',
    },
  });
  const body = await resp.json();
  return body.access_token;
}

test.describe('Platform smoke tests (APISIX)', () => {

  test('React UI loads', async ({ page }) => {
    const resp = await page.goto(BASE);
    expect(resp.status()).toBeLessThan(500);
  });

  test('Keycloak is reachable', async ({ request }) => {
    const resp = await request.get(`${KC}/realms/telcobright`);
    expect(resp.ok()).toBeTruthy();
  });

  test('Keycloak token grant works', async ({ request }) => {
    const token = await getKCToken(request);
    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(3);
  });

  test('APISIX health (public)', async ({ request }) => {
    const resp = await request.get(`${APISIX}/api/odoo/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.odoo_connected).toBe(true);
  });

  test('APISIX rejects unauthenticated', async ({ request }) => {
    const resp = await request.post(`${APISIX}/api/odoo/infra.region/search_read`, {
      data: { args: [[]], kwargs: { fields: ['name'] } },
    });
    expect(resp.status()).toBe(401);
  });

  test('APISIX tenant loading (public)', async ({ request }) => {
    const resp = await request.post(`${APISIX}/api/odoo/res.partner/search_read`, {
      data: { args: [[['is_company', '=', true]]], kwargs: { fields: ['id', 'name'] } },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.length).toBeGreaterThan(0);
    const names = body.map(b => b.name);
    expect(names).toContain('BTCL');
  });

  test('APISIX + KC token → Odoo regions', async ({ request }) => {
    const token = await getKCToken(request);
    const resp = await request.post(`${APISIX}/api/odoo/infra.region/search_read`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { args: [[]], kwargs: { fields: ['name', 'code'] } },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.length).toBeGreaterThan(0);
  });

  test('APISIX + KC token → device models', async ({ request }) => {
    const token = await getKCToken(request);
    const resp = await request.post(`${APISIX}/api/odoo/infra.device.model/search_read`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { args: [[]], kwargs: { fields: ['name', 'vendor'], limit: 3 } },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body[0].vendor).toBe('MikroTik');
  });

  test('APISIX + KC token → Kill Bill', async ({ request }) => {
    const token = await getKCToken(request);
    const resp = await request.get(`${APISIX}/api/kb/nodesInfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('Spring Boot API direct health', async ({ request }) => {
    const resp = await request.get(`${API}/api/odoo/health`);
    expect(resp.ok()).toBeTruthy();
  });

  test('APISIX admin API reachable', async ({ request }) => {
    const resp = await request.get('http://localhost:9180/apisix/admin/routes', {
      headers: { 'X-API-KEY': 'telcobright-apisix-admin-key' },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.total).toBeGreaterThanOrEqual(4);
  });
});
