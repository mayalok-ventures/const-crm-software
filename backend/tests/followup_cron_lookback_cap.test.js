const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Follow-Up Cron 24h Lookback Cap & Atomic Claim (R5)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  const { sweepDueFollowUps } = require('../src/services/followUpSchedulerService');

  const ws = await Workspace.create({ name: 'Cron WS', slug: 'cron-ws', ownerId: new mongoose.Types.ObjectId() });
  const user = await User.create({
    name: 'Cron User',
    email: 'cron@crm.local',
    password: 'Password123!',
    phone: '9876543322',
  });

  const now = Date.now();

  // Lead 1: 2 hours ago (within 24h window) -> Should be swept
  const leadRecent = await Lead.create({
    name: 'Recent Due Lead',
    phone: '9888800001',
    workspaceId: ws._id,
    userId: user._id,
    assignedTo: user._id,
    targetDomain: 'Engineering',
    followUpDate: new Date(now - 2 * 60 * 60 * 1000),
    followUpNotified: false,
    followUpStatus: 'scheduled',
  });

  // Lead 2: 10 seconds in future (within 30s cutoff) -> Should be swept
  const leadUpcoming = await Lead.create({
    name: 'Upcoming Due Lead',
    phone: '9888800002',
    workspaceId: ws._id,
    userId: user._id,
    assignedTo: user._id,
    targetDomain: 'Engineering',
    followUpDate: new Date(now + 10 * 1000),
    followUpNotified: false,
    followUpStatus: 'scheduled',
  });

  // Lead 3: 48 hours ago (OUTSIDE 24h lookback) -> Must be SKIPPED
  const leadAntique = await Lead.create({
    name: 'Antique Due Lead',
    phone: '9888800003',
    workspaceId: ws._id,
    userId: user._id,
    assignedTo: user._id,
    targetDomain: 'Engineering',
    followUpDate: new Date(now - 48 * 60 * 60 * 1000),
    followUpNotified: false,
    followUpStatus: 'scheduled',
  });

  // Run the sweep
  const res = await sweepDueFollowUps();
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.processedCount, 2, 'Should process exactly 2 leads within lookback window');

  // Verify DB state
  const updatedRecent = await Lead.findById(leadRecent._id);
  assert.strictEqual(updatedRecent.followUpNotified, true, 'Recent lead must be marked notified');

  const updatedUpcoming = await Lead.findById(leadUpcoming._id);
  assert.strictEqual(updatedUpcoming.followUpNotified, true, 'Upcoming lead must be marked notified');

  const updatedAntique = await Lead.findById(leadAntique._id);
  assert.strictEqual(updatedAntique.followUpNotified, false, 'Antique lead beyond 24h lookback must NOT be notified');
  console.log('✅ Step 1: 24-hour lookback window successfully filtered antique leads and swept active ones.');

  // Idempotency: second immediate sweep should find 0 pending
  const resSecond = await sweepDueFollowUps();
  assert.strictEqual(resSecond.processedCount, 0, 'Second run must process 0 leads (already claimed)');
  console.log('✅ Step 2: Atomic CAS claim prevented duplicate sweep.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL R5 FOLLOW-UP CRON LOOKBACK TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
