const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: WhatsApp Distributed Lease & 440 Loop Prevention (R1)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const WhatsAppSessionState = require('../src/models/WhatsAppSessionState');
  const User = require('../src/models/User');
  const waSession = require('../src/services/waSession');

  const userId = new mongoose.Types.ObjectId();
  const sessionId = userId.toString();

  // Create session state doc in DB
  await WhatsAppSessionState.create({
    sessionId,
    userId,
    status: 'DISCONNECTED',
  });

  // 1. Lease Acquisition by Current Instance
  const acquired1 = await waSession.acquireLease(sessionId);
  assert.strictEqual(acquired1, true, 'Current instance must successfully acquire open lease');

  const stateDoc = await WhatsAppSessionState.findOne({ sessionId });
  assert.strictEqual(stateDoc.leaseOwner, waSession.INSTANCE_ID);
  assert.ok(stateDoc.leaseExpiresAt > new Date());
  console.log('✅ Step 1: Distributed lease acquired by current instance.');

  // 2. Mutual exclusion: simulate another instance trying to acquire while lease is active
  // Temporarily set leaseOwner to another process
  await WhatsAppSessionState.updateOne(
    { sessionId },
    { $set: { leaseOwner: 'proc_competing_9999', leaseExpiresAt: new Date(Date.now() + 60000) } }
  );

  const competingAcquire = await waSession.acquireLease(sessionId);
  assert.strictEqual(competingAcquire, false, 'Should fail to acquire lease held by another instance');
  console.log('✅ Step 2: Mutual exclusion verified. Non-owner instance denied lease acquisition.');

  // 3. Outbound dispatch from non-owner instance returns 503 WA_SESSION_OWNED_BY_ANOTHER_INSTANCE
  await User.create({
    _id: userId,
    name: 'WhatsApp User',
    email: 'wauser@crm.local',
    password: 'Password123!',
    phone: '9876543399',
  });

  let errorCaught = null;
  try {
    await waSession.sendText(userId, '9876543300', 'Test message');
  } catch (err) {
    errorCaught = err;
  }
  assert.ok(errorCaught, 'Must throw error when non-owner instance tries to send');
  assert.strictEqual(errorCaught.code, 'WA_SESSION_OWNED_BY_ANOTHER_INSTANCE');
  assert.strictEqual(errorCaught.statusCode, 503);
  assert.strictEqual(errorCaught.leaseOwner, 'proc_competing_9999');
  console.log('✅ Step 3: Outbound dispatch on non-owner instance returned 503 WA_SESSION_OWNED_BY_ANOTHER_INSTANCE.');

  // 4. Release Lease
  // Reset ownership to current instance, then release
  await WhatsAppSessionState.updateOne(
    { sessionId },
    { $set: { leaseOwner: waSession.INSTANCE_ID, leaseExpiresAt: new Date(Date.now() + 60000) } }
  );
  await waSession.releaseLease(sessionId);
  const releasedDoc = await WhatsAppSessionState.findOne({ sessionId });
  assert.strictEqual(releasedDoc.leaseOwner, null);
  assert.strictEqual(releasedDoc.leaseExpiresAt, null);
  console.log('✅ Step 4: Distributed lease cleanly released.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL R1 WHATSAPP DISTRIBUTED LEASE TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
