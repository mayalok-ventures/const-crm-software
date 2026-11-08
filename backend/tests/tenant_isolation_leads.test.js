const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

async function runTest() {
  console.log('🧪 Running Issue 5 Test: Cross-Tenant Isolation & Legacy Backfill...');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';
  delete process.env.ALLOW_UNSCOPED_LEGACY_LEADS; // Strict mode

  await mongoose.connect(uri);

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');
  require('../src/models/Catalogue');
  const { runBackfill } = require('../src/scripts/backfillLegacyLeadWorkspaceId');

  // Setup Workspace A
  const ownerA = await User.create({
    name: 'Owner A',
    email: 'ownerA@example.com',
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });
  const wsA = await Workspace.create({ name: 'Workspace A', ownerId: ownerA._id });
  await WorkspaceMembership.create({ workspaceId: wsA._id, userId: ownerA._id, role: 'owner', status: 'active' });
  const tokenA = jwt.sign({ id: ownerA._id, role: ownerA.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Setup Workspace B
  const ownerB = await User.create({
    name: 'Owner B',
    email: 'ownerB@example.com',
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });
  const wsB = await Workspace.create({ name: 'Workspace B', ownerId: ownerB._id });
  await WorkspaceMembership.create({ workspaceId: wsB._id, userId: ownerB._id, role: 'owner', status: 'active' });
  const tokenB = jwt.sign({ id: ownerB._id, role: ownerB.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Create Leads:
  // Lead A in Workspace A
  const leadA = await Lead.create({
    name: 'Lead A',
    phone: '+919111111111',
    userId: ownerA._id,
    companyId: ownerA._id,
    workspaceId: wsA._id,
  });

  // Lead B in Workspace B
  const leadB = await Lead.create({
    name: 'Lead B',
    phone: '+919222222222',
    userId: ownerB._id,
    companyId: ownerB._id,
    workspaceId: wsB._id,
  });

  // Legacy Lead with NO workspaceId inserted directly (as legacy records existed before hooks)
  const legacyLeadResult = await Lead.collection.insertOne({
    name: 'Legacy Unscoped Lead',
    phone: '+919333333333',
    userId: ownerA._id,
    companyId: ownerA._id,
    workspaceId: null,
    status: 'new',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const legacyLeadId = legacyLeadResult.insertedId;

  const app = express();
  app.use(express.json());
  app.use('/api/leads', require('../src/routes/leads'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/leads`;

  try {
    // 1. Owner B requests leads while operating in Workspace B
    const resB = await fetch(`${baseUrl}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-workspace-id': wsB._id.toString(),
      },
    });
    assert.strictEqual(resB.status, 200);
    const bodyB = await resB.json();
    const leadsReturnedB = bodyB.leads || bodyB;

    // Verify Owner B sees ONLY Lead B, NEVER Lead A or legacy unassigned lead
    const returnedIdsB = leadsReturnedB.map(l => l._id.toString());
    assert.ok(returnedIdsB.includes(leadB._id.toString()), 'Workspace B should see Lead B');
    assert.ok(!returnedIdsB.includes(leadA._id.toString()), 'Workspace B MUST NEVER see Lead A');
    assert.ok(!returnedIdsB.includes(legacyLeadId.toString()), 'Workspace B MUST NEVER see legacy lead with null workspaceId');

    // 2. Owner B tries to GET Lead A directly by ID
    const resIdCheck = await fetch(`${baseUrl}/${leadA._id}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-workspace-id': wsB._id.toString(),
      },
    });
    assert.strictEqual(resIdCheck.status, 404, 'Direct access to cross-workspace lead must return 404 Not Found');

    // 3. Test Backfill Script in Dry-Run Mode
    const dryRunResult = await runBackfill({ apply: false });
    assert.strictEqual(dryRunResult.total, 1, 'Should find 1 legacy unscoped lead');
    assert.strictEqual(dryRunResult.resolved, 1, 'Should be resolvable via ownerA company');

    const checkStillNull = await Lead.findById(legacyLeadId);
    assert.strictEqual(checkStillNull.workspaceId, null, 'Dry run must not commit changes');

    // 4. Test Backfill Script in Apply Mode
    const applyResult = await runBackfill({ apply: true });
    assert.strictEqual(applyResult.resolved, 1);

    const checkUpdated = await Lead.findById(legacyLeadId);
    assert.strictEqual(checkUpdated.workspaceId.toString(), wsA._id.toString(), 'Apply mode must assign correct workspaceId');

    console.log('✅ Issue 5 Test PASSED: Strict cross-tenant isolation verified and legacy backfill successfully tested.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 5 Test FAILED:', err);
    process.exit(1);
  });
