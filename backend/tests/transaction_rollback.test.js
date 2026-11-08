const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

async function runTest() {
  console.log('🧪 Running Issue 7 Test: Multi-Document Transaction Atomicity & Rollback...');

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const Lead = require('../src/models/Lead');
  const Payment = require('../src/models/Payment');
  const { withTransaction } = require('../src/utils/withTransaction');

  try {
    // ── Test 1: Successful multi-document transaction commit ──
    const testLeadId = new mongoose.Types.ObjectId();
    const testUserId = new mongoose.Types.ObjectId();

    await withTransaction(async (session) => {
      const qOpts = session ? { session } : {};
      await Lead.create([
        {
          _id: testLeadId,
          name: 'Txn Success Lead',
          phone: '+919999000011',
          status: 'converted',
          userId: testUserId,
          companyId: testUserId,
        }
      ], qOpts);

      await Payment.create([
        {
          lead_id: testLeadId,
          leadId: testLeadId,
          amount: 8000,
          status: 'completed',
          transaction_id: 'TXN-SUCCESS-01',
        }
      ], qOpts);
    });

    const leadCommitted = await Lead.findById(testLeadId);
    const paymentCommitted = await Payment.findOne({ transaction_id: 'TXN-SUCCESS-01' });
    assert.ok(leadCommitted, 'Lead must be committed to DB');
    assert.ok(paymentCommitted, 'Payment must be committed to DB');
    assert.strictEqual(paymentCommitted.amount, 8000);

    // ── Test 2: Transaction rollback on failure (atomicity guarantee) ──
    const rollbackLeadId = new mongoose.Types.ObjectId();
    let caughtError = null;

    try {
      await withTransaction(async (session) => {
        const qOpts = session ? { session } : {};
        // 1st write: create lead
        await Lead.create([
          {
            _id: rollbackLeadId,
            name: 'Txn Rollback Lead',
            phone: '+919999000022',
            status: 'converted',
            userId: testUserId,
            companyId: testUserId,
          }
        ], qOpts);

        // 2nd write: force intentional failure (e.g. invalid payment amount or thrown exception)
        throw new Error('Simulated database/service failure mid-transaction');
      });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Transaction must throw on failure');
    assert.strictEqual(caughtError.message, 'Simulated database/service failure mid-transaction');

    // Crucial assertion: Lead written before the failure MUST BE ROLLED BACK
    const rolledBackLead = await Lead.findById(rollbackLeadId);
    assert.strictEqual(rolledBackLead, null, 'Lead created inside aborted transaction MUST be rolled back');

    console.log('✅ Issue 7 Test PASSED: Multi-document transaction successfully commits and fully rolls back on failure.');
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 7 Test FAILED:', err);
    process.exit(1);
  });
