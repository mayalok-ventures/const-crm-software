// @ts-check
const { test, expect } = require('@playwright/test');

const mockUser = {
  _id: 'user_counselor_mobile',
  name: 'Priya Sharma',
  role: 'counsellor',
  workspaceRole: 'agent',
  companyInfo: { companyName: 'Future Scholars CRM' },
};

const mockCampaign = {
  _id: 'camp_meta_fall_2026',
  name: 'Meta Ads Fall 2026',
  campaignName: 'Meta Ads Fall 2026',
  displayName: 'Meta Ads Fall 2026',
  platform: 'meta',
  campaignType: 'inbound_ad',
  status: 'active',
  leadCount: 2,
  assignedCount: 1,
  convertedCount: 1,
  createdAt: new Date().toISOString(),
};

const mockLeads = [
  {
    _id: 'lead_c1',
    id: 'lead_c1',
    name: 'Rohan Verma',
    phone: '+9198765XXXXX',
    rawPhone: '+919876543210',
    isPhoneMasked: true,
    email: 'rohan@example.com',
    status: 'new_lead',
    pipelineStage: 'new_lead',
    score: 85,
    temperature: 'HOT',
    campaignId: 'camp_meta_fall_2026',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'lead_c2',
    id: 'lead_c2',
    name: 'Meera Iyer',
    phone: '+9198765YYYYY',
    rawPhone: '+919876543211',
    isPhoneMasked: true,
    email: 'meera@example.com',
    status: 'closed',
    pipelineStage: 'Admitted',
    score: 95,
    temperature: 'HOT',
    campaignId: 'camp_meta_fall_2026',
    createdAt: new Date().toISOString(),
  },
];

test.describe('Stage 3: Campaign Leads Mobile Viewport & Unified Experience', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 / Pixel 7 mobile dimensions

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('token', 'e2e-stage3-mock-token');
      localStorage.setItem('user', JSON.stringify(user));
    }, mockUser);

    // Mock campaigns endpoint
    await page.route('**/api/campaigns/camp_meta_fall_2026', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, campaign: mockCampaign }),
      });
    });

    // Mock leads endpoint scoped to campaign
    await page.route('**/api/leads*', async (route) => {
      const url = new URL(route.request().url());
      const campaignId = url.searchParams.get('campaignId');

      if (campaignId === 'camp_meta_fall_2026' || campaignId === 'Meta Ads Fall 2026') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            leads: mockLeads,
            total: 2,
            pagination: { total: 2, page: 1, pages: 1, limit: 25 },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            leads: [],
            total: 0,
            pagination: { total: 0, page: 1, pages: 1, limit: 25 },
          }),
        });
      }
    });

    // Mock other ancillary options
    await page.route('**/api/users/team-members*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/campaigns/inbound*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockCampaign]) });
    });
    await page.route('**/api/integrations*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Campaign header metrics and unified leads list render correctly on mobile viewport', async ({ page }) => {
    await page.goto('/campaigns/camp_meta_fall_2026');

    // 1. Verify Campaign Title & Badges
    await expect(page.locator('h1.page-title')).toContainText('Meta Ads Fall 2026');
    await expect(page.locator('text=active').first()).toBeVisible();
    await expect(page.locator('text=meta').first()).toBeVisible();

    // 2. Verify Stats Cards Grid
    await expect(page.locator('text=Total Leads')).toBeVisible();
    await expect(page.locator('text=2').first()).toBeVisible(); // total leads
    await expect(page.locator('text=Assigned')).toBeVisible();
    await expect(page.locator('text=Conversion Rate')).toBeVisible();
    await expect(page.locator('text=50.0%')).toBeVisible();

    // 3. Verify Embedded Leads List Header
    await expect(page.locator('h2:has-text("Campaign Leads")')).toBeVisible();

    // 4. Verify Leads Rendered
    await expect(page.locator('text=Rohan Verma')).toBeVisible();
    await expect(page.locator('text=Meera Iyer')).toBeVisible();

    // 5. Verify Phone Masking (raw number not shown)
    await expect(page.locator('text=+919876543210')).not.toBeVisible();
    await expect(page.locator('text=+9198765XXXXX')).toBeVisible();

    // 6. Verify Mobile BottomNav
    await expect(page.locator('nav.bottom-nav')).toBeVisible();
  });
});
