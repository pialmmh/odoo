// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';

test.describe('Post-migration smoke tests', () => {

  test('Login page loads', async ({ page }) => {
    await page.goto(BASE + '/login');
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Login and see dashboard', async ({ page }) => {
    await page.goto(BASE + '/login');
    // Fill login form
    const inputs = page.locator('input');
    await inputs.first().fill('admin');
    await inputs.nth(1).fill('password');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    await page.waitForTimeout(2000);
    // Should redirect to dashboard
    await expect(page).toHaveURL(BASE + '/');
  });

  test('Infra page loads with tree', async ({ page }) => {
    // Login first
    await page.goto(BASE + '/login');
    const inputs = page.locator('input');
    await inputs.first().fill('admin');
    await inputs.nth(1).fill('password');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    await page.waitForTimeout(2000);

    // Navigate to infra
    await page.goto(BASE + '/infra');
    await page.waitForTimeout(3000);

    // Tree should have regions
    const tree = page.locator('text=Infrastructure');
    await expect(tree.first()).toBeVisible();

    // Check for demo data regions
    await expect(page.locator('text=Dhaka').first()).toBeVisible({ timeout: 5000 });
  });

  test('Device catalog loads with MikroTik models', async ({ page }) => {
    await page.goto(BASE + '/login');
    const inputs = page.locator('input');
    await inputs.first().fill('admin');
    await inputs.nth(1).fill('password');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    await page.waitForTimeout(2000);

    await page.goto(BASE + '/infra/catalog');
    await page.waitForTimeout(3000);

    // Should show device catalog
    await expect(page.locator('text=Device Catalog').first()).toBeVisible();

    // Should have MikroTik models
    await expect(page.locator('text=MikroTik').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=CCR1036').first()).toBeVisible();
  });

  test('SSH page loads', async ({ page }) => {
    await page.goto(BASE + '/login');
    const inputs = page.locator('input');
    await inputs.first().fill('admin');
    await inputs.nth(1).fill('password');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    await page.waitForTimeout(2000);

    await page.goto(BASE + '/infra/ssh');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=SSH Management').first()).toBeVisible();
    await expect(page.locator('text=SSH Keys').first()).toBeVisible();
    await expect(page.locator('text=Credentials').first()).toBeVisible();
  });

  test('Artifacts page loads', async ({ page }) => {
    await page.goto(BASE + '/login');
    const inputs = page.locator('input');
    await inputs.first().fill('admin');
    await inputs.nth(1).fill('password');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    await page.waitForTimeout(2000);

    await page.goto(BASE + '/artifacts');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=Artifacts').first()).toBeVisible();
    await expect(page.locator('text=Projects').first()).toBeVisible();
  });

  test('Odoo API works via proxy (device models)', async ({ page }) => {
    // Authenticate with Odoo first
    await page.request.post(BASE + '/odoo/web/session/authenticate', {
      data: {
        jsonrpc: '2.0', id: 1, method: 'call',
        params: { db: 'odoo_billing', login: 'admin', password: 'admin' },
      },
    });
    const response = await page.request.post(BASE + '/odoo/web/dataset/call_kw/infra.device.model/search_read', {
      data: {
        jsonrpc: '2.0', id: 2, method: 'call',
        params: {
          model: 'infra.device.model', method: 'search_read',
          args: [[]], kwargs: { fields: ['name', 'vendor'], limit: 3 },
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.result).toBeDefined();
    expect(body.result.length).toBeGreaterThan(0);
  });

  test('Spring Boot API health', async ({ page }) => {
    const response = await page.request.get('http://localhost:8180/api/odoo/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.odoo_connected).toBe(true);
  });

  test('Spring Boot Odoo proxy returns data', async ({ page }) => {
    const response = await page.request.post('http://localhost:8180/api/odoo/infra.device.model/search_read', {
      data: {
        args: [[]],
        kwargs: { fields: ['name', 'vendor'], limit: 3 },
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].vendor).toBe('MikroTik');
  });
});
