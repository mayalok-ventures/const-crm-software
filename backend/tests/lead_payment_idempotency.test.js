const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

function makeRequest(server, options, body) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('🧪 Running Test: Lead Payment Idempotency & Second Installment Support...');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Payment = require('../src/models/Payment');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');

  const user = await User.create({
    name: 'Idempotency Tester',
    email: `idem_${Date.now()}@example.com`,
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });

  const workspace = await Workspace.create({
    name: 'Idempotency Test Workspace',
    ownerId: user._id,
  });

  await WorkspaceMembership.create({
    workspaceId: workspace._id,
    userId: user._id,
    role: 'owner',
    status: 'active',
  });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  const app = express();
  app.use(express.json());
  app.use('/api/leads', require('../src/routes/leads'));

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));

  try {
    const lead = await Lead.create({
      name: 'Test Candidate For Installments',
      phone: '9888877771',
      userId: user._id,
      companyId: user.companyId || user._id,
      workspaceId: workspace._id,
      status: 'Lead Received',
      targetDomain: 'Engineering (B.Tech/BE)',
    });

    // 1. Initial conversion with installment 1 (amount: 15000, txnId: 'TXN-INSTAL-1')
    const res1 = await makeRequest(server, {
      path: `/api/leads/${lead._id}`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      status: 'converted',
      paymentAmount: 15000,
      paymentMethod: 'UPI',
      transaction_id: 'TXN-INSTAL-1',
    });
    assert.strictEqual(res1.status, 200, 'First conversion should succeed with 200');

    const paymentsAfter1 = await Payment.find({ lead_id: lead._id });
    assert.strictEqual(paymentsAfter1.length, 1, 'Should have exactly 1 payment record');
    assert.strictEqual(paymentsAfter1[0].amount, 15000);
    assert.strictEqual(paymentsAfter1[0].transaction_id, 'TXN-INSTAL-1');
    console.log('✅ Step 1: Installment 1 of 15,000 INR created successfully.');

    // 2. Immediate duplicate submit with identical transaction_id (retry / double-click)
    const resDuplicate = await makeRequest(server, {
      path: `/api/leads/${lead._id}`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      status: 'converted',
      paymentAmount: 15000,
      paymentMethod: 'UPI',
      transaction_id: 'TXN-INSTAL-1',
    });
    assert.strictEqual(resDuplicate.status, 200, 'Duplicate request should succeed gracefully');

    const paymentsAfterDup = await Payment.find({ lead_id: lead._id });
    assert.strictEqual(paymentsAfterDup.length, 1, 'Duplicate request must NOT create a second payment record');
    console.log('✅ Step 2: Immediate duplicate submit safely deduplicated (still 1 payment).');

    // 3. Genuine second installment of the EXACT SAME amount (15000 INR) with new transaction_id ('TXN-INSTAL-2')
    const res2 = await makeRequest(server, {
      path: `/api/leads/${lead._id}`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    }, {
      status: 'converted',
      paymentAmount: 15000,
      paymentMethod: 'UPI',
      transaction_id: 'TXN-INSTAL-2',
    });
    assert.strictEqual(res2.status, 200, 'Second installment request should succeed');

    const paymentsAfter2 = await Payment.find({ lead_id: lead._id }).sort({ createdAt: 1 });
    assert.strictEqual(paymentsAfter2.length, 2, 'Genuine second installment with distinct txnId must be created!');
    assert.strictEqual(paymentsAfter2[1].transaction_id, 'TXN-INSTAL-2');
    console.log('✅ Step 3: Legitimate second installment of same amount (15,000 INR) successfully recorded!');

    console.log('🎉 ALL PAYMENT IDEMPOTENCY ASSERTIONS PASSED!');
    process.exit(0);
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
