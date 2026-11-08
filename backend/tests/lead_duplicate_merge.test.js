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
const Payment = require('../src/models/Payment');
const AuditLog = require('../src/models/AuditLog');
require('../src/models/Catalogue');

const leadMergeController = require('../src/controllers/leadMergeController');

describe('F3: Duplicate Lead Detection and Atomic Merge Integration Tests', () => {
  let mongod;
  let workspace;
  let foreignWorkspace;
  let owner;
  let leadA;
  let leadB;
  let leadC;
  let foreignLead;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const ownerId = new mongoose.Types.ObjectId();
    workspace = await Workspace.create({
      name: 'Duplicate Resolution Academy',
      domain: 'dup-test',
      ownerId,
    });

    owner = await User.create({
      _id: ownerId,
      name: 'Admissions Head Roy',
      email: 'roy@duptest.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });
    owner.workspaceId = workspace._id;
    owner.workspaceRole = 'owner';

    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: owner._id,
      role: 'owner',
      status: 'active',
    });

    // Lead A (Primary): Base inquiry
    leadA = await Lead.create({
      name: 'Rahul Verma',
      email: 'rahul.verma@example.test',
      phone: '+919876544444',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      status: 'new_lead',
      location: 'Delhi',
      notes: [{ text: 'Initial inquiry from meta campaign', createdBy: owner._id, authorName: 'Roy' }],
    });

    // Lead B (Secondary 1): Duplicate phone number
    leadB = await Lead.create({
      name: 'Rahul V.',
      email: 'rahul.alt@example.test',
      phone: '+919876544444',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      status: 'contacted',
      location: 'Delhi',
      notes: [{ text: 'Walk-in inquiry at Delhi center', createdBy: owner._id, authorName: 'Roy' }],
      leadActivities: [
        {
          action: 'call_initiated',
          performerName: 'Counsellor Ankit',
          details: 'Discussed engineering program fees',
          timestamp: new Date(Date.now() - 50000),
        },
      ],
    });

    // Lead C (Secondary 2): Duplicate email address
    leadC = await Lead.create({
      name: 'R. Verma',
      email: 'rahul.verma@example.test',
      phone: '+919999988888',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      status: 'new_lead',
    });

    // Foreign Workspace Lead: Same phone, but strictly isolated in different workspace
    const foreignOwnerId = new mongoose.Types.ObjectId();
    foreignWorkspace = await Workspace.create({
      name: 'Isolated Foreign Academy',
      domain: 'foreign-test',
      ownerId: foreignOwnerId,
    });

    foreignLead = await Lead.create({
      name: 'Rahul Imposter',
      email: 'rahul.verma@example.test',
      phone: '+919876544444',
      workspaceId: foreignWorkspace._id,
      companyId: foreignWorkspace._id,
      userId: foreignOwnerId,
      status: 'new_lead',
    });

    // Create a follow-up and payment associated with Lead B
    await FollowUp.create({
      workspaceId: workspace._id,
      lead_id: leadB._id,
      leadId: leadB._id,
      agent_id: owner._id,
      scheduled_at: new Date(Date.now() + 86400000),
      note: 'Follow up regarding engineering brochure',
      status: 'pending',
    });

    await Payment.create({
      lead_id: leadB._id,
      leadId: leadB._id,
      agent_id: owner._id,
      amount: 15000,
      method: 'bank_transfer',
      transaction_id: 'TXN-LEADB-001',
      verified_by_agent: true,
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

  it('Integration: getDuplicateCandidates finds leads sharing phone or email within same workspace and ranks by confidence', async () => {
    const mockReq = {
      params: { id: leadA._id.toString() },
      user: owner,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await leadMergeController.getDuplicateCandidates(mockReq, mockRes);
    assert(resPayload && resPayload.success);
    assert.strictEqual(resPayload.count, 2, 'Should find exactly 2 candidates in workspace');

    const candidateIds = resPayload.candidates.map(c => c._id.toString());
    assert(candidateIds.includes(leadB._id.toString()), 'Must detect Lead B sharing phone');
    assert(candidateIds.includes(leadC._id.toString()), 'Must detect Lead C sharing email');
    assert(!candidateIds.includes(foreignLead._id.toString()), 'Must NOT leak foreign workspace lead');
    assert(!candidateIds.includes(leadA._id.toString()), 'Must NOT return self as duplicate');

    // Verify confidence scoring
    const candB = resPayload.candidates.find(c => c._id.toString() === leadB._id.toString());
    assert(candB.confidence >= 0.9, 'Phone match confidence must be >= 0.9');
  });

  it('Integration: mergeLeads atomically transfers entities, appends history, and soft-deletes secondary lead', async () => {
    const initialAuditCount = await AuditLog.countDocuments({ action: 'LEAD_MERGED' });

    const mockReq = {
      body: {
        primaryLeadId: leadA._id.toString(),
        secondaryLeadId: leadB._id.toString(),
        fieldOverrides: {
          budget: '750000',
          courseInterest: 'B.Tech Computer Science',
        },
      },
      user: owner,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    let resStatus = 200;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await leadMergeController.mergeLeads(mockReq, mockRes);
    assert.strictEqual(resStatus, 200);
    assert(resPayload && resPayload.success);

    // 1. Verify relational entity reassignments
    const followUpsForPrimary = await FollowUp.find({
      $or: [{ lead_id: leadA._id }, { leadId: leadA._id }],
    });
    assert.strictEqual(followUpsForPrimary.length, 1, 'Follow-up from Lead B must now point to Lead A');

    const paymentsForPrimary = await Payment.find({
      $or: [{ lead_id: leadA._id }, { leadId: leadA._id }],
    });
    assert.strictEqual(paymentsForPrimary.length, 1, 'Payment from Lead B must now point to Lead A');
    assert.strictEqual(paymentsForPrimary[0].amount, 15000);

    // 2. Verify primary lead was updated
    const updatedLeadA = await Lead.findById(leadA._id);
    assert.strictEqual(updatedLeadA.budget, '750000');
    assert.strictEqual(updatedLeadA.targetCourse, 'B.Tech Computer Science');
    const hasMergedNote = updatedLeadA.notes.some(n => n.text && n.text.includes('Walk-in inquiry at Delhi center'));
    assert(hasMergedNote, 'Notes from Lead B must be merged into Lead A');

    const hasMergeActivity = updatedLeadA.leadActivities.some(a => a.action === 'lead_merged');
    assert(hasMergeActivity, 'Primary lead must record lead_merged activity');

    const hasImportedActivity = updatedLeadA.leadActivities.some(
      a => a.details && a.details.includes('Discussed engineering program fees')
    );
    assert(hasImportedActivity, 'Historical activities from Lead B must be transferred to Lead A');

    // 3. Verify secondary lead is soft-deleted and archived (explicitly query deletedAt to bypass soft-delete filter)
    const updatedLeadB = await Lead.findOne({ _id: leadB._id, deletedAt: { $ne: null } });
    assert(updatedLeadB, 'Secondary lead must exist in soft-deleted state');
    assert(updatedLeadB.deletedAt !== null, 'Secondary lead must have deletedAt timestamp');
    assert.strictEqual(updatedLeadB.status, 'merged');
    assert.strictEqual(updatedLeadB.mergedInto.toString(), leadA._id.toString());

    // 4. Verify AuditLog persisted
    const finalAuditCount = await AuditLog.countDocuments({ action: 'LEAD_MERGED' });
    assert.strictEqual(finalAuditCount, initialAuditCount + 1, 'Audit log entry must be created');

    // 5. Verify cannot re-merge already merged secondary lead
    let errorPayload = null;
    const mockErrorRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { errorPayload = data; return this; },
    };
    await leadMergeController.mergeLeads(mockReq, mockErrorRes);
    assert.strictEqual(mockErrorRes.statusCode, 404, 'Must return 404 since secondary lead is now soft-deleted');
    assert.strictEqual(errorPayload.message, 'One or both leads not found or unauthorized');
  });
});
