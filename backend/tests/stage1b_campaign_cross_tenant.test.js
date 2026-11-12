/**
 * Stage 1b Reproduction & Verification: Campaign Leads Cross-Tenant Leak & Phone Masking
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'stage1b_test_jwt_secret_2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Campaign = require('../src/models/Campaign');
const Lead = require('../src/models/Lead');
const { generateToken } = require('../src/middleware/auth');
const campaignRoutes = require('../src/routes/campaigns');

describe('Stage 1b: Inbound Campaign Leads Cross-Tenant Leak & Phone Masking', function () {
  this.timeout(45000);
  let mongoServer;
  let server;
  let baseUrl;

  let wsA, wsB;
  let userA, userB, counselorA;
  let tokenA, tokenB, tokenCounselorA;
  let campaignA, campaignB;
  let leadA, leadB, leadDeletedA;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const app = express();
    app.use(express.json());

    // Resolve workspace mock middleware
    app.use((req, res, next) => {
      req.workspaceId = req.headers['x-workspace-id'] || null;
      next();
    });

    app.use('/api/campaigns', campaignRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Tenant A
    const companyAId = new mongoose.Types.ObjectId();
    wsA = await Workspace.create({
      name: 'Org A',
      slug: 'org-a',
      ownerId: companyAId,
      settings: { maskLeadPhones: true },
      maskLeadPhones: true,
    });
    userA = await User.create({
      _id: companyAId,
      name: 'Owner A',
      email: 'ownerA@orgA.com',
      password: 'Password@123',
      role: 'owner',
      companyRole: 'owner',
      companyId: companyAId,
      isAdmin: false,
      userStatus: 'active',
    });
    tokenA = generateToken(userA._id, 0);
    await WorkspaceMembership.create({
      workspaceId: wsA._id,
      userId: userA._id,
      role: 'owner',
      status: 'active',
    });

    // Counselor in Org A (restricted user who must have phone masked)
    counselorA = await User.create({
      name: 'Counselor A',
      email: 'counselorA@orgA.com',
      password: 'Password@123',
      role: 'counsellor',
      companyRole: 'counsellor',
      companyId: companyAId,
      workspaceId: wsA._id,
      isAdmin: false,
      userStatus: 'active',
    });
    tokenCounselorA = generateToken(counselorA._id, 0);
    await WorkspaceMembership.create({
      workspaceId: wsA._id,
      userId: counselorA._id,
      role: 'counsellor',
      status: 'active',
      permissions: ['campaigns.view', 'leads.view'],
    });

    // Tenant B
    const companyBId = new mongoose.Types.ObjectId();
    wsB = await Workspace.create({ name: 'Org B', slug: 'org-b', ownerId: companyBId });
    userB = await User.create({
      _id: companyBId,
      name: 'Owner B',
      email: 'ownerB@orgB.com',
      password: 'Password@123',
      role: 'owner',
      companyRole: 'owner',
      companyId: companyBId,
      isAdmin: false,
      userStatus: 'active',
    });
    tokenB = generateToken(userB._id, 0);
    await WorkspaceMembership.create({
      workspaceId: wsB._id,
      userId: userB._id,
      role: 'owner',
      status: 'active',
    });

    // Both organizations create a campaign with the SAME name: "Fall Admission 2026"
    campaignA = await Campaign.create({
      name: 'Fall Admission 2026',
      campaignName: 'Fall Admission 2026',
      companyId: companyAId,
      workspaceId: wsA._id,
      status: 'active',
      platform: 'meta',
    });

    campaignB = await Campaign.create({
      name: 'Fall Admission 2026',
      campaignName: 'Fall Admission 2026',
      companyId: companyBId,
      workspaceId: wsB._id,
      status: 'active',
      platform: 'meta',
    });

    // Lead A belongs to Org A (assigned to counselorA)
    leadA = await Lead.create({
      name: 'Student A',
      phone: '9999911111',
      email: 'studentA@test.com',
      userId: companyAId,
      companyId: companyAId,
      workspaceId: wsA._id,
      campaignId: campaignA._id,
      assignedTo: counselorA._id,
      leadSource: {
        platform: 'meta',
        campaignName: 'Fall Admission 2026',
      },
      status: 'new_lead',
    });

    // Lead B belongs to Org B (with identical campaignName in leadSource)
    leadB = await Lead.create({
      name: 'Student B',
      phone: '8888822222',
      email: 'studentB@test.com',
      userId: companyBId,
      companyId: companyBId,
      workspaceId: wsB._id,
      campaignId: campaignB._id,
      leadSource: {
        platform: 'meta',
        campaignName: 'Fall Admission 2026',
      },
      status: 'new_lead',
    });

    // Soft-deleted lead in Org A
    leadDeletedA = await Lead.create({
      name: 'Deleted Student A',
      phone: '9999900000',
      userId: companyAId,
      companyId: companyAId,
      workspaceId: wsA._id,
      campaignId: campaignA._id,
      isDeleted: true,
      deletedAt: new Date(),
      status: 'new_lead',
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  async function apiGet(path, token, wsId) {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    if (wsId) headers['x-workspace-id'] = String(wsId);
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  it('1. Cross-Tenant Isolation: User A cannot see Lead B in campaign leads', async () => {
    const res = await apiGet(`/api/campaigns/${campaignA._id}/leads`, tokenA, wsA._id);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const leadIds = (res.data.leads || []).map((l) => String(l._id));
    assert.ok(leadIds.includes(String(leadA._id)), 'Lead A should be included in campaign leads');
    assert.ok(!leadIds.includes(String(leadB._id)), 'CROSS-TENANT LEAK: Lead B from Org B was returned to Org A!');
  });

  it('2. Soft-Deleted Filter: Soft-deleted leads must not appear in campaign leads', async () => {
    const res = await apiGet(`/api/campaigns/${campaignA._id}/leads`, tokenA, wsA._id);
    const leadIds = (res.data.leads || []).map((l) => String(l._id));
    assert.ok(!leadIds.includes(String(leadDeletedA._id)), 'Soft-deleted lead appeared in campaign leads!');
  });

  it('3. Phone Masking: Phones must be masked according to user preferences / permissions', async () => {
    const res = await apiGet(`/api/campaigns/${campaignA._id}/leads`, tokenCounselorA, wsA._id);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const returnedLeadA = (res.data.leads || []).find((l) => String(l._id) === String(leadA._id));
    assert.ok(returnedLeadA, 'Lead A must be present');
    assert.strictEqual(returnedLeadA.isPhoneMasked, true, 'isPhoneMasked flag should be true');
    assert.notStrictEqual(returnedLeadA.phone, '9999911111', 'Phone number was not masked!');
  });
});
