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
const AdmissionDeal = require('../src/models/AdmissionDeal');
const FeeInstallment = require('../src/models/FeeInstallment');
const ChatMessage = require('../src/models/ChatMessage');
const EmailMessage = require('../src/models/EmailMessage');
const Recording = require('../src/models/Recording');
const Notification = require('../src/models/Notification');
const ActivityLog = require('../src/models/ActivityLog');
const Group = require('../src/models/Group');
const AutomationLog = require('../src/models/AutomationLog');
const CampaignLog = require('../src/models/CampaignLog');
const AuditLog = require('../src/models/AuditLog');
require('../src/models/Catalogue');

const leadMergeController = require('../src/controllers/leadMergeController');

describe('F3: Duplicate Lead Detection and Atomic Merge Integration Tests', function () {
  this.timeout(30000);

  let mongod;
  let workspace;
  let foreignWorkspace;
  let owner;
  let counsellor;
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

    counsellor = await User.create({
      name: 'Counsellor Ankit',
      email: 'ankit@duptest.test',
      password: 'password123',
      role: 'counsellor',
      workStatus: 'counsellor',
      companyRole: 'counsellor',
      workspaceId: workspace._id,
    });

    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: owner._id,
      role: 'owner',
      status: 'active',
    });

    const counsellorMem = await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: counsellor._id,
      role: 'counsellor',
      status: 'active',
      permissionOverrides: [{ key: 'leads.merge', granted: false }],
    });
    counsellor.membership = counsellorMem;

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

    // Seed all relational child entities associated with Lead B
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

    await AdmissionDeal.create({
      workspaceId: workspace._id,
      leadId: leadB._id,
      studentName: 'Rahul V.',
      collegeName: 'Apex College',
      courseName: 'B.Tech',
      admissionStatus: 'confirmed',
      assignedTo: owner._id,
      createdBy: owner._id,
    });

    await FeeInstallment.create({
      workspaceId: workspace._id,
      leadId: leadB._id,
      installmentNumber: 1,
      totalInstallments: 3,
      amount: 50000,
      dueDate: new Date(Date.now() + 86400000),
      status: 'pending',
    });

    await ChatMessage.create({
      userId: owner._id,
      leadId: leadB._id,
      phone: '9876544444',
      text: 'Hello Rahul from B',
      direction: 'inbound',
      status: 'received',
    });

    await EmailMessage.create({
      workspaceId: workspace._id,
      accountId: new mongoose.Types.ObjectId(),
      userId: owner._id,
      leadId: leadB._id,
      threadId: 'th_dup_test_001',
      from: { name: 'Roy', email: 'roy@duptest.test' },
      to: [{ name: 'Rahul', email: 'rahul.alt@example.test' }],
      subject: 'Inquiry Followup B',
      snippet: 'Welcome to admissions',
      direction: 'outbound',
      status: 'sent',
    });

    await Recording.create({
      leadId: leadB._id,
      userId: owner._id,
      duration: 60,
      filename: 'rec_leadb.mp3',
    });

    await Notification.create({
      userId: owner._id,
      leadId: leadB._id,
      title: 'Lead B Alert',
      message: 'Notice for Lead B',
    });

    await ActivityLog.create({
      actor: owner._id,
      actorName: 'Roy',
      action: 'note_added',
      entityType: 'Lead',
      entityId: leadB._id,
      details: 'Note logged on Lead B',
    });

    await Group.create({
      name: 'Batch 2026 CS',
      ownerId: owner._id,
      userId: owner._id,
      workspaceId: workspace._id,
      leadIds: [leadB._id],
    });

    await AutomationLog.create({
      workspaceId: workspace._id,
      ruleId: new mongoose.Types.ObjectId(),
      triggerType: 'lead_created',
      leadId: leadB._id,
      ruleName: 'Welcome SMS Rule',
      status: 'success',
    });

    await CampaignLog.create({
      campaignId: new mongoose.Types.ObjectId(),
      userId: owner._id,
      groupId: new mongoose.Types.ObjectId(),
      number: '9876544444',
      leadId: leadB._id,
      status: 'sent',
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

  it('1. getDuplicateCandidates finds leads sharing phone or email within same workspace and ranks by confidence', async () => {
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

    const candidateIds = resPayload.candidates.map((c) => c._id.toString());
    assert(candidateIds.includes(leadB._id.toString()), 'Must detect Lead B sharing phone');
    assert(candidateIds.includes(leadC._id.toString()), 'Must detect Lead C sharing email');
    assert(!candidateIds.includes(foreignLead._id.toString()), 'Must NOT leak foreign workspace lead');
    assert(!candidateIds.includes(leadA._id.toString()), 'Must NOT return self as duplicate');

    const candB = resPayload.candidates.find((c) => c._id.toString() === leadB._id.toString());
    assert(candB.confidence >= 0.9, 'Phone match confidence must be >= 0.9');
  });

  it('2. dryRun preview returns entity counts and field resolution without mutating database', async () => {
    const mockReq = {
      body: {
        primaryLeadId: leadA._id.toString(),
        secondaryLeadId: leadB._id.toString(),
        fieldChoices: {
          name: 'secondary',
          budget: '750000',
        },
        dryRun: true,
      },
      user: owner,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await leadMergeController.mergeLeads(mockReq, mockRes);
    assert(resPayload && resPayload.success, 'Expected success');
    assert.strictEqual(resPayload.dryRun, true, 'dryRun must be true');
    assert(resPayload.repointSummary, 'Expected repointSummary');
    assert.strictEqual(resPayload.repointSummary.followups, 1);
    assert.strictEqual(resPayload.repointSummary.payments, 1);
    assert.strictEqual(resPayload.repointSummary.admissionDeals, 1);
    assert.strictEqual(resPayload.repointSummary.feeInstallments, 1);
    assert.strictEqual(resPayload.repointSummary.chatMessages, 1);
    assert.strictEqual(resPayload.repointSummary.emailMessages, 1);
    assert.strictEqual(resPayload.repointSummary.recordings, 1);
    assert.strictEqual(resPayload.repointSummary.groups, 1);

    // Verify database was NOT mutated
    const secondaryCheck = await Lead.findById(leadB._id);
    assert.strictEqual(secondaryCheck.deletedAt, null, 'Secondary lead must not be deleted during dryRun');
    assert.notStrictEqual(secondaryCheck.status, 'merged', 'Status must not be merged during dryRun');
  });

  it('3. Rejects cross-workspace merge attempts with 400', async () => {
    const mockReq = {
      body: {
        primaryLeadId: leadA._id.toString(),
        secondaryLeadId: foreignLead._id.toString(),
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
    // Cross-workspace lookup fails either with 404 (due to permission query) or 400 (workspace mismatch)
    assert([400, 404].includes(resStatus), 'Must reject cross-workspace merge');
  });

  it('4. Rejects merge request if user lacks leads.merge permission', async () => {
    const mockReq = {
      body: {
        primaryLeadId: leadA._id.toString(),
        secondaryLeadId: leadB._id.toString(),
      },
      user: counsellor,
      membership: counsellor.membership,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    let resStatus = 200;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await leadMergeController.mergeLeads(mockReq, mockRes);
    assert.strictEqual(resStatus, 403, 'Must return 403 Forbidden for missing leads.merge permission');
    assert(resPayload.message.includes('leads.merge'));
  });

  it('5. Atomic merge transfers all child entities, applies field choices, soft-deletes secondary lead, and logs audit', async () => {
    const initialAuditCount = await AuditLog.countDocuments({ action: 'LEAD_MERGED' });

    const mockReq = {
      body: {
        primaryLeadId: leadA._id.toString(),
        secondaryLeadId: leadB._id.toString(),
        fieldChoices: {
          name: 'secondary', // Takes 'Rahul V.'
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

    // 1. Verify relational entity reassignments across ALL child collections
    const followUpsForPrimary = await FollowUp.find({
      $or: [{ lead_id: leadA._id }, { leadId: leadA._id }],
    });
    assert.strictEqual(followUpsForPrimary.length, 1, 'Follow-up must now point to Lead A');

    // Financial records: NEVER deleted, re-pointed to primary lead
    const paymentsForPrimary = await Payment.find({
      $or: [{ lead_id: leadA._id }, { leadId: leadA._id }],
    });
    assert.strictEqual(paymentsForPrimary.length, 1, 'Payment must now point to Lead A');
    assert.strictEqual(paymentsForPrimary[0].amount, 15000);

    const dealsForPrimary = await AdmissionDeal.find({
      $or: [{ leadId: leadA._id }, { lead_id: leadA._id }],
    });
    assert.strictEqual(dealsForPrimary.length, 1, 'Deal must now point to Lead A');

    const installmentsForPrimary = await FeeInstallment.find({
      $or: [{ leadId: leadA._id }, { lead_id: leadA._id }],
    });
    assert.strictEqual(installmentsForPrimary.length, 1, 'FeeInstallment must now point to Lead A');

    const chatsForPrimary = await ChatMessage.find({ leadId: leadA._id });
    assert.strictEqual(chatsForPrimary.length, 1, 'ChatMessage must now point to Lead A');

    const emailsForPrimary = await EmailMessage.find({ leadId: leadA._id });
    assert.strictEqual(emailsForPrimary.length, 1, 'EmailMessage must now point to Lead A');

    const recordingsForPrimary = await Recording.find({ leadId: leadA._id });
    assert.strictEqual(recordingsForPrimary.length, 1, 'Recording must now point to Lead A');

    const notifsForPrimary = await Notification.find({ leadId: leadA._id });
    assert.strictEqual(notifsForPrimary.length, 1, 'Notification must now point to Lead A');

    const activityLogsForPrimary = await ActivityLog.find({
      $or: [{ entityId: leadA._id }, { targetId: leadA._id }, { target_id: leadA._id }],
    });
    assert.strictEqual(activityLogsForPrimary.length, 1, 'ActivityLog must now point to Lead A');

    const groupForPrimary = await Group.findOne({ leadIds: leadA._id });
    assert(groupForPrimary, 'Group must now contain Lead A');
    assert(!groupForPrimary.leadIds.map((id) => id.toString()).includes(leadB._id.toString()), 'Group must no longer contain Lead B');

    const autoLogForPrimary = await AutomationLog.findOne({ leadId: leadA._id });
    assert(autoLogForPrimary, 'AutomationLog must now point to Lead A');

    const campLogForPrimary = await CampaignLog.findOne({ leadId: leadA._id });
    assert(campLogForPrimary, 'CampaignLog must now point to Lead A');

    // 2. Verify primary lead was updated with field choices
    const updatedLeadA = await Lead.findById(leadA._id);
    assert.strictEqual(updatedLeadA.name, 'Rahul V.', 'Name must be taken from secondary as requested');
    assert.strictEqual(updatedLeadA.budget, '750000');
    assert.strictEqual(updatedLeadA.targetCourse, 'B.Tech Computer Science');

    const hasMergedNote = updatedLeadA.notes.some((n) => n.text && n.text.includes('Walk-in inquiry at Delhi center'));
    assert(hasMergedNote, 'Notes from Lead B must be merged into Lead A');

    const hasMergeActivity = updatedLeadA.leadActivities.some((a) => a.action === 'lead_merged');
    assert(hasMergeActivity, 'Primary lead must record lead_merged activity');

    // 3. Verify secondary lead is soft-deleted
    const updatedLeadB = await Lead.findOne({ _id: leadB._id, deletedAt: { $ne: null } });
    assert(updatedLeadB, 'Secondary lead must exist in soft-deleted state');
    assert(updatedLeadB.deletedAt !== null, 'Secondary lead must have deletedAt timestamp');
    assert.strictEqual(updatedLeadB.status, 'merged');
    assert.strictEqual(updatedLeadB.mergedInto.toString(), leadA._id.toString());

    // 4. Verify AuditLog persisted
    const finalAuditCount = await AuditLog.countDocuments({ action: 'LEAD_MERGED' });
    assert.strictEqual(finalAuditCount, initialAuditCount + 1, 'Audit log entry must be created');
  });

  it('6. Idempotent repeat merge returns 200 alreadyMerged without errors', async () => {
    const mockReq = {
      body: {
        primaryLeadId: leadA._id.toString(),
        secondaryLeadId: leadB._id.toString(),
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
    assert.strictEqual(resStatus, 200, 'Repeat merge must return 200');
    assert.strictEqual(resPayload.alreadyMerged, true, 'alreadyMerged must be true');
  });
});
