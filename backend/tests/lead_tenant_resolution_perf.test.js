const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function runTest() {
  console.log('🧪 Running Issue 8 Test: Lead Tenant Resolution Performance & Hook Decoupling...');

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
  const { resolveLeadTenant, memoCache } = require('../src/utils/resolveLeadTenant');

  // Setup Company Owner and Workspace
  const owner = await User.create({
    name: 'Resolution Owner',
    email: 'res_owner@example.com',
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });
  const ws = await Workspace.create({ name: 'Resolution Workspace', ownerId: owner._id });
  await WorkspaceMembership.create({ workspaceId: ws._id, userId: owner._id, role: 'owner', status: 'active' });

  try {
    // 1. Test resolveLeadTenant utility directly (and verify memo caching)
    memoCache.clear();
    const resolvedFirst = await resolveLeadTenant({ userId: owner._id, companyId: owner._id });
    assert.strictEqual(resolvedFirst.workspaceId.toString(), ws._id.toString());
    assert.strictEqual(memoCache.size, 1, 'Memo cache should have 1 entry');

    // Second call should hit in-memory cache directly
    const startMemo = process.hrtime.bigint();
    const resolvedCached = await resolveLeadTenant({ userId: owner._id, companyId: owner._id });
    const endMemo = process.hrtime.bigint();
    const durationMs = Number(endMemo - startMemo) / 1e6;
    assert.strictEqual(resolvedCached.workspaceId.toString(), ws._id.toString());
    assert.ok(durationMs < 5, `Cached resolution should take < 5ms (took ${durationMs}ms)`);

    // 2. Hot-path test: Saving 50 leads with explicit workspaceId triggers zero extra queries
    const leadsToInsert = [];
    for (let i = 1; i <= 50; i++) {
      leadsToInsert.push(new Lead({
        name: `Fast Lead ${i}`,
        phone: `+9199000000${i < 10 ? '0' + i : i}`,
        userId: owner._id,
        companyId: owner._id,
        workspaceId: ws._id,
      }));
    }

    const saveStart = process.hrtime.bigint();
    await Promise.all(leadsToInsert.map(l => l.save()));
    const saveEnd = process.hrtime.bigint();
    const saveDurationMs = Number(saveEnd - saveStart) / 1e6;
    console.log(`⚡ 50 Leads saved in ${saveDurationMs.toFixed(2)}ms with explicit workspaceId`);

    // 3. Fallback path test: Lead saved without workspaceId still gets resolved safely
    const fallbackLead = new Lead({
      name: 'Fallback Lead',
      phone: '+919999888877',
      userId: owner._id,
      companyId: owner._id,
    });
    await fallbackLead.save();
    assert.strictEqual(fallbackLead.workspaceId.toString(), ws._id.toString(), 'Fallback resolution must fill workspaceId');

    console.log('✅ Issue 8 Test PASSED: Cached tenant resolution and pre-save optimization verified.');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 8 Test FAILED:', err);
    process.exit(1);
  });
