// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Sahyak SalesCRM — Master E2E Automation Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  test('TC-AUTH-01: Valid Login should store JWT and redirect to Dashboard', async ({ page }) => {
    await page.goto('/login/');

    await page.fill('input[placeholder*="email" i], input[type="text"]', 'admin@crm.com');
    await page.fill('input[placeholder*="password" i], input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]', { force: true });

    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/.*(dashboard|superadmin-dashboard).*/, { timeout: 15000 });

    const token = await page.evaluate(() => localStorage.getItem('token'));
    const user = await page.evaluate(() => localStorage.getItem('user'));
    expect(token).toBeTruthy();
    expect(user).toBeTruthy();
  });

  test('TC-AUTH-02: Invalid Password shows error toast without redirecting', async ({ page }) => {
    await page.goto('/login/');

    await page.fill('input[placeholder*="email" i], input[type="text"]', 'admin@crm.com');
    await page.fill('input[placeholder*="password" i], input[type="password"]', 'WrongPassword!999');
    await page.click('button[type="submit"]', { force: true });

    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/login');

    const toastError = page.locator('text=/invalid|failed|incorrect|unauthorized/i');
    await expect(toastError.first()).toBeVisible({ timeout: 8000 });
  });

  test('TC-AUTH-03: Logout clears auth state and blocks access to /dashboard', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('input[placeholder*="email" i], input[type="text"]', 'admin@crm.com');
    await page.fill('input[placeholder*="password" i], input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/.*(dashboard|superadmin-dashboard).*/, { timeout: 15000 });

    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await page.goto('/login/');

    await page.goto('/dashboard/');
    await expect(page).toHaveURL(/.*login.*/, { timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. NAVIGATION & SPA ROUTING (<50ms TARGET)
  // ─────────────────────────────────────────────────────────────
  test('TC-NAV-01: Navigation routes seamlessly across all CRM modules', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('input[placeholder*="email" i], input[type="text"]', 'admin@crm.com');
    await page.fill('input[placeholder*="password" i], input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/.*(dashboard|superadmin-dashboard).*/, { timeout: 15000 });

    // Open projects catalog module
    await page.goto('/projects/');
    await expect(page).toHaveURL(/.*projects.*/, { timeout: 8000 });

    // Open templates module
    await page.goto('/templates/');
    await expect(page).toHaveURL(/.*templates.*/, { timeout: 8000 });

    // Open profile module
    await page.goto('/profile/');
    await expect(page).toHaveURL(/.*profile.*/, { timeout: 8000 });
  });

  test('TC-NAV-02: Direct Hit on Dynamic Route loads Next.js Router without 404', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('input[placeholder*="email" i], input[type="text"]', 'admin@crm.com');
    await page.fill('input[placeholder*="password" i], input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/.*(dashboard|superadmin-dashboard).*/, { timeout: 15000 });

    await page.goto('/leads/placeholder/');
    await page.waitForTimeout(1500);

    const heading = await page.locator('body').innerText();
    expect(heading).not.toContain('404 Not Found');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. SECURITY & ACCESS CONTROL
  // ─────────────────────────────────────────────────────────────
  test('TC-SEC-01: Unauthenticated request to /superadmin-dashboard redirects to /login', async ({ page }) => {
    await page.goto('/superadmin-dashboard/');
    await expect(page).toHaveURL(/.*login.*/, { timeout: 10000 });
  });

});
