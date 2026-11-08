const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Strict Tenant Isolation Fail-Closed Verification...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const User = require('../src/models/User');
  const Workspace = require('../src/models/Workspace');
  const { buildLeadPermissionQuery } = require('../src/controllers/leadsController');

  const ws = await Workspace.create({ name: 'Strict WS', slug: 'strict-ws', ownerId: new mongoose.Types.ObjectId() });
  const user = await User.create({
    name: 'Scoping Tester',
    email: 'scoping@crm.local',
    password: 'Password123!',
    phone: '9876543209',
    role: 'agent',
    companyRole: 'agent',
  });
  user.workspaceId = ws._id;

  // Seed a lead in the workspace
  await Lead.create({
    name: 'Scoped Lead',
    phone: '9888877772',
    workspaceId: ws._id,
    userId: user._id,
    targetDomain: 'Engineering (B.Tech/BE)',
  });

  // 1. With workspaceId present on user, query matches workspaceId
  delete process.env.ALLOW_UNSCOPED_LEGACY_LEADS;
  const scopedQuery = await buildLeadPermissionQuery(user);
  assert.strictEqual(scopedQuery.workspaceId.toString(), ws._id.toString());
  const foundLeads = await Lead.find(scopedQuery);
  assert.strictEqual(foundLeads.length, 1);
  console.log('✅ Step 1: User with active workspaceId successfully scopes to workspace.');

  // 2. User without workspaceId and ALLOW_UNSCOPED_LEGACY_LEADS undefined/false must FAIL CLOSED
  const userWithoutWs = { _id: user._id, role: 'agent', companyRole: 'agent' };
  const failClosedQuery = await buildLeadPermissionQuery(userWithoutWs);
  assert.ok(failClosedQuery.workspaceId, 'Must produce a non-matching workspaceId filter');
  const foundUnscoped = await Lead.find(failClosedQuery);
  assert.strictEqual(foundUnscoped.length, 0, 'Unscoped request without legacy flag must match 0 records');
  console.log('✅ Step 2: Unscoped user request strictly fails closed (0 records matched).');

  // 3. Transitional mode when ALLOW_UNSCOPED_LEGACY_LEADS=true
  process.env.ALLOW_UNSCOPED_LEGACY_LEADS = 'true';
  const transitionalQuery = await buildLeadPermissionQuery(userWithoutWs);
  assert.ok(transitionalQuery.$or, 'Transitional mode should produce fallback $or query');
  console.log('✅ Step 3: Transitional mode produces legacy fallback when explicitly enabled.');

  delete process.env.ALLOW_UNSCOPED_LEGACY_LEADS;
  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL TENANT FAIL-CLOSED ASSERTIONS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
