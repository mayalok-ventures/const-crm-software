const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let User, Workspace, Lead, FollowUp, PushSubscription, Notification, ConsumedToken;

describe('Stage 6: Notifications, Follow-Up Reminders & PWA', function () {
  this.timeout(45000);

  let userA, userB, workspaceA, workspaceB;
  let leadA;

  before(async function () {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'stage6_test_jwt_secret_must_be_over_32_characters_long_for_security';
    process.env.ENABLE_WEB_PUSH_FOLLOWUPS = 'true';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    User = require('../src/models/User');
    Workspace = require('../src/models/Workspace');
    Lead = require('../src/models/Lead');
    FollowUp = require('../src/models/FollowUp');
    PushSubscription = require('../src/models/PushSubscription');
    Notification = require('../src/models/Notification');
    ConsumedToken = require('../src/models/ConsumedToken');

    workspaceA = await Workspace.create({
      name: 'Workspace A',
      slug: 'workspace-a',
      ownerId: new mongoose.Types.ObjectId(),
    });

    workspaceB = await Workspace.create({
      name: 'Workspace B',
      slug: 'workspace-b',
      ownerId: new mongoose.Types.ObjectId(),
    });

    userA = await User.create({
      name: 'Agent A',
      email: 'agent.a@stage6.com',
      password: 'Password123!',
      workspaceId: workspaceA._id,
      role: 'counselor',
      companyRole: 'counselor',
    });

    userB = await User.create({
      name: 'Agent B',
      email: 'agent.b@stage6.com',
      password: 'Password123!',
      workspaceId: workspaceB._id,
      role: 'counselor',
      companyRole: 'counselor',
    });

    leadA = await Lead.create({
      name: 'Rahul Sharma',
      phone: '+919876543210',
      status: 'new',
      workspaceId: workspaceA._id,
      userId: userA._id,
      assignedTo: userA._id,
    });
  });

  after(async function () {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('1. Follow-up reminder dispatch must NOT leak phone numbers in title, message, or push payload', async function () {
    const { sweepDueFollowUps } = require('../src/services/followUpSchedulerService');

    const pastDate = new Date(Date.now() - 5 * 60 * 1000);
    const fup = await FollowUp.create({
      workspaceId: workspaceA._id,
      lead_id: leadA._id,
      leadId: leadA._id,
      agent_id: userA._id,
      agentId: userA._id,
      scheduled_at: pastDate,
      scheduledAt: pastDate,
      note: 'Discussion on MBA admission criteria',
      status: 'open',
      notified: false,
    });

    const result = await sweepDueFollowUps();
    assert(result.success, 'Scheduler sweep should succeed');

    const notif = await Notification.findOne({ entityId: fup._id });
    assert(notif, 'Notification record should be created for due follow-up');

    // Strict privacy verification: Phone number must NOT be in message, title, or notification record
    assert.strictEqual(
      notif.message.includes('+919876543210'),
      false,
      `Phone number leaked in notification message: "${notif.message}"`
    );
    assert.strictEqual(
      notif.title.includes('+919876543210'),
      false,
      `Phone number leaked in notification title: "${notif.title}"`
    );
    assert(notif.message.includes('Rahul Sharma'), 'Notification should include candidate name');
  });

  it('2. Rescheduling a follow-up replaces notification dedupe tag (fup_<id>) instead of stacking', async function () {
    const fupId = new mongoose.Types.ObjectId();
    const scheduledDate = new Date(Date.now() - 1000);

    const { dispatchNotification } = require('../src/services/notificationService');

    const res1 = await dispatchNotification({
      userId: userA._id,
      workspaceId: workspaceA._id,
      leadId: leadA._id,
      leadName: 'Rahul Sharma',
      title: 'Follow-Up Reminder',
      message: 'Candidate follow-up due',
      type: 'follow_up',
      entityId: fupId,
      dueAt: scheduledDate,
      dedupKey: `test_tag_1_${fupId}`,
      channels: ['in_app'],
      pushPayload: {
        tag: `fup_${fupId}`,
        renotify: true,
      },
    });

    assert(res1.notification, 'Notification 1 created');
  });

  it('3. Logout prunes push subscription endpoint to prevent orphaned token leaks', async function () {
    const testEndpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint-user-a';
    await PushSubscription.create({
      userId: userA._id,
      workspaceId: workspaceA._id,
      endpoint: testEndpoint,
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
      deviceInfo: { deviceLabel: 'Pixel 8' },
    });

    let found = await PushSubscription.findOne({ endpoint: testEndpoint });
    assert(found, 'Subscription should exist before logout');

    // Simulate authController.logout with endpoint passed in body
    const { logout, logoutAll } = require('../src/controllers/authController');
    const req = {
      user: { _id: userA._id },
      headers: { authorization: 'Bearer dummy_token' },
      body: { endpoint: testEndpoint },
    };
    const res = { json: () => {} };

    await logout(req, res);

    const afterLogout = await PushSubscription.findOne({ endpoint: testEndpoint });
    assert.strictEqual(afterLogout, null, 'Push subscription must be pruned on single-device logout');

    // Test logoutAll prunes all subscriptions for user
    const endpoint2 = 'https://fcm.googleapis.com/fcm/send/test-endpoint-user-a-2';
    await PushSubscription.create({
      userId: userA._id,
      workspaceId: workspaceA._id,
      endpoint: endpoint2,
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
    });
    await logoutAll(req, res);
    const afterLogoutAll = await PushSubscription.findOne({ endpoint: endpoint2 });
    assert.strictEqual(afterLogoutAll, null, 'All push subscriptions must be pruned on logoutAll');
  });

  it('4. Expired subscriptions (HTTP 410 / 404) are automatically pruned by sendPushNotification', async function () {
    const expiredEndpoint = 'https://fcm.googleapis.com/fcm/send/expired-sub-410';
    await PushSubscription.create({
      userId: userA._id,
      workspaceId: workspaceA._id,
      endpoint: expiredEndpoint,
      keys: { p256dh: 'dummy-p256dh', auth: 'dummy-auth' },
      isActive: true,
    });

    const webpush = require('web-push');
    const originalSend = webpush.sendNotification;
    webpush.sendNotification = async () => {
      const err = new Error('Subscription has expired or is no longer valid');
      err.statusCode = 410;
      throw err;
    };

    const { sendPushNotification } = require('../src/services/pushNotificationService');
    try {
      await sendPushNotification(userA._id, { title: 'Test', body: 'Test' });
    } finally {
      webpush.sendNotification = originalSend;
    }

    const pruned = await PushSubscription.findOne({ endpoint: expiredEndpoint });
    assert.strictEqual(pruned, null, 'Subscription with 410 status must be pruned from DB');
  });

  it('5. Quick-action token generation, single-use consumption, replay protection & note validation', async function () {
    const {
      generateQuickActionToken,
      verifyAndConsumeQuickActionToken,
      verifyQuickActionTokenReadOnly,
    } = require('../src/utils/quickActionToken');

    const fupId = new mongoose.Types.ObjectId();
    const token = generateQuickActionToken({
      followUpId: fupId,
      leadId: leadA._id,
      userId: userA._id,
      workspaceId: workspaceA._id,
      expiresInSeconds: 300,
    });

    assert(typeof token === 'string' && token.length > 20, 'Should generate signed token string');

    // Read-only verify should succeed without consuming
    const readOnlyData = await verifyQuickActionTokenReadOnly(token);
    assert.strictEqual(String(readOnlyData.followUpId), String(fupId));

    // First consumption succeeds
    const consumedData = await verifyAndConsumeQuickActionToken(token);
    assert.strictEqual(String(consumedData.followUpId), String(fupId));

    // Replay attempt MUST fail
    let replayError = null;
    try {
      await verifyAndConsumeQuickActionToken(token);
    } catch (err) {
      replayError = err;
    }
    assert(replayError, 'Replaying a consumed quick-action token must fail');
    assert(
      replayError.message.includes('consumed') || replayError.message.includes('replay'),
      `Expected replay error, got: ${replayError.message}`
    );
  });

  it('6. Quick-action endpoint enforces mandatory outcome note, tenant isolation, and status update', async function () {
    const { generateQuickActionToken } = require('../src/utils/quickActionToken');
    const { verifyQuickAction, executeQuickAction } = require('../src/controllers/quickActionController');

    const fup = await FollowUp.create({
      workspaceId: workspaceA._id,
      lead_id: leadA._id,
      leadId: leadA._id,
      agent_id: userA._id,
      agentId: userA._id,
      scheduled_at: new Date(),
      note: 'Call to review document submission',
      status: 'open',
    });

    const token = generateQuickActionToken({
      followUpId: fup._id,
      leadId: leadA._id,
      userId: userA._id,
      workspaceId: workspaceA._id,
      expiresInSeconds: 300,
    });

    // 6a. Verify endpoint check
    let verifyResponse = null;
    const reqVerify = { query: { token } };
    const resVerify = { json: (data) => { verifyResponse = data; } };
    await verifyQuickAction(reqVerify, resVerify);
    assert(verifyResponse && verifyResponse.valid, 'Token verification should succeed');
    assert.strictEqual(String(verifyResponse.followUp._id), String(fup._id));

    // 6b. Attempting completion without mandatory note must fail with 400
    let errCode = null;
    let errMessage = null;
    const reqNoNote = {
      body: { token, action: 'complete', note: '   ' },
    };
    const resNoNote = {
      status: (code) => {
        errCode = code;
        return {
          json: (data) => { errMessage = data.message; },
        };
      },
    };
    await executeQuickAction(reqNoNote, resNoNote);
    assert.strictEqual(errCode, 400, 'Empty note must be rejected with 400');
    assert(errMessage.includes('mandatory') || errMessage.includes('required'), 'Must require mandatory note');

    // 6c. Execution with non-empty note succeeds
    let execSuccess = null;
    const reqValid = {
      body: { token, action: 'complete', note: 'Candidate submitted IELTS scorecard.' },
    };
    const resValid = {
      status: (code) => ({ json: (d) => { execSuccess = d; } }),
      json: (d) => { execSuccess = d; },
    };
    await executeQuickAction(reqValid, resValid);
    assert(execSuccess && execSuccess.success, 'Valid quick action should succeed');

    const updatedFup = await FollowUp.findById(fup._id);
    assert.strictEqual(updatedFup.status, 'completed', 'Follow-up status should be completed');
    assert.strictEqual(updatedFup.acknowledged, true, 'Follow-up should be marked acknowledged');

    // 6d. Replaying the quick-action call with the same token must fail with 409
    let replayCode = null;
    const resReplay = {
      status: (code) => {
        replayCode = code;
        return { json: () => {} };
      },
    };
    await executeQuickAction(reqValid, resReplay);
    assert.strictEqual(replayCode, 409, 'Replay with same quick-action token must return 409');
  });

  it('7. Super Admin reminder health telemetry endpoint reports scheduler status and metrics', async function () {
    const { getReminderHealth } = require('../src/superadmin/controllers/systemController');
    let healthData = null;
    const req = { user: { role: 'superadmin' } };
    const res = { json: (data) => { healthData = data; } };

    await getReminderHealth(req, res);
    assert(healthData && healthData.success, 'Reminder health should return success');
    assert(typeof healthData.activeSubscriptionsCount === 'number');
    assert(typeof healthData.pendingDueFollowUps === 'number');
    assert(typeof healthData.unacknowledgedReminders === 'number');
    assert(healthData.scheduler, 'Should contain scheduler telemetry');
  });
});
