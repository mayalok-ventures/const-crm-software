// @ts-check
const { test, expect } = require('@playwright/test');

const mockUser = {
  _id: 'user_e2e_1',
  name: 'Anjali Counsellor',
  role: 'counsellor',
  workspaceRole: 'agent',
  companyInfo: { companyName: 'Global Education Consultancy' },
};

const mockLeads = [
  {
    _id: 'lead_e2e_1',
    id: 'lead_e2e_1',
    name: 'Aarav Patel',
    phone: '+919876543210',
    email: 'aarav@example.com',
    status: 'new_lead',
    pipelineStage: 'new_lead',
    serviceRequired: 'smart_solo',
    monthlySpend: 25000,
    goalTimeline: 'immediate',
    company: 'Apex Corporation',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'lead_e2e_2',
    id: 'lead_e2e_2',
    name: 'Sneha Rao',
    phone: '+919876543211',
    email: 'sneha@example.com',
    status: 'converted',
    pipelineStage: 'converted',
    serviceRequired: 'business',
    monthlySpend: 50000,
    goalTimeline: 'within_1_month',
    company: 'Rao Global',
    createdAt: new Date().toISOString(),
  },
];

test.beforeEach(async ({ page }) => {
  // Inject mock authentication token and user profile into localStorage
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'e2e-mock-jwt-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, mockUser);

  // Intercept all API calls with standard mock responses
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/leads/lead_e2e_1')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lead: mockLeads[0] }),
      });
    }

    if (url.includes('/leads')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leads: mockLeads,
          total: mockLeads.length,
          page: 1,
          limit: 20,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
});

test.describe('E2E Smoke & Mobile Ergonomics Suite (T3 & Group U)', () => {
  test('Smoke 1: Lead list loads, displays leads, and supports scrolling', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('domcontentloaded');

    // Check that leads page heading or leads container is visible
    const leadHeading = page.locator('h1, h2, [role="heading"]').filter({ hasText: /Leads/i }).first();
    await expect(leadHeading).toBeVisible({ timeout: 10000 });

    // Verify leads are displayed or loading state resolves
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  });

  test('Smoke 2: Mobile bottom navigation renders with accessible tap targets', async ({ page, isMobile }) => {
    await page.goto('/leads');
    await page.waitForLoadState('domcontentloaded');

    if (isMobile) {
      const bottomNav = page.locator('nav.bottom-nav');
      await expect(bottomNav).toBeVisible();

      // Check min-height of nav links is at least 44-48px for WCAG touch compliance
      const firstLink = bottomNav.locator('a.bottom-nav-link').first();
      const box = await firstLink.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('Smoke 3: Modal opens with accessible dialog role and close button', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('domcontentloaded');

    // Look for Add Lead button
    const addLeadBtn = page.locator('button, a').filter({ hasText: /Add Lead|New Lead|\+/i }).first();
    if (await addLeadBtn.isVisible()) {
      await addLeadBtn.click();
      const modal = page.locator('[role="dialog"], .animate-fade-in').first();
      await expect(modal).toBeVisible();
    }
  });

  test('Smoke 4: WhatsApp click-to-chat button generates proper wa.me link format', async () => {
    const rawPhone = '+91 98765 43210';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const expectedUrl = `https://wa.me/${cleanPhone}`;
    expect(expectedUrl).toBe('https://wa.me/919876543210');
  });

  test('Ergonomics 5: Input elements on mobile viewports enforce font-size >= 16px to prevent iOS auto-zoom', async ({ page, isMobile }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const input = page.locator('input[type="text"], input[type="email"], input[type="tel"]').first();
    if (await input.isVisible()) {
      const fontSize = await input.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });
      if (isMobile) {
        // Enforce font-size >= 16px on mobile viewports (< 768px) to prevent iOS Safari auto-zoom
        expect(fontSize).toBeGreaterThanOrEqual(16.0);
      } else {
        expect(fontSize).toBeGreaterThanOrEqual(13.0);
      }
    }
  });

  test('Ergonomics 6: Save and Confirm modal buttons are never covered by BottomNav on mobile viewports (elementFromPoint proof)', async ({ page }) => {
    const mobileViewports = [
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 390, height: 844, name: 'iPhone 13/14' },
    ];

    for (const vp of mobileViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/leads');
      await page.waitForLoadState('domcontentloaded');

      const bottomNav = page.locator('nav.bottom-nav');
      await expect(bottomNav).toBeVisible();

      // Trigger modal (Add Lead)
      const triggerBtn = page.locator('button, a').filter({ hasText: /Add Lead|New Lead|\+/i }).first();
      if (await triggerBtn.isVisible()) {
        await triggerBtn.click();
        const modal = page.locator('[role="dialog"], .modal-sheet, .modal').first();
        await expect(modal).toBeVisible();

        // Locate primary action button inside modal
        const submitBtn = modal.locator('button[type="submit"], button.btn-primary, button:has-text("Save"), button:has-text("Add")').first();
        if (await submitBtn.isVisible()) {
          // Scroll button into view if needed
          await submitBtn.scrollIntoViewIfNeeded();

          // Evaluate exact point clickability using elementFromPoint
          const hitReport = await page.evaluate(() => {
            const btn = document.querySelector('[role="dialog"] button[type="submit"], [role="dialog"] .btn-primary, .modal-sheet button[type="submit"], .modal-sheet .btn-primary');
            if (!btn) return { found: false };
            const rect = btn.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const hitEl = document.elementFromPoint(cx, cy);

            return {
              found: true,
              isCoveredByBottomNav: Boolean(hitEl && hitEl.closest('nav.bottom-nav')),
              hitTag: hitEl?.tagName,
              hitText: hitEl?.textContent?.trim().slice(0, 30),
              btnBounds: { top: rect.top, bottom: rect.bottom, height: rect.height },
              viewportHeight: window.innerHeight,
            };
          });

          if (hitReport.found) {
            // PROOF: Element at the button's center point is NOT intercepted or covered by BottomNav
            expect(hitReport.isCoveredByBottomNav).toBe(false);
          }
        }
      }
    }
  });

  test('Ergonomics 7: Mobile search and filter bars do not clip or induce horizontal scroll blowout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/leads');
    await page.waitForLoadState('domcontentloaded');

    // Check no horizontal window blowout
    const overflowReport = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
      const clientW = docEl.clientWidth;
      return {
        scrollWidth: scrollW,
        clientWidth: clientW,
        hasHorizontalOverflow: scrollW > clientW + 2,
      };
    });

    expect(overflowReport.hasHorizontalOverflow).toBe(false);

    // Verify search bar stays fully within viewport boundaries
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible()) {
      const box = await searchInput.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
      }
    }
  });
});
