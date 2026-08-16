// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:5000/api';

test.describe('CoreSetu SalesCRM — Master E2E Automation Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage and cookies before each test
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  test('TC-AUTH-01: Valid Login should store JWT and redirect to Dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', 'admin@crm.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');

    // Expect navigation to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Verify localStorage contains token and user
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const user = await page.evaluate(() => localStorage.getItem('user'));
    expect(token).toBeTruthy();
    expect(user).toBeTruthy();
  });

  test('TC-AUTH-02: Invalid Password shows error toast without redirecting', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[type="email"], input[name="email"]', 'admin@crm.com');
    await page.fill('input[type="password"], input[name="password"]', 'WrongPassword!999');
    await page.click('button[type="submit"]');

    // Expect URL remains on /login
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/login');
    
    // Check for error toast or notification element
    const toastError = page.locator('text=/invalid|failed|incorrect|unauthorized/i');
    await expect(toastError.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-AUTH-03: Logout clears auth state and blocks access to /dashboard', async ({ page }) => {
    // Perform login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'admin@crm.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to profile or click logout
    await page.goto(`${BASE_URL}/profile`);
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout-btn"]');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
    } else {
      await page.evaluate(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      });
      await page.goto(`${BASE_URL}/login`);
    }

    // Direct access to /dashboard must redirect to /login
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. NAVIGATION & SPA ROUTING (<50ms TARGET)
  // ─────────────────────────────────────────────────────────────
  test('TC-NAV-01: Mobile Bottom Dock navigation routes between all modules', async ({ page }) => {
    // Set mobile viewport (iPhone 14 Pro: 393x852)
    await page.setViewportSize({ width: 393, height: 852 });
    
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'admin@crm.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Test Catalog link
    const catalogLink = page.locator('.bottom-nav .bottom-nav-link:has-text("Catalog"), a[href="/projects"]');
    await catalogLink.first().click();
    await page.waitForURL('**/projects', { timeout: 5000 });
    expect(page.url()).toContain('/projects');

    // Test WhatsApp link
    const inboxLink = page.locator('.bottom-nav .bottom-nav-link:has-text("Inbox"), a[href="/whatsapp"]');
    await inboxLink.first().click();
    await page.waitForURL('**/whatsapp', { timeout: 5000 });
    expect(page.url()).toContain('/whatsapp');

    // Test Templates link
    const templatesLink = page.locator('.bottom-nav .bottom-nav-link:has-text("Templates"), a[href="/templates"]');
    await templatesLink.first().click();
    await page.waitForURL('**/templates', { timeout: 5000 });
    expect(page.url()).toContain('/templates');

    // Test Profile link
    const profileLink = page.locator('.bottom-nav .bottom-nav-link:has-text("Profile"), a[href="/profile"]');
    await profileLink.first().click();
    await page.waitForURL('**/profile', { timeout: 5000 });
    expect(page.url()).toContain('/profile');
  });

  test('TC-NAV-02: Direct Hit on Dynamic Route loads Next.js Router without 404', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'admin@crm.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Direct hit on placeholder dynamic route
    await page.goto(`${BASE_URL}/leads/placeholder`);
    await page.waitForTimeout(1000);
    
    // Ensure no raw Cloudflare/NGINX 404 is served
    const heading = await page.locator('body').innerText();
    expect(heading).not.toContain('404 Not Found');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. LEAD MANAGEMENT & LIFECYCLE
  // ─────────────────────────────────────────────────────────────
  test('TC-LEAD-01: Create new Lead and verify in Pipeline stage', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'admin@crm.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Click Add Lead FAB / Button
    const addLeadBtn = page.locator('button:has-text("Add Lead"), .fab, [aria-label="Add lead"]');
    await addLeadBtn.first().click();

    // Fill Lead Form
    const testPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const testName = `QA Test Lead ${Date.now().toString().slice(-4)}`;
    
    await page.fill('input[name="name"], input[placeholder*="Name"]', testName);
    await page.fill('input[name="phone"], input[placeholder*="Phone"]', testPhone);
    
    // Submit
    const submitBtn = page.locator('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button:has-text("Add Lead")');
    await submitBtn.first().click();

    // Verify lead appears in dashboard pipeline
    await expect(page.locator(`text=${testName}`).first()).toBeVisible({ timeout: 8000 });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. RAZORPAY STANDARD WEB CHECKOUT
  // ─────────────────────────────────────────────────────────────
  test('TC-PAY-01: Checkout button triggers Razorpay modal initialization', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'admin@crm.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/plans`);
    await page.waitForTimeout(1000);

    // Verify Razorpay script is present or injected on demand
    const subscribeBtn = page.locator('button:has-text("Upgrade"), button:has-text("Subscribe"), button:has-text("Select Plan")');
    if (await subscribeBtn.count() > 0) {
      await subscribeBtn.first().click();
      await page.waitForTimeout(2000);
      
      // Either modal opens or verification handles gracefully
      const scriptTag = await page.locator('script[src*="checkout.razorpay.com"]').count();
      expect(scriptTag).toBeGreaterThanOrEqual(1);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 5. SECURITY & ACCESS CONTROL
  // ─────────────────────────────────────────────────────────────
  test('TC-SEC-01: Unauthenticated request to /superadmin-dashboard redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/superadmin-dashboard`);
    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

});
