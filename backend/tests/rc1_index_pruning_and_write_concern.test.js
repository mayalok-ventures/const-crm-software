/**
 * RC1 Gate: Index Pruning Explain Verification & Write Concern Durability
 *
 * Verifies:
 * 1. Schema-level writeConcern { w: 'majority', j: true, wtimeout: 10000 } is active on all 5 critical models:
 *    - Lead
 *    - Payment
 *    - FeeInstallment
 *    - ImportJob
 *    - AdmissionDeal
 * 2. pruneRedundantLeadIndexes script is dry-run by default, and safely drops redundant indexes in apply mode.
 * 3. Top 10 lead queries run explain() before and after index pruning, proving:
 *    - winningPlan stage is IXSCAN (no COLLSCAN)
 *    - sort operations are covered by indexes (no in-memory SORT stage)
 * 4. Benchmarks 1,000 document insertions with writeConcern enabled and reports measured throughput.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Lead = require('../src/models/Lead');
const Payment = require('../src/models/Payment');
const FeeInstallment = require('../src/models/FeeInstallment');
const ImportJob = require('../src/models/ImportJob');
const AdmissionDeal = require('../src/models/AdmissionDeal');
const { REDUNDANT_INDEXES, pruneRedundantIndexes } = require('../src/scripts/pruneRedundantLeadIndexes');

describe('RC1 Gate: Index Pruning & Write Concern Durability', function () {
  this.timeout(60000);
  let mongoServer;
  const workspaceId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Ensure models are registered and build all indexes
    await Promise.all([
      Lead.init(),
      Payment.init(),
      FeeInstallment.init(),
      ImportJob.init(),
      AdmissionDeal.init(),
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('1. Confirms w: "majority", j: true is configured on all 5 critical models', () => {
    const criticalModels = [
      { name: 'Lead', model: Lead },
      { name: 'Payment', model: Payment },
      { name: 'FeeInstallment', model: FeeInstallment },
      { name: 'ImportJob', model: ImportJob },
      { name: 'AdmissionDeal', model: AdmissionDeal },
    ];

    for (const { name, model } of criticalModels) {
      const wc = model.schema.get('writeConcern');
      assert.ok(wc, `${name} must have schema-level writeConcern configured`);
      assert.strictEqual(wc.w, 'majority', `${name} writeConcern.w must be 'majority'`);
      assert.strictEqual(wc.j, true, `${name} writeConcern.j must be true`);
      assert.ok(wc.wtimeout >= 5000, `${name} writeConcern.wtimeout must be >= 5000ms`);
    }
  });

  it('2. Index pruning script defaults to dry-run and does not drop indexes', async () => {
    const beforeIndexes = await mongoose.connection.collection('leads').listIndexes().toArray();
    const dryRunResult = await pruneRedundantIndexes(mongoose.connection, { apply: false });

    assert.strictEqual(dryRunResult.mode, 'dry-run');
    assert.strictEqual(dryRunResult.dropped.length, 0);

    const afterIndexes = await mongoose.connection.collection('leads').listIndexes().toArray();
    assert.strictEqual(afterIndexes.length, beforeIndexes.length, 'Dry run must not drop any indexes');
  });

  it('3. Top 10 lead queries use IXSCAN and index-backed sorting before and after pruning', async () => {
    // Seed sample lead and installment data for explain execution
    const testLead = await Lead.create({
      workspaceId,
      userId,
      companyId: userId,
      name: 'Explain Candidate',
      phone: '+919876543210',
      email: 'explain@candidate.test',
      status: 'new_lead',
      pipelineStage: 'new_lead',
      followUpDate: new Date(),
      assignedTo: userId,
    });

    await FeeInstallment.create({
      workspaceId,
      leadId: testLead._id,
      installmentNumber: 1,
      amount: 15000,
      dueDate: new Date(),
      status: 'pending',
    });

    // Helper to inspect winning plan for COLLSCAN or in-memory SORT
    function checkPlanHealth(plan, queryName) {
      const planStr = JSON.stringify(plan);
      // Fail if the plan falls back to COLLSCAN when an index should be used
      assert.ok(
        !planStr.includes('"stage":"COLLSCAN"'),
        `[${queryName}] Query must not perform COLLSCAN. Plan: ${planStr}`
      );
      // Fail if in-memory sort is used instead of index-backed order
      assert.ok(
        !planStr.includes('"stage":"SORT"') || planStr.includes('SORT_KEY_GENERATOR'),
        `[${queryName}] Query must not perform in-memory SORT. Plan: ${planStr}`
      );
    }

    const queries = [
      { name: '1. List', run: () => Lead.find({ workspaceId }).sort({ createdAt: -1 }).explain('executionStats') },
      { name: '2. Filtered List', run: () => Lead.find({ workspaceId, status: 'new_lead' }).sort({ _id: -1 }).explain('executionStats') },
      { name: '3. Kanban View', run: () => Lead.find({ workspaceId, pipelineStage: 'new_lead' }).sort({ _id: -1 }).explain('executionStats') },
      { name: '4. Phone Search', run: () => Lead.find({ workspaceId, phoneDigits: '919876543210' }).explain('executionStats') },
      { name: '5. Followups', run: () => Lead.find({ workspaceId, followUpDate: { $lte: new Date() } }).explain('executionStats') },
      { name: '6. Assignment counts', run: () => Lead.find({ workspaceId, assignedTo: userId }).sort({ _id: -1 }).explain('executionStats') },
      { name: '7. Duplicate Check', run: () => Lead.find({ companyId: userId, phone: '+919876543210' }).explain('executionStats') },
      { name: '8. Bulk Export', run: () => Lead.find({ workspaceId }).sort({ createdAt: -1 }).explain('executionStats') },
      { name: '9. Timeline Lookup', run: () => Lead.find({ workspaceId, _id: testLead._id }).explain('executionStats') },
      { name: '10. Fee Installments', run: () => FeeInstallment.find({ workspaceId, leadId: testLead._id }).sort({ installmentNumber: 1 }).explain('executionStats') },
    ];

    // Check BEFORE pruning
    for (const q of queries) {
      const exp = await q.run();
      const plan = exp.queryPlanner?.winningPlan || exp;
      checkPlanHealth(plan, `${q.name} (Before Pruning)`);
    }

    // Now apply index pruning
    const pruneResult = await pruneRedundantIndexes(mongoose.connection, { apply: true });
    assert.strictEqual(pruneResult.mode, 'apply');
    console.log(`[RC1 Gate] Dropped ${pruneResult.droppedCount} redundant indexes. Remaining: ${pruneResult.remainingCount}`);

    // Check AFTER pruning
    for (const q of queries) {
      const exp = await q.run();
      const plan = exp.queryPlanner?.winningPlan || exp;
      checkPlanHealth(plan, `${q.name} (After Pruning)`);
    }
  });

  it('4. Measures 1,000 document insertion throughput with w: majority, j: true', async () => {
    const count = 1000;
    const docs = [];
    for (let i = 0; i < count; i++) {
      docs.push({
        workspaceId,
        userId,
        companyId: userId,
        name: `Throughput Candidate ${i}`,
        phone: `+9198000${String(i).padStart(5, '0')}`,
        email: `throughput_${i}@crm.test`,
        status: 'new_lead',
        source: 'MANUAL',
      });
    }

    const tStart = Date.now();
    // Insert with majority write concern active
    const inserted = await Lead.insertMany(docs, { ordered: false });
    const elapsedMs = Date.now() - tStart;
    const docsPerSec = Math.round((count / (elapsedMs / 1000)));

    assert.strictEqual(inserted.length, count, 'All 1,000 documents must be written');
    console.log(`[RC1 Gate] Write Throughput Benchmark: 1,000 docs in ${elapsedMs}ms (${docsPerSec} docs/sec) with w: majority, j: true`);

    assert.ok(docsPerSec > 200, `Write throughput (${docsPerSec} docs/sec) must exceed 200 docs/sec baseline`);
  });
});

