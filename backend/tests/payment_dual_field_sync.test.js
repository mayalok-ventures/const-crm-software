const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function runTest() {
  console.log('🧪 Running Issue 9 Test: Payment Dual Field Pairs Query Sync & Reconciliation...');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const Payment = require('../src/models/Payment');
  const { runReconciliation } = require('../src/scripts/reconcilePaymentFieldPairs');

  const leadId1 = new mongoose.Types.ObjectId();
  const leadId2 = new mongoose.Types.ObjectId();

  try {
    // 1. Create a payment document initially
    const pay = await Payment.create({
      lead_id: leadId1,
      amount: 1000,
      transaction_id: 'TXN-INITIAL-01',
      status: 'completed',
    });

    assert.strictEqual(pay.leadId.toString(), leadId1.toString(), 'Save hook should set leadId from lead_id');
    assert.strictEqual(pay.transactionId, 'TXN-INITIAL-01', 'Save hook should set transactionId from transaction_id');

    // 2. Test updateOne updating camelCase leadId => query middleware must update snake_case lead_id
    await Payment.updateOne({ _id: pay._id }, { $set: { leadId: leadId2 } });
    const checkAfterUpdateOne = await Payment.findById(pay._id);
    assert.strictEqual(checkAfterUpdateOne.leadId.toString(), leadId2.toString());
    assert.strictEqual(checkAfterUpdateOne.lead_id.toString(), leadId2.toString(), 'Query middleware must sync lead_id when leadId is updated');

    // 3. Test findOneAndUpdate updating transactionId => query middleware must update transaction_id
    await Payment.findOneAndUpdate(
      { _id: pay._id },
      { $set: { transactionId: 'TXN-UPDATED-02', verifiedByAgent: true } },
      { new: true }
    );
    const checkAfterFindOneAndUpdate = await Payment.findById(pay._id);
    assert.strictEqual(checkAfterFindOneAndUpdate.transaction_id, 'TXN-UPDATED-02', 'Query middleware must sync transaction_id');
    assert.strictEqual(checkAfterFindOneAndUpdate.verified_by_agent, true, 'Query middleware must sync verified_by_agent');

    // 4. Test Reconciliation Script on artificially drifted record
    // Insert a raw drifted record bypassing Mongoose middleware
    const driftedLeadId = new mongoose.Types.ObjectId();
    const rawResult = await Payment.collection.insertOne({
      lead_id: driftedLeadId,
      amount: 2500,
      transaction_id: 'TXN-DRIFTED-99',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const driftedId = rawResult.insertedId;

    // Dry Run should report 1 drifted document
    const dryRunResult = await runReconciliation({ apply: false });
    assert.strictEqual(dryRunResult.drifted, 1, 'Reconciliation should find 1 drifted record');

    const checkStillDrifted = await Payment.collection.findOne({ _id: driftedId });
    assert.strictEqual(checkStillDrifted.leadId, undefined, 'Dry run should not alter drifted record');

    // Apply Mode should fix drifted document
    const applyResult = await runReconciliation({ apply: true });
    assert.strictEqual(applyResult.drifted, 1);

    const checkFixed = await Payment.collection.findOne({ _id: driftedId });
    assert.strictEqual(checkFixed.leadId.toString(), driftedLeadId.toString(), 'Apply mode must sync leadId');
    assert.strictEqual(checkFixed.transactionId, 'TXN-DRIFTED-99', 'Apply mode must sync transactionId');

    console.log('✅ Issue 9 Test PASSED: Payment dual field pairs query sync and reconciliation verified.');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 9 Test FAILED:', err);
    process.exit(1);
  });
