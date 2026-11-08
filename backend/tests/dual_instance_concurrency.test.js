const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Dual Server Instance Concurrency & Single Lease Holder...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  await mongoose.connect(uri);
  console.log('✅ Connected default Mongoose instance to shared in-memory MongoDB replica.');

  const { withDistributedLock, getLockModel } = require('../src/utils/distributedLock');
  const waSession = require('../src/services/waSession');

  const LockModel = getLockModel();
  await LockModel.init();

  // ── TEST 1: ONCE-ONLY CRON JOB CONCURRENCY ──────────────────────────────
  let executionCount = 0;
  const cronTask = async () => {
    executionCount++;
    await new Promise((r) => setTimeout(r, 60));
    return 'done';
  };

  // Node A and Node B attempt to run the same scheduled job simultaneously with different ownerIds
  const [resultA, resultB] = await Promise.all([
    withDistributedLock('nightly_lead_reconciliation', cronTask, { ttlMs: 5000, ownerId: 'server_instance_node_A' }),
    withDistributedLock('nightly_lead_reconciliation', cronTask, { ttlMs: 5000, ownerId: 'server_instance_node_B' }),
  ]);

  assert.strictEqual(executionCount, 1, 'Job body must execute exactly ONCE across both nodes');
  const executedResult = resultA.executed ? resultA : resultB;
  const skippedResult = resultA.executed ? resultB : resultA;

  assert.strictEqual(executedResult.executed, true, 'One node must win the lock and execute');
  assert.strictEqual(skippedResult.executed, false, 'The losing node must skip execution gracefully');
  assert.strictEqual(skippedResult.reason, 'locked', 'Reason must be locked');
  console.log('✅ Test 1: Once-only cron job executed exactly once across two competing server instances.');

  // ── TEST 2: WHATSAPP DISTRIBUTED LEASE SINGLE-HOLDER ────────────────────
  const WhatsAppSessionState = mongoose.model('WhatsAppSessionState');
  const sessionId = 'test_tenant_whatsapp_line';

  // Seed session state
  await WhatsAppSessionState.create({
    sessionId,
    phone: '919876543210',
    status: 'CONNECTED',
    leaseOwner: null,
    leaseExpiresAt: null,
  });

  // Current process acquires lease
  const acquired = await waSession.acquireLease(sessionId);
  assert.strictEqual(acquired, true, 'Process must successfully acquire the free lease');

  // Verify lease in DB
  let sessionDoc = await WhatsAppSessionState.findOne({ sessionId });
  assert.strictEqual(sessionDoc.leaseOwner, waSession.INSTANCE_ID);
  assert.ok(sessionDoc.leaseExpiresAt > new Date());

  // Simulate another node/foreign cluster worker holding an active lease
  await WhatsAppSessionState.updateOne(
    { sessionId },
    {
      $set: {
        leaseOwner: 'worker_node_pid_99999',
        leaseExpiresAt: new Date(Date.now() + 60000), // active for 60s
      },
    }
  );

  // Competing acquisition by current process must be rejected
  const rejected = await waSession.acquireLease(sessionId);
  assert.strictEqual(rejected, false, 'Lease acquisition must be rejected when active lease held by another node');

  // Once foreign lease expires, acquisition succeeds again
  await WhatsAppSessionState.updateOne(
    { sessionId },
    {
      $set: {
        leaseExpiresAt: new Date(Date.now() - 1000), // expired
      },
    }
  );

  const reclaimed = await waSession.acquireLease(sessionId);
  assert.strictEqual(reclaimed, true, 'Expired lease must be safely reclaimed by competing node');
  console.log('✅ Test 2: WhatsApp distributed lease strictly enforces single-holder semantics across cluster instances.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL DUAL-INSTANCE CONCURRENCY TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
