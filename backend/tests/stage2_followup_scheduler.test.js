/**
 * Stage 2: Follow-Up Scheduler Core Reproduction & Verification Suite
 * Tests:
 * 1. Duplicate $or bug drops date filter (future follow-ups mistakenly dispatched)
 * 2. Due follow-up dispatched exactly once
 * 3. Stale claim recovery after crash/timeout
 * 4. scheduled_at vs scheduledAt drift & completed_at typo fix
 * 5. Timezone & DST instant resolution
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'stage2_test_jwt_secret_2026';
process.env.NODE_ENV = 'test';
process.env.FOLLOWUP_LOOKBACK_HOURS = '24';
process.env.FOLLOWUP_CLAIM_TIMEOUT_MS = '300000'; // 5 mins

const Lead = require('../src/models/Lead');
const FollowUp = require('../src/models/FollowUp');
const Workspace = require('../src/models/Workspace');
const User = require('../src/models/User');
const { sweepDueFollowUps } = require('../src/services/followUpSchedulerService');

describe('Stage 2: Follow-Up Scheduler Core & Timezone Correctness', function () {
  this.timeout(45000);
  let mongoServer;
  let workspace;
  let agent;
  let lead;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const companyId = new mongoose.Types.ObjectId();
    workspace = await Workspace.create({
      name: 'Scheduler Test Agency',
      slug: 'scheduler-test',
      ownerId: companyId,
      settings: { timezone: 'Asia/Kolkata' },
    });

    agent = await User.create({
      name: 'Scheduler Counselor',
      email: 'counselor@scheduler.test',
      password: 'Password@123',
      role: 'counsellor',
      companyRole: 'counsellor',
      companyId,
      workspaceId: workspace._id,
      isAdmin: false,
      userStatus: 'active',
    });

    lead = await Lead.create({
      name: 'Candidate Lead',
      phone: '9876543210',
      userId: companyId,
      companyId,
      workspaceId: workspace._id,
      assignedTo: agent._id,
      status: 'new_lead',
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await FollowUp.deleteMany({});
  });

  it('1. REPRODUCTION: Duplicate $or bug causes FUTURE follow-up to be dispatched prematurely', async () => {
    // Follow-up scheduled 7 days in the future
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureFup = await FollowUp.create({
      leadId: lead._id,
      lead_id: lead._id,
      agentId: agent._id,
      agent_id: agent._id,
      workspaceId: workspace._id,
      companyId: workspace.ownerId,
      scheduled_at: futureDate,
      scheduledAt: futureDate,
      status: 'open',
      note: 'Future appointment call',
      notified: false,
      claimStatus: 'idle',
    });

    // Execute scheduler sweep
    await sweepDueFollowUps();

    // Check future follow-up status
    const checkedFup = await FollowUp.findById(futureFup._id).lean();
    assert.strictEqual(
      checkedFup.notified,
      false,
      'VULNERABILITY REPRODUCED: Future follow-up was dispatched because duplicate $or dropped the date cutoff!'
    );
  });

  it('2. Due follow-up within cutoff is dispatched exactly once', async () => {
    const dueDate = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const dueFup = await FollowUp.create({
      leadId: lead._id,
      lead_id: lead._id,
      agentId: agent._id,
      agent_id: agent._id,
      workspaceId: workspace._id,
      companyId: workspace.ownerId,
      scheduled_at: dueDate,
      scheduledAt: dueDate,
      status: 'open',
      note: 'Urgent callback requested',
      notified: false,
      claimStatus: 'idle',
    });

    // First sweep dispatches
    const res1 = await sweepDueFollowUps();
    const checked1 = await FollowUp.findById(dueFup._id).lean();
    assert.strictEqual(checked1.notified, true, 'Due follow-up was not dispatched');
    assert.strictEqual(checked1.claimStatus, 'dispatched');

    // Second sweep should not re-dispatch
    const res2 = await sweepDueFollowUps();
    const checked2 = await FollowUp.findById(dueFup._id).lean();
    assert.strictEqual(checked2.notified, true);
  });

  it('3. Stale claim recovery: Crashed/timed-out claim is re-processed', async () => {
    const dueDate = new Date(Date.now() - 10 * 60 * 1000);
    const staleDate = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago (> 5m timeout)
    const crashedFup = await FollowUp.create({
      leadId: lead._id,
      lead_id: lead._id,
      agentId: agent._id,
      agent_id: agent._id,
      workspaceId: workspace._id,
      companyId: workspace.ownerId,
      scheduled_at: dueDate,
      scheduledAt: dueDate,
      status: 'open',
      note: 'Crashed worker retry test',
      notified: false,
      claimStatus: 'processing',
      claimedAt: staleDate,
    });

    await sweepDueFollowUps();

    const checked = await FollowUp.findById(crashedFup._id).lean();
    assert.strictEqual(checked.notified, true, 'Stale claim was not recovered and dispatched');
    assert.strictEqual(checked.claimStatus, 'dispatched');
  });

  it('4. Drift audit: completed_at typo in FollowUp.js pre-save hook', async () => {
    const testFup = new FollowUp({
      leadId: lead._id,
      agentId: agent._id,
      workspaceId: workspace._id,
      scheduledAt: new Date(),
      status: 'completed',
      note: 'Completed successfully',
      completionNote: 'Completed successfully',
      completedAt: new Date('2026-11-12T10:00:00Z'),
    });

    await testFup.save();

    assert.ok(testFup.completed_at, 'completed_at was not populated from completedAt!');
    assert.strictEqual(
      testFup.completed_at.getTime(),
      testFup.completedAt.getTime(),
      'completed_at and completedAt must match'
    );
    assert.ok(testFup.scheduled_at, 'scheduled_at must be populated from scheduledAt');
  });

  it('5. Timezone & DST Correctness: Reminders fire at the exact intended instant', async () => {
    const { parseDateInTimezone } = require('../src/utils/timezoneHelper');

    // 1. Asia/Kolkata (+05:30)
    // 2026-11-12 14:00 local IST = 2026-11-12 08:30:00 UTC
    const istParsed = parseDateInTimezone('2026-11-12 14:00', 'Asia/Kolkata');
    assert.strictEqual(istParsed.toISOString(), '2026-11-12T08:30:00.000Z');

    // 2. America/New_York Daylight Saving Time (EDT, UTC-4 in July)
    // 2026-07-04 14:00 EDT = 2026-07-04 18:00:00 UTC
    const edtParsed = parseDateInTimezone('2026-07-04 14:00', 'America/New_York');
    assert.strictEqual(edtParsed.toISOString(), '2026-07-04T18:00:00.000Z');

    // 3. America/New_York Standard Time (EST, UTC-5 in January)
    // 2026-01-15 14:00 EST = 2026-01-15 19:00:00 UTC
    const estParsed = parseDateInTimezone('2026-01-15 14:00', 'America/New_York');
    assert.strictEqual(estParsed.toISOString(), '2026-01-15T19:00:00.000Z');
  });
});
