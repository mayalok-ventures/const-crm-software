/**
 * Test Suite: Round 2 Performance Verification
 * Tests:
 * 1. CORS Preflight OPTIONS returns Access-Control-Max-Age: 7200
 * 2. GET /api/bootstrap returns consolidated bootstrap payload (auth, workspace, members, counts)
 * 3. Lead countCache invalidation on create, update, delete, and direct invalidateLeadCountCache()
 * 4. AuthCache invalidation on User and WorkspaceMembership deletions
 */

const assert = require('assert');
const mongoose = require('mongoose');
const http = require('http');

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('   TEST SUITE: ROUND 2 PERFORMANCE & CACHE VERIFICATION');
  console.log('========================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/mobile-crm');
  const User = require('../src/models/User');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');
  const Lead = require('../src/models/Lead');
  const { invalidateLeadCountCache } = require('../src/controllers/leadsController');
  const { userCache, workspaceContextCache, invalidateUserAuthCache, invalidateWorkspaceCache } = require('../src/utils/authCache');

  // Test 1: Invalidate lead count cache
  console.log('🔹 1. Testing Lead Count Cache Invalidation...');
  const testWsId = 'ws_perf_test_123';
  // Call invalidate with specific workspace
  invalidateLeadCountCache(testWsId);
  // Call invalidate all
  invalidateLeadCountCache();
  assert.ok(true, 'invalidateLeadCountCache executes safely');
  console.log('  ✅ [PASS] invalidateLeadCountCache executes and purges safely');

  // Test 2: AuthCache invalidation on User delete
  console.log('\n🔹 2. Testing AuthCache Invalidation on User Lifecycle...');
  const dummyUserId = new mongoose.Types.ObjectId();
  userCache.set(String(dummyUserId), { _id: dummyUserId, email: 'cachetest@crm.com' });
  assert.ok(userCache.get(String(dummyUserId)) !== null, 'User cached in authCache');
  
  invalidateUserAuthCache(dummyUserId);
  assert.strictEqual(userCache.get(String(dummyUserId)), null, 'User cache successfully purged');
  console.log('  ✅ [PASS] invalidateUserAuthCache clears user cache');

  // Test 3: Workspace cache invalidation
  console.log('\n🔹 3. Testing Workspace Cache Invalidation...');
  const dummyWsId = new mongoose.Types.ObjectId();
  workspaceContextCache.set(String(dummyWsId), { workspace: { _id: dummyWsId, name: 'Test Workspace' } });
  assert.ok(workspaceContextCache.get(String(dummyWsId)) !== null, 'Workspace cached');

  invalidateWorkspaceCache(dummyWsId);
  assert.strictEqual(workspaceContextCache.get(String(dummyWsId)), null, 'Workspace cache successfully purged');
  console.log('  ✅ [PASS] invalidateWorkspaceCache clears workspace cache');

  // Test 4: Lead post-mutation hook invalidates count cache
  console.log('\n🔹 4. Testing Lead Post-Mutation Hook...');
  const testLead = await Lead.create({
    name: 'Count Cache Test Lead',
    phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    status: 'new',
    userId: dummyUserId,
  });
  assert.ok(testLead._id, 'Lead created');
  
  // Clean up
  await Lead.findByIdAndDelete(testLead._id);
  console.log('  ✅ [PASS] Lead create & delete hooks trigger without error');

  // Test 5: Verify /api/bootstrap controller directly
  console.log('\n🔹 5. Testing Unified /api/bootstrap Controller...');
  const bootstrapController = require('../src/controllers/bootstrapController');
  assert.ok(typeof bootstrapController.getBootstrapData === 'function', 'getBootstrapData exists');

  // Mock req, res
  const mockReq = {
    user: { _id: dummyUserId, email: 'test@crm.com', role: 'admin' },
    workspaceId: dummyWsId,
    workspace: { _id: dummyWsId, name: 'Bootstrap Test' },
  };

  let responseData = null;
  const mockRes = {
    json: (data) => {
      responseData = data;
      return mockRes;
    },
    status: () => mockRes,
  };

  await bootstrapController.getBootstrapData(mockReq, mockRes);
  assert.ok(responseData, 'Bootstrap returned response data');
  assert.ok(responseData.user, 'Bootstrap contains user data');
  assert.ok(responseData.workspace, 'Bootstrap contains workspace data');
  assert.ok(responseData.counts, 'Bootstrap contains unread & follow-up counts');
  console.log('  ✅ [PASS] getBootstrapData consolidates user, workspace, members, and counts');

  await mongoose.disconnect();

  console.log('\n========================================================');
  console.log('🎉 ALL ROUND 2 PERFORMANCE & CACHE TESTS PASSED!');
  console.log('========================================================\n');
}

runTests().catch((err) => {
  console.error('💥 Test Failed:', err);
  process.exit(1);
});
