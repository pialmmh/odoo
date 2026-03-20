import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';

test('Tenants load after KC login', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      console.log(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto(BASE);

  // Keycloak JS will redirect to KC login — wait for it
  await page.waitForURL(/7104/, { timeout: 15000 }).catch(() => {});

  // If on KC login page, fill and submit
  const onKC = page.url().includes('7104');
  console.log('On KC page:', onKC, page.url());

  if (onKC) {
    await page.waitForSelector('#username', { timeout: 5000 });
    await page.fill('#username', 'admin');
    await page.fill('#password', 'password');
    await page.click('#kc-login');

    // Wait for redirect back to our app
    await page.waitForURL(/localhost:5180/, { timeout: 15000 });
  }

  console.log('After login URL:', page.url());

  // Wait for React to init + load tenants
  await page.waitForTimeout(10000);

  console.log('Final URL:', page.url());
  const bodyText = await page.locator('body').innerText();
  console.log('Body:', bodyText.substring(0, 400));

  await page.screenshot({ path: '/tmp/tenant-final.png', fullPage: true });

  // Verify tenants are visible
  const hasBTCL = bodyText.includes('BTCL');
  console.log('Has BTCL:', hasBTCL);

  // Also verify API works from browser context
  const fetchResult = await page.evaluate(async () => {
    const r = await fetch('/api/odoo/res.partner/search_read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [[['is_company', '=', true]]], kwargs: { fields: ['id', 'name'] } }),
    });
    return { status: r.status, data: await r.json() };
  });
  console.log('Browser fetch:', fetchResult.status, JSON.stringify(fetchResult.data));

  expect(fetchResult.status).toBe(200);
  expect(fetchResult.data.length).toBeGreaterThan(0);
  expect(hasBTCL).toBe(true);
});
