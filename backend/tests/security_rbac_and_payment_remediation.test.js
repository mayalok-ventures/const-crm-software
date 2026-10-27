const axios = require('axios');
const assert = require('assert');
const mongoose = require('mongoose');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Invitation = require('../src/models/Invitation');
const AdmissionDeal = require('../src/models/AdmissionDeal');

async function runSecurityRemediationSuite() {
  console.log('\n============================================================');
  console.log('🔒 RUNNING SECURITY REMEDIATION RBAC & PAYMENT TEST SUITE');
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
  const ownerAEmail = `owner_sec_a_${ts}@testagency.com`;
  const ownerBEmail = `owner_sec_b_${ts}@testagency.com`;
  const counsellorEmail = `counsellor_sec_${ts}@testagency.com`;
  const managerEmail = `manager_sec_${ts}@testagency.com`;
  const auditorEmail = `auditor_sec_${ts}@testagency.com`;
  const testPassword = 'Password@123456';

  let tokenOwnerA = '';
  let tokenOwnerB = '';
  let tokenCounsellor = '';
  let tokenManager = '';
  let tokenAuditor = '';
  let tokenSuperAdmin = '';

  let workspaceAId = '';
  let workspaceBId = '';
  let dealAId = '';

  const apiA = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiB = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiCounsellor = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiManager = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiAuditor = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiSuperAdmin = axios.create({ baseURL: BASE_URL, timeout: 10000 });

  // -------------------------------------------------------------
  // Setup: Sign up Tenant Owner A and Tenant Owner B
  // -------------------------------------------------------------
  await test('Sign up Tenant Owner A', async () => {
    const res = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Owner Alice',
      email: ownerAEmail,
      password: testPassword,
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      industryType: 'education',
      educationSubProfile: 'college_admissions',
    });
    assert.strictEqual(res.status, 201);
    tokenOwnerA = res.data.token;
    apiA.defaults.headers.common['Authorization'] = `Bearer ${tokenOwnerA}`;

    // Get Owner A's active workspace
    const wsRes = await apiA.get('/api/workspaces/current');
    assert(wsRes.data.success, 'Current workspace should return success');
    workspaceAId = wsRes.data.workspace._id;
    apiA.defaults.headers.common['x-workspace-id'] = workspaceAId;
  });

  await test('Sign up Tenant Owner B', async () => {
    const res = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Owner Bob',
      email: ownerBEmail,
      password: testPassword,
      phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
      industryType: 'education',
      educationSubProfile: 'college_admissions',
    });
    assert.strictEqual(res.status, 201);
    tokenOwnerB = res.data.token;
    apiB.defaults.headers.common['Authorization'] = `Bearer ${tokenOwnerB}`;

    const wsRes = await apiB.get('/api/workspaces/current');
    assert(wsRes.data.success, 'Current workspace should return success');
    workspaceBId = wsRes.data.workspace._id;
    apiB.defaults.headers.common['x-workspace-id'] = workspaceBId;
  });

  // Login as platform SuperAdmin
  await test('Authenticate platform SuperAdmin', async () => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@yourapp.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    let res;
    try {
      res = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: adminEmail,
        password: adminPassword,
      });
    } catch (_) {
      // Fallback if admin has default email
      res = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@crm.com',
        password: adminPassword,
      });
    }
    assert(res.status === 200, 'SuperAdmin login must succeed');
    tokenSuperAdmin = res.data.token;
    apiSuperAdmin.defaults.headers.common['Authorization'] = `Bearer ${tokenSuperAdmin}`;
  });

  // =============================================================
  // FINDING A: Platform-level Payment Authorization Bypass Tests
  // =============================================================
  console.log('\n--- FINDING A: Platform-level Payment Authorization Boundary ---');

  await test('Tenant Owner A CANNOT access platform payment queue (GET /api/payments/admin)', async () => {
    try {
      await apiA.get('/api/payments/admin');
      assert.fail('Should have been denied with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Must return 403 Forbidden for tenant owner');
    }
  });

  await test('Tenant Owner A CANNOT approve arbitrary payment (PUT /api/payments/admin/:id/approve)', async () => {
    const fakePaymentId = new mongoose.Types.ObjectId();
    try {
      await apiA.put(`/api/payments/admin/${fakePaymentId}/approve`, { transactionId: 'TXN123' });
      assert.fail('Should have been denied with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Must return 403 Forbidden for tenant owner');
    }
  });

  await test('Tenant Owner A CANNOT reject arbitrary payment (PUT /api/payments/admin/:id/reject)', async () => {
    const fakePaymentId = new mongoose.Types.ObjectId();
    try {
      await apiA.put(`/api/payments/admin/${fakePaymentId}/reject`, { reason: 'Unauthorized' });
      assert.fail('Should have been denied with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Must return 403 Forbidden for tenant owner');
    }
  });

  await test('Platform SuperAdmin CAN access platform payment queue (GET /api/payments/admin)', async () => {
    const res = await apiSuperAdmin.get('/api/payments/admin');
    assert.strictEqual(res.status, 200, 'SuperAdmin must receive 200 OK');
    assert(Array.isArray(res.data) || Array.isArray(res.data.payments) || Array.isArray(res.data.data), 'Returns payment array');
  });

  await test('Unauthenticated request to payment admin returns 401', async () => {
    try {
      await axios.get(`${BASE_URL}/api/payments/admin`);
      assert.fail('Should have failed with 401');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Must return 401 Unauthorized');
    }
  });

  // =============================================================
  // FINDING B: Invited Member Privilege Escalation & Dual Role Collision
  // =============================================================
  console.log('\n--- FINDING B: Invitation Role Integrity & Privilege Escalation Prevention ---');

  let inviteTokenCounsellor = '';
  let inviteTokenManager = '';
  let inviteTokenAuditor = '';

  await test('Owner A invites counsellor, manager, and auditor', async () => {
    const inv1 = await apiA.post(`/api/workspace/invitations`, {
      email: counsellorEmail,
      role: 'counsellor',
      team: 'Admissions',
    });
    assert(inv1.data.success);
    inviteTokenCounsellor = inv1.data.data?.token || inv1.data.invitation?.token;

    const inv2 = await apiA.post(`/api/workspace/invitations`, {
      email: managerEmail,
      role: 'manager',
      team: 'Admissions',
    });
    assert(inv2.data.success);
    inviteTokenManager = inv2.data.data?.token || inv2.data.invitation?.token;

    const inv3 = await apiA.post(`/api/workspace/invitations`, {
      email: auditorEmail,
      role: 'auditor',
      team: 'Auditing',
    });
    assert(inv3.data.success);
    inviteTokenAuditor = inv3.data.data?.token || inv3.data.invitation?.token;
  });

  await test('Accept counsellor invitation and verify DB document integrity', async () => {
    const accRes = await axios.post(`${BASE_URL}/api/workspace/invitations/${inviteTokenCounsellor}/accept`, {
      name: 'Charlie Counsellor',
      password: testPassword,
    });
    assert(accRes.data.success);
    tokenCounsellor = accRes.data.token;
    apiCounsellor.defaults.headers.common['Authorization'] = `Bearer ${tokenCounsellor}`;
    apiCounsellor.defaults.headers.common['x-workspace-id'] = workspaceAId;

    // Check DB directly for User and WorkspaceMembership records
    const userDoc = await User.findOne({ email: counsellorEmail }).lean();
    assert.ok(userDoc, 'User document must exist in database');
    assert.strictEqual(userDoc.companyRole, 'counsellor', "User.companyRole MUST be 'counsellor' (NOT 'owner')");
    assert.strictEqual(userDoc.role, 'counsellor', "User.role MUST be 'counsellor'");
    assert.ok(userDoc.workStatus === 'counsellor' || userDoc.workStatus === 'employee', "User.workStatus MUST NOT be 'company_owner'");

    const memberDoc = await WorkspaceMembership.findOne({ workspaceId: workspaceAId, userId: userDoc._id }).lean();
    assert.ok(memberDoc, 'WorkspaceMembership must exist in database');
    assert.strictEqual(memberDoc.role, 'counsellor', "Membership.role MUST be 'counsellor'");
    assert.strictEqual(memberDoc.status, 'active');
  });

  await test('Accept manager invitation and verify DB document integrity', async () => {
    const accRes = await axios.post(`${BASE_URL}/api/workspace/invitations/${inviteTokenManager}/accept`, {
      name: 'Mary Manager',
      password: testPassword,
    });
    assert(accRes.data.success);
    tokenManager = accRes.data.token;
    apiManager.defaults.headers.common['Authorization'] = `Bearer ${tokenManager}`;
    apiManager.defaults.headers.common['x-workspace-id'] = workspaceAId;

    const userDoc = await User.findOne({ email: managerEmail }).lean();
    assert.strictEqual(userDoc.companyRole, 'manager');
    assert.strictEqual(userDoc.role, 'manager');

    const memberDoc = await WorkspaceMembership.findOne({ workspaceId: workspaceAId, userId: userDoc._id }).lean();
    assert.strictEqual(memberDoc.role, 'manager');
  });

  await test('Accept auditor invitation and verify DB document integrity', async () => {
    const accRes = await axios.post(`${BASE_URL}/api/workspace/invitations/${inviteTokenAuditor}/accept`, {
      name: 'Alan Auditor',
      password: testPassword,
    });
    assert(accRes.data.success);
    tokenAuditor = accRes.data.token;
    apiAuditor.defaults.headers.common['Authorization'] = `Bearer ${tokenAuditor}`;
    apiAuditor.defaults.headers.common['x-workspace-id'] = workspaceAId;

    const userDoc = await User.findOne({ email: auditorEmail }).lean();
    assert.strictEqual(userDoc.companyRole, 'auditor');

    const memberDoc = await WorkspaceMembership.findOne({ workspaceId: workspaceAId, userId: userDoc._id }).lean();
    assert.strictEqual(memberDoc.role, 'auditor');
  });

  // Verify that an invited counsellor cannot access platform payment endpoints
  await test('Invited Counsellor CANNOT access platform payment queue (403)', async () => {
    try {
      await apiCounsellor.get('/api/payments/admin');
      assert.fail('Should have been denied with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  // =============================================================
  // Role-Based Access Control on Administrative & Mutating Endpoints
  // =============================================================
  console.log('\n--- RBAC Boundary Verification for Counsellor ---');

  await test('Counsellor CANNOT access admin overview metrics (/api/admin/metrics) -> 403', async () => {
    try {
      await apiCounsellor.get('/api/admin/metrics');
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT access lead distribution rules (/api/admin/distribution-rules) -> 403', async () => {
    try {
      await apiCounsellor.get('/api/admin/distribution-rules');
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT modify workspace member roles -> 403', async () => {
    try {
      const fakeMemberId = new mongoose.Types.ObjectId();
      await apiCounsellor.put(`/api/workspace/members/${fakeMemberId}/role`, {
        role: 'owner',
      });
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT connect WhatsApp session -> 403', async () => {
    try {
      await apiCounsellor.post('/api/whatsapp/connect', { phoneNumber: '919999999999' });
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT disconnect WhatsApp session -> 403', async () => {
    try {
      await apiCounsellor.post('/api/whatsapp/disconnect');
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT launch outbound broadcast campaign -> 403', async () => {
    try {
      await apiCounsellor.post('/api/campaigns', { name: 'Unauthorized Campaign' });
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT mutate catalogue course degrees -> 403', async () => {
    try {
      const fakeCatId = new mongoose.Types.ObjectId();
      await apiCounsellor.post(`/api/catalogue/my-catalogue/${fakeCatId}/degrees`, {
        degreeName: 'B.Tech',
      });
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT create integration configurations -> 403', async () => {
    try {
      await apiCounsellor.post('/api/integrations', { name: 'Zapier Webhook' });
      assert.fail('Expected 403 Forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  // =============================================================
  // Commission Privacy & Scoping Isolation
  // =============================================================
  console.log('\n--- Commission Privacy & Deal Scoping ---');

  await test('Owner A creates admission deal with sensitive university commission', async () => {
    const dealRes = await apiA.post('/api/deals', {
      studentName: 'Test Student Sensitive',
      collegeName: 'National Engineering College',
      courseName: 'Computer Science',
      tuitionValue: 500000,
      commission: {
        ratePercent: 12,
        expectedAmount: 60000,
        invoiceNumber: 'INV-2026-999',
        invoiceStatus: 'paid',
        receivedAmount: 60000,
      },
    });
    assert(dealRes.data.success);
    dealAId = dealRes.data.data._id;
  });

  await test('Owner A can view sensitive commission on deals', async () => {
    const res = await apiA.get(`/api/deals/${dealAId}`);
    assert(res.data.success);
    assert(res.data.data.commission, 'Owner A should see commission object');
    assert.strictEqual(res.data.data.commission.expectedAmount, 60000);
  });

  await test('Counsellor CANNOT see commission on deals list or detail', async () => {
    // Detail check
    try {
      const detailRes = await apiCounsellor.get(`/api/deals/${dealAId}`);
      if (detailRes.status === 200) {
        assert(!detailRes.data.data.commission, 'Counsellor MUST NOT see commission details');
      }
    } catch (err) {
      // 403 is also acceptable if deal is not assigned to them
      assert(err.response?.status === 403 || err.response?.status === 200);
    }

    // List check
    const listRes = await apiCounsellor.get('/api/deals');
    assert(listRes.data.success);
    listRes.data.data.forEach(deal => {
      assert.strictEqual(deal.commission, undefined, 'Commission object must be stripped for counsellor');
    });
  });

  await test('Auditor CAN view commission and read-only data, but CANNOT create deals (403)', async () => {
    const listRes = await apiAuditor.get('/api/deals');
    assert(listRes.data.success, 'Auditor can view deals');

    try {
      await apiAuditor.post('/api/deals', {
        studentName: 'Auditor Created Student',
        collegeName: 'Test College',
        courseName: 'B.Sc',
      });
      assert.fail('Auditor should NOT be able to create deals');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Must return 403 for auditor create deal');
    }
  });

  // =============================================================
  // Invitation Boundary & Tampering Tests
  // =============================================================
  console.log('\n--- Invitation Boundary & Tampering Protection ---');

  await test('Reused invitation token is rejected (400)', async () => {
    try {
      await axios.post(`${BASE_URL}/api/workspace/invitations/${inviteTokenCounsellor}/accept`, {
        name: 'Another Person',
        password: testPassword,
      });
      assert.fail('Reusing accepted token must fail');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Must return 400 Bad Request');
    }
  });

  await test('Malformed or non-existent invitation token is rejected (400)', async () => {
    try {
      await axios.post(`${BASE_URL}/api/workspace/invitations/completely_fabricated_token_12345/accept`, {
        name: 'Attacker',
        password: testPassword,
      });
      assert.fail('Fabricated token must fail');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Must return 400 Bad Request');
    }
  });

  // =============================================================
  // Cross-Tenant Boundary Tests
  // =============================================================
  console.log('\n--- Cross-Tenant Workspace Isolation ---');

  await test('Owner B cannot access or modify Owner A workspace settings (403)', async () => {
    try {
      await apiB.put(`/api/workspace/current`, { name: 'Hacked Workspace' }, {
        headers: { 'x-workspace-id': workspaceAId },
      });
      assert.fail('Cross-tenant modification must fail');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Owner B cannot view Owner A admission deal (404/403)', async () => {
    try {
      await apiB.get(`/api/deals/${dealAId}`);
      assert.fail('Cross-tenant deal view must fail');
    } catch (err) {
      assert(err.response?.status === 404 || err.response?.status === 403);
    }
  });

  // =============================================================
  // Phase 2 Deep Security, Integrity & Scoping Verification
  // =============================================================
  console.log('\n--- Phase 2 Deep Security, Integrity & Scoping Verification ---');

  await test('Counsellor CANNOT alter deal commission via PUT /api/deals/:id -> 403', async () => {
    try {
      await apiCounsellor.put(`/api/deals/${dealAId}`, {
        commission: {
          ratePercent: 50,
          expectedAmount: 250000,
          invoiceStatus: 'settled',
        },
      });
      assert.fail('Counsellor modifying commission must fail with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert(['PERMISSION_DENIED', 'COMMISSION_EDIT_FORBIDDEN'].includes(err.response?.data?.code),
        `Expected code to be PERMISSION_DENIED or COMMISSION_EDIT_FORBIDDEN, got: ${err.response?.data?.code}`);
    }
  });

  await test('Counsellor CANNOT reassign lead via PUT /api/leads/:id', async () => {
    const User = require('../src/models/User');
    const counsellorUser = await User.findOne({ email: counsellorEmail }).lean();

    // Create a lead in workspace A assigned to this counsellor
    const leadRes = await apiA.post('/api/leads', {
      name: 'Test Student For Reassign',
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      targetDomain: 'Engineering (B.Tech/BE)',
      assignedTo: counsellorUser._id,
    });
    assert(leadRes.data.success || leadRes.data._id);
    const leadId = leadRes.data.lead?._id || leadRes.data._id || leadRes.data.data?._id;

    // Counsellor attempts to assign lead to another user
    const fakeUserId = new mongoose.Types.ObjectId().toString();
    const updateRes = await apiCounsellor.put(`/api/leads/${leadId}`, {
      assignedTo: fakeUserId,
      course: 'MCA',
      targetDomain: 'Engineering (B.Tech/BE)',
    });
    assert(updateRes.data.success || updateRes.status === 200);

    // The request succeeded in updating, but assignedTo must NOT have been changed to fakeUserId
    const Lead = require('../src/models/Lead');
    const updatedLead = await Lead.findById(leadId).lean();
    assert.notStrictEqual(updatedLead?.assignedTo?.toString(), fakeUserId, 'assignedTo field must not be updated by counsellor');
    assert.strictEqual(updatedLead?.assignedTo?.toString(), counsellorUser._id.toString(), 'lead must remain assigned to original counsellor');
  });

  await test('Auditor CANNOT log WhatsApp message on lead (/api/leads/:id/track-message) -> 403', async () => {
    const fakeLeadId = new mongoose.Types.ObjectId();
    try {
      await apiAuditor.post(`/api/leads/${fakeLeadId}/track-message`, { text: 'Hello' });
      assert.fail('Auditor track-message must fail with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor receives masked customTieUpDetails on GET /api/catalogue', async () => {
    const TenantCatalogue = require('../src/models/TenantCatalogue');
    const User = require('../src/models/User');
    const ownerDoc = await User.findOne({ email: ownerAEmail }).lean();

    // Directly insert catalogue item with customTieUpDetails for Workspace A
    await TenantCatalogue.create({
      workspaceId: workspaceAId,
      tenantId: ownerDoc._id,
      customCollegeName: 'Confidential University ' + ts,
      isCustomInstitution: true,
      collegeType: 'Private University',
      location: { city: 'Bengaluru', state: 'Karnataka' },
      courses: [{
        degreeName: 'MBA Executive',
        specialization: 'Finance',
        durationYears: 2,
        customTieUpDetails: {
          commissionType: 'percentage',
          commissionRate: 25,
          mouStatus: 'direct_tie_up',
          notes: 'Internal confidential agreement',
        },
      }],
    });

    // Call getCatalogue as counsellor
    const listRes = await apiCounsellor.get('/api/catalogue');
    assert(listRes.data.success);
    const foundItem = listRes.data.catalogue?.find(i => i.customCollegeName?.includes('Confidential University')) ||
      listRes.data.data?.find(i => i.collegeName?.includes('Confidential University'));
    assert(foundItem, 'Should find inserted catalogue item in catalogue list');
    if (foundItem.courses && foundItem.courses.length > 0) {
      assert.strictEqual(foundItem.courses[0].customTieUpDetails, undefined, 'customTieUpDetails must be masked for counsellor');
    }
  });

  await test('Counsellor CANNOT view integration snippet (GET /api/integrations/:id/snippet) -> 403', async () => {
    const fakeIntId = new mongoose.Types.ObjectId();
    try {
      await apiCounsellor.get(`/api/integrations/${fakeIntId}/snippet`);
      assert.fail('Counsellor viewing integration snippet must fail with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT view integration events (GET /api/integrations/events) -> 403', async () => {
    try {
      await apiCounsellor.get('/api/integrations/events');
      assert.fail('Counsellor viewing integration events must fail with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT view analytics (GET /api/analytics) -> 403', async () => {
    try {
      await apiCounsellor.get('/api/analytics');
      assert.fail('Counsellor viewing analytics must fail with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Counsellor CANNOT export analytics (GET /api/analytics/export) -> 403', async () => {
    try {
      await apiCounsellor.get('/api/analytics/export');
      assert.fail('Counsellor exporting analytics must fail with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Manager CAN view analytics (GET /api/analytics) -> 200', async () => {
    const res = await apiManager.get('/api/analytics');
    assert.strictEqual(res.status, 200);
    assert(res.data.totalLeads !== undefined);
  });

  await test('Counsellor CANNOT view campaigns (GET /api/campaigns) -> 403', async () => {
    try {
      await apiCounsellor.get('/api/campaigns');
      assert.fail('Counsellor viewing campaigns must fail with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Manager CAN view campaigns (GET /api/campaigns) -> 200', async () => {
    const res = await apiManager.get('/api/campaigns');
    assert.strictEqual(res.status, 200);
  });

  await test('Custom role creation with unrecognized permission key is rejected -> 400', async () => {
    try {
      await apiA.post('/api/workspace/roles', {
        name: 'Malicious Custom Role',
        description: 'Testing key injection',
        permissions: [
          { key: 'unrecognized.dangerous.action', scope: 'workspace' },
        ],
      });
      assert.fail('Creating role with invalid key must fail with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.code, 'INVALID_PERMISSION_KEY');
    }
  });

  // =============================================================
  // Summary & Teardown
  // =============================================================
  console.log('\n============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  try {
    await mongoose.disconnect();
  } catch (_) {}

  if (require.main === module) {
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  runSecurityRemediationSuite().catch(err => {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  });
}

module.exports = { runSecurityRemediationSuite };
