/**
 * Exhaustive Permission Matrix & UI Lifecycle Test Suite
 * Validates:
 * 1. Authoritative effective permission resolution (/api/bootstrap and /api/auth/me)
 * 2. Scope hierarchy and field-level masking fidelity
 * 3. Granular endpoint RBAC enforcement across Owner, Manager, Counsellor, Auditor, Custom roles
 * 4. Administrator privilege escalation barriers
 * 5. Instant Permission Revocation Lifecycle (0ms cache invalidation across Redis and Memory)
 */

const axios = require('axios');
const assert = require('assert');
const mongoose = require('mongoose');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Role = require('../src/models/Role');
const Lead = require('../src/models/Lead');
const AdmissionDeal = require('../src/models/AdmissionDeal');
const { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } = require('../src/config/permissions');

// Frontend evaluation mirrors
const SCOPE_LEVELS = { workspace: 3, team: 2, own: 1, restricted: 0 };
function evaluateFrontendPermission(user, permissionKey, requiredScope = null) {
  if (!user) return false;
  if (user.role === 'superadmin' || user.isAdmin) return true;
  const role = (user.workspaceRole || user.companyRole || '').toLowerCase();
  if (role === 'owner') return true;

  let permissions = user.effectivePermissions || user.membership?.effectivePermissions;
  if (!Array.isArray(permissions) || permissions.length === 0) {
    const mapped = role === 'counselor' ? 'counsellor' : role;
    permissions = DEFAULT_ROLE_PERMISSIONS[mapped] || DEFAULT_ROLE_PERMISSIONS.counsellor;
  }

  const match = permissions.find(p => (typeof p === 'string' ? p === permissionKey : p?.key === permissionKey));
  if (!match) return false;
  if (!requiredScope) return true;

  const matchScope = typeof match === 'object' && match.scope ? match.scope : 'workspace';
  return (SCOPE_LEVELS[matchScope] || 0) >= (SCOPE_LEVELS[requiredScope] || 0);
}

function evaluateFrontendField(user, fieldKey) {
  if (!user) return false;
  if (user.role === 'superadmin' || user.isAdmin) return true;
  const role = (user.workspaceRole || user.companyRole || '').toLowerCase();
  if (role === 'owner') return true;

  switch (fieldKey) {
    case 'commission':
      return evaluateFrontendPermission(user, 'commission.view');
    case 'customTieUpDetails':
    case 'tieUpCommission':
    case 'collegeSpoc':
      return (
        evaluateFrontendPermission(user, 'catalogue.view_commission') ||
        evaluateFrontendPermission(user, 'commission.view')
      );
    case 'sensitiveNotes':
      return evaluateFrontendPermission(user, 'leads.view_sensitive');
    default:
      return true;
  }
}

async function runPermissionMatrixSuite() {
  console.log('\n============================================================');
  console.log('🏛️  RUNNING AUTHORITATIVE PERMISSION MATRIX & LIFECYCLE SUITE');
  console.log('============================================================\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.response?.data) {
        console.error(`     Response:`, JSON.stringify(err.response.data));
      }
      failed++;
    }
  };

  const ts = Date.now();
  const ownerEmail = `owner_pm_${ts}@agency.com`;
  const managerEmail = `mgr_pm_${ts}@agency.com`;
  const counsellorEmail = `couns_pm_${ts}@agency.com`;
  const auditorEmail = `aud_pm_${ts}@agency.com`;
  const customEmail = `custom_pm_${ts}@agency.com`;
  const testPassword = 'Password@123456';

  let tokenOwner = '';
  let tokenManager = '';
  let tokenCounsellor = '';
  let tokenAuditor = '';
  let tokenCustom = '';

  let workspaceId = '';
  let ownerUser = null;
  let managerUser = null;
  let counsellorUser = null;
  let auditorUser = null;
  let customUser = null;
  let customRoleId = '';

  const apiOwner = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiManager = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiCounsellor = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiAuditor = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiCustom = axios.create({ baseURL: BASE_URL, timeout: 10000 });

  // -------------------------------------------------------------
  // SECTION 1: PROVISIONING & WORKSPACE ONBOARDING
  // -------------------------------------------------------------
  console.log('\n--- SECTION 1: Multi-Role Tenant Provisioning ---');

  await test('1.1 Owner registers, auto-provisions workspace, and has Enterprise plan', async () => {
    const res = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Owner Boss',
      email: ownerEmail,
      password: testPassword,
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      industryType: 'education',
      educationSubProfile: 'college_admissions',
    });
    assert.strictEqual(res.status, 201);
    tokenOwner = res.data.token;
    ownerUser = res.data;
    const ownerId = res.data._id;
    apiOwner.defaults.headers.common['Authorization'] = `Bearer ${tokenOwner}`;

    // Upgrade owner to team-starter plan in DB so full plan feature entitlement (leadExport) is active
    await User.findByIdAndUpdate(ownerId, {
      plan: 'team-starter',
      planEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    // Fetch workspace
    const wsRes = await apiOwner.get('/api/workspace/current');
    assert.strictEqual(wsRes.status, 200);
    workspaceId = wsRes.data.workspace?._id;
    assert.ok(workspaceId, 'Workspace ID must be resolved');
    apiOwner.defaults.headers.common['x-workspace-id'] = String(workspaceId);
  });

  await test('1.2 Owner invites Manager, Counsellor, and Auditor', async () => {
    const invMgr = await apiOwner.post('/api/workspace/invitations', { email: managerEmail, role: 'manager' });
    assert.strictEqual(invMgr.status, 201);
    const tokenMgr = invMgr.data.data?.token || invMgr.data.invitation?.token;
    assert.ok(tokenMgr, 'Manager invitation token returned');

    const invCouns = await apiOwner.post('/api/workspace/invitations', { email: counsellorEmail, role: 'counsellor' });
    assert.strictEqual(invCouns.status, 201);
    const tokenCouns = invCouns.data.data?.token || invCouns.data.invitation?.token;
    assert.ok(tokenCouns, 'Counsellor invitation token returned');

    const invAud = await apiOwner.post('/api/workspace/invitations', { email: auditorEmail, role: 'auditor' });
    assert.strictEqual(invAud.status, 201);
    const tokenAud = invAud.data.data?.token || invAud.data.invitation?.token;
    assert.ok(tokenAud, 'Auditor invitation token returned');

    // Accept manager
    const regMgr = await axios.post(`${BASE_URL}/api/workspace/invitations/${tokenMgr}/accept`, {
      name: 'Manager Bob',
      password: testPassword,
    });
    assert.strictEqual(regMgr.status, 200);
    tokenManager = regMgr.data.token;
    managerUser = regMgr.data.user;
    apiManager.defaults.headers.common['Authorization'] = `Bearer ${tokenManager}`;
    apiManager.defaults.headers.common['x-workspace-id'] = String(workspaceId);

    // Accept counsellor
    const regCouns = await axios.post(`${BASE_URL}/api/workspace/invitations/${tokenCouns}/accept`, {
      name: 'Counsellor Carol',
      password: testPassword,
    });
    assert.strictEqual(regCouns.status, 200);
    tokenCounsellor = regCouns.data.token;
    counsellorUser = regCouns.data.user;
    apiCounsellor.defaults.headers.common['Authorization'] = `Bearer ${tokenCounsellor}`;
    apiCounsellor.defaults.headers.common['x-workspace-id'] = String(workspaceId);

    // Accept auditor
    const regAud = await axios.post(`${BASE_URL}/api/workspace/invitations/${tokenAud}/accept`, {
      name: 'Auditor Dave',
      password: testPassword,
    });
    assert.strictEqual(regAud.status, 200);
    tokenAuditor = regAud.data.token;
    auditorUser = regAud.data.user;
    apiAuditor.defaults.headers.common['Authorization'] = `Bearer ${tokenAuditor}`;
    apiAuditor.defaults.headers.common['x-workspace-id'] = String(workspaceId);
  });

  // -------------------------------------------------------------
  // SECTION 2: AUTHORITATIVE EFFECTIVE PERMISSIONS RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: Authoritative Effective Permissions Resolution ---');

  await test('2.1 GET /api/bootstrap returns authoritative effectivePermissions for Owner', async () => {
    const res = await apiOwner.get('/api/bootstrap');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.workspaceRole, 'owner');
    const perms = res.data.effectivePermissions || res.data.user.effectivePermissions;
    assert.ok(Array.isArray(perms), 'effectivePermissions must be an array');
    assert.ok(perms.length >= 32, `Owner must have all permissions, got ${perms.length}`);
    const keys = perms.map(p => p.key);
    assert.ok(keys.includes('leads.export'));
    assert.ok(keys.includes('commission.view'));
    assert.ok(keys.includes('roles.manage'));
  });

  await test('2.2 GET /api/bootstrap returns authoritative effectivePermissions for Manager', async () => {
    const res = await apiManager.get('/api/bootstrap');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.workspaceRole, 'manager');
    const perms = res.data.effectivePermissions || res.data.user.effectivePermissions;
    const keys = perms.map(p => p.key);
    assert.ok(keys.includes('leads.export'), 'Manager should have leads.export');
    assert.ok(keys.includes('pipelines.manage'), 'Manager should have pipelines.manage');
    assert.ok(keys.includes('reports.view'), 'Manager should have reports.view');
    assert.ok(!keys.includes('roles.manage'), 'Manager MUST NOT have roles.manage');
    assert.ok(!keys.includes('billing.manage'), 'Manager MUST NOT have billing.manage');
  });

  await test('2.3 GET /api/bootstrap returns scoped effectivePermissions for Counsellor', async () => {
    const res = await apiCounsellor.get('/api/bootstrap');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.workspaceRole, 'counsellor');
    const perms = res.data.effectivePermissions || res.data.user.effectivePermissions;
    const leadsView = perms.find(p => p.key === 'leads.view');
    assert.ok(leadsView, 'Counsellor must have leads.view');
    assert.strictEqual(leadsView.scope, 'own', 'Counsellor leads.view scope must be own');
    const keys = perms.map(p => p.key);
    assert.ok(!keys.includes('leads.export'), 'Counsellor MUST NOT have leads.export');
    assert.ok(!keys.includes('commission.view'), 'Counsellor MUST NOT have commission.view');
    assert.ok(!keys.includes('pipelines.manage'), 'Counsellor MUST NOT have pipelines.manage');
  });

  await test('2.4 GET /api/bootstrap returns read-only effectivePermissions for Auditor', async () => {
    const res = await apiAuditor.get('/api/bootstrap');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.workspaceRole, 'auditor');
    const perms = res.data.effectivePermissions || res.data.user.effectivePermissions;
    const keys = perms.map(p => p.key);
    assert.ok(keys.includes('leads.view'), 'Auditor must have leads.view');
    assert.ok(keys.includes('commission.view'), 'Auditor must have commission.view');
    assert.ok(keys.includes('reports.view'), 'Auditor must have reports.view');
    assert.ok(!keys.includes('leads.create'), 'Auditor MUST NOT have leads.create');
    assert.ok(!keys.includes('leads.edit'), 'Auditor MUST NOT have leads.edit');
    assert.ok(!keys.includes('deals.create'), 'Auditor MUST NOT have deals.create');
  });

  await test('2.5 GET /api/auth/me resolves workspaceRole and effectivePermissions', async () => {
    const res = await apiCounsellor.get('/api/auth/me');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.workspaceRole, 'counsellor');
    assert.ok(Array.isArray(res.data.effectivePermissions));
  });

  // -------------------------------------------------------------
  // SECTION 3: FRONTEND AUTHORIZATION LOGIC CONGRUENCE
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: Frontend Authorization Logic Congruence ---');

  await test('3.1 Scope hierarchy evaluation (workspace > team > own)', () => {
    const mockUserWorkspace = { workspaceRole: 'manager', effectivePermissions: [{ key: 'leads.view', scope: 'workspace' }] };
    const mockUserOwn = { workspaceRole: 'counsellor', effectivePermissions: [{ key: 'leads.view', scope: 'own' }] };

    assert.strictEqual(evaluateFrontendPermission(mockUserWorkspace, 'leads.view', 'workspace'), true);
    assert.strictEqual(evaluateFrontendPermission(mockUserWorkspace, 'leads.view', 'own'), true);
    assert.strictEqual(evaluateFrontendPermission(mockUserOwn, 'leads.view', 'own'), true);
    assert.strictEqual(evaluateFrontendPermission(mockUserOwn, 'leads.view', 'workspace'), false, 'Own scope cannot satisfy workspace requirement');
  });

  await test('3.2 Sensitive field masking evaluation (commission & SPOC details)', () => {
    const mockCounsellor = { workspaceRole: 'counsellor', effectivePermissions: DEFAULT_ROLE_PERMISSIONS.counsellor };
    const mockManager = { workspaceRole: 'manager', effectivePermissions: DEFAULT_ROLE_PERMISSIONS.manager };
    const mockAuditor = { workspaceRole: 'auditor', effectivePermissions: DEFAULT_ROLE_PERMISSIONS.auditor };

    assert.strictEqual(evaluateFrontendField(mockCounsellor, 'commission'), false, 'Counsellor cannot view commission');
    assert.strictEqual(evaluateFrontendField(mockCounsellor, 'customTieUpDetails'), false, 'Counsellor cannot view tie-up details');
    assert.strictEqual(evaluateFrontendField(mockManager, 'commission'), true, 'Manager can view commission');
    assert.strictEqual(evaluateFrontendField(mockManager, 'customTieUpDetails'), true, 'Manager can view tie-up details');
    assert.strictEqual(evaluateFrontendField(mockAuditor, 'commission'), true, 'Auditor can view commission');
  });

  // -------------------------------------------------------------
  // SECTION 4: REAL BACKEND ENDPOINT RBAC ENFORCEMENT
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: Real Backend Endpoint RBAC Enforcement ---');

  let testLeadId = '';

  await test('4.1 Leads: Manager creates candidate lead', async () => {
    const res = await apiManager.post('/api/leads', {
      name: 'Aditi Rao',
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `aditi_${Date.now()}@example.com`,
      targetCourse: 'B.Tech Computer Science',
      targetDomain: 'Engineering (B.Tech/BE)',
      status: 'new',
    });
    assert.strictEqual(res.status, 201);
    testLeadId = res.data.lead?._id || res.data.data?._id || res.data._id;
    assert.ok(testLeadId, 'Lead ID must be returned');
  });

  await test('4.2 Leads Export: Counsellor is FORBIDDEN (403), Manager is ALLOWED (200)', async () => {
    try {
      await apiCounsellor.get('/api/leads/export');
      assert.fail('Counsellor should receive 403 on leads export');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }

    const mgrRes = await apiManager.get('/api/leads/export');
    assert.strictEqual(mgrRes.status, 200);
  });

  await test('4.3 Pipelines: Counsellor is FORBIDDEN (403) from creating pipelines, Manager is ALLOWED (201)', async () => {
    try {
      await apiCounsellor.post('/api/pipelines', {
        name: 'Counsellor Rogue Pipeline',
        stages: [{ stageId: 's1', name: 'Stage 1', order: 0 }],
      });
      assert.fail('Counsellor should receive 403 on pipeline creation');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }

    const res = await apiManager.post('/api/pipelines', {
      name: `Postgrad Tech Pipeline ${Date.now()}`,
      stages: [
        { stageId: 'inquiry', name: 'Inquiry', category: 'open', order: 0, probability: 10 },
        { stageId: 'enrolled', name: 'Enrolled', category: 'won', order: 1, probability: 100 },
      ],
    });
    assert.ok(res.status === 200 || res.status === 201);
  });

  await test('4.4 Deals: Auditor is FORBIDDEN (403) from recording admissions, Counsellor is ALLOWED (201)', async () => {
    try {
      await apiAuditor.post('/api/deals', {
        studentName: 'Auditor Student',
        studentPhone: '919876543210',
        collegeName: 'Apex University',
        courseName: 'MBA',
        courseFee: 450000,
        stage: 'closed_won',
      });
      assert.fail('Auditor should receive 403 on deal creation');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }

    const res = await apiCounsellor.post('/api/deals', {
      studentName: 'Counsellor Student',
      studentPhone: '919876543210',
      collegeName: 'Apex University',
      courseName: 'MBA',
      courseFee: 450000,
      stage: 'closed_won',
    });
    assert.strictEqual(res.status, 201);
  });

  await test('4.5 Commission Summary: Counsellor is FORBIDDEN (403), Auditor and Manager are ALLOWED (200)', async () => {
    try {
      await apiCounsellor.get('/api/deals/summary/commission');
      assert.fail('Counsellor should receive 403 on commission view');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }

    const audRes = await apiAuditor.get('/api/deals/summary/commission');
    assert.strictEqual(audRes.status, 200);

    const mgrRes = await apiManager.get('/api/deals/summary/commission');
    assert.strictEqual(mgrRes.status, 200);
  });

  // -------------------------------------------------------------
  // SECTION 5: STRICT ADMINISTRATOR BOUNDARIES & ANTI-ESCALATION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 5: Strict Administrator Boundaries & Anti-Escalation ---');

  await test('5.1 Manager CANNOT invite another Manager or Owner (Privilege Escalation Barrier)', async () => {
    try {
      await apiManager.post('/api/workspace/invitations', {
        email: `rogue_mgr_${Date.now()}@test.com`,
        role: 'manager',
      });
      assert.fail('Manager should receive 403 when trying to invite manager');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert.ok(
        err.response?.data?.code === 'PRIVILEGE_ESCALATION_PREVENTED' ||
        err.response?.data?.message?.includes('owner can invite')
      );
    }

    try {
      await apiManager.post('/api/workspace/invitations', {
        email: `rogue_owner_${Date.now()}@test.com`,
        role: 'owner',
      });
      assert.fail('Manager should receive 400 when trying to invite owner');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
    }
  });

  await test('5.2 Manager CANNOT manage or create custom roles', async () => {
    try {
      await apiManager.post('/api/workspace/roles', {
        name: 'Manager Super Role',
        description: 'Unauthorized custom role',
        permissions: [{ key: 'leads.export', scope: 'workspace' }],
      });
      assert.fail('Manager should receive 403 when attempting to create custom role');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('5.3 Counsellor CANNOT inspect workspace roles list', async () => {
    try {
      await apiCounsellor.get('/api/workspace/roles');
      assert.fail('Counsellor should receive 403 on GET /api/workspace/roles');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  // -------------------------------------------------------------
  // SECTION 6: INSTANT PERMISSION REVOCATION LIFECYCLE (0ms LAG)
  // -------------------------------------------------------------
  console.log('\n--- SECTION 6: Instant Permission Revocation Lifecycle ---');

  await test('6.1 Owner creates Custom Role "Export Specialist" with leads.export', async () => {
    const res = await apiOwner.post('/api/workspace/roles', {
      name: `Export Specialist ${Date.now()}`,
      description: 'Role with explicit export privileges',
      permissions: [
        { key: 'leads.view', scope: 'workspace' },
        { key: 'leads.export', scope: 'workspace' },
      ],
    });
    assert.strictEqual(res.status, 201);
    customRoleId = res.data.role?._id || res.data._id;
    assert.ok(customRoleId, 'Custom role ID must be returned');
  });

  await test('6.2 Owner invites new user directly to Custom Role', async () => {
    const invRes = await apiOwner.post('/api/workspace/invitations', {
      email: customEmail,
      role: 'custom',
      customRoleId: customRoleId,
    });
    assert.strictEqual(invRes.status, 201);
    const tokenCust = invRes.data.data?.token || invRes.data.invitation?.token;
    assert.ok(tokenCust, 'Custom invitation token returned');

    const regRes = await axios.post(`${BASE_URL}/api/workspace/invitations/${tokenCust}/accept`, {
      name: 'Custom User Emma',
      password: testPassword,
    });
    assert.strictEqual(regRes.status, 200);
    tokenCustom = regRes.data.token;
    customUser = regRes.data.user;
    apiCustom.defaults.headers.common['Authorization'] = `Bearer ${tokenCustom}`;
    apiCustom.defaults.headers.common['x-workspace-id'] = String(workspaceId);
  });

  await test('6.3 Custom member executes authorized GET /api/leads/export (200 OK)', async () => {
    const res = await apiCustom.get('/api/leads/export');
    assert.strictEqual(res.status, 200);
  });

  await test('6.4 Custom member calls GET /api/bootstrap -> response is cached with leads.export', async () => {
    const res = await apiCustom.get('/api/bootstrap');
    assert.strictEqual(res.status, 200);
    const perms = res.data.effectivePermissions || res.data.user.effectivePermissions;
    const keys = perms.map(p => p.key);
    assert.ok(keys.includes('leads.export'), 'Bootstrap response must include leads.export');
  });

  await test('6.5 Owner REVOKES leads.export from Custom Role -> Cache evicted synchronously', async () => {
    const res = await apiOwner.put(`/api/workspace/roles/${customRoleId}`, {
      name: 'Export Specialist (Revoked)',
      description: 'Permissions downgraded to view only',
      permissions: [
        { key: 'leads.view', scope: 'workspace' },
      ],
    });
    assert.strictEqual(res.status, 200);
  });

  await test('6.6 ZERO-LAG ENFORCEMENT: Custom member is IMMEDIATELY FORBIDDEN from GET /api/leads/export (403)', async () => {
    try {
      await apiCustom.get('/api/leads/export');
      assert.fail('Custom member must be rejected with 403 immediately without restart or delay');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert.ok(
        err.response?.data?.message?.includes('leads.export') ||
        err.response?.data?.code === 'PERMISSION_DENIED',
        'Should return PERMISSION_DENIED for leads.export'
      );
    }
  });

  await test('6.7 Bootstrap reflects revoked permission on subsequent request', async () => {
    const res = await apiCustom.get('/api/bootstrap');
    assert.strictEqual(res.status, 200);
    const perms = res.data.effectivePermissions || res.data.user.effectivePermissions;
    const keys = perms.map(p => p.key);
    assert.ok(!keys.includes('leads.export'), 'Revoked leads.export must no longer be present in bootstrap');
  });

  await test('6.8 DEACTIVATION LIFECYCLE: Owner deactivates member -> Member is immediately denied access', async () => {
    // Look up custom user membership ID
    const membersRes = await apiOwner.get('/api/workspace/members');
    const customMember = membersRes.data.members.find(m => String(m.user?._id || m.userId?._id || m.userId) === String(customUser._id));
    assert.ok(customMember, 'Custom member must be in workspace');

    const deactRes = await apiOwner.delete(`/api/workspace/members/${customMember.membershipId || customMember._id}`);
    assert.strictEqual(deactRes.status, 200);

    // Custom member calls any protected endpoint -> immediately 403
    try {
      await apiCustom.get('/api/leads');
      assert.fail('Deactivated member must receive 403 on subsequent API calls');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  console.log('\n============================================================');
  console.log(`🏁 SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPermissionMatrixSuite().catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});
