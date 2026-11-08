const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  acquireDistributedLock,
  renewDistributedLock,
  releaseDistributedLock,
  withDistributedLock,
  getLockModel,
} = require('../src/utils/distributedLock');
const TenantConfig = require('../src/models/TenantConfig');
const User = require('../src/models/User');

let mongod;

describe('F4: Distributed Locks and Concurrency Guards for Crons and Workers', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('F4.1: should prevent concurrent execution of the same cron across multiple instances', async () => {
    let worker1Ran = false;
    let worker2Ran = false;

    // Simulate two worker instances attempting to run the meta leads reconciliation cron simultaneously
    const lockKey = 'cron_test_meta_reconciliation';

    const p1 = withDistributedLock(lockKey, 5000, async () => {
      worker1Ran = true;
      // Hold the lock for 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'worker1_done';
    });

    // Small yield to let p1 acquire first
    await new Promise(resolve => setTimeout(resolve, 10));

    const p2 = withDistributedLock(lockKey, 5000, async () => {
      worker2Ran = true;
      return 'worker2_done';
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    const executedCount = [res1, res2].filter(r => r.executed).length;
    const skippedCount = [res1, res2].filter(r => r.skipped).length;

    assert.strictEqual(executedCount, 1, 'Exactly one worker must acquire and execute');
    assert.strictEqual(skippedCount, 1, 'The competing worker must skip execution');
    assert.strictEqual(worker1Ran !== worker2Ran, true, 'Only one worker function must have executed');
  });

  it('F4.2: should renew lock lease automatically via heartbeat for active jobs', async () => {
    assert.strictEqual(typeof renewDistributedLock, 'function', 'renewDistributedLock must be exported');

    const lockKey = 'cron_test_heartbeat_renewal';
    const lock = await acquireDistributedLock(lockKey, 2000, 'worker_heartbeat_test');
    assert.strictEqual(lock.acquired, true);

    const initialExpiresAt = (await getLockModel().findById(lockKey)).expiresAt.getTime();

    // Sleep 100ms, then renew for another 5000ms
    await new Promise(r => setTimeout(r, 100));
    const renewed = await renewDistributedLock(lockKey, 'worker_heartbeat_test', 5000);
    assert.strictEqual(renewed, true, 'Lock lease renewal must succeed for owner');

    const updatedExpiresAt = (await getLockModel().findById(lockKey)).expiresAt.getTime();
    assert.ok(updatedExpiresAt > initialExpiresAt, 'Renewed expiresAt must be greater than initial');

    await lock.release();
  });

  it('F4.3: should distribute concurrent round-robin assignments atomically in automationHandlers', async () => {
    const { assignEdTechRoundRobin } = require('../src/services/automationHandlers');

    // Create test tenant user and agents
    const tenantUser = await User.create({
      name: 'Owner Admin',
      email: `owner_${Date.now()}@test.com`,
      password: 'password123',
      role: 'admin',
    });

    const agent1 = await User.create({
      name: 'Agent One',
      email: `agent1_${Date.now()}@test.com`,
      password: 'password123',
      role: 'counsellor',
      companyId: tenantUser._id,
    });

    const agent2 = await User.create({
      name: 'Agent Two',
      email: `agent2_${Date.now()}@test.com`,
      password: 'password123',
      role: 'counsellor',
      companyId: tenantUser._id,
    });

    const agent3 = await User.create({
      name: 'Agent Three',
      email: `agent3_${Date.now()}@test.com`,
      password: 'password123',
      role: 'counsellor',
      companyId: tenantUser._id,
    });

    // Run 9 concurrent round-robin lead assignments
    const assignments = await Promise.all(
      Array.from({ length: 9 }).map((_, idx) =>
        assignEdTechRoundRobin({
          companyId: tenantUser._id,
        })
      )
    );

    // Count distributions across the 3 agents
    const counts = {};
    for (const a of assignments) {
      const idStr = String(a);
      counts[idStr] = (counts[idStr] || 0) + 1;
    }

    const a1Count = counts[String(agent1._id)] || 0;
    const a2Count = counts[String(agent2._id)] || 0;
    const a3Count = counts[String(agent3._id)] || 0;

    // Exactly 3 each under perfect atomic round robin!
    assert.strictEqual(a1Count, 3, `Agent 1 must receive exactly 3 leads, got ${a1Count}`);
    assert.strictEqual(a2Count, 3, `Agent 2 must receive exactly 3 leads, got ${a2Count}`);
    assert.strictEqual(a3Count, 3, `Agent 3 must receive exactly 3 leads, got ${a3Count}`);
  });
});
