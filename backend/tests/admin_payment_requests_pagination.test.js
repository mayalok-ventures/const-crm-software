const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

async function runTest() {
  console.log('🧪 Running Issue 11 Test: Admin Payment Requests Pagination & Stable Sorting...');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const User = require('../src/models/User');
  const PaymentRequest = require('../src/models/PaymentRequest');

  // Create admin user
  const adminUser = await User.create({
    name: 'Admin Finance',
    email: 'adminfinance@example.com',
    password: 'Password123!',
    role: 'superadmin',
    isAdmin: true,
  });

  const token = jwt.sign({ id: adminUser._id, role: adminUser.role, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Seed 120 payment requests with sequential timestamps
  const docs = [];
  const baseTime = Date.now() - 1000000;
  for (let i = 1; i <= 120; i++) {
    docs.push({
      userId: adminUser._id,
      username: `user_${i}`,
      planSelected: 'growth',
      originalPrice: 1000,
      finalPrice: 800,
      utrNumber: `UTR-${1000000000 + i}`,
      screenshotUrl: `https://example.com/receipt_${i}.jpg`,
      status: i % 2 === 0 ? 'pending' : 'approved',
      createdAt: new Date(baseTime + i * 1000),
    });
  }
  await PaymentRequest.insertMany(docs);

  const app = express();
  app.use(express.json());
  app.use('/api/payments', require('../src/routes/paymentRoutes'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/payments`;

  try {
    // 1. Default request without query params
    const resDefault = await fetch(`${baseUrl}/admin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(resDefault.status, 200);
    const bodyDefault = await resDefault.json();
    assert.ok(Array.isArray(bodyDefault), 'Response body must remain a JSON array for backward compatibility');
    assert.strictEqual(bodyDefault.length, 50, 'Default page limit should be 50');
    assert.strictEqual(resDefault.headers.get('x-total-count'), '120');
    assert.strictEqual(resDefault.headers.get('x-page'), '1');
    assert.strictEqual(resDefault.headers.get('x-limit'), '50');
    assert.strictEqual(resDefault.headers.get('x-total-pages'), '3');

    // 2. Page 2 request
    const resPage2 = await fetch(`${baseUrl}/admin?page=2&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bodyPage2 = await resPage2.json();
    assert.strictEqual(bodyPage2.length, 50);
    assert.strictEqual(resPage2.headers.get('x-page'), '2');

    // Verify disjoint sets between page 1 and page 2
    const page1Ids = new Set(bodyDefault.map(r => r._id));
    const overlap = bodyPage2.filter(r => page1Ids.has(r._id));
    assert.strictEqual(overlap.length, 0, 'Page 1 and Page 2 must not have overlapping records');

    // 3. Page 3 request (remaining 20)
    const resPage3 = await fetch(`${baseUrl}/admin?page=3&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bodyPage3 = await resPage3.json();
    assert.strictEqual(bodyPage3.length, 20, 'Page 3 must return the remaining 20 records');

    // 4. Stable sort verification: first item on page 1 has higher or equal createdAt than last item
    const firstTimestamp = new Date(bodyDefault[0].createdAt).getTime();
    const lastTimestamp = new Date(bodyDefault[bodyDefault.length - 1].createdAt).getTime();
    assert.ok(firstTimestamp >= lastTimestamp, 'Records must be sorted descending by createdAt');

    console.log('✅ Issue 11 Test PASSED: Admin payment requests pagination, stable sorting, and metadata headers verified.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 11 Test FAILED:', err);
    process.exit(1);
  });
