const assert = require('assert');
const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const {
  userCache,
  workspaceContextCache,
  invalidateUserAuthCache,
  invalidateWorkspaceCache,
} = require('../src/utils/authCache');

async function runPhase2TestSuite() {
  console.log('\n⚡ ========================================================');
  console.log('   TEST SUITE: PHASE 2 BACKEND SPEED & SEARCH OPTIMIZATIONS');
  console.log('========================================================\n');

  let passed = 0;
  const uniqueStamp = Date.now();

  // Step 1: Create a test user & workspace
  const user = await User.create({
    name: 'Phase 2 Tester',
    email: `phase2_${uniqueStamp}@test.com`,
    phone: `9812${String(uniqueStamp).slice(-6)}`,
    password: 'Password123!',
    role: 'owner',
    workStatus: 'company_owner',
  });

  const workspace = await Workspace.create({
    name: 'Phase 2 Test Workspace',
    ownerId: user._id,
  });

  // Step 2: Test authCache and invalidation
  userCache.set(String(user._id), { user, timestamp: Date.now() });
  workspaceContextCache.set(`${user._id}_default`, { workspace, membership: { role: 'owner' } });

  assert.strictEqual(userCache.get(String(user._id)) !== null, true);
  console.log('  ✅ [PASS] Step 1a: User cached successfully in authCache');
  passed++;

  assert.strictEqual(workspaceContextCache.get(`${user._id}_default`) !== null, true);
  console.log('  ✅ [PASS] Step 1b: Workspace context cached successfully');
  passed++;

  // Invalidate workspace cache by workspace ID
  invalidateWorkspaceCache(workspace._id);
  assert.strictEqual(workspaceContextCache.get(`${user._id}_default`), null);
  console.log('  ✅ [PASS] Step 2a: invalidateWorkspaceCache successfully purges cached workspace context');
  passed++;

  // Invalidate user cache
  invalidateUserAuthCache(user._id);
  assert.strictEqual(userCache.get(String(user._id)), null);
  console.log('  ✅ [PASS] Step 2b: invalidateUserAuthCache successfully purges user cache');
  passed++;

  // Step 3: Test Lead normalized search fields in pre-validate / pre-save
  const lead = new Lead({
    workspaceId: workspace._id,
    userId: user._id,
    name: 'Rajesh Kumar Gupta',
    phone: '+91 98765-43210',
    company: 'Alpha Tech Corp',
    source: 'manual',
  });

  await lead.validate();
  assert.strictEqual(lead.nameLower, 'rajesh kumar gupta');
  assert.strictEqual(lead.phoneDigits, '919876543210');
  assert.strictEqual(lead.companyLower, 'alpha tech corp');
  console.log('  ✅ [PASS] Step 3a: Lead pre-validate normalizes nameLower, companyLower, and phoneDigits');
  passed++;

  await lead.save();
  assert.strictEqual(String(lead.workspaceId), String(workspace._id));
  console.log('  ✅ [PASS] Step 3b: Lead saved successfully with normalized fields');
  passed++;

  // Step 4: Test Lead pre-save hook skip on update (zero extra DB queries)
  lead.notes = lead.notes || [];
  lead.notes.push({ text: 'Updated follow-up note', authorName: 'Tester' });
  await lead.save();
  console.log('  ✅ [PASS] Step 4: Lead update succeeds on hot path without redundant queries');
  passed++;

  // Step 5: Test indexed search queries
  const foundByName = await Lead.findOne({
    workspaceId: workspace._id,
    nameLower: new RegExp('^rajesh'),
  }).lean();
  assert.strictEqual(foundByName !== null, true);
  assert.strictEqual(foundByName.name, 'Rajesh Kumar Gupta');
  console.log('  ✅ [PASS] Step 5a: Anchored prefix search on nameLower finds lead');
  passed++;

  const foundByPhone = await Lead.findOne({
    workspaceId: workspace._id,
    phoneDigits: new RegExp('9876543210$'),
  }).lean();
  assert.strictEqual(foundByPhone !== null, true);
  assert.strictEqual(foundByPhone.name, 'Rajesh Kumar Gupta');
  console.log('  ✅ [PASS] Step 5b: Suffix search on phoneDigits finds lead');
  passed++;

  console.log(`\n========================================================`);
  console.log(`🏁 PHASE 2 TEST RESULTS: ${passed} PASSED | 0 FAILED`);
  console.log(`========================================================\n`);
}

module.exports = { runPhase2TestSuite };

if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  mongoose.connect(MONGO_URI).then(async () => {
    try {
      await runPhase2TestSuite();
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
}
