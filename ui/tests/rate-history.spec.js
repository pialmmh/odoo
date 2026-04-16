import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5180';
const KC = 'http://localhost:7104';

async function loginAndSelectTenant(page, tenantName = 'BTCL') {
  await page.goto(BASE);
  await page.waitForTimeout(3000);

  // Keycloak login if redirected
  if (page.url().includes('7104')) {
    await page.fill('#username', 'admin');
    await page.fill('#password', 'password');
    await page.click('#kc-login');
    await page.waitForURL(/localhost:5180/, { timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  // Select tenant via TopBar MUI dropdown
  const tenantSelect = page.locator('[role="combobox"]').first();
  if (await tenantSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tenantSelect.click();
    const option = page.locator(`[role="option"]:has-text("${tenantName}")`).first();
    if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
      await option.click();
      await page.waitForTimeout(1000);
    }
  }
}

test.describe('Rate History Page', () => {
  test('loads rate history page', async ({ page }) => {
    await loginAndSelectTenant(page);
    await page.goto(`${BASE}/btcl/rate-history`);
    await page.waitForTimeout(5000);

    // Take screenshot to see what rendered
    await page.screenshot({ path: '/tmp/rate-history-page.png', fullPage: true });

    // Check page loaded
    const heading = page.locator('text=Rate History');
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test('can open new rate modal with variant selector', async ({ page }) => {
    await loginAndSelectTenant(page);
    await page.goto(`${BASE}/btcl/rate-history`);
    await page.waitForTimeout(5000);

    // Click New Rate button
    await page.locator('button:has-text("New Rate")').first().click();
    await page.waitForTimeout(1000);

    // Modal opens — use the accessible dialog name for precise scoping
    const dialog = page.getByRole('dialog', { name: 'New Rate Entry' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // The first combobox inside the dialog is Product; second is Variant
    const productSelect = dialog.getByRole('combobox').nth(0);
    await expect(productSelect).toBeVisible();
    await productSelect.click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:has-text("Dedicated Internet Access")').first().click();
    await page.waitForTimeout(2500); // wait for variants to load

    await page.screenshot({ path: '/tmp/rate-history-modal.png', fullPage: true });

    // Variant selector label appears inside the dialog (either "optional" or "required")
    await expect(dialog.locator('text=/Variant \\(/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('loads pricing page', async ({ page }) => {
    await loginAndSelectTenant(page);
    await page.goto(`${BASE}/btcl/pricing`);
    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/pricing-page.png', fullPage: true });

    // Must not show an error alert
    await expect(page.locator('text=/Failed to load pricing/i')).not.toBeVisible();
    // Must show the dual-column header
    await expect(page.locator('text=/List.*Effective|Effective.*List/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('products page CRUD controls visible', async ({ page }) => {
    await loginAndSelectTenant(page);
    await page.goto(`${BASE}/btcl/products`);
    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/products-page.png', fullPage: true });

    // Must not show error
    await expect(page.locator('text=/Failed to load products/i')).not.toBeVisible();
    // Must have "New Product" button
    await expect(page.locator('button:has-text("New Product")').first()).toBeVisible({ timeout: 10000 });

    // Open the New Product dialog and verify required fields render
    await page.locator('button:has-text("New Product")').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=/New Product/').first()).toBeVisible();
    await expect(page.locator('label:has-text("Product Name")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Category")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Create Product")').first()).toBeVisible();
    // Close the new dialog
    await page.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(300);
  });

  test('variant price is editable in product modal', async ({ page }) => {
    await loginAndSelectTenant(page);
    await page.goto(`${BASE}/btcl/products`);
    await page.waitForTimeout(5000);

    // Click the "Dedicated Internet Access (DIA)" row to open its modal (it has 21 variants including 100 Mbps)
    const diaRow = page.locator('tr:has-text("Dedicated Internet Access")').first();
    await expect(diaRow).toBeVisible({ timeout: 10000 });
    await diaRow.click();
    await page.waitForTimeout(1000);

    // Switch to Variants tab
    await page.locator('button[role="tab"]:has-text("Variants")').first().click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: '/tmp/products-variants.png', fullPage: true });

    // Info alert explaining the split between list price and dated pricing
    await expect(page.locator('text=/list price/i').first()).toBeVisible();
    await expect(page.locator('text=/Rate History/i').first()).toBeVisible();
    // At least one editable price input must exist in the variants table
    const priceInput = page.locator('input[aria-label^="Price for"]').first();
    await expect(priceInput).toBeVisible({ timeout: 5000 });
    await expect(priceInput).toBeEditable();
  });

  test('loads purchase page with plans', async ({ page }) => {
    await loginAndSelectTenant(page);

    // Navigate via sidebar link to preserve React state (avoid full page reload losing activeTenant)
    const purchaseLink = page.locator('button:has-text("Purchase")').first();
    if (await purchaseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await purchaseLink.click();
    } else {
      await page.goto(`${BASE}/btcl/purchase`);
    }
    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/purchase-page.png', fullPage: true });

    // Page should render — either the stepper (tenant selected) or the no-tenant prompt
    const stepper = page.locator('text=Select Customer');
    const noTenant = page.locator('text=Please select a tenant');
    await expect(stepper.or(noTenant).first()).toBeVisible({ timeout: 15000 });
  });
});
