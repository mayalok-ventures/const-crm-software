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

  // Step 3: Stale claim recovery
  // Simulate a worker crash where followUpClaimStatus was 'processing' 10 minutes ago but never finished
  const leadCrashed = await Lead.create({
    name: 'Crashed Worker Lead',
    phone: '9888800004',
    workspaceId: ws._id,
    userId: user._id,
    assignedTo: user._id,
    targetDomain: 'Engineering',
    followUpDate: new Date(now - 10 * 60 * 1000), // 10 mins ago
    followUpNotified: false,
    followUpClaimStatus: 'processing',
    followUpClaimedAt: new Date(now - 10 * 60 * 1000), // Stale claim (> 5 min timeout)
    followUpStatus: 'due',
  });

  // Also simulate existing doc without the field from 5 days ago (no followUpNotified field at all)
  const leadLegacyHistorical = await Lead.create({
    name: 'Legacy Historical Lead',
    phone: '9888800005',
    workspaceId: ws._id,
    userId: user._id,
    assignedTo: user._id,
    targetDomain: 'Engineering',
    followUpDate: new Date(now - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    followUpStatus: 'scheduled',
  });

  const resStale = await sweepDueFollowUps();
  assert.strictEqual(resStale.processedCount, 1, 'Stale claim must be recovered and processed');

  const updatedCrashed = await Lead.findById(leadCrashed._id);
  assert.strictEqual(updatedCrashed.followUpNotified, true, 'Recovered lead must be marked notified');
  assert.strictEqual(updatedCrashed.followUpClaimStatus, 'dispatched', 'Status must be dispatched');

  const updatedLegacy = await Lead.findById(leadLegacyHistorical._id);
  assert.strictEqual(updatedLegacy.followUpNotified, false, '5-day old legacy lead must remain unnotified without spamming');
  assert.strictEqual(updatedLegacy.followUpClaimStatus, 'idle', 'Legacy lead claim status remains idle');
  console.log('✅ Step 3: Stale-claim recovery successfully rescued reminder and legacy historical leads were untouched.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL R5 FOLLOW-UP CRON LOOKBACK TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
