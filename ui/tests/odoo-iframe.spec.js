// E2E: verify the Odoo iframe embed renders inside the React shell.
//
// What this protects against:
//   - The iframe failing to bootstrap because the Vite proxy mangles
//     /web responses (saw this earlier with /odoo/* deep-links → Owl
//     never mounted).
//   - The Spring tenant→DB resolver pointing at a stale-schema DB
//     (the totp_last_counter regression — silent unless someone
//     actually authenticates against Odoo).
//   - The /btcl/erp/* React route shape regressing.
//   - Odoo's X-Frame-Options/CSP making the iframe cross-origin
//     (the Vite proxy strips both, see vite.config.js).
//
// Topology under test:
//   React shell (Vite :5180) → /btcl/erp/products
//     └─ <iframe src="/web"> → Vite proxy → Odoo :7170
//
// Auth model: Keycloak handles the React shell login (admin/password).
// Odoo has its own auth realm; we log into it through the iframe's
// own login form (admin/admin — Odoo defaults from the fresh init).

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';
const ODOO_USER = 'admin';
const ODOO_PASS = 'admin';

async function loginSuperAdmin(page) {
  await page.goto(BASE);
  await page.waitForTimeout(2000);
  if (page.url().includes(':7104')) {
    await page.fill('#username', 'admin');
    await page.fill('#password', 'password');
    await page.click('#kc-login');
    await page.waitForURL(/localhost:5180/, { timeout: 15000 });
  }
  await page.waitForTimeout(2000);
}

async function selectTenant(page, name) {
  await expect(page.locator('text=Select Tenant')).toBeVisible({ timeout: 10000 });
  await page.locator(`h6:text("${name}")`).click();
  await page.waitForTimeout(2000);
}

test.describe('Odoo iframe embed', () => {
  test.setTimeout(90000);

  test('iframe element is present at /btcl/erp/products', async ({ page }) => {
    await loginSuperAdmin(page);
    await selectTenant(page, 'BTCL');
    await page.goto(`${BASE}/btcl/erp/products`);
    await page.waitForURL(/\/btcl\/erp\/products/, { timeout: 10000 });

    const iframe = page.locator('iframe[title="Odoo (embedded)"]');
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toBeVisible();
  });

  test('iframe is same-origin (Vite proxy strips X-Frame-Options/CSP)', async ({ page }) => {
    await loginSuperAdmin(page);
    await selectTenant(page, 'BTCL');
    await page.goto(`${BASE}/btcl/erp/products`);
    await page.waitForLoadState('networkidle');

    // Wait until the iframe's contentDocument has actually parsed.
    const sameOrigin = await page.waitForFunction(() => {
      const f = document.querySelector('iframe[title="Odoo (embedded)"]');
      if (!f || !f.contentWindow) return null;
      try {
        const d = f.contentDocument;
        if (!d || !d.body) return null;       // not loaded yet
        return d.body.children.length > 0 ? 'yes' : null;
      } catch {
        return 'cross-origin';
      }
    }, null, { timeout: 30000 });
    expect(await sameOrigin.jsonValue()).toBe('yes');
  });

  test('iframe shows Odoo login page (proxy + Odoo serving HTML)', async ({ page }) => {
    await loginSuperAdmin(page);
    await selectTenant(page, 'BTCL');
    await page.goto(`${BASE}/btcl/erp/products`);

    const frame = page.frameLocator('iframe[title="Odoo (embedded)"]');
    // /web redirects to /web/login when unauthenticated. Odoo's login
    // page has a form with #login and #password inputs — that's our
    // proof the proxy works and Odoo is serving real HTML.
    await expect(frame.locator('input#login')).toBeVisible({ timeout: 30000 });
    await expect(frame.locator('input#password')).toBeVisible();
  });

  test('iframe Odoo login → web client mounts (full e2e)', async ({ page }) => {
    await loginSuperAdmin(page);
    await selectTenant(page, 'BTCL');
    await page.goto(`${BASE}/btcl/erp/products`);

    const frame = page.frameLocator('iframe[title="Odoo (embedded)"]');
    await expect(frame.locator('input#login')).toBeVisible({ timeout: 30000 });

    // Log into Odoo via the iframe's own form.
    await frame.locator('input#login').fill(ODOO_USER);
    await frame.locator('input#password').fill(ODOO_PASS);
    await frame.locator('button[type="submit"]').click();

    // After login Odoo's path-based router lands at /odoo/<default>;
    // .o_action_manager is the root container for actions (list/form/kanban).
    await expect(frame.locator('.o_action_manager').first()).toBeVisible({ timeout: 30000 });

    // Visible navbar = JS bundle loaded + Owl mounted.
    await expect(frame.locator('.o_main_navbar').first()).toBeVisible({ timeout: 5000 });

    // Snapshot for visual regression diffs.
    await page.screenshot({ path: 'tests/_screenshots/odoo-iframe-loggedin.png', fullPage: true });
  });
});
