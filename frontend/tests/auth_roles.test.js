const assert = require('assert');

// Simulate browser environment / window undefined for node test
const {
  isSuperAdmin,
  isOwner,
  isManager,
  isCounselor,
  isAgent,
  getUserRole,
} = require('../src/lib/auth');

console.log('🧪 Testing Frontend Role Helpers...');

// Case 1: Null/undefined user
assert.strictEqual(isSuperAdmin(null), false);
assert.strictEqual(isOwner(null), false);
assert.strictEqual(isManager(null), false);
assert.strictEqual(isCounselor(null), false);
assert.strictEqual(getUserRole(null), 'ANONYMOUS');
console.log('  ✅ PASS: Null user returns false for all roles');

// Case 2: Superadmin user
const superAdminUser = { role: 'superadmin', name: 'Super Admin' };
assert.strictEqual(isSuperAdmin(superAdminUser), true);
assert.strictEqual(isOwner(superAdminUser), true); // Has owner privileges
assert.strictEqual(getUserRole(superAdminUser), 'SUPERADMIN');
console.log('  ✅ PASS: Superadmin correctly detected');

// Case 3: Agency Owner user
const ownerUser = {
  name: 'Agency Owner',
  companyRole: 'owner',
  workStatus: 'company_owner'
};
assert.strictEqual(isSuperAdmin(ownerUser), false);
assert.strictEqual(isOwner(ownerUser), true);
assert.strictEqual(isManager(ownerUser), false);
assert.strictEqual(isCounselor(ownerUser), false);
assert.strictEqual(getUserRole(ownerUser), 'OWNER');
console.log('  ✅ PASS: Agency Owner correctly detected');

// Case 4: Manager user
const managerUser = {
  name: 'Team Manager',
  companyRole: 'manager',
  workspaceRole: 'manager'
};
assert.strictEqual(isSuperAdmin(managerUser), false);
assert.strictEqual(isOwner(managerUser), false);
assert.strictEqual(isManager(managerUser), true);
assert.strictEqual(isCounselor(managerUser), false);
assert.strictEqual(getUserRole(managerUser), 'MANAGER');
console.log('  ✅ PASS: Manager correctly detected');

// Case 5: Counselor user (British spelling 'counsellor')
const counsellorUser = {
  name: 'Counselor Maya',
  companyRole: 'counsellor',
  companyId: 'owner_123'
};
assert.strictEqual(isSuperAdmin(counsellorUser), false);
assert.strictEqual(isOwner(counsellorUser), false);
assert.strictEqual(isManager(counsellorUser), false);
assert.strictEqual(isCounselor(counsellorUser), true);
assert.strictEqual(isAgent(counsellorUser), true);
assert.strictEqual(getUserRole(counsellorUser), 'COUNSELLOR');
console.log('  ✅ PASS: Counsellor correctly detected');

// Case 6: Counselor user (American spelling 'counselor')
const counselorUser = {
  name: 'Counselor John',
  workspaceRole: 'counselor',
  companyId: 'owner_123'
};
assert.strictEqual(isOwner(counselorUser), false);
assert.strictEqual(isCounselor(counselorUser), true);
assert.strictEqual(getUserRole(counselorUser), 'COUNSELLOR');
console.log('  ✅ PASS: Counselor correctly detected');

// Case 7: Solo consultant (no companyId, no sub-role)
const soloUser = {
  name: 'Solo Consultant',
  workStatus: 'solo_consultant'
};
assert.strictEqual(isOwner(soloUser), true);
assert.strictEqual(getUserRole(soloUser), 'OWNER');
console.log('  ✅ PASS: Solo consultant defaults to OWNER');

console.log('\n🎉 ALL FRONTEND ROLE HELPER TESTS PASSED SUCCESSFULLY!\n');
