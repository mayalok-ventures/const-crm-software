// @ts-check
const { test, expect } = require('@playwright/test');

const mockUser = {
  _id: 'user_e2e_lead_switch',
  name: 'Switch Test Counsellor',
  role: 'counsellor',
  workspaceRole: 'agent',
  companyInfo: { companyName: 'Global Admissions' },
};

const leadsData = {
  'lead_alpha_001': {
    _id: 'lead_alpha_001',
    id: 'lead_alpha_001',
    name: 'Alpha Candidate',
    phone: '+919876500001',
    email: 'alpha@candidate.test',
    status: 'new_lead',
    pipelineStage: 'new_lead',
    budget: 50000,
    targetCourse: 'Computer Science',
    __v: 1,
    createdAt: new Date().toISOString(),
  },
  'lead_beta_002': {
    _id: 'lead_beta_002',
    id: 'lead_beta_002',
    name: 'Beta Candidate',
    phone: '+919876500002',
    email: 'beta@candidate.test',
    status: 'contacted',
    pipelineStage: 'contacted',
    budget: 80000,
    targetCourse: 'Data Science',
    __v: 2,
    createdAt: new Date().toISOString(),
  },
  'lead_gamma_003': {
    _id: 'lead_gamma_003',
    id: 'lead_gamma_003',
    name: 'Gamma Candidate',
    phone: '+919876500003',
    email: 'gamma@candidate.test',
    status: 'qualified',
    pipelineStage: 'qualified',
    budget: 120000,
    targetCourse: 'Robotics',
    __v: 3,
    createdAt: new Date().toISOString(),
  },
};

test.describe('RC1 Gate: Frontend Rapid Lead Switch & Offline Durability', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('token', 'e2e-rc1-mock-jwt-token');
      localStorage.setItem('user', JSON.stringify(user));
    }, mockUser);

    // Default route handler for all API calls
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/auth/me') || url.includes('/auth/user')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
      }

      if (url.includes('/projects')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }

      if (url.includes('/whatsapp/status')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'CONNECTED' }) });
      }

      if (url.includes('/leads/lead_alpha_001')) {
        if (method === 'PUT') {
          const body = route.request().postDataJSON();
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...leadsData['lead_alpha_001'], ...body }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsData['lead_alpha_001']) });
      }

      if (url.includes('/leads/lead_beta_002')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsData['lead_beta_002']) });
      }

      if (url.includes('/leads/lead_gamma_003')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsData['lead_gamma_003']) });
      }

      if (url.includes('/leads')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            leads: Object.values(leadsData),
            total: 3,
            page: 1,
            limit: 20,
          }),
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });
  });

  test('1. Rapid lead switch A -> B -> C -> back shows no stale/wrong-lead data and no form bleeding under variable network latency', async ({ page }) => {
    // Unroute and re-route with simulated delays to induce race conditions
    await page.unroute('**/api/**');
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/auth/me') || url.includes('/auth/user')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
      }
      if (url.includes('/projects') || url.includes('/whatsapp/status') || url.includes('/whatsapp/chats/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }

      if (url.includes('/leads/lead_alpha_001')) {
        // High latency for Lead Alpha (800ms)
        await new Promise((r) => setTimeout(r, 800));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsData['lead_alpha_001']) });
      }

      if (url.includes('/leads/lead_beta_002')) {
        // Fast response for Lead Beta (40ms)
        await new Promise((r) => setTimeout(r, 40));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsData['lead_beta_002']) });
      }

      if (url.includes('/leads/lead_gamma_003')) {
        // Moderate response for Lead Gamma (200ms)
        await new Promise((r) => setTimeout(r, 200));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsData['lead_gamma_003']) });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message, err.stack));

    // 1. Start navigation to Lead Alpha (slow 800ms)
    await page.goto('/leads/lead_alpha_001');

    // 2. Immediately switch to Lead Beta before Lead Alpha finishes loading
    await page.goto('/leads/lead_beta_002');

    // 3. Verify Lead Beta renders correctly without being overwritten by Alpha
    await expect(page.locator('text=Beta Candidate').or(page.locator('input[value="Beta Candidate"]'))).toBeVisible({ timeout: 10000 });

    const betaContent = await page.textContent('body');
    expect(betaContent).toContain('Beta Candidate');
    expect(betaContent).not.toContain('Alpha Candidate');

    // 4. Switch to Lead Gamma
    await page.goto('/leads/lead_gamma_003');
    await expect(page.locator('text=Gamma Candidate').or(page.locator('input[value="Gamma Candidate"]'))).toBeVisible({ timeout: 10000 });

    const gammaContent = await page.textContent('body');
    expect(gammaContent).toContain('Gamma Candidate');
    expect(gammaContent).not.toContain('Beta Candidate');
  });

  test('2. Save-while-navigating preserves the write with optimistic version in payload', async ({ page }) => {
    let capturedPutPayload = null;

    await page.unroute('**/api/**');
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/auth/me') || url.includes('/auth/user')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
      }
      if (url.includes('/projects') || url.includes('/whatsapp/status') || url.includes('/whatsapp/chats/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }

      if (url.includes('/leads/lead_alpha_001')) {
        if (method === 'PUT') {
          capturedPutPayload = route.request().postDataJSON();
          // Simulate server processing delay
          await new Promise((r) => setTimeout(r, 250));
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...leadsData['lead_alpha_001'], ...capturedPutPayload, __v: 2 }),
          });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsData['lead_alpha_001']) });
      }

      if (url.includes('/leads')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ leads: Object.values(leadsData), total: 3, page: 1, limit: 20 }),
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.goto('/leads/lead_alpha_001');
    await expect(page.locator('text=Alpha Candidate').or(page.locator('input[value="Alpha Candidate"]'))).toBeVisible({ timeout: 10000 });

    // Look for edit trigger or quick status action
    const editBtn = page.locator('button:has-text("Edit Profile")').or(page.locator('button:has-text("Edit")')).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const saveBtn = page.locator('button:has-text("Save Changes")').or(page.locator('button:has-text("Save")')).first();
      await saveBtn.click();
      // Immediately navigate away to /leads
      await page.goto('/leads');
      await page.waitForTimeout(400);

      expect(capturedPutPayload).not.toBeNull();
      expect(capturedPutPayload.version).toBe(1);
    }
  });
});
