const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Campaign = require('../src/models/Campaign');
const Lead = require('../src/models/Lead');
const Integration = require('../src/models/Integration');
const leadIngestionService = require('../src/services/integrations/leadIngestionService');
const inbound = require('../src/controllers/inboundCampaignController');

const connectDB = require('../src/config/db');

async function runTestSuite() {
  console.log('🧪 Starting Campaign Inbound Routing & Authoritative Lead Assignment Test Suite...\n');

  await connectDB();
  console.log('  ✔ Connected to MongoDB');

  // 1. Setup Test Tenant & Counselors
  const testSuffix = Date.now();
  const owner = await User.create({
    name: `CEO Owner ${testSuffix}`,
    email: `owner_${testSuffix}@campaign-test.com`,
    password: 'Password123!',
    role: 'owner',
    companyRole: 'owner',
    isActive: true,
  });
  owner.companyId = owner._id;
  await owner.save();

  const counselor1 = await User.create({
    name: `Counselor Priya ${testSuffix}`,
    email: `priya_${testSuffix}@campaign-test.com`,
    password: 'Password123!',
    role: 'counsellor',
    companyId: owner._id,
    isActive: true,
  });

  const counselor2 = await User.create({
    name: `Counselor Vikram ${testSuffix}`,
    email: `vikram_${testSuffix}@campaign-test.com`,
    password: 'Password123!',
    role: 'counsellor',
    companyId: owner._id,
    isActive: true,
  });

  const counselor3 = await User.create({
    name: `Counselor Neha ${testSuffix}`,
    email: `neha_${testSuffix}@campaign-test.com`,
    password: 'Password123!',
    role: 'counsellor',
    companyId: owner._id,
    isActive: true,
  });

  console.log('  ✔ Created Test Tenant Owner and 3 Counselors');

  // 2. Setup Meta and Google Integrations
  const metaInteg = await Integration.create({
    userId: owner._id,
    companyId: owner._id,
    provider: 'meta',
    status: 'connected',
    pageId: `page_${testSuffix}`,
    pageName: 'Apex Institute Official',
    formIds: [`meta_form_x_${testSuffix}`],
    formNames: ['X form'],
  });

  const googleInteg = await Integration.create({
    userId: owner._id,
    companyId: owner._id,
    provider: 'google',
    status: 'connected',
    customerId: `g_act_${testSuffix}`,
    accountName: 'Google Ads Main Search',
  });

  console.log('  ✔ Created Meta and Google Integrations');

  // 3. Create Campaign "X" (Routing Meta Form "X form" -> Round Robin Counselors 1 & 2)
  const reqCreateX = {
    user: owner,
    body: {
      name: `Campaign X ${testSuffix}`,
      description: 'Engineering Inbound Meta Lead Gen',
      platform: 'meta',
      routingRules: {
        metaFormIds: [`meta_form_x_${testSuffix}`],
        metaFormNames: ['X form'],
      },
      assignmentRule: {
        type: 'round_robin',
        counselorPool: [
          { userId: counselor1._id, weight: 1 },
          { userId: counselor2._id, weight: 1 },
        ],
        fallbackUserId: owner._id,
      },
      budget: 50000,
      status: 'active',
    },
  };

  let resDataX = null;
  const mockResX = {
    status: (code) => ({
      json: (data) => {
        resDataX = data;
        return data;
      },
    }),
    json: (data) => {
      resDataX = data;
      return data;
    },
  };

  await inbound.createInboundCampaign(reqCreateX, mockResX);
  assert(resDataX && resDataX.success, 'Campaign X should be created successfully');
  const campaignX = resDataX.campaign;
  console.log(`  ✔ Created Campaign "X" (${campaignX.name}) with Meta Form routing & Round-Robin pool`);

  // 4. Create Campaign "Google PMax" (Routing Google Account -> Dedicated Counselor 3 Neha)
  const reqCreateG = {
    user: owner,
    body: {
      name: `Google PMax ${testSuffix}`,
      description: 'Google Performance Max Direct Routing',
      platform: 'google',
      routingRules: {
        googleAccountIds: [`g_act_${testSuffix}`],
      },
      assignmentRule: {
        type: 'specific_counselor',
        specificCounselorId: counselor3._id,
        fallbackUserId: owner._id,
      },
      budget: 75000,
      status: 'active',
    },
  };

  let resDataG = null;
  const mockResG = {
    status: (code) => ({
      json: (data) => {
        resDataG = data;
        return data;
      },
    }),
    json: (data) => {
      resDataG = data;
      return data;
    },
  };

  await inbound.createInboundCampaign(reqCreateG, mockResG);
  assert(resDataG && resDataG.success, 'Google Campaign should be created successfully');
  const campaignG = resDataG.campaign;
  console.log(`  ✔ Created Campaign "Google PMax" with Dedicated Counselor routing to Neha`);

  // 5. Ingest Lead 1 arriving from Meta Form "X form"
  console.log('\n--- Ingesting Lead 1 via Meta "X form" ---');
  const lead1Res = await leadIngestionService.ingest({
    provider: 'meta',
    integrationId: metaInteg._id,
    externalLeadId: `ext_lead_1_${testSuffix}`,
    pageId: `page_${testSuffix}`,
    formId: `meta_form_x_${testSuffix}`,
    formName: 'X form',
    name: 'Aarav Patel',
    phone: '9876511111',
    email: 'aarav.patel@example.com',
    customData: { course: 'B.Tech AI' },
  });

  assert(lead1Res.created === true, 'Lead 1 should be created');
  assert(String(lead1Res.lead.campaignId) === String(campaignX._id), 'Lead 1 must be captured under Campaign X');
  assert(lead1Res.lead.assignedTo, 'Lead 1 must be assigned');
  const lead1AssignedId = String(lead1Res.lead.assignedTo);
  assert(
    lead1AssignedId === String(counselor1._id) || lead1AssignedId === String(counselor2._id),
    'Lead 1 must be assigned to Counselor 1 or 2 from Campaign X pool'
  );
  console.log(`  ✔ Lead 1 routed to Campaign "${lead1Res.lead.campaignName}" -> Assigned to: ${lead1Res.lead.assignedToName}`);

  // 6. Ingest Lead 2 arriving from Meta Form "X form"
  console.log('\n--- Ingesting Lead 2 via Meta "X form" (Testing Round-Robin Rotation) ---');
  const lead2Res = await leadIngestionService.ingest({
    provider: 'meta',
    integrationId: metaInteg._id,
    externalLeadId: `ext_lead_2_${testSuffix}`,
    pageId: `page_${testSuffix}`,
    formId: `meta_form_x_${testSuffix}`,
    formName: 'X form',
    name: 'Diya Sen',
    phone: '9876522222',
    email: 'diya.sen@example.com',
    customData: { course: 'B.Tech CSE' },
  });

  assert(lead2Res.created === true, 'Lead 2 should be created');
  assert(String(lead2Res.lead.campaignId) === String(campaignX._id), 'Lead 2 must be captured under Campaign X');
  const lead2AssignedId = String(lead2Res.lead.assignedTo);
  assert(lead2AssignedId !== lead1AssignedId, 'Lead 2 must rotate to the other counselor in Campaign X round-robin pool');
  console.log(`  ✔ Lead 2 routed to Campaign "${lead2Res.lead.campaignName}" -> Rotated to: ${lead2Res.lead.assignedToName}`);

  // 7. Ingest Lead 3 arriving from Google Ads Account
  console.log('\n--- Ingesting Lead 3 via Google Ads Account (Testing Dedicated Counselor) ---');
  const lead3Res = await leadIngestionService.ingest({
    provider: 'google',
    integrationId: googleInteg._id,
    externalLeadId: `ext_lead_3_${testSuffix}`,
    accountId: `g_act_${testSuffix}`,
    name: 'Kabir Mehta',
    phone: '9876533333',
    email: 'kabir.mehta@example.com',
    customData: { course: 'MBA Marketing' },
  });

  assert(lead3Res.created === true, 'Lead 3 should be created');
  assert(String(lead3Res.lead.campaignId) === String(campaignG._id), 'Lead 3 must be captured under Campaign Google PMax');
  assert(String(lead3Res.lead.assignedTo) === String(counselor3._id), 'Lead 3 must be assigned directly to Counselor Neha');
  console.log(`  ✔ Lead 3 routed to Campaign "${lead3Res.lead.campaignName}" -> Assigned to: ${lead3Res.lead.assignedToName}`);

  // 8. Test Campaign Leads & Attribution API (GET /api/campaigns/:id/leads)
  console.log('\n--- Testing GET /api/campaigns/:id/leads (Lead Tracking & Attribution Audit) ---');
  let leadsData = null;
  const mockResLeads = {
    json: (d) => {
      leadsData = d;
      return d;
    },
    status: () => ({ json: (d) => { leadsData = d; return d; } }),
  };

  await inbound.getCampaignLeads(
    {
      user: owner,
      params: { id: campaignX._id },
      query: { page: 1, limit: 10 },
    },
    mockResLeads
  );

  assert(leadsData && leadsData.success, 'getCampaignLeads should succeed');
  assert(leadsData.leads.length === 2, `Campaign X should contain exactly 2 leads, found ${leadsData.leads.length}`);
  assert(leadsData.stats.totalLeads === 2, 'Total leads stat should be 2');
  assert(leadsData.stats.assignedCount === 2, 'Assigned count stat should be 2');
  console.log(`  ✔ Verified Campaign X leads list: ${leadsData.leads.map(l => `${l.name} -> ${l.assignedTo?.name}`).join(', ')}`);
  console.log(`  ✔ Counselor distribution: ${JSON.stringify(leadsData.stats.counselorBreakdown)}`);
  console.log(`  ✔ Source breakdown: ${JSON.stringify(leadsData.stats.sourceBreakdown)}`);

  // 9. Cleanup
  console.log('\n--- Cleaning up test fixtures ---');
  await User.deleteMany({ _id: { $in: [owner._id, counselor1._id, counselor2._id, counselor3._id] } });
  await Campaign.deleteMany({ _id: { $in: [campaignX._id, campaignG._id] } });
  await Lead.deleteMany({ _id: { $in: [lead1Res.lead._id, lead2Res.lead._id, lead3Res.lead._id] } });
  await Integration.deleteMany({ _id: { $in: [metaInteg._id, googleInteg._id] } });

  await mongoose.disconnect();
  console.log('\n🎉 ALL CAMPAIGN ROUTING & ASSIGNMENT TESTS PASSED FLAWLESSLY!');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
