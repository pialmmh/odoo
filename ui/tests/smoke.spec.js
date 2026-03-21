import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';
const APISIX = 'http://localhost:9080';
const KC = 'http://localhost:7104';

async function getKCToken(request) {
  const resp = await request.post(`${KC}/realms/telcobright/protocol/openid-connect/token`, {
    form: {
      grant_type: 'password',
      client_id: 'platform-ui',
      username: 'admin',
      password: 'password',
    },
  });
  return (await resp.json()).access_token;
}

test.describe('API tests', () => {
  test('APISIX health (public)', async ({ request }) => {
    const r = await request.get(`${APISIX}/api/odoo/health`);
    expect(r.ok()).toBeTruthy();
    expect((await r.json()).odoo_connected).toBe(true);
  });

  test('APISIX rejects unauthenticated', async ({ request }) => {
    const r = await request.post(`${APISIX}/api/odoo/infra.region/search_read`, {
      data: { args: [[]], kwargs: { fields: ['name'] } },
    });
    expect(r.status()).toBe(401);
  });

  test('APISIX tenant loading (public)', async ({ request }) => {
    const r = await request.post(`${APISIX}/api/odoo/res.partner/search_read`, {
      data: { args: [[['is_company', '=', true]]], kwargs: { fields: ['id', 'name'] } },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.map(b => b.name)).toContain('BTCL');
  });

  test('APISIX + KC token → Odoo', async ({ request }) => {
    const token = await getKCToken(request);
    const r = await request.post(`${APISIX}/api/odoo/infra.region/search_read`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { args: [[]], kwargs: { fields: ['name', 'code'] } },
    });
    expect(r.ok()).toBeTruthy();
    expect((await r.json()).length).toBeGreaterThan(0);
  });

  test('APISIX + KC token → Kill Bill', async ({ request }) => {
    const token = await getKCToken(request);
    const r = await request.get(`${APISIX}/api/kb/nodesInfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });

  test('APISIX admin API', async ({ request }) => {
    const r = await request.get('http://localhost:9180/apisix/admin/routes', {
      headers: { 'X-API-KEY': 'telcobright-apisix-admin-key' },
    });
    expect(r.ok()).toBeTruthy();
    expect((await r.json()).total).toBeGreaterThanOrEqual(4);
  });
});

test.describe('UI tests', () => {
  test('Keycloak login → tenant selector', async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning')
        console.log(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto(BASE);

    // Wait — either KC redirect or app renders
    await page.waitForTimeout(3000);

    // Handle KC login if redirected
    if (page.url().includes('7104')) {
      await page.fill('#username', 'admin');
      await page.fill('#password', 'password');
      await page.click('#kc-login');
      await page.waitForURL(/localhost:5180/, { timeout: 10000 });
    }

    // Wait for app to fully render
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: '/tmp/ui-test.png', fullPage: true });

    const url = page.url();
    const body = await page.locator('body').innerText();
    console.log('URL:', url);
    console.log('Body:', body.substring(0, 300));

    // Check: should have either tenant selector or sidebar (already selected tenant)
    const hasSelectTenant = body.includes('Select Tenant');
    const hasDashboard = body.includes('Dashboard');
    const hasBTCL = body.includes('BTCL');

    console.log('Select Tenant:', hasSelectTenant, 'Dashboard:', hasDashboard, 'BTCL:', hasBTCL);

    // At minimum, the page should not be blank
    expect(body.length).toBeGreaterThan(10);
    // Should show tenants or a dashboard
    expect(hasSelectTenant || hasDashboard).toBe(true);
  });

  test('Select BTCL tenant → navigate infra', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(2000);

    if (page.url().includes('7104')) {
      await page.fill('#username', 'admin');
      await page.fill('#password', 'password');
      await page.click('#kc-login');
      await page.waitForURL(/localhost:5180/, { timeout: 10000 });
    }

    await page.waitForTimeout(3000);

    // Click BTCL tenant card
    await expect(page.locator('h6:text("BTCL")')).toBeVisible({ timeout: 10000 });
    await page.locator('h6:text("BTCL")').click();
    await page.waitForTimeout(2000);

    // Should be on /btcl/
    expect(page.url()).toContain('/btcl');

    // Sidebar should be visible
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Infra')).toBeVisible({ timeout: 5000 });

    // Navigate to infra
    await page.locator('text=Infra').first().click();
    await page.waitForTimeout(3000);

    // Should see infra tree with BTCL data
    await expect(page.locator('text=Infrastructure')).toBeVisible({ timeout: 10000 });
  });
});
