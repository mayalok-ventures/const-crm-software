const { assertTestSafety } = require('./safetyGuard');
assertTestSafety();

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Payment = require('../src/models/Payment');
const AdmissionDeal = require('../src/models/AdmissionDeal');
const leadMergeController = require('../src/controllers/leadMergeController');

describe('F3 Hardening: Lead Merge Transaction Rollback on Injected Failure', function () {
  this.timeout(45000);

  let replSet;
  let workspace;
  let owner;
  let primaryLead;
  let secondaryLead;

  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const ownerId = new mongoose.Types.ObjectId();
    workspace = await Workspace.create({
      name: 'Txn Rollback Academy',
      domain: 'rollback-test',
      ownerId,
    });

    owner = await User.create({
      _id: ownerId,
      name: 'Admin Boss',
      email: 'boss@rollback.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      workspaceId: workspace._id,
    });

    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: owner._id,
      role: 'owner',
      status: 'active',
    });

    primaryLead = await Lead.create({
      name: 'Prime Student',
      email: 'prime@rollback.test',
      phone: '+919999111111',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      status: 'new_lead',
    });

    secondaryLead = await Lead.create({
      name: 'Secondary Student',
      email: 'sec@rollback.test',
      phone: '+919999222222',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      status: 'contacted',
    });

    await Payment.create({
      lead_id: secondaryLead._id,
      leadId: secondaryLead._id,
      agent_id: owner._id,
      amount: 25000,
      method: 'upi',
      transaction_id: 'TXN-ROLLBACK-SEC-01',
    });

    await AdmissionDeal.create({
      workspaceId: workspace._id,
      leadId: secondaryLead._id,
      studentName: 'Secondary Student',
      collegeName: 'Tech University',
      courseName: 'MCA',
      admissionStatus: 'confirmed',
      assignedTo: owner._id,
      createdBy: owner._id,
    });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  });

  it('Proves atomicity: injected failure mid-merge rolls back all child reassignments and lead state', async () => {
    // Inject a failure into Lead.prototype.save during the merge transaction
    const originalSave = Lead.prototype.save;
    let saveCount = 0;
    Lead.prototype.save = async function (...args) {
      saveCount++;
      if (saveCount === 1) {
        // Force intentional failure on primaryLead.save
        throw new Error('Injected database storage fault during lead merge');
      }
      return originalSave.apply(this, args);
    };

    const mockReq = {
      body: {
        primaryLeadId: primaryLead._id.toString(),
        secondaryLeadId: secondaryLead._id.toString(),
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

    try {
      await leadMergeController.mergeLeads(mockReq, mockRes);
    } finally {
      // Always restore original method
      Lead.prototype.save = originalSave;
    }

    assert.strictEqual(resStatus, 500, 'Must return 500 on transaction failure');

    // 1. Verify Payment was NOT re-pointed (rolled back)
    const payment = await Payment.findOne({ transaction_id: 'TXN-ROLLBACK-SEC-01' });
    assert.strictEqual(payment.leadId.toString(), secondaryLead._id.toString(), 'Payment must roll back to secondaryLead');

    // 2. Verify Deal was NOT re-pointed (rolled back)
    const deal = await AdmissionDeal.findOne({ collegeName: 'Tech University' });
    assert.strictEqual(deal.leadId.toString(), secondaryLead._id.toString(), 'Deal must roll back to secondaryLead');

    // 3. Verify secondary lead was NOT deleted or marked merged
    const secondaryAfter = await Lead.findById(secondaryLead._id);
    assert.strictEqual(secondaryAfter.deletedAt, null, 'Secondary lead must not be soft-deleted');
    assert.notStrictEqual(secondaryAfter.status, 'merged', 'Secondary lead status must not be merged');

    // 4. Verify primary lead was NOT modified
    const primaryAfter = await Lead.findById(primaryLead._id);
    assert.strictEqual(primaryAfter.leadActivities.length, 0, 'Primary lead must not retain merge activity');
  });
});
