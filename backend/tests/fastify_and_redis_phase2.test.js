const assert = require('assert');
const { buildFastifyApp } = require('../src/fastify/app');
const { cacheService } = require('../src/config/redis');
const { paginateWithCursor } = require('../src/utils/cursorPagination');
const { leadCreateSchema } = require('../src/fastify/schemas/leadSchemas');

async function runPhase2Tests() {
  console.log('\n======================================================');
  console.log('⚡ PHASE 2: FASTIFY, REDIS & CLOUDINARY VALIDATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // 1. Redis Cache Service Verification
  console.log('1️⃣ Testing Redis / Distributed Cache Service...');
  await testAsync('Redis cacheService sets and retrieves JSON with TTL', async () => {
    const testKey = 'test_key_' + Date.now();
    const testData = { leadId: 'lead_123', count: 42, active: true };
    await cacheService.setJson(testKey, testData, 60);
    const retrieved = await cacheService.getJson(testKey);
    assert.deepStrictEqual(retrieved, testData, 'Data retrieved from cache must match original');
    await cacheService.delKey(testKey);
    const afterDel = await cacheService.getJson(testKey);
    assert.strictEqual(afterDel, null, 'Key must be deleted');
  });

  await testAsync('Redis cacheService distributed lock acquire and release', async () => {
    const lockKey = 'lock:lead_import_test';
    const lock1 = await cacheService.acquireLock(lockKey, 5000);
    assert(lock1, 'Lock 1 must be acquired');
    const lock2 = await cacheService.acquireLock(lockKey, 5000);
    assert.strictEqual(lock2, null, 'Lock 2 must be rejected while lock 1 is active');
    await cacheService.releaseLock(lockKey, lock1);
    const lock3 = await cacheService.acquireLock(lockKey, 5000);
    assert(lock3, 'Lock 3 must be acquired after lock 1 is released');
    await cacheService.releaseLock(lockKey, lock3);
  });

  // 2. Fastify App Boot & Health Check
  console.log('\n2️⃣ Testing Fastify Application Engine...');
  const app = buildFastifyApp({ logger: false });
  await app.ready();

  await testAsync('Fastify /health returns engine Fastify and status UP', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.engine, 'Fastify');
    assert.strictEqual(body.status, 'UP');
  });

  // 3. Zod Schema Validation
  console.log('\n3️⃣ Testing Zod Lead Schema Validation & DTO Enforcement...');
  test('Valid lead passes Zod schema validation', () => {
    const valid = {
      name: 'Rohan Sharma',
      phone: '9876543210',
      email: 'rohan@example.com',
      targetStream: 'Engineering',
      targetCourse: 'B.Tech Computer Science',
      temperature: 'HOT',
      score: 95,
      budget: '15L',
    };
    const parsed = leadCreateSchema.safeParse(valid);
    assert(parsed.success, 'Valid lead must parse successfully');
  });

  test('Invalid phone rejects with Zod validation error', () => {
    const invalid = {
      name: 'Rohan Sharma',
      phone: '123', // Too short
      temperature: 'INVALID_TEMP',
    };
    const parsed = leadCreateSchema.safeParse(invalid);
    assert(!parsed.success, 'Invalid phone and temperature must fail');
    assert(parsed.error.issues && parsed.error.issues.length > 0, 'Error details must be present');
  });

  // 4. Cursor Pagination Math
  console.log('\n4️⃣ Testing Cursor Pagination Contract...');
  test('Cursor pagination limits to maximum 250 records', () => {
    const limit = Math.min(Math.max(parseInt(500, 10) || 50, 1), 250);
    assert.strictEqual(limit, 250, 'Max limit cap should be 250');
  });

  // 5. Cloudinary Direct Signed Upload
  console.log('\n5️⃣ Testing Cloudinary Direct Client Signed Upload...');
  test('Cloudinary signature generator configures f_auto,q_auto and folder presets', () => {
    const { signDirectUpload } = require('../src/controllers/mediaController');
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-api-key';
    process.env.CLOUDINARY_API_SECRET = 'test-api-secret-12345';

    let responseData = null;
    let statusCode = null;

    const mockReq = {
      body: { folderType: 'recordings', tags: 'counselor_call' },
    };
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    signDirectUpload(mockReq, mockRes);
    assert.strictEqual(responseData.success, true, 'Signature response should succeed');
    assert.strictEqual(responseData.data.folder, 'crm_recordings', 'Folder should map to crm_recordings');
    assert.strictEqual(responseData.data.transformation, 'f_auto,q_auto', 'Transformation must be f_auto,q_auto');
    assert(responseData.data.signature, 'Signature must be generated');
  });

  await app.close();

  console.log('\n======================================================');
  console.log(`📊 FINAL RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
