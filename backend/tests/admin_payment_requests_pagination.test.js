const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Admin Payment Requests Pagination Defaults...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const PaymentRequest = require('../src/models/PaymentRequest');
  const { getAdminPaymentRequests } = require('../src/controllers/paymentController');

  // Seed 250 payment requests
  const dummyDocs = [];
  for (let i = 0; i < 250; i++) {
    dummyDocs.push({
      userId: new mongoose.Types.ObjectId(),
      username: `user_${i}`,
      planSelected: 'pro',
      originalPrice: 1000,
      finalPrice: 1000,
      utrNumber: `UTR_${Date.now()}_${i}`,
      screenshotUrl: 'https://example.com/receipt.jpg',
      status: 'pending',
      createdAt: new Date(Date.now() - i * 1000),
    });
  }
  await PaymentRequest.insertMany(dummyDocs);

  const mockRes = () => {
    const res = {
      headers: {},
      statusCode: 200,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    return res;
  };

  // Test 1: Query params absent -> defaults to limit 200
  {
    const req = { query: {} };
    const res = mockRes();
    await getAdminPaymentRequests(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['X-Total-Count'], 250);
    assert.strictEqual(res.headers['X-Page'], 1);
    assert.strictEqual(res.headers['X-Limit'], 200);
    assert.strictEqual(res.headers['X-Total-Pages'], 2);
    assert.strictEqual(res.data.length, 200, 'Should return exactly 200 items when limit omitted');
    console.log('✅ Test 1 Passed: Default limit of 200 applied when query params absent.');
  }

  // Test 2: Custom limit = 25
  {
    const req = { query: { limit: '25', page: '2' } };
    const res = mockRes();
    await getAdminPaymentRequests(req, res);

    assert.strictEqual(res.headers['X-Limit'], 25);
    assert.strictEqual(res.headers['X-Page'], 2);
    assert.strictEqual(res.data.length, 25);
    console.log('✅ Test 2 Passed: Custom limit 25 and page 2 respected.');
  }

  // Test 3: Large limit capped at 200
  {
    const req = { query: { limit: '1000' } };
    const res = mockRes();
    await getAdminPaymentRequests(req, res);

    assert.strictEqual(res.headers['X-Limit'], 200);
    assert.strictEqual(res.data.length, 200);
    console.log('✅ Test 3 Passed: Large limit capped at 200.');
  }

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL ADMIN PAYMENT REQUESTS PAGINATION TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
