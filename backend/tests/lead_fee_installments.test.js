const { assertTestSafety } = require('./safetyGuard');
assertTestSafety();

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const FeeInstallment = require('../src/models/FeeInstallment');
const Payment = require('../src/models/Payment');
require('../src/models/Catalogue');

const feeInstallmentController = require('../src/controllers/feeInstallmentController');

describe('F4: Fee Installments Tracking and Payment Linkage Integration Tests', () => {
  let mongod;
  let workspace;
  let owner;
  let counsellor;
  let testLead;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const ownerId = new mongoose.Types.ObjectId();
    workspace = await Workspace.create({
      name: 'Fee Management Test Academy',
      domain: 'fee-test',
      ownerId,
    });

    owner = await User.create({
      _id: ownerId,
      name: 'Director Sharma',
      email: 'sharma@feetest.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });
    owner.workspaceId = workspace._id;
    owner.workspaceRole = 'owner';

    counsellor = await User.create({
      name: 'Finance Executive Tina',
      email: 'tina@feetest.test',
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

    testLead = await Lead.create({
      name: 'Aarav Patel',
      email: 'aarav.patel@example.test',
      phone: '+919876512345',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      assignedTo: counsellor._id,
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

  it('Integration: Schedules a multi-installment fee structure and persists on lead', async () => {
    const futureDate1 = new Date(Date.now() + 10 * 86400000); // +10 days
    const futureDate2 = new Date(Date.now() + 30 * 86400000); // +30 days
    const pastDateOverdue = new Date(Date.now() - 5 * 86400000); // -5 days (overdue)

    const mockReq = {
      params: { id: testLead._id.toString() },
      body: {
        installments: [
          {
            title: 'Initial Admission Fee',
            amount: 50000,
            dueDate: futureDate1,
            gracePeriodDays: 3,
            notes: 'Registration + first term tuition',
          },
          {
            title: 'Mid-Term Installment',
            amount: 30000,
            dueDate: futureDate2,
            gracePeriodDays: 5,
          },
          {
            title: 'Past Overdue Deposit',
            amount: 20000,
            dueDate: pastDateOverdue,
            gracePeriodDays: 1, // grace passed 4 days ago
          },
        ],
      },
      user: counsellor,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    let resStatus = 200;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await feeInstallmentController.createLeadInstallments(mockReq, mockRes);
    assert.strictEqual(resStatus, 201, 'Should return 201 Created');
    assert.strictEqual(resPayload.success, true);
    assert.strictEqual(resPayload.count, 3);
    assert.strictEqual(resPayload.totalAmount, 100000);

    // Verify activity entry in leadActivities
    const updatedLead = await Lead.findById(testLead._id);
    const hasScheduledActivity = updatedLead.leadActivities.some(
      (a) => a.action === 'fee_installment_scheduled'
    );
    assert(hasScheduledActivity, 'leadActivities must record fee_installment_scheduled');
  });

  it('Integration: getLeadInstallments returns summary metrics and marks past dues as overdue', async () => {
    const mockReq = {
      params: { id: testLead._id.toString() },
      user: counsellor,
      workspaceId: workspace._id,
    };

    let resPayload = null;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { resPayload = data; return this; },
    };

    await feeInstallmentController.getLeadInstallments(mockReq, mockRes);
    assert(resPayload && resPayload.success);
    assert.strictEqual(resPayload.installments.length, 3);

    const summary = resPayload.summary;
    assert.strictEqual(summary.totalFee, 100000);
    assert.strictEqual(summary.totalPaid, 0);
    assert.strictEqual(summary.totalPending, 100000);
    assert.strictEqual(summary.totalOverdue, 20000, 'Installment 3 must be recognized as overdue');

    // Confirm Installment 3 was updated to overdue
    const inst3 = resPayload.installments.find(i => i.title === 'Past Overdue Deposit');
    assert(inst3);
    assert.strictEqual(inst3.status, 'overdue');
  });

  it('Integration: recordInstallmentPayment logs Payment and transitions status from pending to paid and partially_paid', async () => {
    // 1. Pay Installment #1 in full
    const installments = await FeeInstallment.find({ leadId: testLead._id }).sort({ installmentNumber: 1 });
    const inst1 = installments[0];

    const mockReqPay1 = {
      params: { id: testLead._id.toString(), installmentId: inst1._id.toString() },
      body: {
        amount: 50000,
        paymentMethod: 'upi',
        transactionId: 'UPI-TEST-0001',
      },
      user: counsellor,
      workspaceId: workspace._id,
    };

    let pay1Payload = null;
    const mockResPay1 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { pay1Payload = data; return this; },
    };

    await feeInstallmentController.recordInstallmentPayment(mockReqPay1, mockResPay1);
    assert(pay1Payload && pay1Payload.success);
    assert.strictEqual(pay1Payload.installment.status, 'paid');
    assert.strictEqual(pay1Payload.installment.paidAmount, 50000);
    assert(pay1Payload.payment, 'Payment document must be created and returned');
    assert.strictEqual(pay1Payload.payment.amount, 50000);
    assert.strictEqual(pay1Payload.payment.transaction_id, 'UPI-TEST-0001');

    // 2. Pay partial amount on Installment #2 (₹15,000 out of ₹30,000)
    const inst2 = installments[1];
    const mockReqPay2 = {
      params: { id: testLead._id.toString(), installmentId: inst2._id.toString() },
      body: {
        amount: 15000,
        paymentMethod: 'cash',
      },
      user: counsellor,
      workspaceId: workspace._id,
    };

    let pay2Payload = null;
    const mockResPay2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { pay2Payload = data; return this; },
    };

    await feeInstallmentController.recordInstallmentPayment(mockReqPay2, mockResPay2);
    assert(pay2Payload && pay2Payload.success);
    assert.strictEqual(pay2Payload.installment.status, 'partially_paid');
    assert.strictEqual(pay2Payload.installment.paidAmount, 15000);

    // 3. Verify updated summary via getLeadInstallments
    const mockReqSummary = {
      params: { id: testLead._id.toString() },
      user: counsellor,
      workspaceId: workspace._id,
    };
    let summaryPayload = null;
    const mockResSummary = {
      status(code) { this.statusCode = code; return this; },
      json(data) { summaryPayload = data; return this; },
    };

    await feeInstallmentController.getLeadInstallments(mockReqSummary, mockResSummary);
    assert.strictEqual(summaryPayload.summary.totalFee, 100000);
    assert.strictEqual(summaryPayload.summary.totalPaid, 65000); // 50,000 + 15,000
    assert.strictEqual(summaryPayload.summary.totalPending, 35000);
  });
});

