const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let Lead;
let FollowUp;
let FeeInstallment;
let Payment;
let User;
let Workspace;

const leadsController = require('../src/controllers/leadsController');
const feeInstallmentController = require('../src/controllers/feeInstallmentController');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  Lead = require('../src/models/Lead');
  FollowUp = require('../src/models/FollowUp');
  FeeInstallment = require('../src/models/FeeInstallment');
  Payment = require('../src/models/Payment');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F1.5: Idempotency Key and Double-Submit Guard on Mutating Endpoints', () => {
  it('scheduleFollowUp does not create duplicate FollowUp documents under rapid retry / same idempotency key', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'Idempotency WS', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Agent Idempotent',
      email: 'agent_idem@test.com',
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
      name: 'Student FollowUp Dedup',
      phone: '9555511111',
      phoneDigits: '9555511111',
      status: 'contacted',
    });

    const scheduledDate = new Date(Date.now() + 86400000);
    const req1 = {
      params: { id: lead._id.toString() },
      body: {
        scheduledAt: scheduledDate,
        note: 'Discuss fee structure',
        idempotencyKey: 'FUP_KEY_12345',
      },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res1 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    // First request
    await leadsController.scheduleFollowUp(req1, res1);
    assert.strictEqual(res1.statusCode || 200, 201);

    // Second request with exact same idempotency key (simulating network retry)
    const req2 = {
      params: { id: lead._id.toString() },
      body: {
        scheduledAt: scheduledDate,
        note: 'Discuss fee structure',
        idempotencyKey: 'FUP_KEY_12345',
      },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res2 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.scheduleFollowUp(req2, res2);
    assert.strictEqual(res2.statusCode || 200, 200, 'Replayed request must return HTTP 200');
    assert.strictEqual(res2.body.idempotent, true, 'Response must identify idempotent replay');

    // Count documents in DB
    const fupDocs = await FollowUp.find({ lead_id: lead._id });
    assert.strictEqual(fupDocs.length, 1, 'Only exactly 1 FollowUp document must exist in DB');
  });

  it('createLead returns existing lead idempotently on retry with same idempotencyKey and phone', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();

    const req1 = {
      body: {
        name: 'Retry Lead',
        phone: '9555522222',
        targetDomain: 'Engineering (B.Tech/BE)',
        status: 'new',
        idempotencyKey: 'LEAD_IDEM_999',
      },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res1 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.createLead(req1, res1);
    if ((res1.statusCode || 200) !== 201) {
      console.error('createLead req1 failed with:', res1.statusCode, res1.body);
    }
    assert.strictEqual(res1.statusCode || 200, 201);

    // Re-submit exact same create request
    const req2 = {
      body: {
        name: 'Retry Lead',
        phone: '9555522222',
        targetDomain: 'Engineering (B.Tech/BE)',
        status: 'new',
        idempotencyKey: 'LEAD_IDEM_999',
      },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res2 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.createLead(req2, res2);
    assert.strictEqual(res2.statusCode || 200, 200, 'Retry with idempotency key must return 200');
    assert.strictEqual(res2.body.idempotent, true);

    const leadCount = await Lead.countDocuments({ phone: '9555522222' });
    assert.strictEqual(leadCount, 1, 'Exactly 1 lead document must exist');
  });

  it('recordInstallmentPayment does not duplicate Payment under same idempotencyKey retry', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();

    const lead = await Lead.create({
      workspaceId: ws._id,
      companyId: ws._id,
      userId: user._id,
      assignedTo: user._id,
      name: 'Fee Lead',
      phone: '9555533333',
      phoneDigits: '9555533333',
      status: 'contacted',
      targetDomain: 'Engineering (B.Tech/BE)',
    });

    const inst = await FeeInstallment.create({
      workspaceId: ws._id,
      leadId: lead._id,
      installmentNumber: 1,
      amount: 10000,
      paidAmount: 0,
      dueDate: new Date(),
      status: 'pending',
    });

    const payReq1 = {
      params: { id: lead._id.toString(), installmentId: inst._id.toString() },
      body: {
        amount: 5000,
        idempotencyKey: 'PAY_IDEM_777',
      },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const payRes1 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await feeInstallmentController.recordInstallmentPayment(payReq1, payRes1);
    assert.strictEqual(payRes1.statusCode || 200, 200);

    const payReq2 = {
      params: { id: lead._id.toString(), installmentId: inst._id.toString() },
      body: {
        amount: 5000,
        idempotencyKey: 'PAY_IDEM_777',
      },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const payRes2 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await feeInstallmentController.recordInstallmentPayment(payReq2, payRes2);
    assert.strictEqual(payRes2.statusCode || 200, 200);
    assert.strictEqual(payRes2.body.idempotent, true);

    const paymentDocs = await Payment.find({ lead_id: lead._id, idempotencyKey: 'PAY_IDEM_777' });
    assert.strictEqual(paymentDocs.length, 1, 'Only 1 Payment document created despite retry');

    const updatedInst = await FeeInstallment.findById(inst._id);
    assert.strictEqual(updatedInst.paidAmount, 5000, 'Paid amount must not be double-incremented');
  });
});
