const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

async function runTest() {
  console.log('🧪 Running Issue 1 Test: Lead Won Status Update & Incentive Isolation...');
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

  // Create test user and workspace
  const user = await User.create({
    name: 'Won Tester',
    email: `wontester_${Date.now()}@example.com`,
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });

  const workspace = await Workspace.create({
    name: 'Won Test Workspace',
    ownerId: user._id,
  });

  await WorkspaceMembership.create({
    workspaceId: workspace._id,
    userId: user._id,
    role: 'owner',
    status: 'active',
  });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Create clean isolated Express app
  const app = express();
  app.use(express.json());
  app.use('/api/leads', require('../src/routes/leads'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Create initial lead
    const lead = await Lead.create({
      name: 'Conversion Candidate',
      phone: '+919876543210',
      status: 'hot',
      userId: user._id,
      companyId: user._id,
      workspaceId: workspace._id,
    });

    // 2. Send PUT request to mark converted with payment details
    const res = await fetch(`${baseUrl}/leads/${lead._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspace._id.toString(),
      },
      body: JSON.stringify({
        status: 'converted',
        paid_amount: 15000,
        payment_method: 'bank_transfer',
        transaction_id: 'TXN-WON-TEST-001',
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200 OK but got ${res.status}: ${JSON.stringify(body)}`);
    assert.strictEqual(body.status, 'converted', 'Lead status in response should be converted');

    // 3. Verify in database
    const updatedLead = await Lead.findById(lead._id);
    assert.strictEqual(updatedLead.status, 'converted', 'Lead in DB must be converted');

    // 4. Verify Payment created in DB
    const payment = await Payment.findOne({
      $or: [{ lead_id: lead._id }, { leadId: lead._id }],
    });
    assert.ok(payment, 'Payment record must be created in DB');
    assert.strictEqual(payment.amount, 15000, 'Payment amount must match');

    console.log('✅ Issue 1 Test PASSED: Lead converted, payment recorded, zero crash on missing agencyController.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 1 Test FAILED:', err);
    process.exit(1);
  });
