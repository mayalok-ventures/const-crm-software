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

const { isInstallmentOverdue, getLeadInstallments, recordInstallmentPayment } = require('../src/controllers/feeInstallmentController');

describe('F4 Hardening: UTC-Safe Overdue & Golden Payment Analytics Invariant Tests', () => {
  let mongod;
  let workspaceA;
  let workspaceB;
  let ownerA;
  let counsellorA;
  let userB;
  let leadA;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    // Workspace A
    const ownerAId = new mongoose.Types.ObjectId();
    workspaceA = await Workspace.create({
      name: 'Alpha Coaching Academy',
      domain: 'alpha-academy',
      ownerId: ownerAId,
    });

    ownerA = await User.create({
      _id: ownerAId,
      name: 'Director Alpha',
      email: 'owner@alpha.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });
    ownerA.workspaceId = workspaceA._id;
    ownerA.workspaceRole = 'owner';

    counsellorA = await User.create({
      name: 'Counsellor Alice',
      email: 'alice@alpha.test',
      password: 'password123',
      role: 'counsellor',
      workStatus: 'counsellor',
      companyRole: 'counsellor',
    });
    counsellorA.workspaceId = workspaceA._id;
    counsellorA.workspaceRole = 'counsellor';

    await WorkspaceMembership.create({
      workspaceId: workspaceA._id,
      userId: ownerA._id,
      role: 'owner',
      status: 'active',
    });
    await WorkspaceMembership.create({
      workspaceId: workspaceA._id,
      userId: counsellorA._id,
      role: 'counsellor',
      status: 'active',
    });

    // Workspace B (isolation check)
    const ownerBId = new mongoose.Types.ObjectId();
    workspaceB = await Workspace.create({
      name: 'Beta Institute',
      domain: 'beta-institute',
      ownerId: ownerBId,
    });

    userB = await User.create({
      _id: ownerBId,
      name: 'Director Beta',
      email: 'owner@beta.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });
    userB.workspaceId = workspaceB._id;
    userB.workspaceRole = 'owner';

    await WorkspaceMembership.create({
      workspaceId: workspaceB._id,
      userId: userB._id,
      role: 'owner',
      status: 'active',
    });

    // Test Lead in Workspace A
    leadA = await Lead.create({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.test',
      phone: '+919876543210',
      workspaceId: workspaceA._id,
      companyId: workspaceA._id,
      userId: ownerA._id,
      assignedTo: counsellorA._id,
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

  describe('1. UTC-Safe Overdue Derivation', () => {
    it('isInstallmentOverdue evaluates against end of UTC day plus gracePeriodDays', () => {
      // Due Date: 2026-11-08 (any time of day)
      const dueDate = new Date('2026-11-08T05:30:00.000Z');

      // Check on same day at 12:00:00 UTC with grace = 0 -> NOT overdue
      const sameDayMidday = new Date('2026-11-08T12:00:00.000Z').getTime();
      assert.strictEqual(isInstallmentOverdue(dueDate, 0, sameDayMidday), false, 'Should not be overdue during due date');

      // Check on same day at 23:59:59.999 UTC with grace = 0 -> NOT overdue
      const endOfDueDay = Date.UTC(2026, 10, 8, 23, 59, 59, 999);
      assert.strictEqual(isInstallmentOverdue(dueDate, 0, endOfDueDay), false, 'Should not be overdue at exact end of due day');

      // Check 1 millisecond after end of due day with grace = 0 -> OVERDUE
      assert.strictEqual(isInstallmentOverdue(dueDate, 0, endOfDueDay + 1), true, 'Should be overdue right after due day ends');

      // Check next day with grace = 1 day (grace ends 2026-11-09T23:59:59.999Z)
      const nextDayAfternoon = new Date('2026-11-09T15:00:00.000Z').getTime();
      assert.strictEqual(isInstallmentOverdue(dueDate, 1, nextDayAfternoon), false, 'Grace period of 1 day protects next day');

      const afterGracePeriod = Date.UTC(2026, 10, 9, 23, 59, 59, 999) + 1;
      assert.strictEqual(isInstallmentOverdue(dueDate, 1, afterGracePeriod), true, 'Overdue after grace period elapsed');
    });

    it('getLeadInstallments auto-updates overdue status accurately using UTC threshold', async () => {
      // Create installment due yesterday UTC
      const yesterdayUtc = new Date(Date.now() - 2 * 86400000);
      const installment = await FeeInstallment.create({
        workspaceId: workspaceA._id,
        leadId: leadA._id,
        installmentNumber: 1,
        title: 'Past Due Term 1',
        amount: 25000,
        dueDate: yesterdayUtc,
        gracePeriodDays: 0,
        status: 'pending',
      });

      const mockReq = {
        params: { id: leadA._id.toString() },
        user: counsellorA,
        workspaceId: workspaceA._id,
      };

      let resPayload = null;
      const mockRes = {
        status(c) { this.statusCode = c; return this; },
        json(d) { resPayload = d; return this; },
      };

      await getLeadInstallments(mockReq, mockRes);
      assert(resPayload && resPayload.success);
      const item = resPayload.installments.find(i => i._id.toString() === installment._id.toString());
      assert.strictEqual(item.status, 'overdue', 'Installment should have updated to overdue');
      assert.strictEqual(resPayload.summary.totalOverdue, 25000);
    });
  });

  describe('2. Multi-Tenant Workspace Isolation', () => {
    it('User from Workspace B cannot fetch or record payment for Workspace A lead installments', async () => {
      const inst = await FeeInstallment.create({
        workspaceId: workspaceA._id,
        leadId: leadA._id,
        installmentNumber: 2,
        title: 'Term 2 Fee',
        amount: 30000,
        dueDate: new Date(Date.now() + 15 * 86400000),
        gracePeriodDays: 2,
        status: 'pending',
      });

      // User B tries to get installments of Lead A
      const mockReqGet = {
        params: { id: leadA._id.toString() },
        user: userB,
        workspaceId: workspaceB._id,
      };
      let getStatus = 200;
      let getPayload = null;
      const mockResGet = {
        status(c) { getStatus = c; return this; },
        json(d) { getPayload = d; return this; },
      };

      await getLeadInstallments(mockReqGet, mockResGet);
      assert.strictEqual(getStatus, 404, 'Cross-workspace lead access must return 404');

      // User B tries to pay Lead A installment
      const mockReqPay = {
        params: { id: leadA._id.toString(), installmentId: inst._id.toString() },
        body: { amount: 30000 },
        user: userB,
        workspaceId: workspaceB._id,
      };
      let payStatus = 200;
      const mockResPay = {
        status(c) { payStatus = c; return this; },
        json(d) { return this; },
      };

      await recordInstallmentPayment(mockReqPay, mockResPay);
      assert.strictEqual(payStatus, 404, 'Cross-workspace payment record must return 404');
    });
  });

  describe('3. Golden Test: Zero Disruption to Existing Payment Analytics and Totals', () => {
    it('Installment payment integrates cleanly into standard Payment aggregations without skewing metrics', async () => {
      // 1. Seed existing payment records in Workspace A
      await Payment.create([
        {
          lead_id: leadA._id,
          leadId: leadA._id,
          workspaceId: workspaceA._id,
          companyId: workspaceA._id,
          amount: 10000,
          status: 'completed',
          method: 'upi',
          transaction_id: 'LEGACY-PAY-01',
        },
        {
          lead_id: leadA._id,
          leadId: leadA._id,
          workspaceId: workspaceA._id,
          companyId: workspaceA._id,
          amount: 15000,
          status: 'captured',
          method: 'card',
          transaction_id: 'LEGACY-PAY-02',
        },
        {
          lead_id: leadA._id,
          leadId: leadA._id,
          workspaceId: workspaceA._id,
          companyId: workspaceA._id,
          amount: 5000,
          status: 'refunded',
          method: 'netbanking',
          transaction_id: 'LEGACY-PAY-REFUND',
        },
      ]);

      // Baseline revenue aggregation as used in adminController / dashboard analytics
      const getRevenueTotal = async (wsId) => {
        const agg = await Payment.aggregate([
          {
            $match: {
              status: { $in: ['completed', 'captured', 'success'] },
              $or: [{ workspaceId: wsId }, { companyId: wsId }],
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        return agg[0]?.total || 0;
      };

      const baselineRevenue = await getRevenueTotal(workspaceA._id);
      assert.strictEqual(baselineRevenue, 25000, 'Baseline revenue must be 10000 + 15000 = 25000 (excluding refunded 5000)');

      // 2. Create installment and record an installment payment of 8,000
      const inst = await FeeInstallment.create({
        workspaceId: workspaceA._id,
        leadId: leadA._id,
        installmentNumber: 3,
        title: 'Lab Fee Installment',
        amount: 8000,
        dueDate: new Date(Date.now() + 5 * 86400000),
        status: 'pending',
      });

      const mockReqPay = {
        params: { id: leadA._id.toString(), installmentId: inst._id.toString() },
        body: {
          amount: 8000,
          paymentMethod: 'bank_transfer',
          transactionId: 'TXN-INST-GOLDEN-01',
        },
        user: counsellorA,
        workspaceId: workspaceA._id,
      };

      let payPayload = null;
      let payStatus = 200;
      const mockResPay = {
        status(c) { payStatus = c; return this; },
        json(d) { payPayload = d; return this; },
      };

      await recordInstallmentPayment(mockReqPay, mockResPay);
      assert.strictEqual(payStatus, 200);
      assert(payPayload && payPayload.success);
      assert.strictEqual(payPayload.installment.status, 'paid');
      assert.strictEqual(payPayload.payment.amount, 8000);
      assert.strictEqual(payPayload.payment.status, 'completed');
      assert.strictEqual(payPayload.payment.workspaceId.toString(), workspaceA._id.toString());
      assert.strictEqual(payPayload.payment.companyId.toString(), workspaceA._id.toString());

      // 3. Post-payment revenue aggregation
      const postPaymentRevenue = await getRevenueTotal(workspaceA._id);
      assert.strictEqual(postPaymentRevenue, 33000, 'Post-payment revenue must equal 25000 + 8000 = 33000');

      // 4. Verify refunded payment and legacy payments are intact
      const allPayments = await Payment.find({
        $or: [{ workspaceId: workspaceA._id }, { companyId: workspaceA._id }],
      });
      assert.strictEqual(allPayments.length, 4, 'Must have 3 legacy + 1 installment payment');
      const refundRecord = allPayments.find(p => p.transaction_id === 'LEGACY-PAY-REFUND');
      assert(refundRecord);
      assert.strictEqual(refundRecord.status, 'refunded');
      assert.strictEqual(refundRecord.amount, 5000);
    });
  });
});
