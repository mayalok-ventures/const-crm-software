const { assertTestSafety } = require('./safetyGuard');
assertTestSafety();

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const FollowUp = require('../src/models/FollowUp');
const ChatMessage = require('../src/models/ChatMessage');
const EmailMessage = require('../src/models/EmailMessage');
const EmailAccount = require('../src/models/EmailAccount');
const Payment = require('../src/models/Payment');
const Recording = require('../src/models/Recording');
require('../src/models/Catalogue');

const leadsController = require('../src/controllers/leadsController');

describe('F2: Omnichannel Activity Timeline API Integration Tests', () => {
  let mongod;
  let workspace;
  let owner;
  let counsellor;
  let lead;
  let otherWorkspace;
  let otherLead;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    // 1. Create primary workspace and members
    const ownerId = new mongoose.Types.ObjectId();
    workspace = await Workspace.create({
      name: 'OmniChannel Test Academy',
      domain: 'omni-test',
      ownerId,
    });

    owner = await User.create({
      _id: ownerId,
      name: 'Principal Skinner',
      email: 'principal@omni.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });
    owner.workspaceId = workspace._id;
    owner.workspaceRole = 'owner';

    counsellor = await User.create({
      name: 'Counsellor Lisa',
      email: 'lisa@omni.test',
      password: 'password123',
      role: 'counsellor',
      workStatus: 'counsellor',
      companyRole: 'counsellor',
    });
    counsellor.workspaceId = workspace._id;
    counsellor.workspaceRole = 'counsellor';

    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: owner._id,
      role: 'owner',
      status: 'active',
    });

    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: counsellor._id,
      role: 'counsellor',
      status: 'active',
    });

    // 2. Create lead in primary workspace with built-in activities
    const now = Date.now();
    lead = await Lead.create({
      name: 'Bart Simpson',
      email: 'bart@springfield.test',
      phone: '+919876500001',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      assignedTo: counsellor._id,
      status: 'new_lead',
      leadActivities: [
        {
          action: 'lead_created',
          performerName: 'System',
          details: 'Student registered via Webhook',
          timestamp: new Date(now - 100000), // oldest
        },
        {
          action: 'call_initiated',
          performedBy: counsellor._id,
          performerName: 'Counsellor Lisa',
          details: 'First-touch phone inquiry placed',
          timestamp: new Date(now - 80000),
        },
      ],
    });

    // 3. Create FollowUp
    await FollowUp.create({
      workspaceId: workspace._id,
      lead_id: lead._id,
      agent_id: counsellor._id,
      scheduled_at: new Date(now - 60000),
      status: 'completed',
      note: 'Discuss fee structure with parents',
      completion_note: 'Parents agreed to tuition terms',
      completed_at: new Date(now - 60000),
    });

    // 4. Create ChatMessage (WhatsApp)
    await ChatMessage.create({
      userId: counsellor._id,
      leadId: lead._id,
      phone: lead.phone,
      direction: 'inbound',
      text: 'Hello, when is the last date for admission?',
      status: 'delivered',
      createdAt: new Date(now - 40000),
    });

    // 5. Create EmailAccount & EmailMessage
    const emailAccount = await EmailAccount.create({
      workspaceId: workspace._id,
      userId: owner._id,
      email: 'admissions@omni.test',
      provider: 'smtp',
    });

    await EmailMessage.create({
      workspaceId: workspace._id,
      accountId: emailAccount._id,
      userId: counsellor._id,
      leadId: lead._id,
      threadId: 'th_omni_test_001',
      from: { name: 'Admissions Office', email: 'admissions@omni.test' },
      to: [{ name: 'Bart Simpson', email: 'bart@springfield.test' }],
      subject: 'Offer Letter - Grade 11 Admission',
      snippet: 'Congratulations! Your provisional admission is granted.',
      direction: 'outbound',
      status: 'sent',
      createdAt: new Date(now - 30000),
    });

    // 6. Create Payment
    await Payment.create({
      lead_id: lead._id,
      agent_id: counsellor._id,
      amount: 25000,
      method: 'upi',
      transaction_id: 'UPI987654321',
      verified_by_agent: true,
      createdAt: new Date(now - 20000),
    });

    // 7. Create Recording
    await Recording.create({
      workspaceId: workspace._id,
      leadId: lead._id,
      userId: counsellor._id,
      filename: 'call_rec_1234.webm',
      duration: 145,
      createdAt: new Date(now - 10000), // newest
    });

    // 8. Create another workspace and isolated lead for tenant boundary test
    const otherOwnerId = new mongoose.Types.ObjectId();
    otherWorkspace = await Workspace.create({
      name: 'Shelbyville Academy',
      domain: 'shelbyville-test',
      ownerId: otherOwnerId,
    });

    otherLead = await Lead.create({
      name: 'Milhouse Van Houten',
      email: 'milhouse@shelbyville.test',
      phone: '+919876500099',
      workspaceId: otherWorkspace._id,
      companyId: otherWorkspace._id,
      userId: otherOwnerId,
      status: 'new_lead',
    });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  it('Integration: Aggregates omnichannel events across all 6 sources into normalized items', async () => {
    const mockReq = {
      params: { id: lead._id.toString() },
      query: { limit: 20 },
      user: counsellor,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await leadsController.getLeadTimeline(mockReq, mockRes);
    assert(resPayload, 'Response payload expected');
    assert.strictEqual(resPayload.success, true);
    assert.strictEqual(resPayload.leadName, 'Bart Simpson');

    // Total events: 2 leadActivities + 1 followup + 1 whatsapp + 1 email + 1 payment + 1 recording = 7
    assert.strictEqual(resPayload.total, 7, 'Must aggregate exactly 7 events from all collections');
    assert.strictEqual(resPayload.timeline.length, 7);

    // Verify presence of every type tag
    const typesPresent = new Set(resPayload.timeline.map((item) => item.type));
    assert(typesPresent.has('lead_activity'), 'Must contain lead_activity');
    assert(typesPresent.has('followup'), 'Must contain followup');
    assert(typesPresent.has('whatsapp'), 'Must contain whatsapp');
    assert(typesPresent.has('email'), 'Must contain email');
    assert(typesPresent.has('payment'), 'Must contain payment');
    assert(typesPresent.has('recording'), 'Must contain recording');

    // Verify chronological order (newest first)
    for (let i = 0; i < resPayload.timeline.length - 1; i++) {
      const current = new Date(resPayload.timeline[i].timestamp).getTime();
      const next = new Date(resPayload.timeline[i + 1].timestamp).getTime();
      assert(current >= next, `Timeline item ${i} must be newer than or equal to ${i + 1}`);
    }

    // Newest must be the recording
    assert.strictEqual(resPayload.timeline[0].type, 'recording');
    assert.strictEqual(resPayload.timeline[0].metadata.duration, 145);

    // Oldest must be lead_created
    assert.strictEqual(resPayload.timeline[6].type, 'lead_activity');
    assert.strictEqual(resPayload.timeline[6].action, 'lead_created');
  });

  it('Integration: Cursor pagination with limit and before cursor retrieves sequential pages', async () => {
    // Page 1: Limit 3
    const mockReqP1 = {
      params: { id: lead._id.toString() },
      query: { limit: 3 },
      user: counsellor,
      workspaceId: workspace._id,
    };
    let p1Payload = null;
    const mockResP1 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { p1Payload = data; return this; },
    };

    await leadsController.getLeadTimeline(mockReqP1, mockResP1);
    assert.strictEqual(p1Payload.timeline.length, 3);
    assert.strictEqual(p1Payload.pagination.hasMore, true);
    assert(p1Payload.pagination.nextCursor, 'nextCursor must be returned when hasMore is true');

    // Page 2: Query using before = nextCursor
    const mockReqP2 = {
      params: { id: lead._id.toString() },
      query: { limit: 3, before: p1Payload.pagination.nextCursor },
      user: counsellor,
      workspaceId: workspace._id,
    };
    let p2Payload = null;
    const mockResP2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { p2Payload = data; return this; },
    };

    await leadsController.getLeadTimeline(mockReqP2, mockResP2);
    assert.strictEqual(p2Payload.timeline.length, 3);

    // Ensure Page 2 items do not overlap Page 1 items
    const p1Ids = new Set(p1Payload.timeline.map(i => i.id));
    for (const item of p2Payload.timeline) {
      assert(!p1Ids.has(item.id), `Item ${item.id} should not appear in both page 1 and page 2`);
    }
  });

  it('Security: Rejects cross-workspace lead timeline access with 404', async () => {
    // Counsellor from Workspace A trying to read timeline of lead from Workspace B
    const mockReq = {
      params: { id: otherLead._id.toString() },
      query: { limit: 10 },
      user: counsellor,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await leadsController.getLeadTimeline(mockReq, mockRes);
    assert.strictEqual(mockRes.statusCode, 404, 'Must return 404 for lead in foreign workspace');
    assert.strictEqual(resPayload.message, 'Lead not found or unauthorized');
  });

  it('Hardening: Per-source permission filtering excludes unauthorized communication streams', async () => {
    // Agent without whatsapp.view or email.view permissions
    const restrictedUser = await User.create({
      name: 'Restricted Agent',
      email: 'restricted@omni.test',
      password: 'password123',
      role: 'counsellor',
      workStatus: 'counsellor',
      workspaceId: workspace._id,
    });

    const restrictedMembership = await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: restrictedUser._id,
      role: 'counsellor',
      status: 'active',
      permissionOverrides: [
        { key: 'whatsapp.view', granted: false },
        { key: 'email.view', granted: false },
        { key: 'deals.view', granted: false },
      ],
    });

    lead.assignedTo = restrictedUser._id;
    await lead.save();

    const mockReq = {
      params: { id: lead._id.toString() },
      query: { limit: 50 },
      user: restrictedUser,
      membership: restrictedMembership,
      workspace,
      workspaceId: workspace._id,
    };
    let payload = null;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { payload = data; return this; },
    };

    await leadsController.getLeadTimeline(mockReq, mockRes);
    assert(payload && Array.isArray(payload.timeline), 'Expected timeline array');

    const typesPresent = new Set(payload.timeline.map((i) => i.type));
    assert(!typesPresent.has('whatsapp'), 'Restricted agent must not see whatsapp events');
    assert(!typesPresent.has('email'), 'Restricted agent must not see email events');
    assert(!typesPresent.has('payment'), 'Restricted agent must not see payment/deals events');
    assert(typesPresent.has('followup'), 'Allowed sources (followup) must still appear');
  });

  it('Hardening: Masking inside summaries redacts phone numbers when maskLeadPhones is ON', async () => {
    // 1. Turn masking ON for workspace
    workspace.settings.maskLeadPhones = true;
    await workspace.save();

    // 2. Add an activity with raw phone number in details
    lead.assignedTo = counsellor._id;
    lead.leadActivities.push({
      action: 'note_added',
      performerName: 'Agent John',
      details: 'Spoke to father at 9876543210 regarding admission fee schedule',
      timestamp: new Date(),
    });
    await lead.save();

    const mockReq = {
      params: { id: lead._id.toString() },
      query: { limit: 50 },
      user: counsellor,
      workspace,
      workspaceId: workspace._id,
    };
    let payload = null;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { payload = data; return this; },
    };

    await leadsController.getLeadTimeline(mockReq, mockRes);
    assert(payload && Array.isArray(payload.timeline), 'Expected timeline array');

    const noteItem = payload.timeline.find((i) => i.action === 'note_added');
    assert(noteItem, 'Note item must be found in timeline');
    assert(noteItem.description.includes('98765*****'), 'Phone inside description must be masked');
    assert(!noteItem.description.includes('9876543210'), 'Raw phone must never appear in summary text');
  });
});
