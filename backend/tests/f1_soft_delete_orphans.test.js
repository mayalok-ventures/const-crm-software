const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let Lead;
let FollowUp;
let FeeInstallment;
let AdmissionDeal;
let User;
let Workspace;

const leadsController = require('../src/controllers/leadsController');
const { sweepDueFollowUps } = require('../src/services/followUpSchedulerService');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  Lead = require('../src/models/Lead');
  FollowUp = require('../src/models/FollowUp');
  FeeInstallment = require('../src/models/FeeInstallment');
  AdmissionDeal = require('../src/models/AdmissionDeal');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F1.3: Soft Delete Cascade Cleanup & Cron Orphan Skipping', () => {
  it('soft-deleting a lead cancels pending follow-ups, admission deals, and fee installments', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'Soft Delete WS', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Admin User',
      email: 'admin_delete@test.com',
      password: 'Password123!',
      role: 'admin',
      companyRole: 'owner',
      workspaceRole: 'owner',
      workspaceId: ws._id,
      companyId: ws._id,
      isActive: true,
    });

    const lead = await Lead.create({
      workspaceId: ws._id,
      companyId: ws._id,
      userId: user._id,
      assignedTo: user._id,
      name: 'Candidate To Delete',
      phone: '9888811111',
      phoneDigits: '9888811111',
      status: 'contacted',
    });

    // Create child records
    const followUp = await FollowUp.create({
      workspaceId: ws._id,
      lead_id: lead._id,
      leadId: lead._id,
      agentId: user._id,
      scheduled_at: new Date(),
      scheduledAt: new Date(),
      note: 'Call candidate back',
      status: 'open',
    });

    const deal = await AdmissionDeal.create({
      workspaceId: ws._id,
      leadId: lead._id,
      counselorId: user._id,
      createdBy: user._id,
      studentName: 'Candidate To Delete',
      studentPhone: '9888811111',
      collegeName: 'Oxford University',
      courseName: 'Computer Science',
      admissionStatus: 'seat_locked',
    });

    const installment = await FeeInstallment.create({
      workspaceId: ws._id,
      leadId: lead._id,
      installmentNumber: 1,
      title: 'First Tranche',
      amount: 20000,
      dueDate: new Date(),
      status: 'pending',
    });

    const req = {
      params: { id: lead._id.toString() },
      user,
      workspaceId: ws._id,
    };
    const res = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.deleteLead(req, res);

    assert.strictEqual(res.statusCode || 200, 200);

    // Verify lead is soft-deleted
    const rawLead = await Lead.collection.findOne({ _id: lead._id });
    assert.ok(rawLead.deletedAt, 'Lead must have deletedAt timestamp');

    // Verify FollowUp cancelled
    const freshFollowUp = await FollowUp.findById(followUp._id);
    assert.strictEqual(freshFollowUp.status, 'cancelled', 'FollowUp must be cancelled on lead delete');

    // Verify AdmissionDeal cancelled
    const freshDeal = await AdmissionDeal.findById(deal._id);
    assert.strictEqual(freshDeal.admissionStatus, 'cancelled', 'AdmissionDeal must be cancelled on lead delete');

    // Verify FeeInstallment cancelled
    const freshInstallment = await FeeInstallment.findById(installment._id);
    assert.strictEqual(freshInstallment.status, 'cancelled', 'FeeInstallment must be cancelled on lead delete');
  });

  it('sweepDueFollowUps skips and cancels orphaned follow-up records whose lead is deleted', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();

    // Create an orphaned follow-up pointing to a deleted or non-existent lead
    const deletedLeadId = new mongoose.Types.ObjectId();
    const orphanFup = await FollowUp.create({
      workspaceId: ws._id,
      lead_id: deletedLeadId,
      leadId: deletedLeadId,
      agentId: user._id,
      scheduled_at: new Date(Date.now() - 60000), // Due 1 minute ago
      scheduledAt: new Date(Date.now() - 60000),
      note: 'Orphan follow-up call',
      status: 'open',
      notified: false,
    });

    await sweepDueFollowUps();

    // The orphan should be marked cancelled/orphaned_skipped and not notified
    const freshOrphan = await FollowUp.findById(orphanFup._id);
    assert.strictEqual(freshOrphan.status, 'cancelled', 'Orphan follow-up should be cancelled');
    assert.strictEqual(freshOrphan.claimStatus, 'orphaned_skipped', 'Orphan follow-up should be marked orphaned_skipped');
  });
});
