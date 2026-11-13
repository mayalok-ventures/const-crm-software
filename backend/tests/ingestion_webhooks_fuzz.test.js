/**
 * Ingestion & Inbound Webhooks Fuzzing & Security Suite
 * Tests all 7 inbound webhooks with valid, tampered, replayed, and duplicate payloads.
 * Verifies deduplication, strict tenant routing, and retry/dead-letter mechanics.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const crypto = require('crypto');
const http = require('http');

describe('Inbound Webhooks Fuzzing & Security Verification', () => {
  let mongod;
  let server;
  let baseUrl;
  let Integration, WebhookEvent, User, Workspace, Lead, PaymentAttempt, Notification;
  let webhookQueueService;

  const META_APP_SECRET = 'meta-test-app-secret-1234567890abcdef!';
  const RAZORPAY_WEBHOOK_SECRET = 'rzp-test-secret-1234567890abcdef!';

  let tenantA_Id, tenantB_Id;
  let metaIntA, googleIntA, sheetsIntA, websiteIntA, customIntA;
  let googleIntB, sheetsIntB;

  const googleKeyPlain = 'goog_key_secret_test_token_9876543210';
  const sheetsSecretPlain = 'gsht_sec_valid_secret_token_1234567890';
  const customSecretPlain = 'cwh_sec_valid_custom_token_1234567890';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    process.env.JWT_SECRET = 'test-jwt-secret-for-ingestion-fuzzing!';
    process.env.META_APP_SECRET = META_APP_SECRET;
    process.env.META_VERIFY_SIGNATURE = 'true';
    process.env.RAZORPAY_WEBHOOK_SECRET = RAZORPAY_WEBHOOK_SECRET;

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    Integration = require('../src/models/Integration');
    WebhookEvent = require('../src/models/WebhookEvent');
    User = require('../src/models/User');
    Workspace = require('../src/models/Workspace');
    Lead = require('../src/models/Lead');
    PaymentAttempt = require('../src/models/PaymentAttempt');
    Notification = require('../src/models/Notification');
    webhookQueueService = require('../src/services/integrations/webhookQueueService');

    // Create Tenant A & Tenant B
    tenantA_Id = new mongoose.Types.ObjectId();
    const wsA = await Workspace.create({ name: 'Tenant A Workspace', ownerId: tenantA_Id, companyId: tenantA_Id });
    await User.create({
      _id: tenantA_Id,
      name: 'Tenant Alpha Owner',
      email: 'owner@tenant-a.com',
      password: 'Password123!',
      role: 'owner',
      companyId: tenantA_Id,
      workspaceId: wsA._id,
      status: 'active',
    });

    tenantB_Id = new mongoose.Types.ObjectId();
    const wsB = await Workspace.create({ name: 'Tenant B Workspace', ownerId: tenantB_Id, companyId: tenantB_Id });
    await User.create({
      _id: tenantB_Id,
      name: 'Tenant Beta Owner',
      email: 'owner@tenant-b.com',
      password: 'Password123!',
      role: 'owner',
      companyId: tenantB_Id,
      workspaceId: wsB._id,
      status: 'active',
    });

    // 1. Meta Integration for Tenant A
    metaIntA = await Integration.create({
      provider: 'meta',
      companyId: tenantA_Id,
      userId: tenantA_Id,
      pageId: '100099887766554',
      formIds: ['form_meta_1001'],
      status: 'connected',
    });

    // 2. Google Integration for Tenant A & B
    const googleHashA = crypto.createHash('sha256').update(googleKeyPlain).digest('hex');
    googleIntA = await Integration.create({
      provider: 'google',
      companyId: tenantA_Id,
      userId: tenantA_Id,
      googleKeyHash: googleHashA,
      status: 'connected',
    });

    const googleHashB = crypto.createHash('sha256').update('goog_key_secret_for_tenant_b_999').digest('hex');
    googleIntB = await Integration.create({
      provider: 'google',
      companyId: tenantB_Id,
      userId: tenantB_Id,
      googleKeyHash: googleHashB,
      status: 'connected',
    });

    // 3. Sheets Integration for Tenant A & B
    const sheetsHashA = crypto.createHash('sha256').update(sheetsSecretPlain).digest('hex');
    sheetsIntA = await Integration.create({
      provider: 'sheets',
      companyId: tenantA_Id,
      userId: tenantA_Id,
      sheetsSecretHash: sheetsHashA,
      status: 'connected',
    });

    const sheetsHashB = crypto.createHash('sha256').update('gsht_sec_secret_for_tenant_b_999').digest('hex');
    sheetsIntB = await Integration.create({
      provider: 'sheets',
      companyId: tenantB_Id,
      userId: tenantB_Id,
      sheetsSecretHash: sheetsHashB,
      status: 'connected',
    });

    // 4. Website Form Integration for Tenant A
    websiteIntA = await Integration.create({
      provider: 'website',
      companyId: tenantA_Id,
      userId: tenantA_Id,
      websiteFormConfig: {
        formKey: 'form_campus_application_2026',
        allowedOrigins: ['https://college-portal.edu', 'https://apply.college-portal.edu'],
      },
      status: 'connected',
    });

    // 5. Custom Webhook Integration for Tenant A
    const customHashA = crypto.createHash('sha256').update(customSecretPlain).digest('hex');
    customIntA = await Integration.create({
      provider: 'custom',
      companyId: tenantA_Id,
      userId: tenantA_Id,
      sheetsSecretHash: customHashA,
      status: 'connected',
    });

    // 6. Meta WhatsApp Account for Tenant A
    const WhatsAppBusinessAccount = require('../src/models/WhatsAppBusinessAccount');
    await WhatsAppBusinessAccount.create({
      ownerId: tenantA_Id,
      workspaceId: wsA._id,
      phoneNumberId: 'PHONE_NUM_ID_01',
      wabaId: 'WHATSAPP_BUS_ACC_1001',
      displayPhoneNumber: '+919000000001',
      status: 'CONNECTED',
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
    if (server && server.listening) server.close();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve) => {
      const url = new URL(path, baseUrl);
      const payload = body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const reqHeaders = {
        ...(payload !== null ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      };

      const req = http.request(
        url.href,
        {
          method,
          headers: reqHeaders,
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
            resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
          });
        }
      );

      req.on('error', (err) => resolve({ status: 500, error: err.message }));
      if (payload !== null) req.write(payload);
      req.end();
    });
  }

  describe('1. Meta Lead Ads Inbound Webhook', () => {
    const validMetaPayload = {
      object: 'page',
      entry: [
        {
          id: '100099887766554',
          time: 1700000000,
          changes: [
            {
              field: 'leadgen',
              value: {
                page_id: '100099887766554',
                form_id: 'form_meta_1001',
                leadgen_id: 'leadgen_meta_valid_001',
                created_time: 1700000000,
              },
            },
          ],
        },
      ],
    };

    it('rejects inbound request when x-hub-signature-256 header is missing', async () => {
      const res = await makeRequest('POST', '/api/integrations/meta/webhook', {}, validMetaPayload);
      expect(res.status).toBe(403);
      expect(res.text).toContain('Missing signature');
    });

    it('rejects inbound request with tampered HMAC signature', async () => {
      const rawString = JSON.stringify(validMetaPayload);
      const res = await makeRequest(
        'POST',
        '/api/integrations/meta/webhook',
        { 'x-hub-signature-256': 'sha256=deadbeefcafebabe0000111122223333444455556666777788889999aaaabbbb' },
        rawString
      );
      expect(res.status).toBe(403);
      expect(res.text).toContain('Invalid signature');
    });

    it('accepts valid HMAC-SHA256 signature and enqueues event for correct tenant', async () => {
      const rawString = JSON.stringify(validMetaPayload);
      const validHmac = crypto.createHmac('sha256', META_APP_SECRET).update(rawString).digest('hex');

      const res = await makeRequest(
        'POST',
        '/api/integrations/meta/webhook',
        { 'x-hub-signature-256': `sha256=${validHmac}` },
        rawString
      );

      expect(res.status).toBe(200);
      expect(res.text).toContain('EVENT_RECEIVED');

      // Verify event was enqueued into MongoDB for Tenant A
      const event = await WebhookEvent.findOne({ provider: 'meta', externalLeadId: 'leadgen_meta_valid_001' });
      expect(event).not.toBeNull();
      expect(String(event.companyId)).toBe(String(tenantA_Id));
      expect(String(event.integrationId)).toBe(String(metaIntA._id));
    });

    it('safely discards event for unmapped page without cross-tenant leak or 500 error', async () => {
      const unmappedPayload = {
        object: 'page',
        entry: [
          {
            id: '999999999999999', // Unknown page
            changes: [
              {
                field: 'leadgen',
                value: {
                  page_id: '999999999999999',
                  form_id: 'form_unknown',
                  leadgen_id: 'leadgen_unmapped_001',
                },
              },
            ],
          },
        ],
      };
      const rawString = JSON.stringify(unmappedPayload);
      const validHmac = crypto.createHmac('sha256', META_APP_SECRET).update(rawString).digest('hex');

      const res = await makeRequest(
        'POST',
        '/api/integrations/meta/webhook',
        { 'x-hub-signature-256': `sha256=${validHmac}` },
        rawString
      );

      expect(res.status).toBe(200);
      const unmappedEvent = await WebhookEvent.findOne({ externalLeadId: 'leadgen_unmapped_001' });
      expect(unmappedEvent).toBeNull();
    });
  });

  describe('2. Google Ads Lead Form Inbound Webhook', () => {
    const validGooglePayload = {
      lead_id: 'goog_lead_test_101',
      api_version: '1.0',
      form_id: '12345678',
      campaign_id: '87654321',
      user_column_data: [
        { column_id: 'FULL_NAME', string_value: 'Ananya Sharma' },
        { column_id: 'PHONE_NUMBER', string_value: '+919876543210' },
        { column_id: 'EMAIL', string_value: 'ananya@example.com' },
      ],
    };

    it('rejects request missing webhook key with 401', async () => {
      const res = await makeRequest('POST', '/api/integrations/google/webhook', {}, validGooglePayload);
      expect(res.status).toBe(401);
      expect(res.body?.error).toBe('Missing webhook key');
    });

    it('rejects request with invalid/tampered key with 401', async () => {
      const res = await makeRequest(
        'POST',
        '/api/integrations/google/webhook/goog_key_tampered_fake_key',
        {},
        validGooglePayload
      );
      expect(res.status).toBe(401);
      expect(res.body?.error).toBe('Invalid webhook key');
    });

    it('accepts valid key via path param, enqueues event, and preserves tenant isolation', async () => {
      const res = await makeRequest(
        'POST',
        `/api/integrations/google/webhook/${googleKeyPlain}`,
        {},
        validGooglePayload
      );

      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('RECEIVED');

      const event = await WebhookEvent.findOne({ provider: 'google', externalLeadId: 'goog_lead_test_101' });
      expect(event).not.toBeNull();
      expect(String(event.companyId)).toBe(String(tenantA_Id));
      expect(String(event.integrationId)).toBe(String(googleIntA._id));
      expect(String(event.companyId)).not.toBe(String(tenantB_Id));
    });
  });

  describe('3. Google Sheets Inbound Webhook', () => {
    const validSheetsPayload = {
      leadId: 'uuid-sheet-row-888',
      rowData: {
        'Student Name': 'Rajesh Gupta',
        'Mobile Number': '9876501234',
        'Course': 'MBA Executive',
      },
    };

    it('rejects request without x-crm-secret header with 401', async () => {
      const res = await makeRequest(
        'POST',
        `/api/integrations/sheets/webhook/${sheetsIntA._id}`,
        {},
        validSheetsPayload
      );
      expect(res.status).toBe(401);
      expect(res.body?.error).toBe('Missing webhook secret key');
    });

    it('rejects request with invalid secret with 401', async () => {
      const res = await makeRequest(
        'POST',
        `/api/integrations/sheets/webhook/${sheetsIntA._id}`,
        { 'x-crm-secret': 'wrong-tampered-secret-value' },
        validSheetsPayload
      );
      expect(res.status).toBe(401);
      expect(res.body?.error).toBe('Invalid secret token');
    });

    it('rejects request with non-existent or cross-tenant integration id with 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await makeRequest(
        'POST',
        `/api/integrations/sheets/webhook/${fakeId}`,
        { 'x-crm-secret': sheetsSecretPlain },
        validSheetsPayload
      );
      expect(res.status).toBe(404);
      expect(res.body?.error).toContain('not found');
    });

    it('accepts valid secret, enqueues event, and sets status to SYNCED', async () => {
      const res = await makeRequest(
        'POST',
        `/api/integrations/sheets/webhook/${sheetsIntA._id}`,
        { 'x-crm-secret': sheetsSecretPlain },
        validSheetsPayload
      );

      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('SYNCED');

      const event = await WebhookEvent.findOne({ provider: 'sheets', externalLeadId: 'uuid-sheet-row-888' });
      expect(event).not.toBeNull();
      expect(String(event.companyId)).toBe(String(tenantA_Id));
    });
  });

  describe('4. Website Inbound Form Webhook', () => {
    const validFormPayload = {
      name: 'Sunita Reddy',
      phone: '+919876543299',
      email: 'sunita@reddy.test',
      program: 'M.Sc Data Science',
    };

    it('rejects submission from unauthorized origin with 403', async () => {
      const res = await makeRequest(
        'POST',
        '/api/integrations/forms/form_campus_application_2026/submit',
        { Origin: 'https://malicious-phishing-site.xyz' },
        validFormPayload
      );
      expect(res.status).toBe(403);
      expect(res.body?.error).toBe('Origin not allowed');
    });

    it('rejects submission without origin header when domain restricted with 403', async () => {
      const res = await makeRequest(
        'POST',
        '/api/integrations/forms/form_campus_application_2026/submit',
        {},
        validFormPayload
      );
      expect(res.status).toBe(403);
      expect(res.body?.error).toContain('Origin header required');
    });

    it('rejects submission for non-existent formKey with 404', async () => {
      const res = await makeRequest(
        'POST',
        '/api/integrations/forms/form_non_existent_key_999/submit',
        { Origin: 'https://college-portal.edu' },
        validFormPayload
      );
      expect(res.status).toBe(404);
      expect(res.body?.error).toContain('not found');
    });

    it('silently discards spam when honeypot trap _gotcha is filled', async () => {
      const spamPayload = {
        ...validFormPayload,
        _gotcha: 'http://spam-link-automated-bot.net',
      };

      const res = await makeRequest(
        'POST',
        '/api/integrations/forms/form_campus_application_2026/submit',
        { Origin: 'https://college-portal.edu' },
        spamPayload
      );

      // Returns 200 to fool the bot, but does NOT enqueue
      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('RECEIVED');

      const count = await WebhookEvent.countDocuments({
        provider: 'website',
        'rawBody.name': 'Sunita Reddy',
      });
      expect(count).toBe(0);
    });

    it('accepts valid submission from allowed origin and enqueues event', async () => {
      const res = await makeRequest(
        'POST',
        '/api/integrations/forms/form_campus_application_2026/submit',
        { Origin: 'https://college-portal.edu' },
        validFormPayload
      );

      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('RECEIVED');

      const event = await WebhookEvent.findOne({
        provider: 'website',
        companyId: tenantA_Id,
      });
      expect(event).not.toBeNull();
      expect(event.rawBody?.phone).toBe('+919876543299');
    });
  });

  describe('5. Custom Inbound Webhook (Zapier / Make / JustDial)', () => {
    const validCustomPayload = {
      lead_id: 'custom_zapier_evt_777',
      name: 'Harish Chandra',
      phone: '9845012345',
      lead_source: 'JustDial Inquiry',
    };

    it('rejects request with missing secret with 401', async () => {
      const res = await makeRequest(
        'POST',
        `/api/integrations/custom/webhook/${customIntA._id}`,
        {},
        validCustomPayload
      );
      expect(res.status).toBe(401);
      expect(res.body?.error).toBe('Missing webhook secret key');
    });

    it('rejects request with tampered/bad secret with 401', async () => {
      const res = await makeRequest(
        'POST',
        `/api/integrations/custom/webhook/${customIntA._id}`,
        { Authorization: 'Bearer bad_tampered_token_123' },
        validCustomPayload
      );
      expect(res.status).toBe(401);
      expect(res.body?.error).toBe('Invalid secret token');
    });

    it('accepts valid secret token via Bearer header and enqueues event', async () => {
      const res = await makeRequest(
        'POST',
        `/api/integrations/custom/webhook/${customIntA._id}`,
        { Authorization: `Bearer ${customSecretPlain}` },
        validCustomPayload
      );

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const event = await WebhookEvent.findOne({ provider: 'custom', externalLeadId: 'custom_zapier_evt_777' });
      expect(event).not.toBeNull();
      expect(String(event.companyId)).toBe(String(tenantA_Id));
    });
  });

  describe('6. Razorpay Payment Webhook', () => {
    const paymentId = 'pay_test_rzp_mock_555';
    function getValidRzpPayload() {
      return {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: paymentId,
              amount: 500000,
              currency: 'INR',
              status: 'captured',
              method: 'upi',
              notes: {
                userId: tenantA_Id.toString(),
                planId: 'power_solo',
              },
            },
          },
        },
      };
    }

    it('rejects request without signature header with 400', async () => {
      const rawString = JSON.stringify(getValidRzpPayload());
      const res = await makeRequest('POST', '/api/payment/webhook', {}, rawString);
      expect(res.status).toBe(400);
      expect(res.body?.message).toContain('signature header');
    });

    it('rejects request with tampered HMAC signature with 400', async () => {
      const rawString = JSON.stringify(getValidRzpPayload());
      const res = await makeRequest(
        'POST',
        '/api/payment/webhook',
        { 'x-razorpay-signature': 'tampered_bad_signature_hex_value_12345' },
        rawString
      );
      expect(res.status).toBe(400);
      expect(res.body?.message).toContain('Invalid Razorpay webhook signature');
    });

    it('accepts valid signature and executes reconciliation successfully', async () => {
      const rawString = JSON.stringify(getValidRzpPayload());
      const validSig = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawString).digest('hex');

      const res = await makeRequest(
        'POST',
        '/api/payment/webhook',
        { 'x-razorpay-signature': validSig },
        rawString
      );

      expect(res.status).toBe(200);

      // Verify PaymentAttempt was created for audit & idempotency
      const attempt = await PaymentAttempt.findOne({ idempotencyKey: `wh_payment.captured_${paymentId}` });
      expect(attempt).not.toBeNull();
    });

    it('replayed / duplicate payload returns 200 with idempotent "Already processed"', async () => {
      const rawString = JSON.stringify(getValidRzpPayload());
      const validSig = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawString).digest('hex');

      // Re-send identical event
      const res = await makeRequest(
        'POST',
        '/api/payment/webhook',
        { 'x-razorpay-signature': validSig },
        rawString
      );

      expect(res.status).toBe(200);
      expect(res.body?.message).toBe('Already processed');
    });
  });

  describe('7. Meta WhatsApp Inbound Webhook', () => {
    const validWaPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUS_ACC_1001',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '919000000001', phone_number_id: 'PHONE_NUM_ID_01' },
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLOTE5ODc2NTQzMjEwFQIAEhgWM0VCMDAwMDAwMDAwMDAwMDAwMDAAA',
                    timestamp: '1700000000',
                    text: { body: 'Hello, I want prospectus' },
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    it('rejects request with missing signature header with 401', async () => {
      const res = await makeRequest('POST', '/api/whatsapp/meta/webhook', {}, validWaPayload);
      expect(res.status).toBe(401);
      expect(res.body?.message).toBe('Invalid signature');
    });

    it('rejects request with tampered signature with 401', async () => {
      const rawString = JSON.stringify(validWaPayload);
      const res = await makeRequest(
        'POST',
        '/api/whatsapp/meta/webhook',
        { 'x-hub-signature-256': 'sha256=tampered_fake_signature_hex_1234567890' },
        rawString
      );
      expect(res.status).toBe(401);
      expect(res.body?.message).toBe('Invalid signature');
    });

    it('accepts valid HMAC signature and returns 200 EVENT_RECEIVED', async () => {
      const rawString = JSON.stringify(validWaPayload);
      const validSig = crypto.createHmac('sha256', META_APP_SECRET).update(rawString).digest('hex');

      const res = await makeRequest(
        'POST',
        '/api/whatsapp/meta/webhook',
        { 'x-hub-signature-256': `sha256=${validSig}` },
        rawString
      );

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    });
  });

  describe('8. Webhook Queue Deduplication, Retry & Dead-Letter Pipeline', () => {
    it('deduplicates replayed events via MongoDB partial unique index', async () => {
      const eventA = await webhookQueueService.enqueueEvent({
        provider: 'meta',
        integrationId: metaIntA._id,
        companyId: tenantA_Id,
        userId: tenantA_Id,
        externalLeadId: 'dedup_test_lead_unique_999',
        headers: {},
        rawBody: { test: 1 },
      });
      expect(eventA.duplicate).toBe(false);
      expect(eventA.eventId).not.toBeNull();

      // Enqueue identical event with same provider, integrationId, externalLeadId
      const eventB = await webhookQueueService.enqueueEvent({
        provider: 'meta',
        integrationId: metaIntA._id,
        companyId: tenantA_Id,
        userId: tenantA_Id,
        externalLeadId: 'dedup_test_lead_unique_999',
        headers: {},
        rawBody: { test: 1 },
      });
      expect(eventB.duplicate).toBe(true);
      expect(eventB.eventId).toBeNull();
    });

    it('transitions to dead_letter after maxAttempts and creates tenant degradation notification', async () => {
      const event = await WebhookEvent.create({
        provider: 'meta',
        integrationId: metaIntA._id,
        companyId: tenantA_Id,
        userId: tenantA_Id,
        externalLeadId: 'error_fail_retry_lead_777',
        status: 'processing',
        attempts: 4, // 5th attempt will exceed maxAttempts (5)
        maxAttempts: 5,
        rawBody: { invalid: true },
      });

      // Simulate failure on 5th attempt
      await webhookQueueService.handleProcessingFailure(event, new Error('Simulated upstream API timeout'));

      const updated = await WebhookEvent.findById(event._id);
      expect(updated.status).toBe('dead_letter');
      expect(updated.attempts).toBe(5);
      expect(updated.lastError?.message).toContain('Simulated upstream API timeout');

      // Verify degradation notification was created for tenant admin
      const alert = await Notification.findOne({
        userId: tenantA_Id,
        title: /Integration Degraded/,
      });
      expect(Boolean(alert)).toBe(true);
      expect(alert.title).toContain('Integration Degraded');
    });

    it('supports manual admin re-drive of dead-letter events via retryEvent', async () => {
      const deadEvent = await WebhookEvent.create({
        provider: 'custom',
        integrationId: customIntA._id,
        companyId: tenantA_Id,
        userId: tenantA_Id,
        externalLeadId: 'dead_letter_lead_re_drive',
        status: 'dead_letter',
        attempts: 5,
        rawBody: { data: 'test' },
      });

      await webhookQueueService.retryEvent(deadEvent._id);

      const reDriven = await WebhookEvent.findById(deadEvent._id);
      expect(reDriven.status).toBe('pending');
      expect(reDriven.attempts).toBe(0);
    });
  });
});
