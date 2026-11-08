const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

async function runTest() {
  console.log('🧪 Running Issue 10 Test: Recording & Payment Workspace Isolation...');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');
  const Recording = require('../src/models/Recording');
  const Payment = require('../src/models/Payment');
  const { runBackfill } = require('../src/scripts/backfillWorkspaceIdForRecordingsAndPayments');

  // Create Workspace A and Owner A
  const userA = await User.create({
    name: 'Owner A',
    email: 'rec_a@example.com',
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });
  const wsA = await Workspace.create({ name: 'Workspace A', ownerId: userA._id });
  await WorkspaceMembership.create({ workspaceId: wsA._id, userId: userA._id, role: 'owner', status: 'active' });
  const tokenA = jwt.sign({ id: userA._id, role: userA.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Create Workspace B and Owner B
  const userB = await User.create({
    name: 'Owner B',
    email: 'rec_b@example.com',
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });
  const wsB = await Workspace.create({ name: 'Workspace B', ownerId: userB._id });
  await WorkspaceMembership.create({ workspaceId: wsB._id, userId: userB._id, role: 'owner', status: 'active' });
  const tokenB = jwt.sign({ id: userB._id, role: userB.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Lead A in Workspace A
  const leadA = await Lead.create({
    name: 'Lead A',
    phone: '+919811111111',
    userId: userA._id,
    companyId: userA._id,
    workspaceId: wsA._id,
  });

  // Recording for Lead A
  const recA = await Recording.create({
    workspaceId: wsA._id,
    leadId: leadA._id,
    userId: userA._id,
    filename: 'https://cloudinary.com/audio_test_a.webm',
    originalName: 'test_a.webm',
    duration: 30,
  });

  // Legacy Recording without workspaceId (inserted directly to bypass)
  const legacyRecResult = await Recording.collection.insertOne({
    leadId: leadA._id,
    userId: userA._id,
    filename: 'https://cloudinary.com/audio_legacy.webm',
    originalName: 'legacy.webm',
    workspaceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const legacyRecId = legacyRecResult.insertedId;

  // Legacy Payment without workspaceId
  const legacyPayResult = await Payment.collection.insertOne({
    lead_id: leadA._id,
    leadId: leadA._id,
    amount: 5000,
    status: 'completed',
    workspaceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const legacyPayId = legacyPayResult.insertedId;

  const app = express();
  app.use(express.json());
  app.use('/api/recordings', require('../src/routes/recordings'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/recordings`;

  try {
    // 1. User B tries to fetch recordings for Lead A (cross-workspace)
    const resGetCross = await fetch(`${baseUrl}/${leadA._id}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-workspace-id': wsB._id.toString(),
      },
    });
    assert.strictEqual(resGetCross.status, 404, 'User B must not be able to get recordings for Workspace A lead');

    // 2. User B tries to delete Recording A (cross-workspace)
    const resDelCross = await fetch(`${baseUrl}/${recA._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-workspace-id': wsB._id.toString(),
      },
    });
    assert.strictEqual(resDelCross.status, 404, 'User B must not be able to delete Recording A');

    // 3. User A fetches recordings for Lead A (same workspace) -> succeeds
    const resGetSame = await fetch(`${baseUrl}/${leadA._id}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-workspace-id': wsA._id.toString(),
      },
    });
    assert.strictEqual(resGetSame.status, 200);
    const bodySame = await resGetSame.json();
    assert.ok(Array.isArray(bodySame));
    assert.ok(bodySame.some(r => r._id.toString() === recA._id.toString()));

    // 4. Test Backfill Script in Dry-Run Mode
    const dryRunResult = await runBackfill({ apply: false });
    assert.strictEqual(dryRunResult.recordings.total, 1);
    assert.strictEqual(dryRunResult.recordings.resolved, 1);
    assert.strictEqual(dryRunResult.payments.total, 1);
    assert.strictEqual(dryRunResult.payments.resolved, 1);

    const checkRecStillNull = await Recording.findById(legacyRecId);
    assert.strictEqual(checkRecStillNull.workspaceId, null, 'Dry run must not alter recording');

    // 5. Test Backfill Script in Apply Mode
    const applyResult = await runBackfill({ apply: true });
    assert.strictEqual(applyResult.recordings.resolved, 1);
    assert.strictEqual(applyResult.payments.resolved, 1);

    const checkRecUpdated = await Recording.findById(legacyRecId);
    assert.strictEqual(checkRecUpdated.workspaceId.toString(), wsA._id.toString(), 'Recording workspaceId must be derived from parent lead');
    const checkPayUpdated = await Payment.findById(legacyPayId);
    assert.strictEqual(checkPayUpdated.workspaceId.toString(), wsA._id.toString(), 'Payment workspaceId must be derived from parent lead');

    console.log('✅ Issue 10 Test PASSED: Recording workspace isolation and payment/recording backfill verified.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 10 Test FAILED:', err);
    process.exit(1);
  });
