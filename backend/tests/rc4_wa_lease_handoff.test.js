const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.WA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const WhatsAppSessionState = require('../src/models/WhatsAppSessionState');
const waSession = require('../src/services/waSession');

describe('RC-4: WhatsApp Session Lease Rolling Deploy Handoff & Retry-Acquire Gate', function () {
  this.timeout(20000);
  let mongoServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await WhatsAppSessionState.deleteMany({});
  });

  it('1. Lease Isolation: Instance B is strictly fenced when Instance A holds active unexpired lease', async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const futureExpiry = new Date(Date.now() + 60000);

    // Seed state as owned by Instance A (worker-alpha-01)
    await WhatsAppSessionState.create({
      sessionId,
      leaseOwner: 'worker-alpha-01',
      leaseExpiresAt: futureExpiry,
      status: 'CONNECTED',
    });

    // Current instance (waSession.INSTANCE_ID) attempts immediate acquisition
    const acquired = await waSession.acquireLease(sessionId);
    assert.strictEqual(acquired, false, 'waSession must reject lease acquisition when another worker holds active lease');

    const state = await WhatsAppSessionState.findOne({ sessionId }).lean();
    assert.strictEqual(state.leaseOwner, 'worker-alpha-01', 'Original lease owner must remain intact');
  });

  it('2. Rolling Deploy Handoff: Instance B acquires lease cleanly via retry-acquire once Instance A releases on SIGTERM', async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const instanceA = 'worker-alpha-rolling-old';

    // Instance A currently holds the lease
    await WhatsAppSessionState.create({
      sessionId,
      leaseOwner: instanceA,
      leaseExpiresAt: new Date(Date.now() + 60000),
      status: 'CONNECTED',
    });

    const handoffStart = Date.now();

    // Simulate Instance A receiving SIGTERM after 350ms and releasing its lease
    setTimeout(async () => {
      console.log('    [Old Instance] Received SIGTERM -> flushing session & releasing lease...');
      await WhatsAppSessionState.updateOne(
        { sessionId, leaseOwner: instanceA },
        { $set: { leaseOwner: null, leaseExpiresAt: null, status: 'DISCONNECTED' } }
      );
    }, 350);

    // Booting Instance B executes acquireLeaseWithRetry (retrying every 150ms)
    console.log('    [New Instance] Booting -> polling lease acquire with retry...');
    const acquired = await waSession.acquireLeaseWithRetry(sessionId, 8, 150);
    const handoffDurationMs = Date.now() - handoffStart;

    assert.strictEqual(acquired, true, 'New instance must acquire lease on retry once old instance releases');
    assert.ok(handoffDurationMs >= 350, 'Handoff must wait for old instance release');
    assert.ok(handoffDurationMs < 2500, `Handoff gap must be minimal (<2.5s), measured: ${handoffDurationMs}ms`);

    const state = await WhatsAppSessionState.findOne({ sessionId }).lean();
    assert.strictEqual(state.leaseOwner, waSession.INSTANCE_ID, 'New instance ID must be registered as lease owner');
    assert.ok(new Date(state.leaseExpiresAt) > new Date(), 'Lease expiry must be refreshed into future');

    console.log(`    ✅ Measured rolling deploy handoff gap: ${handoffDurationMs}ms (Old release -> New acquisition)`);
  });

  it('3. Crash Resilience: Instance B acquires expired lease automatically if Instance A crashes hard without clean release', async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const crashedInstance = 'worker-crashed-node';

    // Instance A crashed 2 seconds ago without running gracefulShutdown
    const expiredTimestamp = new Date(Date.now() - 2000);
    await WhatsAppSessionState.create({
      sessionId,
      leaseOwner: crashedInstance,
      leaseExpiresAt: expiredTimestamp,
      status: 'CONNECTED',
    });

    // Instance B attempts to acquire
    const acquired = await waSession.acquireLease(sessionId);
    assert.strictEqual(acquired, true, 'Instance B must acquire lease when previous lease timestamp is in the past');

    const state = await WhatsAppSessionState.findOne({ sessionId }).lean();
    assert.strictEqual(state.leaseOwner, waSession.INSTANCE_ID, 'Lease owner must be updated to current instance');
    assert.ok(new Date(state.leaseExpiresAt) > new Date(), 'Lease expiry must be updated to new future window');
  });

  it('4. Fail-Closed Durability: When database fails or rejects write, acquireLease fails closed and rejects socket bind', async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();

    // Disconnect mongoose temporarily
    await mongoose.disconnect();

    const acquired = await waSession.acquireLease(sessionId);
    assert.strictEqual(acquired, false, 'acquireLease must fail-closed (return false) on DB error');

    // Reconnect for teardown
    await mongoose.connect(mongoServer.getUri());
  });
});
