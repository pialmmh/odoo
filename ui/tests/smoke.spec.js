import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';
const APISIX = 'http://localhost:9081';
const KC = 'http://localhost:7104';

async function getKCToken(request) {
  const resp = await request.post(`${KC}/realms/telcobright/protocol/openid-connect/token`, {
    form: { grant_type: 'password', client_id: 'platform-ui', username: 'admin', password: 'password' },
  });
  return (await resp.json()).access_token;
}

async function loginAndSelectTenant(page, tenantName) {
  await page.goto(BASE);
  await page.waitForTimeout(2000);
  if (page.url().includes('7104')) {
    await page.fill('#username', 'admin');
    await page.fill('#password', 'password');
    await page.click('#kc-login');
    await page.waitForURL(/localhost:5180/, { timeout: 10000 });
  }
  await page.waitForTimeout(3000);
  if (tenantName) {
    await page.locator(`h6:text("${tenantName}")`).click();
    await page.waitForTimeout(3000);
  }
}

test.describe('API tests', () => {
  test('APISIX health', async ({ request }) => {
    const r = await request.get(`${APISIX}/api/odoo/health`);
    expect((await r.json()).odoo_connected).toBe(true);
  });

  test('APISIX rejects unauthenticated', async ({ request }) => {
    const r = await request.post(`${APISIX}/api/odoo/infra.region/search_read`, { data: { args: [[]], kwargs: {} } });
    expect(r.status()).toBe(401);
  });

  test('Tenant loading (public)', async ({ request }) => {
    const r = await request.post(`${APISIX}/api/odoo/res.partner/search_read`, {
      data: { args: [[['is_company', '=', true]]], kwargs: { fields: ['id', 'name'] } },
    });
    expect((await r.json()).map(b => b.name)).toContain('BTCL');
  });

  test('KC token → Odoo regions', async ({ request }) => {
    const token = await getKCToken(request);
    const r = await request.post(`${APISIX}/api/odoo/infra.region/search_read`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { args: [[]], kwargs: { fields: ['name'] } },
    });
    expect((await r.json()).length).toBeGreaterThan(0);
  });

  test('KC token → Kill Bill', async ({ request }) => {
    const token = await getKCToken(request);
    const r = await request.get(`${APISIX}/api/kb/nodesInfo`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.ok()).toBeTruthy();
  });

  test('APISIX admin', async ({ request }) => {
    const r = await request.get('http://localhost:9180/apisix/admin/routes', {
      headers: { 'X-API-KEY': 'telcobright-apisix-admin-key' },
    });
    expect((await r.json()).total).toBeGreaterThanOrEqual(4);
  });
});

test.describe('UI tests', () => {
  test('KC login → tenant selector shows tenants', async ({ page }) => {
    await loginAndSelectTenant(page, null);
    await expect(page.locator('text=Select Tenant')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h6:text("BTCL")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h6:text("Telcobright ISP")')).toBeVisible({ timeout: 5000 });
  });

  test('Select BTCL → dashboard with infra stats', async ({ page }) => {
    await loginAndSelectTenant(page, 'BTCL');
    expect(page.url()).toContain('/btcl');

    // Dashboard should show infra stats
    await expect(page.locator('text=BTCL Dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Regions')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Datacenters')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Computes')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span:text("Infrastructure")')).toBeVisible({ timeout: 5000 });
  });

  test('Dashboard shows SSH keys section', async ({ page }) => {
    await loginAndSelectTenant(page, 'BTCL');
    await expect(page.locator('text=SSH Keys')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=SSH Credentials')).toBeVisible({ timeout: 5000 });
  });

  test('Dashboard shows software projects', async ({ page }) => {
    await loginAndSelectTenant(page, 'BTCL');
    await expect(page.locator('text=Software Projects')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Recent Deployments')).toBeVisible({ timeout: 5000 });
  });

  test('Navigate to Infra from sidebar', async ({ page }) => {
    await loginAndSelectTenant(page, 'BTCL');
    await page.locator('text=Infra').first().click();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/btcl/infra');
  });

  test('Navigate to SSH from sidebar', async ({ page }) => {
    await loginAndSelectTenant(page, 'BTCL');
    await page.locator('text=SSH').first().click();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/btcl/infra/ssh');
    await expect(page.locator('text=SSH Management')).toBeVisible({ timeout: 10000 });
  });

  test('Navigate to Artifacts from sidebar', async ({ page }) => {
    await loginAndSelectTenant(page, 'BTCL');
    await page.locator('text=Artifacts').first().click();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/btcl/artifacts');
    await expect(page.locator('h5:text("Artifacts")')).toBeVisible({ timeout: 10000 });
  });

  test('Navigate to Device Catalog from sidebar', async ({ page }) => {
    await loginAndSelectTenant(page, 'BTCL');
    await page.locator('text=Device Catalog').first().click();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/btcl/infra/catalog');
    await expect(page.locator('h5:text("Device Catalog")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=MikroTik').first()).toBeVisible({ timeout: 5000 });
  });
});
