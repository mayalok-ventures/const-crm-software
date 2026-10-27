const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Integration = require('../src/models/Integration');
const Campaign = require('../src/models/Campaign');
const Lead = require('../src/models/Lead');
const LeadSourceSubscription = require('../src/models/LeadSourceSubscription');
const leadIngestionService = require('../src/services/integrations/leadIngestionService');
const subscriptionRoutingController = require('../src/controllers/integrations/subscriptionRoutingController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function runSelfServiceSuite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING SELF-SERVICE LEAD INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const timestamp = Date.now();
  let passedCount = 0;
  function pass(msg) {
    passedCount++;
    console.log(`  ✅ [PASS] ${msg}`);
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Create Two Separate Tenants (Company A and Company B)
    // -------------------------------------------------------------
    console.log('--- 1. Provisioning Multi-Tenant Entities ---');

    const pSuffix = String(timestamp).slice(-8);
    const companyA = await User.create({
      name: `RealEstate Corp ${timestamp}`,
      email: `ownerA_${timestamp}@realestate.com`,
      password: 'HashPassword123!',
      role: 'admin',
      companyRole: 'owner',
      workStatus: 'company_owner',
      phone: `9191${pSuffix}`,
    });

    const counselorA1 = await User.create({
      name: `Agent Rajesh ${timestamp}`,
      email: `rajesh_${timestamp}@realestate.com`,
      password: 'HashPassword123!',
      role: 'counselor',
      companyId: companyA._id,
      phone: `9192${pSuffix}`,
    });

    const counselorA2 = await User.create({
      name: `Agent Sunita ${timestamp}`,
      email: `sunita_${timestamp}@realestate.com`,
      password: 'HashPassword123!',
      role: 'counselor',
      companyId: companyA._id,
      phone: `9193${pSuffix}`,
    });

    const companyB = await User.create({
      name: `Competitor Ltd ${timestamp}`,
      email: `ownerB_${timestamp}@competitor.com`,
      password: 'HashPassword123!',
      role: 'admin',
      companyRole: 'owner',
      workStatus: 'company_owner',
      phone: `9194${pSuffix}`,
    });

    pass('Multi-tenant test accounts created (Company A & Company B)');

    // -------------------------------------------------------------
    // SETUP: Create Campaign Groups for Company A
    // -------------------------------------------------------------
    console.log('\n--- 2. Setting Up Destination Campaign Groups ---');

    // Group 1: Property Buyers Group (Round Robin between Rajesh & Sunita)
    const buyersGroup = await Campaign.create({
      companyId: companyA._id,
      userId: companyA._id,
      name: `Property Buyers Group ${timestamp}`,
      campaignName: `Property Buyers Group ${timestamp}`,
      platform: 'all',
      campaignType: 'inbound_ad',
      status: 'active',
      assignmentRule: {
        type: 'round_robin',
        counselorPool: [
          { userId: counselorA1._id, weight: 1 },
          { userId: counselorA2._id, weight: 1 },
        ],
      },
    });

    // Group 2: Seller Enquiries Group (Direct to Sunita)
    const sellersGroup = await Campaign.create({
      companyId: companyA._id,
      userId: companyA._id,
      name: `Seller Enquiries Group ${timestamp}`,
      campaignName: `Seller Enquiries Group ${timestamp}`,
      platform: 'all',
      campaignType: 'inbound_ad',
      status: 'active',
      assignmentRule: {
        type: 'specific_counselor',
        specificCounselorId: counselorA2._id,
      },
    });

    // Group 3: Rental Leads Group (Direct to Rajesh)
    const rentalGroup = await Campaign.create({
      companyId: companyA._id,
      userId: companyA._id,
      name: `Rental Leads Group ${timestamp}`,
      campaignName: `Rental Leads Group ${timestamp}`,
      platform: 'all',
      campaignType: 'inbound_ad',
      status: 'active',
      assignmentRule: {
        type: 'specific_counselor',
        specificCounselorId: counselorA1._id,
      },
    });

    // Competitor Company B Campaign Group
    const competitorGroup = await Campaign.create({
      companyId: companyB._id,
      userId: companyB._id,
      name: `Competitor Secret Group ${timestamp}`,
      campaignName: `Competitor Secret Group ${timestamp}`,
      platform: 'all',
      campaignType: 'inbound_ad',
      status: 'active',
    });

    pass('Created 3 destination Campaign Groups for Company A and 1 for Company B');

    // -------------------------------------------------------------
    // SETUP: Connect Single Meta Integration & Google Integration
    // -------------------------------------------------------------
    console.log('\n--- 3. Connecting Integrations ---');

    const metaIntegrationA = await Integration.create({
      companyId: companyA._id,
      userId: companyA._id,
      provider: 'meta',
      accountId: `page_realestate_${timestamp}`,
      accountName: 'RealEstate Official Page',
      pageId: `page_realestate_${timestamp}`,
      pageName: 'RealEstate Official Page',
      status: 'connected',
      accessToken: 'EAAB_test_mock_meta_token',
    });

    const googleIntegrationA = await Integration.create({
      companyId: companyA._id,
      userId: companyA._id,
      provider: 'google',
      accountId: `google_acc_${timestamp}`,
      accountName: 'RealEstate Google Ads',
      status: 'connected',
    });

    pass('Created Meta Connection and Google Ads Connection for Company A');

    // -------------------------------------------------------------
    // TEST 4: Configure Multi-Form Subscriptions
    // -------------------------------------------------------------
    console.log('\n--- 4. Self-Service Source Subscription Linking ---');

    // Mock Express Request/Response for Controller Testing
    function mockReq(user, body = {}, params = {}, query = {}) {
      return { user, body, params, query, headers: {} };
    }
    function mockRes() {
      const res = {};
      res.statusCode = 200;
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.data = data; return res; };
      return res;
    }

    // Subscription 1: Meta Buyers Form -> Property Buyers Group
    const reqSub1 = mockReq(companyA, {
      integrationId: metaIntegrationA._id,
      provider: 'meta',
      sourceName: 'Meta Property Buyers Form',
      externalFormId: `meta_form_buyers_${timestamp}`,
      externalFormName: 'FB Buyer Lead Gen 2026',
      campaignGroupId: buyersGroup._id,
      fieldMapping: [
        { sourceField: 'full_name', crmField: 'name' },
        { sourceField: 'phone_number', crmField: 'phone' },
        { sourceField: 'email', crmField: 'email' },
      ],
      assignmentRule: { type: 'inherit_campaign' },
    });
    const resSub1 = mockRes();
    await subscriptionRoutingController.createSubscription(reqSub1, resSub1);
    assert.strictEqual(resSub1.statusCode, 201, 'Subscription 1 creation should succeed');
    const sub1 = resSub1.data.subscription;
    pass('Created Subscription 1: Meta Buyers Form -> Property Buyers Group');

    // Subscription 2: Meta Sellers Form -> Seller Enquiries Group
    const reqSub2 = mockReq(companyA, {
      integrationId: metaIntegrationA._id,
      provider: 'meta',
      sourceName: 'Meta Property Sellers Form',
      externalFormId: `meta_form_sellers_${timestamp}`,
      externalFormName: 'FB Seller Valuation Form',
      campaignGroupId: sellersGroup._id,
      fieldMapping: [
        { sourceField: 'full_name', crmField: 'name' },
        { sourceField: 'phone_number', crmField: 'phone' },
      ],
      assignmentRule: { type: 'inherit_campaign' },
    });
    const resSub2 = mockRes();
    await subscriptionRoutingController.createSubscription(reqSub2, resSub2);
    assert.strictEqual(resSub2.statusCode, 201, 'Subscription 2 creation should succeed');
    const sub2 = resSub2.data.subscription;
    pass('Created Subscription 2: Meta Sellers Form -> Seller Enquiries Group');

    // Subscription 3: Meta Rental Form -> Rental Leads Group
    const reqSub3 = mockReq(companyA, {
      integrationId: metaIntegrationA._id,
      provider: 'meta',
      sourceName: 'Meta Rental Form',
      externalFormId: `meta_form_rental_${timestamp}`,
      externalFormName: 'FB Rental Inquiries Form',
      campaignGroupId: rentalGroup._id,
      fieldMapping: [
        { sourceField: 'full_name', crmField: 'name' },
        { sourceField: 'phone_number', crmField: 'phone' },
      ],
      assignmentRule: { type: 'inherit_campaign' },
    });
    const resSub3 = mockRes();
    await subscriptionRoutingController.createSubscription(reqSub3, resSub3);
    assert.strictEqual(resSub3.statusCode, 201, 'Subscription 3 creation should succeed');
    pass('Created Subscription 3: Meta Rental Form -> Rental Leads Group');

    // Subscription 4: Google Ads Form -> ALSO into Property Buyers Group! (Multi-provider to same group)
    const reqSub4 = mockReq(companyA, {
      integrationId: googleIntegrationA._id,
      provider: 'google',
      sourceName: 'Google Search Buyers Lead Form',
      externalAccountId: `google_acc_${timestamp}`,
      externalFormId: `google_form_buyers_${timestamp}`,
      externalFormName: 'Search Ad Extension Form',
      campaignGroupId: buyersGroup._id,
      fieldMapping: [
        { sourceField: 'FULL_NAME', crmField: 'name' },
        { sourceField: 'PHONE_NUMBER', crmField: 'phone' },
      ],
      assignmentRule: { type: 'inherit_campaign' },
    });
    const resSub4 = mockRes();
    await subscriptionRoutingController.createSubscription(reqSub4, resSub4);
    assert.strictEqual(resSub4.statusCode, 201, 'Subscription 4 creation should succeed');
    pass('Created Subscription 4: Google Ads Form -> ALSO routes into Property Buyers Group');

    // -------------------------------------------------------------
    // TEST 5: Cross-Tenant IDOR Protection
    // -------------------------------------------------------------
    console.log('\n--- 5. Cross-Tenant IDOR and Unauthorized Access Tests ---');

    // Attempt 1: Competitor B tries to link Company A's Campaign Group
    const reqIdor1 = mockReq(companyB, {
      integrationId: metaIntegrationA._id,
      provider: 'meta',
      sourceName: 'Malicious Hijack Form',
      externalFormId: `hijack_form_${timestamp}`,
      campaignGroupId: buyersGroup._id,
    });
    const resIdor1 = mockRes();
    await subscriptionRoutingController.createSubscription(reqIdor1, resIdor1);
    assert.strictEqual(resIdor1.statusCode, 404, 'Cross-tenant integration reference must be blocked with 404');
    pass('Blocked cross-tenant integration reference with 404');

    // Attempt 2: Competitor B tries to read Company A's subscription
    const reqIdor2 = mockReq(companyB, {}, { id: sub1._id });
    const resIdor2 = mockRes();
    await subscriptionRoutingController.getSubscription(reqIdor2, resIdor2);
    assert.strictEqual(resIdor2.statusCode, 404, 'Cross-tenant subscription read must be blocked with 404');
    pass('Blocked cross-tenant subscription read with 404');

    // Attempt 3: Cross-tenant campaign read via campaignController.getCampaign
    const campaignController = require('../src/controllers/campaignController');
    const reqIdor3 = mockReq(companyB, {}, { id: buyersGroup._id });
    const resIdor3 = mockRes();
    await campaignController.getCampaign(reqIdor3, resIdor3);
    assert.strictEqual(resIdor3.statusCode, 404, 'Cross-tenant campaign read must be blocked with 404');
    pass('Blocked cross-tenant campaign read (IDOR fixed)');

    // -------------------------------------------------------------
    // TEST 6: Ingest Leads & Verify Accurate Multi-Form Routing
    // -------------------------------------------------------------
    console.log('\n--- 6. Ingesting Leads & Validating Multi-Form Multi-Group Routing ---');

    // Lead A: From Meta Buyers Form (`meta_form_buyers_${timestamp}`)
    const resA = await leadIngestionService.ingest({
      integrationId: metaIntegrationA._id,
      platform: 'meta',
      externalLeadId: `lead_meta_buyer_${timestamp}`,
      formId: `meta_form_buyers_${timestamp}`,
      formName: 'FB Buyer Lead Gen 2026',
      name: 'Rohan Sharma',
      phone: '9876500001',
      email: 'rohan@sharma.com',
    });
    const leadA = resA.lead;
    assert.strictEqual(String(leadA.campaignId), String(buyersGroup._id), 'Lead A must route to Property Buyers Group');
    pass('Lead A from Meta Buyers Form routed accurately to Property Buyers Group');

    // Lead B: From Meta Sellers Form (`meta_form_sellers_${timestamp}`)
    const resB = await leadIngestionService.ingest({
      integrationId: metaIntegrationA._id,
      platform: 'meta',
      externalLeadId: `lead_meta_seller_${timestamp}`,
      formId: `meta_form_sellers_${timestamp}`,
      formName: 'FB Seller Valuation Form',
      name: 'Ananya Verma',
      phone: '9876500002',
      email: 'ananya@verma.com',
    });
    const leadB = resB.lead;
    assert.strictEqual(String(leadB.campaignId), String(sellersGroup._id), 'Lead B must route to Seller Enquiries Group');
    assert.strictEqual(String(leadB.assignedTo), String(counselorA2._id), 'Lead B must be assigned to Counselor Sunita');
    pass('Lead B from Meta Sellers Form routed accurately to Seller Enquiries Group & Counselor Sunita');

    // Lead C: From Meta Rental Form (`meta_form_rental_${timestamp}`)
    const resC = await leadIngestionService.ingest({
      integrationId: metaIntegrationA._id,
      platform: 'meta',
      externalLeadId: `lead_meta_rental_${timestamp}`,
      formId: `meta_form_rental_${timestamp}`,
      formName: 'FB Rental Inquiries Form',
      name: 'Karan Mehra',
      phone: '9876500003',
      email: 'karan@mehra.com',
    });
    const leadC = resC.lead;
    assert.strictEqual(String(leadC.campaignId), String(rentalGroup._id), 'Lead C must route to Rental Leads Group');
    assert.strictEqual(String(leadC.assignedTo), String(counselorA1._id), 'Lead C must be assigned to Counselor Rajesh');
    pass('Lead C from Meta Rental Form routed accurately to Rental Leads Group & Counselor Rajesh');

    // Lead D: From Google Ads Form (`google_form_buyers_${timestamp}`) -> Property Buyers Group
    const resD = await leadIngestionService.ingest({
      integrationId: googleIntegrationA._id,
      platform: 'google',
      externalLeadId: `lead_google_buyer_${timestamp}`,
      formId: `google_form_buyers_${timestamp}`,
      accountId: `google_acc_${timestamp}`,
      name: 'Deepak Gupta',
      phone: '9876500004',
      email: 'deepak@gupta.com',
    });
    const leadD = resD.lead;
    assert.strictEqual(String(leadD.campaignId), String(buyersGroup._id), 'Google Lead must ALSO route to Property Buyers Group');
    pass('Lead D from Google Ads routed to the SAME Property Buyers Group as Meta Buyers Form');

    // -------------------------------------------------------------
    // TEST 7: Deduplication & Subscription Health Metrics
    // -------------------------------------------------------------
    console.log('\n--- 7. Deduplication & Subscription Metrics Verification ---');

    // Resend Lead A (idempotency check)
    const resDup = await leadIngestionService.ingest({
      integrationId: metaIntegrationA._id,
      platform: 'meta',
      externalLeadId: `lead_meta_buyer_${timestamp}`,
      formId: `meta_form_buyers_${timestamp}`,
      name: 'Rohan Sharma',
      phone: '9876500001',
    });
    const duplicateLead = resDup.lead;
    assert.strictEqual(String(duplicateLead._id), String(leadA._id), 'Duplicate lead must return existing document');
    pass('Duplicate webhook delivery gracefully resolved to existing lead without duplicate creation');

    // Verify Subscription 1 Health and Lead Count
    const updatedSub1 = await LeadSourceSubscription.findById(sub1._id);
    assert.strictEqual(updatedSub1.healthStatus, 'healthy', 'Subscription health status should be healthy');
    assert.ok(updatedSub1.totalLeadsCount >= 1, 'Subscription lead counter should be incremented');
    assert.ok(updatedSub1.lastLeadAt instanceof Date, 'Subscription lastLeadAt should be updated');
    pass(`Subscription 1 metrics confirmed: ${updatedSub1.totalLeadsCount} leads processed, health: ${updatedSub1.healthStatus}`);

    // -------------------------------------------------------------
    // TEST 8: Subscription Status Toggle (Active / Paused)
    // -------------------------------------------------------------
    console.log('\n--- 8. Subscription Lifecycle Toggle ---');

    const reqToggle = mockReq(companyA, {}, { id: sub1._id });
    const resToggle = mockRes();
    await subscriptionRoutingController.toggleSubscription(reqToggle, resToggle);
    assert.strictEqual(resToggle.statusCode, 200, 'Toggle request should succeed');
    assert.strictEqual(resToggle.data.status, 'paused', 'Status should toggle to paused');
    pass('Subscription status successfully toggled to paused');

    // Re-toggle back to active
    await subscriptionRoutingController.toggleSubscription(reqToggle, mockRes());
    const resumedSub = await LeadSourceSubscription.findById(sub1._id);
    assert.strictEqual(resumedSub.status, 'active', 'Status should toggle back to active');
    pass('Subscription status successfully toggled back to active');

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    await Lead.deleteMany({ companyId: companyA._id });
    await LeadSourceSubscription.deleteMany({ companyId: companyA._id });
    await Campaign.deleteMany({ companyId: { $in: [companyA._id, companyB._id] } });
    await Integration.deleteMany({ companyId: { $in: [companyA._id, companyB._id] } });
    await User.deleteMany({ _id: { $in: [companyA._id, companyB._id, counselorA1._id, counselorA2._id] } });

    console.log('\n======================================================');
    console.log(`🎉 ALL ${passedCount} SELF-SERVICE INTEGRATION TESTS PASSED!`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

runSelfServiceSuite();
