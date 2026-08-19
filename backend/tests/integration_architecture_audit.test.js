/**
 * ============================================================================
 * COMPREHENSIVE PRODUCTION INTEGRATION ARCHITECTURE & SECURITY AUDIT TEST SUITE
 * Multi-Tenant CRM | Meta Lead Ads & Google Ads Integration Verification
 * ============================================================================
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const crypto = require('crypto');

// Models
const User = require('../src/models/User');
const Integration = require('../src/models/Integration');
const Lead = require('../src/models/Lead');

// Services & Utilities
const leadIngestionService = require('../src/services/integrations/leadIngestionService');
const { encrypt, decrypt } = require('../src/utils/encryption');
const { normalizePhone } = require('../src/utils/phoneNormalizer');

// Controllers
const metaOAuthController = require('../src/controllers/integrations/metaOAuthController');
const metaWebhookController = require('../src/controllers/integrations/metaWebhookController');
const googleWebhookController = require('../src/controllers/integrations/googleWebhookController');
const integrationController = require('../src/controllers/integrationController');

let mongoServer;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    testsFailed++;
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(message);
  } else {
    testsPassed++;
    console.log(`  ✅ [PASS] ${message}`);
  }
}

// Mock Response Helper
function createMockRes() {
  const res = {
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
  };
  return res;
}

async function setupDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm-test');
    console.log('📦 Test MongoDB Connected (Persistent Native Engine)');
  } catch {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('📦 Test In-Memory MongoDB Connected');
  }
}

async function teardownDB() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  console.log('📦 Test Database Teardown Complete');
}

async function runSuite() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING COMPLETE CRM INTEGRATION AUDIT & SECURITY SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Token Encryption & Decryption Security (AES-256-GCM)
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: Token Security & AES-256-GCM Encryption ---');
  {
    const secretToken = 'EAAGm0PX4ZCpsBAK...meta_long_lived_secret_access_token_2026';
    const encrypted = encrypt(secretToken);

    assert(encrypted !== secretToken, 'Encrypted token is not plaintext');
    assert(encrypted.split(':').length === 3, 'Encrypted token uses iv:authTag:cipher format');

    const decrypted = decrypt(encrypted);
    assert(decrypted === secretToken, 'Decrypted token matches original secret exactly');

    // Test tamper resistance
    let threwOnTamper = false;
    try {
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -4) + 'abcd'; // Tamper cipher bytes
      decrypt(parts.join(':'));
    } catch {
      threwOnTamper = true;
    }
    assert(threwOnTamper, 'Tampered ciphertext rejected by GCM authentication tag');
  }

  // --------------------------------------------------------------------------
  // SECTION 2: Field & Phone Number Normalization
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Field & Phone Normalization ---');
  {
    assert(normalizePhone('9876543210') === '919876543210', '10-digit Indian phone prepends 91');
    assert(normalizePhone('+91 9876543210') === '919876543210', 'Formatted +91 phone normalized');
    assert(normalizePhone('09876543210') === '919876543210', '11-digit leading 0 phone normalized');
    assert(normalizePhone('+1 (555) 234-5678') === '15552345678', 'International US phone preserved');

    assert(leadIngestionService.normalizeEmail('  TEST.LEAD@EXAMPLE.COM ') === 'test.lead@example.com', 'Email lowercased and trimmed');
    assert(leadIngestionService.cleanString('   Acme Realty Corp   ') === 'Acme Realty Corp', 'Strings cleaned of leading/trailing whitespace');
  }

  // --------------------------------------------------------------------------
  // SECTION 3: Multi-Tenant Test Data Provisioning
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Multi-Tenant Provisioning ---');
  let companyAOwner, companyBOwner, agentA;
  {
    const ts = Date.now();
    await User.deleteMany({ email: { $in: ['alice@companya.com', 'arthur@companya.com', 'bob@companyb.com'] } });
    
    companyAOwner = await User.create({
      name: 'Alice Owner (Company A)',
      email: `alice_${ts}@companya.com`,
      phone: `919999${String(ts).slice(-6)}`,
      password: 'HashedPassword@123',
      role: 'user',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });

    agentA = await User.create({
      name: 'Agent Arthur (Company A)',
      email: `arthur_${ts}@companya.com`,
      phone: `919998${String(ts).slice(-6)}`,
      password: 'HashedPassword@123',
      role: 'user',
      workStatus: 'employee',
      companyRole: 'agent',
      companyId: companyAOwner._id,
    });

    companyBOwner = await User.create({
      name: 'Bob Owner (Company B)',
      email: `bob_${ts}@companyb.com`,
      phone: `919997${String(ts).slice(-6)}`,
      password: 'HashedPassword@123',
      role: 'user',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });

    assert(!!companyAOwner._id && !!companyBOwner._id, 'Multi-tenant test accounts created');
  }

  // --------------------------------------------------------------------------
  // SECTION 4: Integration Model & Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Integration Model Lifecycle & Encryption ---');
  let integrationA, integrationB;
  {
    integrationA = await Integration.create({
      userId: companyAOwner._id,
      companyId: companyAOwner._id,
      provider: 'meta',
      mode: 'client_managed',
      status: 'connected',
      accountId: 'act_meta_companya_101',
      accountName: 'Company A Facebook Page',
      pageId: 'page_companya_5001',
      pageName: 'Company A Real Estate',
      formIds: ['form_leadgen_9001'],
      accessToken: 'EAAG_companyA_meta_token_secure',
      webhookSubscribed: true,
      connectedAt: new Date(),
    });

    assert(integrationA.status === 'connected', 'Integration A initialized with status: connected');
    assert(integrationA.isActive === true, 'Virtual isActive returns true for connected status');
    assert(integrationA.accessToken === 'EAAG_companyA_meta_token_secure', 'Virtual accessToken decrypts correctly');

    // Duplicate account under same company must be blocked by compound unique index
    let blockedDuplicate = false;
    try {
      await Integration.create({
        userId: companyAOwner._id,
        companyId: companyAOwner._id,
        provider: 'meta',
        accountId: 'act_meta_companya_101', // Same account!
      });
    } catch (err) {
      if (err.code === 11000) blockedDuplicate = true;
    }
    assert(blockedDuplicate, 'Compound index prevents duplicate integration for same company + provider + account');

    // Different company CAN connect their own account
    integrationB = await Integration.create({
      userId: companyBOwner._id,
      companyId: companyBOwner._id,
      provider: 'meta',
      mode: 'client_managed',
      status: 'connected',
      accountId: 'act_meta_companyb_202',
      accountName: 'Company B FB Ads',
      pageId: 'page_companyb_5002',
      pageName: 'Company B Real Estate',
      accessToken: 'EAAG_companyB_meta_token_secure',
      connectedAt: new Date(),
    });

    assert(!!integrationB._id, 'Company B successfully connected separate Meta account');
  }

  // --------------------------------------------------------------------------
  // SECTION 5: Multi-Tenant Security & IDOR Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Multi-Tenant Isolation & IDOR Auditing ---');
  {
    // 1. Company A fetches their integrations
    const reqA = { user: companyAOwner };
    const resA = createMockRes();
    await integrationController.getIntegrations(reqA, resA);
    assert(resA.body.integrations.length === 1, 'Company A only receives their 1 integration');
    assert(resA.body.integrations[0].accountId === 'act_meta_companya_101', 'Company A receives their own account');

    // 2. Company B attempts IDOR attack on Company A's integration ID
    const reqBAttack = { user: companyBOwner, params: { id: String(integrationA._id) } };
    const resBAttack = createMockRes();
    await integrationController.getIntegration(reqBAttack, resBAttack);
    assert(resBAttack.statusCode === 404, 'Cross-tenant IDOR read blocked with 404');

    // 3. Company B attempts IDOR disconnect on Company A's integration ID
    const resBDisconnectAttack = createMockRes();
    await integrationController.disconnectIntegration(reqBAttack, resBDisconnectAttack);
    assert(resBDisconnectAttack.statusCode === 404, 'Cross-tenant IDOR disconnect blocked with 404');

    // 4. Verify Integration A was not modified
    const intACheck = await Integration.findById(integrationA._id);
    assert(intACheck.status === 'connected', 'Integration A remains connected after attacker attempts');
  }

  // --------------------------------------------------------------------------
  // SECTION 6: Webhook Verification & Security (Meta & Google)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Webhook Verification & Forged Event Rejection ---');
  {
    // Meta verification challenge
    const metaReqValid = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': process.env.META_WEBHOOK_VERIFY_TOKEN || 'crm_meta_webhook_secret_2026',
        'hub.challenge': 'CHALLENGE_STRING_778899',
      },
    };
    const metaResValid = createMockRes();
    await metaWebhookController.verify(metaReqValid, metaResValid);
    assert(metaResValid.body === 'CHALLENGE_STRING_778899', 'Meta GET webhook verified with challenge echo');

    // Meta invalid token rejected
    const metaReqInvalid = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_secret_attacker',
        'hub.challenge': 'CHALLENGE_STRING_778899',
      },
    };
    const metaResInvalid = createMockRes();
    await metaWebhookController.verify(metaReqInvalid, metaResInvalid);
    assert(metaResInvalid.statusCode === 403, 'Meta GET webhook rejected with 403 on invalid verify token');

    // Google webhook invalid secret rejected
    const googleReqInvalid = {
      headers: { 'x-google-webhook-secret': 'wrong_google_secret' },
      body: { google_key: 'wrong_key' },
    };
    const googleResInvalid = createMockRes();
    await googleWebhookController.receive(googleReqInvalid, googleResInvalid);
    assert(googleResInvalid.statusCode === 401, 'Forged Google webhook rejected with 401 Unauthorized');
  }

  // --------------------------------------------------------------------------
  // SECTION 7: Inbound Lead Ingestion & Attribution Integrity (Meta & Google)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Inbound Lead Ingestion & Attribution Integrity ---');
  let leadMetaA, leadGoogleA;
  {
    // Meta Lead Ingestion
    const metaIngestResult = await leadIngestionService.ingest({
      provider: 'meta',
      integrationId: integrationA._id,
      externalLeadId: 'leadgen_meta_test_881122',
      pageId: 'page_companya_5001',
      formId: 'form_leadgen_9001',
      formName: '2BHK Luxury Villa Form',
      campaignId: 'camp_meta_1001',
      campaignName: 'Summer Real Estate Expo 2026',
      adSetId: 'adset_meta_2001',
      adSetName: 'High Net Worth Investors',
      adId: 'ad_meta_3001',
      adName: 'Villa Walkthrough Video',
      name: 'Rohan Sharma',
      phone: '+91 98765 43210',
      email: 'rohan.sharma@investor.com',
      customData: { preferred_location: 'Goa', budget: '₹1.5 Cr' },
    });

    assert(metaIngestResult.created === true, 'Meta Lead created successfully');
    leadMetaA = metaIngestResult.lead;

    assert(leadMetaA.companyId.toString() === companyAOwner._id.toString(), 'Lead correctly attributed to Company A');
    assert(leadMetaA.source === 'meta', 'Lead source set to meta');
    assert(leadMetaA.phone === '919876543210', 'Lead phone normalized to 919876543210');
    assert(leadMetaA.leadSource.campaignName === 'Summer Real Estate Expo 2026', 'Campaign name attribution preserved');
    assert(leadMetaA.leadSource.formName === '2BHK Luxury Villa Form', 'Form name attribution preserved');
    assert(leadMetaA.leadActivities.length > 0, 'Lead activity audit trail initialized');
    assert(leadMetaA.leadActivities[0].action === 'lead_created', 'lead_created audit activity recorded');

    // Google Lead Ingestion
    const googleIntegrationA = await Integration.create({
      userId: companyAOwner._id,
      companyId: companyAOwner._id,
      provider: 'google',
      mode: 'client_managed',
      status: 'connected',
      accountId: '9876543210',
      customerId: '9876543210',
      accountName: 'Company A Google Search Ads',
      accessToken: 'ya29.google_access_token_secure',
      connectedAt: new Date(),
    });

    const googleIngestResult = await leadIngestionService.ingest({
      provider: 'google',
      integrationId: googleIntegrationA._id,
      externalLeadId: 'google_lead_ext_993344',
      accountId: '9876543210',
      campaignId: 'camp_google_501',
      campaignName: 'Search Brand Commercial Property',
      adGroupId: 'adgroup_google_601',
      adGroupName: 'Office Spaces Mumbai',
      formName: 'Quick Inquiry Extension',
      name: 'Pooja Verma',
      phone: '09812345678',
      email: 'pooja.verma@corp.in',
    });

    assert(googleIngestResult.created === true, 'Google Lead created successfully');
    leadGoogleA = googleIngestResult.lead;
    assert(leadGoogleA.source === 'google', 'Google lead source set to google');
    assert(leadGoogleA.leadSource.adGroupName === 'Office Spaces Mumbai', 'Google Ad Group attribution preserved');
  }

  // --------------------------------------------------------------------------
  // SECTION 8: Duplicate Prevention & Webhook Retry Idempotency
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Webhook Idempotency & Deduplication ---');
  {
    // Simulate webhook retry for exact same externalLeadId
    const retryResult = await leadIngestionService.ingest({
      provider: 'meta',
      integrationId: integrationA._id,
      externalLeadId: 'leadgen_meta_test_881122', // Same ID as before!
      name: 'Rohan Sharma',
      phone: '919876543210',
      email: 'rohan.sharma@investor.com',
      campaignName: 'Summer Real Estate Expo 2026',
    });

    assert(retryResult.created === false, 'Duplicate webhook retry does not create new lead');
    assert(retryResult.duplicate === true, 'Webhook retry flagged as duplicate');
    assert(retryResult.lead._id.toString() === leadMetaA._id.toString(), 'Returns original lead document');

    const totalLeadsForTenant = await Lead.countDocuments({ companyId: companyAOwner._id });
    assert(totalLeadsForTenant === 2, 'Total leads remains exactly 2 (no duplicates created)');
  }

  // --------------------------------------------------------------------------
  // SECTION 9: Concurrency & Race Condition Testing
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 9: Concurrency & High-Parallelism Webhook Ingestion ---');
  {
    const concurrentExternalLeadId = `concurrent_meta_lead_${Date.now()}`;
    const concurrentPayload = {
      provider: 'meta',
      integrationId: integrationA._id,
      externalLeadId: concurrentExternalLeadId,
      name: 'Vikram Malhotra (Concurrent Test)',
      phone: '919800011122',
      email: 'vikram@malhotra.org',
      campaignName: 'Flash Launch Event',
    };

    // Fire 10 simultaneous webhook ingestion requests in parallel
    const promises = Array.from({ length: 10 }).map(() =>
      leadIngestionService.ingest({ ...concurrentPayload })
    );

    const results = await Promise.all(promises);

    const createdCount = results.filter((r) => r.created === true).length;
    const duplicateCount = results.filter((r) => r.duplicate === true).length;

    assert(createdCount === 1, 'Exactly ONE lead created across 10 concurrent webhook executions');
    assert(duplicateCount === 9, 'Remaining 9 concurrent requests cleanly resolved as duplicate without crash');

    const leadCountInDB = await Lead.countDocuments({
      companyId: companyAOwner._id,
      'leadSource.externalLeadId': concurrentExternalLeadId,
    });
    assert(leadCountInDB === 1, 'MongoDB database state contains exactly ONE document');
  }

  // --------------------------------------------------------------------------
  // SECTION 10: Disconnect & Reconnect Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 10: Disconnect & Reconnect Lifecycle ---');
  {
    // Disconnect
    const reqDisconnect = { user: companyAOwner, params: { id: String(integrationA._id) } };
    const resDisconnect = createMockRes();
    await integrationController.disconnectIntegration(reqDisconnect, resDisconnect);

    assert(resDisconnect.body.success === true, 'Integration disconnect succeeded');

    const updatedInt = await Integration.findById(integrationA._id).select('+accessTokenEncrypted');
    assert(updatedInt.status === 'disconnected', 'Status transitioned to disconnected');
    assert(!updatedInt.accessTokenEncrypted, 'Encrypted access tokens wiped on disconnect');

    // Leads and attribution must be safely preserved
    const preservedLead = await Lead.findById(leadMetaA._id);
    assert(!!preservedLead, 'Existing leads remain intact after integration disconnect');
    assert(preservedLead.leadSource.provider === 'meta', 'Lead attribution preserved after disconnect');
  }

  // --------------------------------------------------------------------------
  // SECTION 11: OAuth State CSRF & Signature Tamper Resistance
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 11: OAuth State CSRF & Signature Validation ---');
  {
    // Mock req for startOAuth
    const startReq = {
      user: companyAOwner,
      query: { json: 'true' },
      headers: { accept: 'application/json' },
    };
    const startRes = createMockRes();
    await metaOAuthController.startOAuth(startReq, startRes);

    assert(startRes.body.success === true, 'OAuth start returned authorization URL');
    const authUrl = new URL(startRes.body.authorizationUrl);
    const stateParam = authUrl.searchParams.get('state');
    assert(!!stateParam, 'OAuth state parameter generated');
    assert(stateParam.includes('.'), 'OAuth state contains data.signature token format');

    // Test forged callback state
    const [dataStr, sig] = stateParam.split('.');
    const forgedState = `${dataStr}.invalid_forged_signature_12345`;
    const callbackReqForged = {
      query: { code: 'valid_code', state: forgedState },
    };
    const callbackResForged = createMockRes();
    await metaOAuthController.callback(callbackReqForged, callbackResForged);
    assert(callbackResForged.statusCode === 400, 'Tampered OAuth state signature rejected with 400');
    assert(callbackResForged.body.code === 'INVALID_OAUTH_STATE', 'INVALID_OAUTH_STATE error code returned');
  }

  // --------------------------------------------------------------------------
  // SECTION 12: High-Volume Performance Benchmark & Index Lookup
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 12: High-Volume Batch Simulation & Query Benchmark ---');
  {
    const BATCH_SIZE = 100;
    const startTime = Date.now();

    // Re-connect integration for batch ingestion
    await Integration.findByIdAndUpdate(integrationA._id, {
      status: 'connected',
      accessToken: 'EAAG_reconnected_token',
    });

    const batchLeads = Array.from({ length: BATCH_SIZE }).map((_, i) => ({
      provider: 'meta',
      integrationId: integrationA._id,
      externalLeadId: `perf_lead_ext_${Date.now()}_${i}`,
      name: `Performance Lead ${i}`,
      phone: `91970000${String(i).padStart(4, '0')}`,
      email: `perf${i}@batch-test.com`,
      campaignName: 'Mega Scale Campaign',
      formName: 'High Volume Form',
    }));

    for (const leadData of batchLeads) {
      await leadIngestionService.ingest(leadData);
    }

    const elapsedMs = Date.now() - startTime;
    const totalCount = await Lead.countDocuments({ companyId: companyAOwner._id });

    assert(totalCount >= BATCH_SIZE + 2, `Successfully ingested batch of ${BATCH_SIZE} leads into database`);
    console.log(`    ⚡ Ingestion throughput: ${(BATCH_SIZE / (elapsedMs / 1000)).toFixed(1)} leads/sec (${elapsedMs}ms total)`);

    // Indexed search test
    const searchStart = Date.now();
    const foundLeads = await Lead.find({
      companyId: companyAOwner._id,
      source: 'meta',
    }).limit(50).lean();
    const searchElapsed = Date.now() - searchStart;

    assert(foundLeads.length === 50, 'Indexed query returned 50 leads instantly');
    assert(searchElapsed < 50, `Indexed query completed in ${searchElapsed}ms (< 50ms)`);
  }

  console.log('\n================================================================');
  console.log(`🏁 AUDIT SUITE FINISHED: ${testsPassed} PASSED | ${testsFailed} FAILED`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    throw new Error(`${testsFailed} tests failed in integration architecture audit.`);
  }
}

async function run() {
  try {
    await setupDB();
    await runSuite();
    await teardownDB();
    process.exit(0);
  } catch (error) {
    console.error('Fatal Test Suite Failure:', error);
    if (mongoServer) await mongoServer.stop();
    process.exit(1);
  }
}

run();
