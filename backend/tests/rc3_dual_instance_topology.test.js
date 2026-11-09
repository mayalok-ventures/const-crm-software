/**
 * Regression Test: Dual-Instance Topology, Once-Only Jobs & WhatsApp Lease Fencing (RC-3 Item 2)
 *
 * Asserts:
 * 1. Distributed lock guarantees once-only background job execution across dual instances.
 * 2. Single lease holder guarantee: WhatsApp session lease acquired by Instance A cannot be stolen by Instance B.
 * 3. Non-owner send behavior: An API instance attempting to send WhatsApp message returns explicit HTTP 503
 *    with WA_SESSION_OWNED_BY_ANOTHER_INSTANCE and identifies the leaseOwner instance.
 * 4. Lease transfer: Upon lease release/expiry, secondary instance successfully acquires ownership.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { withDistributedLock } = require('../src/utils/distributedLock');
const WhatsAppSessionState = require('../src/models/WhatsAppSessionState');
const waSession = require('../src/services/waSession');

describe('RC-3 Dual-Instance Topology & WhatsApp Fencing', () => {
  let mongoServer;
  let mongoUri;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('guarantees once-only cron execution across dual instances via distributed lock', async () => {
    let executionCount = 0;
    const taskName = 'cron_test_dual_instance_sweep';

    // Simulate Instance A and Instance B racing to execute the same job
    const runInstanceA = async () => {
      return withDistributedLock(taskName, 10000, async () => {
        executionCount++;
        await new Promise((r) => setTimeout(r, 100)); // Hold lock briefly
        return 'instance_A_executed';
      });
    };

    const runInstanceB = async () => {
      return withDistributedLock(taskName, 10000, async () => {
        executionCount++;
        return 'instance_B_executed';
      });
    };

    const results = await Promise.all([runInstanceA(), runInstanceB()]);

    // Exactly one instance must have acquired the lock and executed
    assert.strictEqual(executionCount, 1, 'Job must execute exactly once across dual instances');
    const executedResults = results.filter((r) => r && r.executed === true);
    assert.strictEqual(executedResults.length, 1, 'Only one instance receives executed: true');
    const skippedResults = results.filter((r) => r && r.skipped === true);
    assert.strictEqual(skippedResults.length, 1, 'The other instance is skipped');
  });

  it('enforces single WhatsApp lease holder and returns HTTP 503 for non-owner sends', async () => {
    const testSessionId = new mongoose.Types.ObjectId().toString();
    const OWNER_INSTANCE_ID = 'worker-node-primary-01';

    // Instance A claims the lease in MongoDB
    await WhatsAppSessionState.create({
      sessionId: testSessionId,
      status: 'CONNECTED',
      phone: '919876543210',
      leaseOwner: OWNER_INSTANCE_ID,
      leaseExpiresAt: new Date(Date.now() + 60000), // 60s lease
    });

    // Verify Instance B (current process with random INSTANCE_ID) cannot acquire the active lease
    const canAcquire = await waSession.acquireLease(testSessionId);
    assert.strictEqual(canAcquire, false, 'Secondary instance must be denied lease when owned by another node');

    // Create an Express app on Instance B testing non-owner WhatsApp send endpoint
    const app = express();
    app.use(express.json());

    // Mock authenticated user on Instance B
    app.use((req, res, next) => {
      req.user = { _id: testSessionId, name: 'Counselor One', phone: '919876543210' };
      next();
    });

    const whatsappController = require('../src/controllers/whatsappController');
    app.post('/api/whatsapp/send', whatsappController.sendText);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    // Instance B receives HTTP request to send a message
    const sendRes = await fetch(`http://127.0.0.1:${port}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '919999888877',
        text: 'Hello from non-owner API instance',
      }),
    });

    const body = await sendRes.json();
    server.close();

    // Verify non-owner send fails safely with HTTP 503 and clear architectural diagnostic
    assert.strictEqual(sendRes.status, 503, 'Non-owner send must return HTTP 503 Service Unavailable');
    assert.strictEqual(body.code, 'WA_SESSION_OWNED_BY_ANOTHER_INSTANCE');
    assert.strictEqual(body.leaseOwner, OWNER_INSTANCE_ID);
    assert.ok(body.message.includes('owned by another cluster worker'));
  });

  it('permits lease acquisition once primary lease expires or is released', async () => {
    const transferSessionId = new mongoose.Types.ObjectId().toString();

    // Create expired lease held by old worker
    await WhatsAppSessionState.create({
      sessionId: transferSessionId,
      status: 'CONNECTED',
      phone: '919876543210',
      leaseOwner: 'stale-worker-99',
      leaseExpiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
    });

    // Current instance should successfully acquire the expired lease
    const acquired = await waSession.acquireLease(transferSessionId);
    assert.strictEqual(acquired, true, 'Instance must successfully claim expired lease');

    const updatedDoc = await WhatsAppSessionState.findOne({ sessionId: transferSessionId });
    assert.strictEqual(updatedDoc.leaseOwner, waSession.INSTANCE_ID);
    assert(updatedDoc.leaseExpiresAt > new Date(), 'New lease expiry must be in the future');
  });
});
