const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('RC-2 Webhook Signature Hardening & Fail-Closed Raw Body', () => {
  let mongod;
  let server;
  let baseUrl;
  const RAZORPAY_SECRET = 'test_rzp_webhook_secret_key_12345';
  const META_SECRET = 'test_meta_app_secret_key_67890';

  beforeAll(async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = RAZORPAY_SECRET;
    process.env.META_APP_SECRET = META_SECRET;
    process.env.META_VERIFY_SIGNATURE = 'true';

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const app = express();
    // Raw body parser capture
    app.use(express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));

    const paymentController = require('../src/controllers/paymentController');
    const metaWebhookController = require('../src/controllers/integrations/metaWebhookController');

    app.post('/api/webhooks/razorpay', paymentController.handleRazorpayWebhook);
    app.post('/api/integrations/meta/webhook', metaWebhookController.receive);

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe('Razorpay Webhook Signature Verification', () => {
    it('should reject inbound Razorpay webhook without x-razorpay-signature header with 400', async () => {
      let err;
      try {
        await axios.post(`${baseUrl}/api/webhooks/razorpay`, { event: 'payment.captured' });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'Expected request to be rejected');
      assert.strictEqual(err.response?.status, 400);
      assert.match(err.response?.data?.message, /signature header/i);
    });

    it('should reject invalid or tampered Razorpay HMAC signature with 400', async () => {
      const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_test_123' } } } };
      let err;
      try {
        await axios.post(`${baseUrl}/api/webhooks/razorpay`, payload, {
          headers: { 'x-razorpay-signature': 'deadbeef00112233445566778899aabbccddeeff' }
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'Expected request to be rejected');
      assert.strictEqual(err.response?.status, 400);
    });

    it('should accept valid HMAC-SHA256 signature calculated on exact raw body buffer', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rc2_verified_001',
              amount: 500000,
              notes: { leadId: new mongoose.Types.ObjectId().toString() }
            }
          }
        }
      });

      const signature = crypto
        .createHmac('sha256', RAZORPAY_SECRET)
        .update(Buffer.from(payload, 'utf8'))
        .digest('hex');

      const res = await axios.post(`${baseUrl}/api/webhooks/razorpay`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature
        }
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.status === 'ok' || res.data.success !== false);
    });
  });

  describe('Meta Webhook Signature Verification', () => {
    it('should reject Meta webhook with missing x-hub-signature-256 with 403', async () => {
      let err;
      try {
        await axios.post(`${baseUrl}/api/integrations/meta/webhook`, { object: 'page', entry: [] });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'Expected request to be rejected');
      assert.strictEqual(err.response?.status, 403);
    });

    it('should reject Meta webhook with tampered HMAC signature with 403', async () => {
      const payload = { object: 'page', entry: [] };
      let err;
      try {
        await axios.post(`${baseUrl}/api/integrations/meta/webhook`, payload, {
          headers: { 'x-hub-signature-256': 'sha256=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' }
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'Expected request to be rejected');
      assert.strictEqual(err.response?.status, 403);
    });

    it('should accept valid Meta webhook signature matching rawBody buffer', async () => {
      const payload = JSON.stringify({ object: 'page', entry: [] });
      const hmac = crypto
        .createHmac('sha256', META_SECRET)
        .update(Buffer.from(payload, 'utf8'))
        .digest('hex');

      const res = await axios.post(`${baseUrl}/api/integrations/meta/webhook`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': `sha256=${hmac}`
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data, 'EVENT_RECEIVED');
    });
  });
});
