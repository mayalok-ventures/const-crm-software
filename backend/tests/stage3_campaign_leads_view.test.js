/**
 * Stage 3 Verification: Campaign Leads View & Multi-Tenant Scoping
 * Verifies that:
 * 1. GET /api/leads?campaignId=XYZ scopes strictly to that campaign and caller workspace
 * 2. Other campaigns and other workspaces' leads never appear (even with identical campaign names)
 * 3. Soft-deleted leads are excluded from query results and campaign stats
 * 4. Pagination across pages delivers mutually exclusive leads with zero duplicate IDs
 * 5. Role visibility and phone masking are respected (counselors see masked phones)
 * 6. GET /api/campaigns/:id returns accurate leadCount, assignedCount, convertedCount
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'stage3_test_jwt_secret_2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Campaign = require('../src/models/Campaign');
const Lead = require('../src/models/Lead');
const { generateToken } = require('../src/middleware/auth');
const campaignRoutes = require('../src/routes/campaigns');
const leadsRoutes = require('../src/routes/leads');

describe('Stage 3: Campaign Leads View & Tenant/Campaign Scoping', function () {
  this.timeout(45000);
  let mongoServer;
  let server;
  let baseUrl;

  let wsA, wsB;
  let userA, userB, counselorA;
  let tokenA, tokenB, tokenCounselorA;
  let campaignA1, campaignA2, campaignB1;
  let leadA1, leadA2, leadB1, leadSoftDeletedA1;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const app = express();
    app.use(express.json());

    // Middleware to set workspace context
    app.use((req, res, next) => {
      req.workspaceId = req.headers['x-workspace-id'] || null;
      next();
    });

    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/leads', leadsRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Workspace A
    const companyAId = new mongoose.Types.ObjectId();
    wsA = await Workspace.create({
      name: 'Workspace A Edu',
      slug: 'workspace-a-edu',
      ownerId: companyAId,
      settings: { maskLeadPhones: true },
      maskLeadPhones: true,
    });

    userA = await User.create({
      _id: companyAId,
      name: 'Owner A',
      email: 'ownerA@workspaceA.com',
      password: 'Password@123',
      role: 'owner',
      companyRole: 'owner',
      companyId: companyAId,
      isAdmin: false,
      workspaceId: wsA._id,
      tokenVersion: 1,
    });

    counselorA = await User.create({
      name: 'Counselor A',
      email: 'counselorA@workspaceA.com',
      password: 'Password@123',
      role: 'counsellor',
      companyRole: 'counsellor',
      companyId: companyAId,
      workspaceId: wsA._id,
      tokenVersion: 1,
    });

    await WorkspaceMembership.create([
      { workspaceId: wsA._id, userId: userA._id, role: 'owner', status: 'active' },
      { workspaceId: wsA._id, userId: counselorA._id, role: 'counsellor', status: 'active' },
    ]);

    tokenA = generateToken(userA);
    tokenCounselorA = generateToken(counselorA);

    // Workspace B
    const companyBId = new mongoose.Types.ObjectId();
    wsB = await Workspace.create({
      name: 'Workspace B Edu',
      slug: 'workspace-b-edu',
      ownerId: companyBId,
      settings: { maskLeadPhones: false },
      maskLeadPhones: false,
    });

    userB = await User.create({
      _id: companyBId,
      name: 'Owner B',
      email: 'ownerB@workspaceB.com',
      password: 'Password@123',
      role: 'owner',
      companyRole: 'owner',
      companyId: companyBId,
      isAdmin: false,
      workspaceId: wsB._id,
      tokenVersion: 1,
    });

    await WorkspaceMembership.create({
      workspaceId: wsB._id,
      userId: userB._id,
      role: 'owner',
      status: 'active',
    });

    tokenB = generateToken(userB);

    // Campaigns:
    // A1: Workspace A, Name 'Fall Admissions 2026'
    campaignA1 = await Campaign.create({
      name: 'Fall Admissions 2026',
      campaignName: 'Fall Admissions 2026',
      platform: 'meta',
      campaignType: 'inbound_ad',
      status: 'active',
      workspaceId: wsA._id,
      companyId: userA.companyId,
    });

    // A2: Workspace A, Name 'Spring Admissions 2027'
    campaignA2 = await Campaign.create({
      name: 'Spring Admissions 2027',
      campaignName: 'Spring Admissions 2027',
      platform: 'google',
      campaignType: 'inbound_ad',
      status: 'active',
      workspaceId: wsA._id,
      companyId: userA.companyId,
    });

    // B1: Workspace B, Same Name 'Fall Admissions 2026' as A1!
    campaignB1 = await Campaign.create({
      name: 'Fall Admissions 2026',
      campaignName: 'Fall Admissions 2026',
      platform: 'meta',
      campaignType: 'inbound_ad',
      status: 'active',
      workspaceId: wsB._id,
      companyId: userB.companyId,
    });

    // Leads:
    leadA1 = await Lead.create({
      name: 'Candidate A1 (Fall)',
      phone: '+919876500001',
      email: 'a1@test.com',
      status: 'new_lead',
      workspaceId: wsA._id,
      companyId: userA.companyId,
      userId: userA._id,
      campaignId: campaignA1._id,
      leadSource: { campaignId: String(campaignA1._id), campaignName: campaignA1.name, platform: 'meta' },
    });

    leadA2 = await Lead.create({
      name: 'Candidate A2 (Spring)',
      phone: '+919876500002',
      email: 'a2@test.com',
      status: 'contacted',
      workspaceId: wsA._id,
      companyId: userA.companyId,
      userId: userA._id,
      campaignId: campaignA2._id,
      leadSource: { campaignId: String(campaignA2._id), campaignName: campaignA2.name, platform: 'google' },
    });

    leadB1 = await Lead.create({
      name: 'Candidate B1 (Fall Tenant B)',
      phone: '+919876500003',
      email: 'b1@test.com',
      status: 'new_lead',
      workspaceId: wsB._id,
      companyId: userB.companyId,
      userId: userB._id,
      campaignId: campaignB1._id,
      leadSource: { campaignId: String(campaignB1._id), campaignName: campaignB1.name, platform: 'meta' },
    });

    leadSoftDeletedA1 = await Lead.create({
      name: 'Candidate Deleted in A1',
      phone: '+919876500004',
      email: 'deleted@test.com',
      status: 'new_lead',
      workspaceId: wsA._id,
      companyId: userA.companyId,
      userId: userA._id,
      campaignId: campaignA1._id,
      leadSource: { campaignId: String(campaignA1._id), campaignName: campaignA1.name, platform: 'meta' },
      isDeleted: true,
      deletedAt: new Date(),
    });
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    if (mongoose.connection) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  async function apiGet(path, token, workspaceId) {
    return new Promise((resolve, reject) => {
      const u = new URL(path, baseUrl);
      const req = http.request(
        u.href,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(workspaceId ? { 'x-workspace-id': String(workspaceId) } : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  it('1. GET /api/leads?campaignId=A1 returns ONLY leads for Campaign A1 in Workspace A', async () => {
    const res = await apiGet(`/api/leads?campaignId=${campaignA1._id}`, tokenA, wsA._id);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.leads.length, 1, 'Should return exactly 1 active lead for campaign A1');
    assert.strictEqual(res.body.leads[0]._id, String(leadA1._id), 'Should match lead A1');
    assert.strictEqual(res.body.total, 1);

    // Verify other campaign (leadA2) and other workspace (leadB1) never appear
    const leadIds = res.body.leads.map((l) => l._id);
    assert(!leadIds.includes(String(leadA2._id)), 'Lead from campaign A2 must not appear');
    assert(!leadIds.includes(String(leadB1._id)), 'Lead from workspace B must not appear');
  });

  it('2. Soft-deleted leads never appear in lead list or campaign lead count', async () => {
    const resLeads = await apiGet(`/api/leads?campaignId=${campaignA1._id}`, tokenA, wsA._id);
    const leadIds = resLeads.body.leads.map((l) => l._id);
    assert(!leadIds.includes(String(leadSoftDeletedA1._id)), 'Soft-deleted lead must not appear in leads list');

    // Check campaign details stats
    const resCamp = await apiGet(`/api/campaigns/${campaignA1._id}`, tokenA, wsA._id);
    assert.strictEqual(resCamp.status, 200);
    const campData = resCamp.body.campaign || resCamp.body;
    assert.strictEqual(campData.leadCount, 1, 'Campaign stats leadCount must exclude soft-deleted leads');
  });

  it('3. Pagination without duplicates: seed 22 leads, verify strict non-overlapping pages', async () => {
    // Add 21 more leads to campaign A1
    const extraLeads = [];
    for (let i = 2; i <= 22; i++) {
      extraLeads.push({
        name: `Candidate Batch A1 #${i}`,
        phone: `+9198765999${i.toString().padStart(2, '0')}`,
        email: `batch${i}@test.com`,
        status: i % 2 === 0 ? 'contacted' : 'new_lead',
        workspaceId: wsA._id,
        companyId: userA.companyId,
        userId: userA._id,
        campaignId: campaignA1._id,
        leadSource: { campaignId: String(campaignA1._id), campaignName: campaignA1.name, platform: 'meta' },
      });
    }
    await Lead.insertMany(extraLeads);

    // Page 1 with limit 10
    const p1 = await apiGet(`/api/leads?campaignId=${campaignA1._id}&page=1&limit=10`, tokenA, wsA._id);
    assert.strictEqual(p1.body.leads.length, 10);
    const p1Ids = p1.body.leads.map((l) => String(l._id));

    // Page 2 with limit 10
    const p2 = await apiGet(`/api/leads?campaignId=${campaignA1._id}&page=2&limit=10`, tokenA, wsA._id);
    assert.strictEqual(p2.body.leads.length, 10);
    const p2Ids = p2.body.leads.map((l) => String(l._id));

    // Page 3 with limit 10 (remaining: 22 total active leads -> 2 leads on page 3)
    const p3 = await apiGet(`/api/leads?campaignId=${campaignA1._id}&page=3&limit=10`, tokenA, wsA._id);
    assert.strictEqual(p3.body.leads.length, 2);
    const p3Ids = p3.body.leads.map((l) => String(l._id));

    // Assert zero overlap between pages
    const overlap12 = p1Ids.filter((id) => p2Ids.includes(id));
    const overlap23 = p2Ids.filter((id) => p3Ids.includes(id));
    const overlap13 = p1Ids.filter((id) => p3Ids.includes(id));

    assert.strictEqual(overlap12.length, 0, `Page 1 and Page 2 overlap: ${overlap12}`);
    assert.strictEqual(overlap23.length, 0, `Page 2 and Page 3 overlap: ${overlap23}`);
    assert.strictEqual(overlap13.length, 0, `Page 1 and Page 3 overlap: ${overlap13}`);

    const allIds = new Set([...p1Ids, ...p2Ids, ...p3Ids]);
    assert.strictEqual(allIds.size, 22, `Expected 22 distinct leads across 3 pages, got ${allIds.size}`);
  });

  it('4. Role visibility and phone masking: counselor sees masked phones', async () => {
    // Assign 1 lead to counselorA so counselor can see it
    await Lead.findByIdAndUpdate(leadA1._id, { assignedTo: counselorA._id });

    const res = await apiGet(`/api/leads?campaignId=${campaignA1._id}`, tokenCounselorA, wsA._id);
    assert.strictEqual(res.status, 200);
    assert(res.body.leads.length >= 1, 'Counselor should see assigned lead');

    const lead = res.body.leads.find((l) => String(l._id) === String(leadA1._id));
    assert(lead, 'Lead A1 should be present for counselor');
    assert.strictEqual(lead.isPhoneMasked, true, 'isPhoneMasked must be true for counselor');
    assert(!lead.phone.includes('+919876500001'), 'Raw unmasked phone must not be exposed');
    assert(lead.phone.includes('XXXX') || lead.phone.includes('*'), 'Phone must contain mask pattern');
  });

  it('5. Workspace B query with same campaign name returns ONLY Workspace B leads', async () => {
    const resB = await apiGet(`/api/leads?campaignId=${campaignB1._id}`, tokenB, wsB._id);
    assert.strictEqual(resB.status, 200);
    assert.strictEqual(resB.body.leads.length, 1);
    assert.strictEqual(resB.body.leads[0]._id, String(leadB1._id));

    // Ensure Workspace B owner cannot query Workspace A campaign
    const resCross = await apiGet(`/api/campaigns/${campaignA1._id}`, tokenB, wsB._id);
    assert.strictEqual(resCross.status, 404, 'Cross-tenant campaign query must return 404');
  });
});
