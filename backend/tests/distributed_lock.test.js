const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Mongo Distributed Lock for Once-Only Recurring Jobs (R3)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const {
    acquireDistributedLock,
    releaseDistributedLock,
    withDistributedLock,
  } = require('../src/utils/distributedLock');

  // 1. Basic Mutual Exclusion
  const lock1 = await acquireDistributedLock('job_alpha', 10000, 'worker_1');
  assert.strictEqual(lock1.acquired, true, 'Worker 1 must acquire lock');

  const lock2 = await acquireDistributedLock('job_alpha', 10000, 'worker_2');
  assert.strictEqual(lock2.acquired, false, 'Worker 2 must be blocked while lock held by Worker 1');
  console.log('✅ Step 1: Mutual exclusion verified. Worker 2 blocked while Worker 1 holds lock.');

  // Release by Worker 1
  const released = await lock1.release();
  assert.strictEqual(released, true);

  // Now Worker 2 acquires
  const lock2After = await acquireDistributedLock('job_alpha', 10000, 'worker_2');
  assert.strictEqual(lock2After.acquired, true, 'Worker 2 must acquire lock after Worker 1 release');
  await lock2After.release();
  console.log('✅ Step 2: Lock successfully transferred to Worker 2 after release.');

  // 2. TTL Automatic Expiration
  const shortLock = await acquireDistributedLock('job_beta', 150, 'worker_1');
  assert.strictEqual(shortLock.acquired, true);

  // Immediately blocked
  const blockedAttempt = await acquireDistributedLock('job_beta', 10000, 'worker_2');
  assert.strictEqual(blockedAttempt.acquired, false);

  // Wait for TTL expiration (180ms)
  await new Promise((r) => setTimeout(r, 180));

  // Worker 2 should now acquire because lock expired
  const expiredAcquire = await acquireDistributedLock('job_beta', 10000, 'worker_2');
  assert.strictEqual(expiredAcquire.acquired, true, 'Worker 2 must acquire expired lock');
  await expiredAcquire.release();
  console.log('✅ Step 3: Expired lock automatically reclaimed after TTL.');

  // 3. withDistributedLock Wrapper
  let workDone = false;
  let concurrentSkipped = false;

  const promise1 = withDistributedLock('job_gamma', 1000, async () => {
    await new Promise((r) => setTimeout(r, 200));
    workDone = true;
    return 'done_work';
  });

  // Small delay then concurrent attempt
  await new Promise((r) => setTimeout(r, 50));
  const resConcurrent = await withDistributedLock('job_gamma', 1000, async () => {
    return 'should_not_run';
  });

  if (resConcurrent.skipped) {
    concurrentSkipped = true;
  }

  const res1 = await promise1;
  assert.strictEqual(res1.executed, true);
  assert.strictEqual(res1.result, 'done_work');
  assert.strictEqual(workDone, true);
  assert.strictEqual(concurrentSkipped, true, 'Concurrent worker must skip job cleanly');
  console.log('✅ Step 4: withDistributedLock executed work once and skipped concurrent worker.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL R3 DISTRIBUTED LOCK TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
