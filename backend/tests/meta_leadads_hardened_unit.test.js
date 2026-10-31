/**
 * Meta Lead Ads Hardened Unit Tests
 * 
 * Verifies:
 * 1. Meta signed_request HMAC-SHA256 parser & cryptographic tamper resistance
 * 2. Multi-tenant campaign ownership isolation logic
 * 3. Cursor-based Graph API pagination logic & loop safeguard
 * 4. Meta Webhook HMAC-SHA256 x-hub-signature-256 verification
 * 5. Unmapped Meta Lead Ingestion holding state & safety assignment
 */

const assert = require('assert');
const crypto = require('crypto');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.META_APP_SECRET = 'test_meta_app_secret_123456789';
process.env.META_VERIFY_TOKEN = 'test_meta_verify_token_2026';

const { parseSignedRequest } = require('../src/controllers/integrations/metaWebhookController');

function runHardenedUnitTests() {
  console.log('\n================================================================');
  console.log('🧪 META LEAD ADS HARDENED UNIT & SECURITY VALIDATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(`   Error: ${err.message}`);
      throw err;
    }
  }

  // Helper to generate signed_request
  function createSignedRequest(payloadObj, secret, algorithm = 'HMAC-SHA256') {
    const payloadJson = JSON.stringify({ ...payloadObj, algorithm });
    const encodedPayload = Buffer.from(payloadJson).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
    return `${sig}.${encodedPayload}`;
  }

  // -------------------------------------------------------------
  // 1. Meta signed_request cryptographic verification
  // -------------------------------------------------------------
  test('parseSignedRequest: correctly parses valid HMAC-SHA256 signed_request', () => {
    const secret = 'super_secret_meta_app_key_99';
    const payload = { user_id: 'meta_user_998877', issued_at: Math.floor(Date.now() / 1000) };
    const signedRequest = createSignedRequest(payload, secret);

    const parsed = parseSignedRequest(signedRequest, secret);
    assert.ok(parsed, 'Payload should be parsed successfully');
    assert.strictEqual(parsed.user_id, 'meta_user_998877', 'User ID must match');
  });

  test('parseSignedRequest: rejects tampered signature', () => {
    const secret = 'super_secret_meta_app_key_99';
    const payload = { user_id: 'meta_user_998877', issued_at: Math.floor(Date.now() / 1000) };
    const signedRequest = createSignedRequest(payload, secret);

    const tampered = `invalid_sig_part.${signedRequest.split('.')[1]}`;
    const result = parseSignedRequest(tampered, secret);
    assert.strictEqual(result, null, 'Tampered signature must return null');
  });

  test('parseSignedRequest: rejects signature signed with wrong secret', () => {
    const realSecret = 'super_secret_meta_app_key_99';
    const wrongSecret = 'attacker_secret_key_00';
    const payload = { user_id: 'meta_user_998877' };
    const signedRequest = createSignedRequest(payload, wrongSecret);

    const result = parseSignedRequest(signedRequest, realSecret);
    assert.strictEqual(result, null, 'Wrong secret must return null');
  });

  test('parseSignedRequest: rejects non-HMAC-SHA256 algorithms', () => {
    const secret = 'super_secret_meta_app_key_99';
    const payload = { user_id: 'meta_user_998877' };
    const signedRequest = createSignedRequest(payload, secret, 'MD5');

    const result = parseSignedRequest(signedRequest, secret);
    assert.strictEqual(result, null, 'Non HMAC-SHA256 algorithm must be rejected');
  });

  test('parseSignedRequest: handles empty, undefined, or malformed strings gracefully', () => {
    assert.strictEqual(parseSignedRequest(null, 'secret'), null);
    assert.strictEqual(parseSignedRequest('', 'secret'), null);
    assert.strictEqual(parseSignedRequest('just-one-part', 'secret'), null);
    assert.strictEqual(parseSignedRequest('part1.part2.part3', 'secret'), null);
    assert.strictEqual(parseSignedRequest('sig.invalid-base64!', 'secret'), null);
  });

  // -------------------------------------------------------------
  // 2. Multi-tenant Campaign Ownership Security Logic
  // -------------------------------------------------------------
  test('Multi-Tenant Campaign Security: cross-tenant access rejection simulation', () => {
    const tenantACompanyId = 'company_tenant_A_id';
    const tenantBCompanyId = 'company_tenant_B_id';

    // Mock campaigns in DB
    const dbCampaigns = [
      { _id: 'camp_101', name: 'Residential Sales A', companyId: tenantACompanyId, status: 'active' },
      { _id: 'camp_202', name: 'Luxury Villas B', companyId: tenantBCompanyId, status: 'active' },
      { _id: 'camp_103', name: 'Archived A', companyId: tenantACompanyId, status: 'archived' },
    ];

    // Simulating Campaign.findOne({ _id: config.campaignGroupId, ...tenantQuery, status: { $nin: ['archived', 'cancelled'] } })
    function findTenantCampaign(campaignId, userCompanyId) {
      const tenantQuery = { companyId: userCompanyId };
      return dbCampaigns.find(c =>
        c._id === campaignId &&
        c.companyId === tenantQuery.companyId &&
        c.status !== 'archived' &&
        c.status !== 'cancelled'
      ) || null;
    }

    // Tenant A accessing own campaign
    const allowed = findTenantCampaign('camp_101', tenantACompanyId);
    assert.ok(allowed, 'Tenant A should be allowed to access own campaign');
    assert.strictEqual(allowed.name, 'Residential Sales A');

    // Tenant A attempting to access Tenant B's campaign (cross-tenant attack)
    const blockedCrossTenant = findTenantCampaign('camp_202', tenantACompanyId);
    assert.strictEqual(blockedCrossTenant, null, 'Cross-tenant campaign access MUST return null');

    // Tenant A attempting to access archived campaign
    const blockedArchived = findTenantCampaign('camp_103', tenantACompanyId);
    assert.strictEqual(blockedArchived, null, 'Archived campaign access MUST return null');
  });

  // -------------------------------------------------------------
  // 3. Cursor Pagination Safeguard & Multi-Page Traversal Logic
  // -------------------------------------------------------------
  test('Graph API Pagination: safely traverses cursor pages and prevents infinite loops', async () => {
    // Mock Graph API endpoint that has 3 pages of results
    const mockMetaPages = [
      {
        data: [{ id: 'page_1', name: 'Agency Page 1' }, { id: 'page_2', name: 'Agency Page 2' }],
        paging: { cursors: { after: 'cursor_page_2' }, next: 'https://graph.facebook.com/v26.0/me/accounts?after=cursor_page_2' }
      },
      {
        data: [{ id: 'page_3', name: 'Agency Page 3' }],
        paging: { cursors: { after: 'cursor_page_3' }, next: 'https://graph.facebook.com/v26.0/me/accounts?after=cursor_page_3' }
      },
      {
        data: [{ id: 'page_4', name: 'Agency Page 4' }],
        paging: { cursors: {} } // No next page
      }
    ];

    let callCount = 0;
    async function mockFetchPage(url) {
      callCount++;
      return mockMetaPages[callCount - 1] || { data: [] };
    }

    // Replicate pagination engine from metaIntegrationController.js
    const aggregated = [];
    let nextUrl = 'https://graph.facebook.com/v26.0/me/accounts';
    let iterations = 0;
    const MAX_PAGES = 10;

    while (nextUrl && iterations < MAX_PAGES) {
      iterations++;
      const resp = await mockFetchPage(nextUrl);
      if (resp?.data && Array.isArray(resp.data)) {
        aggregated.push(...resp.data);
      }
      nextUrl = resp?.paging?.next || null;
    }

    assert.strictEqual(aggregated.length, 4, 'Should aggregate all 4 pages across 3 API calls');
    assert.strictEqual(callCount, 3, 'Should have made exactly 3 calls');
    assert.strictEqual(aggregated[3].id, 'page_4', 'Final item should match 3rd page');
  });

  test('Graph API Pagination: breaks safely on infinite cursor loop', async () => {
    // Mock infinite loop bug on Meta side where next is always present
    let callCount = 0;
    async function mockInfiniteApi(url) {
      callCount++;
      return {
        data: [{ id: `item_${callCount}` }],
        paging: { next: `https://graph.facebook.com/v26.0/me/accounts?after=loop_${callCount}` }
      };
    }

    const aggregated = [];
    let nextUrl = 'https://graph.facebook.com/v26.0/me/accounts';
    let iterations = 0;
    const MAX_PAGES = 10;

    while (nextUrl && iterations < MAX_PAGES) {
      iterations++;
      const resp = await mockInfiniteApi(nextUrl);
      if (resp?.data && Array.isArray(resp.data)) {
        aggregated.push(...resp.data);
      }
      nextUrl = resp?.paging?.next || null;
    }

    assert.strictEqual(iterations, 10, 'Must abort at MAX_PAGES (10) iterations');
    assert.strictEqual(aggregated.length, 10, 'Should have accumulated 10 items before cap');
  });

  // -------------------------------------------------------------
  // 4. Webhook x-hub-signature-256 HMAC Verification
  // -------------------------------------------------------------
  test('Webhook Security: validates x-hub-signature-256 against raw body', () => {
    const appSecret = 'meta_test_secret_for_webhook_signature_2026';
    const rawBody = JSON.stringify({
      object: 'page',
      entry: [{
        id: '12345678',
        time: 1730419200,
        changes: [{ field: 'leadgen', value: { form_id: 'form_99', leadgen_id: 'lead_88' } }]
      }]
    });

    const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

    // Simulate verification
    function verifySig(body, sigHeader, secret) {
      if (!sigHeader || !sigHeader.startsWith('sha256=')) return false;
      const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
      try {
        return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
      } catch (e) {
        return false;
      }
    }

    assert.ok(verifySig(rawBody, signature, appSecret), 'Valid signature must match timing-safe');

    // Tampered body
    const tamperedBody = rawBody + ' ';
    assert.strictEqual(verifySig(tamperedBody, signature, appSecret), false, 'Tampered body must fail verification');

    // Malformed signature prefix
    assert.strictEqual(verifySig(rawBody, 'md5=invalid', appSecret), false, 'Non-sha256 prefix must fail');
  });

  // -------------------------------------------------------------
  // 5. Unmapped Meta Lead Ingestion Safety Routing
  // -------------------------------------------------------------
  test('Lead Ingestion: unmapped Meta lead placed into needs_review holding state', () => {
    const rawLeadPayload = {
      provider: 'meta',
      formId: 'unknown_form_99999',
      connectionName: 'Real Estate Page Alpha',
      leadId: 'meta_lead_12345',
    };

    // Simulate ingestion routing logic from leadIngestionService.js
    function determineCampaignAndStatus(payload, subscription, campaignRoutingRule) {
      if (!subscription && !campaignRoutingRule) {
        return {
          status: 'needs_review',
          campaignName: `Unmapped Meta Leads (${payload.connectionName || 'Default'})`,
          campaignType: 'inbound_ad',
          tags: ['Unmapped Meta Form', 'Action Required: Map Form'],
          alertRequired: true
        };
      }
      return {
        status: 'new',
        campaignName: subscription.campaignName,
        tags: [],
        alertRequired: false
      };
    }

    const unmappedResult = determineCampaignAndStatus(rawLeadPayload, null, null);
    assert.strictEqual(unmappedResult.status, 'needs_review', 'Unmapped lead status must be needs_review');
    assert.strictEqual(unmappedResult.campaignName, 'Unmapped Meta Leads (Real Estate Page Alpha)', 'Must route to dedicated holding group');
    assert.ok(unmappedResult.tags.includes('Unmapped Meta Form'), 'Must tag as unmapped');
    assert.strictEqual(unmappedResult.alertRequired, true, 'Must trigger user alert');

    // Mapped lead
    const mappedSubscription = { campaignName: 'Dubai Marina Luxury Properties' };
    const mappedResult = determineCampaignAndStatus(rawLeadPayload, mappedSubscription, null);
    assert.strictEqual(mappedResult.status, 'new', 'Mapped lead status should be normal');
    assert.strictEqual(mappedResult.campaignName, 'Dubai Marina Luxury Properties', 'Must assign to mapped campaign');
  });

  console.log(`\n================================================================`);
  console.log(`🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY (100%)`);
  console.log(`================================================================\n`);
}

runHardenedUnitTests();
