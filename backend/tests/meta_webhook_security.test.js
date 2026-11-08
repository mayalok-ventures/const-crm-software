const assert = require('assert');
const crypto = require('crypto');
const MetaProvider = require('../src/services/integrations/providers/MetaProvider');
const MetaWhatsAppService = require('../src/services/whatsapp/metaWhatsAppService');

async function runTest() {
  console.log('🧪 Running Issue 4 Test: Meta Webhook Fail-Closed Security...');

  const originalSecret = process.env.META_APP_SECRET;
  const testSecret = 'test_meta_app_secret_32bytes_value_123';
  const testPayload = JSON.stringify({
    object: 'page',
    entry: [{ id: '12345', changes: [{ field: 'leadgen', value: { leadgen_id: 'lg_999' } }] }],
  });

  try {
    // ── Test 1: Valid signature with configured secret => accepted ──
    process.env.META_APP_SECRET = testSecret;
    const validHmac = crypto.createHmac('sha256', testSecret).update(testPayload).digest('hex');
    const validReq = {
      headers: { 'x-hub-signature-256': `sha256=${validHmac}` },
      rawBody: Buffer.from(testPayload),
      body: JSON.parse(testPayload),
    };

    assert.strictEqual(MetaProvider.verify(validReq), true, 'MetaProvider should accept valid signature');
    assert.strictEqual(MetaWhatsAppService.verifyWebhookSignature(validReq, testSecret), true, 'MetaWhatsAppService should accept valid signature');

    // ── Test 2: Missing secret on server => FAILS CLOSED (must return false) ──
    delete process.env.META_APP_SECRET;
    assert.strictEqual(MetaProvider.verify(validReq), false, 'MetaProvider must fail closed when META_APP_SECRET is empty');
    assert.strictEqual(MetaWhatsAppService.verifyWebhookSignature(validReq, ''), false, 'MetaWhatsAppService must fail closed when META_APP_SECRET is empty');

    // ── Test 3: Missing signature header => FAILS CLOSED (must return false) ──
    process.env.META_APP_SECRET = testSecret;
    const reqWithoutSig = {
      headers: {},
      rawBody: Buffer.from(testPayload),
      body: JSON.parse(testPayload),
    };
    assert.strictEqual(MetaProvider.verify(reqWithoutSig), false, 'MetaProvider must reject request without signature header');
    assert.strictEqual(MetaWhatsAppService.verifyWebhookSignature(reqWithoutSig, testSecret), false, 'MetaWhatsAppService must reject request without signature header');

    // ── Test 4: Forged / bad signature => FAILS CLOSED (must return false) ──
    const forgedReq = {
      headers: { 'x-hub-signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000' },
      rawBody: Buffer.from(testPayload),
      body: JSON.parse(testPayload),
    };
    assert.strictEqual(MetaProvider.verify(forgedReq), false, 'MetaProvider must reject forged signature');
    assert.strictEqual(MetaWhatsAppService.verifyWebhookSignature(forgedReq, testSecret), false, 'MetaWhatsAppService must reject forged signature');

    // ── Test 5: Truncated / malformed signature (different length) => returns false without throwing ──
    const malformedReq = {
      headers: { 'x-hub-signature-256': 'sha256=short' },
      rawBody: Buffer.from(testPayload),
      body: JSON.parse(testPayload),
    };
    assert.doesNotThrow(() => {
      const res1 = MetaProvider.verify(malformedReq);
      assert.strictEqual(res1, false, 'MetaProvider must return false for truncated signature');
      const res2 = MetaWhatsAppService.verifyWebhookSignature(malformedReq, testSecret);
      assert.strictEqual(res2, false, 'MetaWhatsAppService must return false for truncated signature');
    });

    console.log('✅ Issue 4 Test PASSED: Meta webhook verification fails closed, guards timing safe comparison, rejects missing secrets & forged signatures.');
  } finally {
    if (originalSecret !== undefined) {
      process.env.META_APP_SECRET = originalSecret;
    } else {
      delete process.env.META_APP_SECRET;
    }
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 4 Test FAILED:', err);
    process.exit(1);
  });
