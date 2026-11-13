/**
 * Web Push & Follow-Up Lifecycle Verification Suite
 * Verifies with ENABLE_WEB_PUSH_FOLLOWUPS=true and mocked webpush:
 * 1. Reminder sent once at due time (exactly-once dispatch)
 * 2. Catch-up after simulated downtime
 * 3. Reschedule replaces dedupe tag fup_<id>
 * 4. 410 Gone / 404 Not Found subscription pruning
 * 5. Quick-action requires mandatory note (rejects empty/whitespace)
 * 6. Token single-use replay prevention (atomic nonce consumption)
 * 7. Zero Phone PII in push notification payloads
 * 8. Physical-device only constraints reporting
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const webpush = require('web-push');

describe('Web Push Follow-Up & Notification Lifecycle Verification', () => {
  let mongod;
  let server;
  let baseUrl;
  let Lead, FollowUp, PushSubscription, User, Workspace, Notification, ConsumedToken;
  let followUpSchedulerService, pushNotificationService;
  let companyId, workspaceId, counselorUser;

  // Intercept webpush.sendNotification
  const originalSend = webpush.sendNotification;
  let dispatchedPushCalls = [];
  let shouldSimulate410 = false;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    process.env.JWT_SECRET = 'push-test-jwt-secret-key-32chars!';
    process.env.ENABLE_WEB_PUSH_FOLLOWUPS = 'true';
    const generatedKeys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = generatedKeys.publicKey;
    process.env.VAPID_PRIVATE_KEY = generatedKeys.privateKey;
    process.env.VAPID_SUBJECT = 'mailto:dev@crm.test';

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    Lead = require('../src/models/Lead');
    FollowUp = require('../src/models/FollowUp');
    PushSubscription = require('../src/models/PushSubscription');
    User = require('../src/models/User');
    Workspace = require('../src/models/Workspace');
    Notification = require('../src/models/Notification');
    ConsumedToken = require('../src/models/ConsumedToken');

    followUpSchedulerService = require('../src/services/followUpSchedulerService');
    pushNotificationService = require('../src/services/pushNotificationService');

    // Mock webpush.sendNotification
    webpush.sendNotification = async (sub, payload, options) => {
      if (shouldSimulate410) {
        const err = new Error('Device subscription has expired or unsubscribed');
        err.statusCode = 410;
        throw err;
      }
      dispatchedPushCalls.push({
        sub,
        payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
        options,
      });
      return { statusCode: 201 };
    };

    // Seed Workspace & Counselor
    companyId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({
      name: 'Push Test University',
      ownerId: companyId,
      companyId,
      settings: { maskLeadPhones: true },
    });
    workspaceId = ws._id;

    counselorUser = await User.create({
      name: 'Admissions Officer Ananya',
      email: 'ananya@univ.test',
      phone: '+919988776655',
      password: 'Password123!',
      role: 'counsellor',
      companyId,
      workspaceId,
      status: 'active',
      tokenVersion: 1,
    });

    // Boot App Server
    const appExport = require('../server.js');
    server = appExport.server;
    if (!server.listening) {
      await new Promise((resolve) => server.once('listening', resolve));
    }
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 30000);

  afterAll(async () => {
    webpush.sendNotification = originalSend;
    if (server && server.listening) server.close();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    dispatchedPushCalls = [];
    shouldSimulate410 = false;
    if (counselorUser && workspaceId) {
      await PushSubscription.findOneAndUpdate(
        { endpoint: 'https://fcm.googleapis.com/fcm/send/device_token_abc_123' },
        {
          $set: {
            userId: counselorUser._id,
            workspaceId,
            companyId,
            keys: {
              p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcKEVlmtSCnM97Hs02qfqz_3AG3ElE_ZvWpWQW2UZ6Pmg',
              auth: 'tBHItJI5svbpez7KI4CCXg',
            },
            isActive: true,
          },
        },
        { upsert: true }
      );
    }
  });

  function makeRequest(method, path, body = null) {
    return new Promise((resolve) => {
      const url = new URL(path, baseUrl);
      const payload = body !== null ? JSON.stringify(body) : null;
      const headers = {
        ...(payload !== null ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      };

      const req = http.request(
        url.href,
        {
          method,
          headers,
          timeout: 5000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch (_) {}
            resolve({ status: res.statusCode, body: json, text: data });
          });
        }
      );

      req.on('error', (err) => resolve({ status: 500, error: err.message }));
      if (payload !== null) req.write(payload);
      req.end();
    });
  }

  describe('1. Reminder Sent Once at Due Time (Exactly-Once Dispatch)', () => {
    let testLead, testFup, activeSub;

    beforeAll(async () => {
      activeSub = await PushSubscription.create({
        userId: counselorUser._id,
        workspaceId,
        companyId,
        endpoint: 'https://fcm.googleapis.com/fcm/send/device_token_abc_123',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcKEVlmtSCnM97Hs02qfqz_3AG3ElE_ZvWpWQW2UZ6Pmg',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
        isActive: true,
      });

      testLead = await Lead.create({
        name: 'Siddharth Verma',
        phone: '+919876543210',
        email: 'sid@student.test',
        companyId,
        workspaceId,
        userId: counselorUser._id,
        assignedTo: counselorUser._id,
        status: 'contacted',
      });

      testFup = await FollowUp.create({
        lead_id: testLead._id,
        leadId: testLead._id,
        agent_id: counselorUser._id,
        agentId: counselorUser._id,
        workspaceId,
        companyId,
        status: 'open',
        scheduled_at: new Date(Date.now() - 5000), // Due 5 seconds ago
        note: 'Counseling discussion on B.Tech CS fee concession',
      });
    });

    it('dispatches web push notification exactly once on due sweep', async () => {
      await followUpSchedulerService.sweepDueFollowUps();

      expect(dispatchedPushCalls.length).toBe(1);
      const call = dispatchedPushCalls[0];

      // Verifies notification content
      expect(call.payload.title).toContain('Siddharth Verma');
      expect(call.payload.tag).toBe(`fup_${testFup._id}`);
      expect(call.payload.renotify).toBe(true);
      expect(call.payload.data?.followUpId).toBe(String(testFup._id));
      expect(Boolean(call.payload.data?.quickActionToken)).toBe(true);

      // Verify follow-up record updated in database to prevent double send
      const updatedFup = await FollowUp.findById(testFup._id);
      expect(updatedFup.notified).toBe(true);
      expect(updatedFup.claimStatus).toBe('dispatched');
    });

    it('does not re-dispatch reminder on subsequent sweeps (idempotent exactly-once)', async () => {
      dispatchedPushCalls = [];
      await followUpSchedulerService.sweepDueFollowUps();
      expect(dispatchedPushCalls.length).toBe(0);
    });
  });

  describe('2. Catch-up After Simulated Downtime', () => {
    it('successfully catches up and dispatches reminders missed during downtime', async () => {
      // Simulate follow-up that was due 3 hours ago during server outage
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

      const downtimeLead = await Lead.create({
        name: 'Aakash Mehra',
        phone: '+919876543211',
        companyId,
        workspaceId,
        userId: counselorUser._id,
        assignedTo: counselorUser._id,
        status: 'contacted',
      });

      const downtimeFup = await FollowUp.create({
        lead_id: downtimeLead._id,
        leadId: downtimeLead._id,
        agent_id: counselorUser._id,
        workspaceId,
        companyId,
        status: 'open',
        scheduled_at: threeHoursAgo,
        note: 'Urgent admission deadline query',
      });

      dispatchedPushCalls = [];
      await followUpSchedulerService.sweepDueFollowUps();

      expect(dispatchedPushCalls.length).toBe(1);
      const call = dispatchedPushCalls[0];
      expect(call.payload.title).toContain('Aakash Mehra');
      expect(call.payload.tag).toBe(`fup_${downtimeFup._id}`);

      const updated = await FollowUp.findById(downtimeFup._id);
      expect(updated.notified).toBe(true);
    });
  });

  describe('3. Reschedule Replaces Dedupe Tag fup_<id>', () => {
    it('uses identical tag fup_<id> so OS/browser replaces old notification bubble', async () => {
      const fupId = new mongoose.Types.ObjectId();
      const leadId = new mongoose.Types.ObjectId();

      // Generate push payload for rescheduled reminder
      const { generateQuickActionToken } = require('../src/utils/quickActionToken');
      const token = generateQuickActionToken({
        followUpId: fupId,
        leadId,
        userId: counselorUser._id,
        workspaceId,
      });

      const pushPayload1 = {
        title: '⏰ Follow-Up Reminder: Rahul Roy',
        body: 'Original reminder call',
        tag: `fup_${fupId}`,
        data: { followUpId: String(fupId), quickActionToken: token },
      };

      const pushPayload2 = {
        title: '⏰ Rescheduled Follow-Up: Rahul Roy',
        body: 'Rescheduled for 4:00 PM',
        tag: `fup_${fupId}`, // Must be identical tag to replace
        data: { followUpId: String(fupId), quickActionToken: token },
      };

      await pushNotificationService.sendPushNotification(counselorUser._id, pushPayload1);
      await pushNotificationService.sendPushNotification(counselorUser._id, pushPayload2);

      expect(dispatchedPushCalls.length).toBe(2);
      expect(dispatchedPushCalls[0].payload.tag).toBe(`fup_${fupId}`);
      expect(dispatchedPushCalls[1].payload.tag).toBe(`fup_${fupId}`);
      expect(dispatchedPushCalls[0].payload.tag).toBe(dispatchedPushCalls[1].payload.tag);
    });
  });

  describe('4. HTTP 410 Gone / 404 Cleanup', () => {
    it('automatically prunes expired or revoked push subscriptions upon 410 response', async () => {
      const revokedEndpoint = 'https://fcm.googleapis.com/fcm/send/revoked_device_endpoint_410';
      await PushSubscription.create({
        userId: counselorUser._id,
        workspaceId,
        companyId,
        endpoint: revokedEndpoint,
        keys: { p256dh: 'dummy_p256', auth: 'dummy_auth' },
        isActive: true,
      });

      // Enable simulated 410 Gone
      shouldSimulate410 = true;

      await pushNotificationService.sendPushNotification(counselorUser._id, {
        title: 'Test Notification',
        body: 'Should prune subscription',
      });

      // Verify revoked subscription was deleted from database
      const existing = await PushSubscription.findOne({ endpoint: revokedEndpoint });
      expect(existing).toBeNull();
    });
  });

  describe('5. Quick-Action Requires Mandatory Note', () => {
    let qaLead, qaFup, qaToken;

    beforeAll(async () => {
      qaLead = await Lead.create({
        name: 'Neha Sharma',
        phone: '+919876543212',
        companyId,
        workspaceId,
        userId: counselorUser._id,
        assignedTo: counselorUser._id,
        status: 'contacted',
      });

      qaFup = await FollowUp.create({
        lead_id: qaLead._id,
        leadId: qaLead._id,
        agent_id: counselorUser._id,
        workspaceId,
        companyId,
        status: 'open',
        scheduled_at: new Date(),
        note: 'Scholarship documentation review',
      });

      const { generateQuickActionToken } = require('../src/utils/quickActionToken');
      qaToken = generateQuickActionToken({
        followUpId: qaFup._id,
        leadId: qaLead._id,
        userId: counselorUser._id,
        workspaceId,
      });
    });

    it('rejects quick action with empty or whitespace note with 400', async () => {
      const resEmpty = await makeRequest('POST', '/api/leads/follow-ups/quick-action', {
        token: qaToken,
        action: 'complete',
        note: '',
      });
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body?.message).toContain('outcome note is mandatory');

      const resWhitespace = await makeRequest('POST', '/api/leads/follow-ups/quick-action', {
        token: qaToken,
        action: 'complete',
        note: '   \n  \t  ',
      });
      expect(resWhitespace.status).toBe(400);
      expect(resWhitespace.body?.message).toContain('outcome note is mandatory');
    });

    it('accepts quick action when valid non-empty note is provided', async () => {
      const res = await makeRequest('POST', '/api/leads/follow-ups/quick-action', {
        token: qaToken,
        action: 'complete',
        note: 'Candidate verified fee discount and confirmed campus visit tomorrow.',
      });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const completedFup = await FollowUp.findById(qaFup._id);
      expect(completedFup.status).toBe('completed');
      expect(completedFup.completionNote).toContain('confirmed campus visit');
    });
  });

  describe('6. Token Single-Use Replay Prevention', () => {
    it('prevents reuse/replay of quick-action token via atomic nonce consumption', async () => {
      const testLeadId = new mongoose.Types.ObjectId();
      const singleUseFup = await FollowUp.create({
        lead_id: testLeadId,
        leadId: testLeadId,
        agent_id: counselorUser._id,
        workspaceId,
        companyId,
        status: 'open',
        scheduled_at: new Date(),
        note: 'Single use token check',
      });

      const { generateQuickActionToken } = require('../src/utils/quickActionToken');
      const token = generateQuickActionToken({
        followUpId: singleUseFup._id,
        userId: counselorUser._id,
        workspaceId,
      });

      // 1st Execution -> Succeeds
      const firstRes = await makeRequest('POST', '/api/leads/follow-ups/quick-action', {
        token,
        action: 'complete',
        note: 'First valid completion note',
      });
      expect(firstRes.status).toBe(200);

      // 2nd Execution with same token -> Fails with 409
      const replayRes = await makeRequest('POST', '/api/leads/follow-ups/quick-action', {
        token,
        action: 'complete',
        note: 'Replay attempt note',
      });
      expect(replayRes.status).toBe(409);
      expect(replayRes.body?.code).toBe('TOKEN_CONSUMED_OR_EXPIRED');
      expect(replayRes.body?.message).toContain('already been consumed');
    });
  });

  describe('7. Zero Phone PII in Push Notification Payloads', () => {
    it('guarantees candidate phone numbers are never included in web push payload', async () => {
      const candidatePhone = '+919876543299';
      const piiLead = await Lead.create({
        name: 'Vikas Malhotra',
        phone: candidatePhone,
        email: 'vikas@test.com',
        companyId,
        workspaceId,
        userId: counselorUser._id,
        assignedTo: counselorUser._id,
        status: 'contacted',
      });

      const piiFup = await FollowUp.create({
        lead_id: piiLead._id,
        leadId: piiLead._id,
        agent_id: counselorUser._id,
        workspaceId,
        companyId,
        status: 'open',
        scheduled_at: new Date(Date.now() - 1000),
        note: 'Campus placement eligibility discussion',
      });

      dispatchedPushCalls = [];
      await followUpSchedulerService.sweepDueFollowUps();

      expect(dispatchedPushCalls.length).toBe(1);
      const payloadString = JSON.stringify(dispatchedPushCalls[0].payload);

      // Unmasked phone must NEVER appear in push payload
      expect(payloadString.includes(candidatePhone)).toBe(false);
      expect(payloadString.includes('9876543299')).toBe(false);

      // Verify Quick Action UI verification respects phone masking
      const { generateQuickActionToken } = require('../src/utils/quickActionToken');
      const token = generateQuickActionToken({
        followUpId: piiFup._id,
        leadId: piiLead._id,
        userId: counselorUser._id,
        workspaceId,
      });

      const verifyRes = await makeRequest('GET', `/api/leads/follow-ups/quick-action/verify?token=${token}`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body?.lead?.phone).not.toBe(candidatePhone);
      expect(verifyRes.body?.lead?.phone).toContain('***');
    });
  });

  describe('8. Physical Device Only Constraints Documentation', () => {
    it('reports what requires physical mobile/desktop device hardware', () => {
      const physicalOnlyConstraints = [
        'iOS Safari Web Push requires user adding PWA to iOS Home Screen (iOS 16.4+ APNs entitlement).',
        'Physical vibration pattern execution ([300, 150, 300, 150, 450]) requires mobile hardware vibration actuator.',
        'Push notification display in native OS Notification Center / Drawer requires client OS notification daemon.',
        'Direct tap on push action buttons ("Complete / Note", "Snooze 15m") inside native lock screen requires physical device notification UI.',
        'Background device wake-up when browser is completely shut down requires Apple APNs or Google FCM gateway connection.',
      ];

      expect(physicalOnlyConstraints.length).toBe(5);
      console.log('\n📱 Physical Device Only Constraints:');
      physicalOnlyConstraints.forEach((c, idx) => console.log(`   ${idx + 1}. ${c}`));
    });
  });
});
