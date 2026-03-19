// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';
const GATEWAY = 'http://localhost:8001';
const KC = 'http://localhost:7104';
const API = 'http://localhost:8180';

// Helper: get Keycloak token
async function getKCToken(request) {
  const resp = await request.post(`${KC}/realms/telcobright/protocol/openid-connect/token`, {
    form: {
      grant_type: 'password',
      client_id: 'platform-ui',
      username: 'admin',
      password: 'password',
    },
  });
  const body = await resp.json();
  return body.access_token;
}

test.describe('Platform smoke tests', () => {

  test('React UI loads', async ({ page }) => {
    const response = await page.goto(BASE);
    expect(response.status()).toBeLessThan(500);
  });

  test('Keycloak is reachable', async ({ request }) => {
    const resp = await request.get(`${KC}/realms/telcobright`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.realm).toBe('telcobright');
  });

  test('Keycloak token grant works', async ({ request }) => {
    const token = await getKCToken(request);
    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(3); // JWT has 3 parts
  });

  test('Gateway health (public, no auth)', async ({ request }) => {
    const resp = await request.get(`${GATEWAY}/PLATFORM-API/api/odoo/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.odoo_connected).toBe(true);
  });

  test('Gateway rejects unauthenticated requests', async ({ request }) => {
    const resp = await request.post(`${GATEWAY}/PLATFORM-API/api/odoo/infra.region/search_read`, {
      data: { args: [[]], kwargs: { fields: ['name'] } },
    });
    // Should be 401 or 403
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });

  test('Gateway + KC token → Odoo regions', async ({ request }) => {
    const token = await getKCToken(request);
    const resp = await request.post(`${GATEWAY}/PLATFORM-API/api/odoo/infra.region/search_read`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { args: [[]], kwargs: { fields: ['name', 'code'] } },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].name).toBeTruthy();
  });

  test('Gateway + KC token → Odoo device models', async ({ request }) => {
    const token = await getKCToken(request);
    const resp = await request.post(`${GATEWAY}/PLATFORM-API/api/odoo/infra.device.model/search_read`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { args: [[]], kwargs: { fields: ['name', 'vendor'], limit: 3 } },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].vendor).toBe('MikroTik');
  });

  test('Gateway + KC token → Kill Bill', async ({ request }) => {
    const token = await getKCToken(request);
    const resp = await request.get(`${GATEWAY}/PLATFORM-API/api/kb/nodesInfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('Gateway + KC token → OS versions', async ({ request }) => {
    const token = await getKCToken(request);
    const resp = await request.post(`${GATEWAY}/PLATFORM-API/api/odoo/infra.os.version/search_read`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { args: [[['is_active', '=', true]]], kwargs: { fields: ['display_name', 'lts'], limit: 5 } },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.length).toBeGreaterThan(0);
  });

  test('Spring Boot API direct health', async ({ request }) => {
    const resp = await request.get(`${API}/api/odoo/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.odoo_connected).toBe(true);
  });

  test('Eureka has PLATFORM-API registered', async ({ request }) => {
    const resp = await request.get('http://localhost:8761/eureka/apps/PLATFORM-API', {
      headers: { Accept: 'application/json' },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.application.name).toBe('PLATFORM-API');
  });

});
