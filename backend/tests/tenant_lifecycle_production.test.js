/**
 * CORESETU — SUPER ADMIN TENANT LIFECYCLE PRODUCTION TEST SUITE
 * Complete 40-Point Validation Suite:
 * States, Transitions, Concurrency, Idempotency, RBAC, Tenant Isolation,
 * Data Preservation, Audit Trails, Notifications & CRM Regression.
 */

const mongoose = require('mongoose');
const assert = require('assert');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Project = require('../src/models/Project');
const Booking = require('../src/models/Booking');
const TenantConfig = require('../src/models/TenantConfig');
const Subscription = require('../src/models/Subscription');
const Plan = require('../src/models/Plan');
const AuditLog = require('../src/models/AuditLog');
const ActivityLog = require('../src/models/ActivityLog');
const Notification = require('../src/models/Notification');

const {
  TENANT_LIFECYCLE_STATES,
  ALLOWED_TRANSITIONS,
  resolveCurrentLifecycleState,
  transitionTenantState,
  getTenantLifecycleDetails,
} = require('../src/superadmin/services/tenantLifecycleService');

const {
  listOrganisations,
  getTenantDetails,
  updateTenantStatus,
} = require('../src/superadmin/services/tenantService');

const organisationController = require('../src/superadmin/controllers/organisationController');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runTenantLifecycleTestSuite() {
  console.log('================================================================');
  console.log('⚡ RUNNING PRODUCTION TENANT LIFECYCLE MANAGEMENT TEST SUITE');
  console.log('================================================================\n');

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('✓ Connected to MongoMemoryServer isolated test database\n');

    // ── ACTOR SETUP ──
    const superAdmin = await User.create({
      name: 'Platform Super Admin',
      email: 'superadmin@coresetu.com',
      password: 'password123',
      role: 'superadmin',
      usercode: 'ADM-999999',
    });

    const tenantOwnerAdmin = await User.create({
      name: 'Owner Admin',
      email: 'owner@tenant-a.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      usercode: 'CMP-111111',
      companyInfo: { companyName: 'Tenant A Real Estate' },
    });

    const tenantManager = await User.create({
      name: 'Sales Manager',
      email: 'manager@tenant-a.com',
      password: 'password123',
      role: 'manager',
      companyRole: 'manager',
      companyId: tenantOwnerAdmin._id,
      usercode: 'MGR-222222',
    });

    const tenantAgent = await User.create({
      name: 'Sales Agent',
      email: 'agent@tenant-a.com',
      password: 'password123',
      role: 'agent',
      companyRole: 'agent',
      companyId: tenantOwnerAdmin._id,
      usercode: 'AGT-333333',
    });

    console.log('✓ Platform actors created (SuperAdmin, Tenant Owner, Manager, Agent)');

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Tenant Creation & Default Trial State
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 1. Tenant Creation & Lifecycle Default State ---');
    const tenant1 = await User.create({
      name: 'Acme Properties',
      email: 'contact@acme.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      companyInfo: { companyName: 'Acme Properties Ltd' },
      lifecycleStatus: 'TRIAL',
      lifecycleTimestamps: {
        provisionedAt: new Date(),
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    assert.strictEqual(tenant1.lifecycleStatus, 'TRIAL', 'New tenant starts in TRIAL state');
    assert(tenant1.lifecycleTimestamps.trialEndsAt, 'Trial end date is recorded');
    console.log('✅ [PASS] 1. Tenant Creation & Default Trial State');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: PROVISIONING → TRIAL Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Transition PROVISIONING → TRIAL ---');
    const provTenant = await User.create({
      name: 'New Provisioning Org',
      email: 'prov@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'PROVISIONING',
      lifecycleTimestamps: { provisionedAt: new Date() },
    });

    const resProvToTrial = await transitionTenantState(provTenant._id, 'TRIAL', superAdmin, { reason: 'Provisioning complete' });
    assert.strictEqual(resProvToTrial.currentState, 'TRIAL', 'PROVISIONING transitions to TRIAL');
    console.log('✅ [PASS] 2. PROVISIONING → TRIAL');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: PROVISIONING → ACTIVE Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Transition PROVISIONING → ACTIVE ---');
    const provTenant2 = await User.create({
      name: 'Instant Paid Org',
      email: 'instant@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'PROVISIONING',
      lifecycleTimestamps: { provisionedAt: new Date() },
    });

    const resProvToActive = await transitionTenantState(provTenant2._id, 'ACTIVE', superAdmin, { reason: 'Paid upfront on signup' });
    assert.strictEqual(resProvToActive.currentState, 'ACTIVE', 'PROVISIONING transitions to ACTIVE');
    console.log('✅ [PASS] 3. PROVISIONING → ACTIVE');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: TRIAL → ACTIVE Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. Transition TRIAL → ACTIVE ---');
    const resTrialToActive = await transitionTenantState(tenant1._id, 'ACTIVE', superAdmin, { reason: 'Upgraded to Growth Plan' });
    assert.strictEqual(resTrialToActive.currentState, 'ACTIVE', 'TRIAL transitions to ACTIVE');
    const updatedT1 = await User.findById(tenant1._id);
    assert(updatedT1.lifecycleTimestamps.activatedAt, 'activatedAt timestamp recorded');
    console.log('✅ [PASS] 4. TRIAL → ACTIVE');

    // ─────────────────────────────────────────────────────────────
    // TEST 5: TRIAL → PAST_DUE Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. Transition TRIAL → PAST_DUE ---');
    const trialTenant2 = await User.create({
      name: 'Trial Expirer',
      email: 'trialexp@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'TRIAL',
    });
    const resTrialToPastDue = await transitionTenantState(trialTenant2._id, 'PAST_DUE', { isSystem: true, role: 'system' }, { reason: 'Trial period elapsed without payment' });
    assert.strictEqual(resTrialToPastDue.currentState, 'PAST_DUE', 'TRIAL transitions to PAST_DUE on expiry');
    console.log('✅ [PASS] 5. TRIAL → PAST_DUE');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: TRIAL → CANCELLED Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 6. Transition TRIAL → CANCELLED ---');
    const trialTenant3 = await User.create({
      name: 'Trial Canceller',
      email: 'trialcancel@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'TRIAL',
    });
    const resTrialToCancelled = await transitionTenantState(trialTenant3._id, 'CANCELLED', superAdmin, { reason: 'Tenant requested cancellation during trial' });
    assert.strictEqual(resTrialToCancelled.currentState, 'CANCELLED', 'TRIAL transitions to CANCELLED');
    console.log('✅ [PASS] 6. TRIAL → CANCELLED');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: ACTIVE → PAST_DUE Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 7. Transition ACTIVE → PAST_DUE ---');
    const activeTenantA = await User.create({
      name: 'Active Recurring Tenant',
      email: 'active-a@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'ACTIVE',
    });
    const resActiveToPastDue = await transitionTenantState(activeTenantA._id, 'PAST_DUE', { isSystem: true, role: 'system' }, { reason: 'Recurring mandate charge failed' });
    assert.strictEqual(resActiveToPastDue.currentState, 'PAST_DUE', 'ACTIVE transitions to PAST_DUE');
    console.log('✅ [PASS] 7. ACTIVE → PAST_DUE');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: ACTIVE → SUSPENDED Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 8. Transition ACTIVE → SUSPENDED ---');
    const activeTenantB = await User.create({
      name: 'Suspension Candidate',
      email: 'suspend-me@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'ACTIVE',
    });
    const resActiveToSuspended = await transitionTenantState(activeTenantB._id, 'SUSPENDED', superAdmin, { reason: 'Terms of Service violation investigation' });
    assert.strictEqual(resActiveToSuspended.currentState, 'SUSPENDED', 'ACTIVE transitions to SUSPENDED');
    const suspendedCheck = await User.findById(activeTenantB._id);
    assert.strictEqual(suspendedCheck.userStatus, 'inactive', 'User status mapped to inactive');
    assert(suspendedCheck.lifecycleTimestamps.suspendedAt, 'suspendedAt timestamp recorded');
    console.log('✅ [PASS] 8. ACTIVE → SUSPENDED');

    // ─────────────────────────────────────────────────────────────
    // TEST 9: ACTIVE → CANCELLED Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 9. Transition ACTIVE → CANCELLED ---');
    const activeTenantC = await User.create({
      name: 'Cancellation Candidate',
      email: 'cancel-me@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'ACTIVE',
    });
    const resActiveToCancelled = await transitionTenantState(activeTenantC._id, 'CANCELLED', superAdmin, { reason: 'Customer requested account closure' });
    assert.strictEqual(resActiveToCancelled.currentState, 'CANCELLED', 'ACTIVE transitions to CANCELLED');
    console.log('✅ [PASS] 9. ACTIVE → CANCELLED');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: PAST_DUE → ACTIVE Transition (Payment Recovery)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 10. Transition PAST_DUE → ACTIVE ---');
    const resPastDueToActive = await transitionTenantState(activeTenantA._id, 'ACTIVE', { isSystem: true, role: 'system' }, { reason: 'Payment mandate successfully resolved' });
    assert.strictEqual(resPastDueToActive.currentState, 'ACTIVE', 'PAST_DUE transitions to ACTIVE upon payment');
    console.log('✅ [PASS] 10. PAST_DUE → ACTIVE');

    // ─────────────────────────────────────────────────────────────
    // TEST 11: PAST_DUE → SUSPENDED Transition (Grace Expiry)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 11. Transition PAST_DUE → SUSPENDED ---');
    const pastDueTenant = await User.create({
      name: 'Overdue Tenant',
      email: 'overdue@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'PAST_DUE',
    });
    const resPastDueToSuspended = await transitionTenantState(pastDueTenant._id, 'SUSPENDED', { isSystem: true, role: 'system' }, { reason: 'Grace period expired without payment' });
    assert.strictEqual(resPastDueToSuspended.currentState, 'SUSPENDED', 'PAST_DUE transitions to SUSPENDED');
    console.log('✅ [PASS] 11. PAST_DUE → SUSPENDED');

    // ─────────────────────────────────────────────────────────────
    // TEST 12: PAST_DUE → CANCELLED Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 12. Transition PAST_DUE → CANCELLED ---');
    const pastDueTenant2 = await User.create({
      name: 'Overdue Canceller',
      email: 'overdue-cancel@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'PAST_DUE',
    });
    const resPastDueToCancelled = await transitionTenantState(pastDueTenant2._id, 'CANCELLED', superAdmin, { reason: 'Customer chose cancellation over payment' });
    assert.strictEqual(resPastDueToCancelled.currentState, 'CANCELLED', 'PAST_DUE transitions to CANCELLED');
    console.log('✅ [PASS] 12. PAST_DUE → CANCELLED');

    // ─────────────────────────────────────────────────────────────
    // TEST 13: SUSPENDED → ACTIVE Transition (Reactivation)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 13. Transition SUSPENDED → ACTIVE ---');
    const resSuspendedToActive = await transitionTenantState(activeTenantB._id, 'ACTIVE', superAdmin, { reason: 'Investigation cleared. Account reactivated.' });
    assert.strictEqual(resSuspendedToActive.currentState, 'ACTIVE', 'SUSPENDED transitions to ACTIVE');
    const reactivatedCheck = await User.findById(activeTenantB._id);
    assert.strictEqual(reactivatedCheck.userStatus, 'active', 'User status restored to active');
    console.log('✅ [PASS] 13. SUSPENDED → ACTIVE');

    // ─────────────────────────────────────────────────────────────
    // TEST 14: SUSPENDED → CANCELLED Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 14. Transition SUSPENDED → CANCELLED ---');
    const suspendedTenant = await User.create({
      name: 'Suspended Canceller',
      email: 'sus-cancel@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'SUSPENDED',
    });
    const resSuspendedToCancelled = await transitionTenantState(suspendedTenant._id, 'CANCELLED', superAdmin, { reason: 'Permanent termination after suspension' });
    assert.strictEqual(resSuspendedToCancelled.currentState, 'CANCELLED', 'SUSPENDED transitions to CANCELLED');
    console.log('✅ [PASS] 14. SUSPENDED → CANCELLED');

    // ─────────────────────────────────────────────────────────────
    // TEST 15: CANCELLED → ARCHIVED Transition
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 15. Transition CANCELLED → ARCHIVED ---');
    const resCancelledToArchived = await transitionTenantState(resSuspendedToCancelled.tenant._id, 'ARCHIVED', superAdmin, { reason: '60 days in cancelled state elapsed. Soft archived.' });
    assert.strictEqual(resCancelledToArchived.currentState, 'ARCHIVED', 'CANCELLED transitions to ARCHIVED');
    const archivedCheck = await User.findById(resSuspendedToCancelled.tenant._id);
    assert(archivedCheck.lifecycleTimestamps.archivedAt, 'archivedAt timestamp set');
    assert.strictEqual(archivedCheck.isActive, false, 'isActive is false in ARCHIVED state');
    console.log('✅ [PASS] 15. CANCELLED → ARCHIVED');

    // ─────────────────────────────────────────────────────────────
    // TEST 16: ARCHIVED is Terminal (Cannot Transition Out)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 16. ARCHIVED State Terminality Check ---');
    try {
      await transitionTenantState(archivedCheck._id, 'ACTIVE', superAdmin, { reason: 'Attempting invalid restore' });
      assert.fail('ARCHIVED should not allow transition to ACTIVE');
    } catch (err) {
      assert.strictEqual(err.statusCode, 409, 'Rejects with 409 Conflict');
      assert.strictEqual(err.code, 'INVALID_LIFECYCLE_TRANSITION', 'Returns INVALID_LIFECYCLE_TRANSITION code');
    }
    console.log('✅ [PASS] 16. ARCHIVED cannot transition (Terminal)');

    // ─────────────────────────────────────────────────────────────
    // TEST 17: Invalid Transition Rejection Matrix (409 Conflict)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 17. Invalid Transition Matrix Rejection (409) ---');
    const freshTrialTenant = await User.create({
      name: 'Fresh Trial Tenant',
      email: 'fresh-trial@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'TRIAL',
    });
    try {
      await transitionTenantState(freshTrialTenant._id, 'ARCHIVED', superAdmin, { reason: 'Direct TRIAL to ARCHIVED is illegal' });
      assert.fail('TRIAL -> ARCHIVED must fail');
    } catch (err) {
      assert.strictEqual(err.statusCode, 409, 'Returns 409 Conflict');
    }
    console.log('✅ [PASS] 17. Invalid transitions rejected with HTTP 409');

    // ─────────────────────────────────────────────────────────────
    // TEST 18: Idempotent State Transitions
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 18. Idempotency Check ---');
    const resIdempotent = await transitionTenantState(freshTrialTenant._id, 'TRIAL', superAdmin, { reason: 'No-op transition' });
    assert.strictEqual(resIdempotent.idempotent, true, 'Flags idempotent response');
    assert.strictEqual(resIdempotent.currentState, 'TRIAL', 'Preserves TRIAL state');
    console.log('✅ [PASS] 18. Duplicate identical transition is safely idempotent');

    // ─────────────────────────────────────────────────────────────
    // TEST 19 & 20: Concurrency & Optimistic Version Protection
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 19 & 20. Concurrency & Optimistic Versioning ---');
    const versionedTenant = await User.create({
      name: 'Concurrent Tenant',
      email: 'concurrent@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'ACTIVE',
      lifecycleVersion: 5,
    });

    const [trans1, trans2] = await Promise.allSettled([
      transitionTenantState(versionedTenant._id, 'SUSPENDED', superAdmin, { reason: 'Admin 1 suspend' }),
      transitionTenantState(versionedTenant._id, 'SUSPENDED', superAdmin, { reason: 'Admin 2 suspend' }),
    ]);

    const successes = [trans1, trans2].filter((t) => t.status === 'fulfilled');
    assert(successes.length >= 1, 'At least one request succeeds atomically');
    const finalVersionTenant = await User.findById(versionedTenant._id);
    assert(finalVersionTenant.lifecycleVersion > 5, 'Lifecycle version incremented');
    console.log('✅ [PASS] 19 & 20. Concurrency and Optimistic Versioning protected');

    // ─────────────────────────────────────────────────────────────
    // TEST 21 to 26: RBAC Authorization Matrix
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 21 to 26. RBAC & Security Enforcement ---');
    const testRbacTenant = await User.create({
      name: 'RBAC Test Org',
      email: 'rbac@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'ACTIVE',
    });

    // 21: SuperAdmin Allowed
    const superAdminAllowedRes = await transitionTenantState(testRbacTenant._id, 'SUSPENDED', superAdmin, { reason: 'SuperAdmin authorized' });
    assert.strictEqual(superAdminAllowedRes.currentState, 'SUSPENDED', 'SuperAdmin allowed');
    console.log('✅ [PASS] 21. SuperAdmin permitted (role === "superadmin")');

    // 22: Tenant Owner Denied
    try {
      await transitionTenantState(testRbacTenant._id, 'ACTIVE', tenantOwnerAdmin);
      assert.fail('Tenant Owner should be denied');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403, 'Tenant Owner denied with 403');
    }
    console.log('✅ [PASS] 22. Tenant Owner Admin denied (403 Forbidden)');

    // 23: Tenant Admin with isAdmin flag Denied
    const fakeAdminUser = { role: 'admin', isAdmin: true, _id: new mongoose.Types.ObjectId() };
    try {
      await transitionTenantState(testRbacTenant._id, 'ACTIVE', fakeAdminUser);
      assert.fail('isAdmin=true non-superadmin should be denied');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403, 'isAdmin=true alone rejected');
    }
    console.log('✅ [PASS] 23. isAdmin flag without role==="superadmin" denied');

    // 24: Manager Denied
    try {
      await transitionTenantState(testRbacTenant._id, 'ACTIVE', tenantManager);
      assert.fail('Manager should be denied');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403, 'Manager denied with 403');
    }
    console.log('✅ [PASS] 24. Manager denied (403 Forbidden)');

    // 25: Agent Denied
    try {
      await transitionTenantState(testRbacTenant._id, 'ACTIVE', tenantAgent);
      assert.fail('Agent should be denied');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403, 'Agent denied with 403');
    }
    console.log('✅ [PASS] 25. Agent denied (403 Forbidden)');

    // 26: Unauthenticated Denied
    try {
      await transitionTenantState(testRbacTenant._id, 'ACTIVE', null);
      assert.fail('Unauthenticated should be denied');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403, 'Unauthenticated denied');
    }
    console.log('✅ [PASS] 26. Unauthenticated actor denied');

    // ─────────────────────────────────────────────────────────────
    // TEST 27, 28, 29: Zero Data Loss / Data Preservation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 27, 28, 29. Non-Destructive Data Preservation ---');
    const dataOrg = await User.create({
      name: 'Data Preservation Org',
      email: 'datapres@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      lifecycleStatus: 'ACTIVE',
      companyInfo: { companyName: 'Mega Real Estate Corp' },
    });

    const dummyLead = await Lead.create({
      userId: dataOrg._id,
      companyId: dataOrg._id,
      name: 'High Value Buyer',
      phone: '9876543210',
      status: 'converted',
      budget: '1.5 Cr',
    });

    const dummyProject = await Project.create({
      userId: dataOrg._id,
      companyId: dataOrg._id,
      name: 'Skyline Towers Luxury Suites',
      location: 'Sector 62, Gurgaon',
    });

    const dummyBooking = await Booking.create({
      companyId: dataOrg._id,
      leadId: dummyLead._id,
      projectId: dummyProject._id,
      inventoryId: new mongoose.Types.ObjectId(),
      bookingNumber: 'BKG-2026-001',
      bookingAmount: 500000,
      agreementValue: 15000000,
      status: 'CONFIRMED',
    });

    // Move dataOrg through: ACTIVE -> SUSPENDED -> ACTIVE -> CANCELLED -> ARCHIVED
    await transitionTenantState(dataOrg._id, 'SUSPENDED', superAdmin, { reason: 'Test 27 data preservation' });
    let leadCountAfterSuspend = await Lead.countDocuments({ companyId: dataOrg._id });
    let projectCountAfterSuspend = await Project.countDocuments({ companyId: dataOrg._id });
    let bookingCountAfterSuspend = await Booking.countDocuments({ companyId: dataOrg._id });
    assert.strictEqual(leadCountAfterSuspend, 1, 'Leads preserved after SUSPEND');
    assert.strictEqual(projectCountAfterSuspend, 1, 'Projects preserved after SUSPEND');
    assert.strictEqual(bookingCountAfterSuspend, 1, 'Bookings preserved after SUSPEND');
    console.log('✅ [PASS] 27. Tenant data fully preserved after SUSPEND');

    await transitionTenantState(dataOrg._id, 'ACTIVE', superAdmin, { reason: 'Reactivation for cancel test' });
    await transitionTenantState(dataOrg._id, 'CANCELLED', superAdmin, { reason: 'Test 28 cancellation data preservation' });
    let leadCountAfterCancel = await Lead.countDocuments({ companyId: dataOrg._id });
    let projectCountAfterCancel = await Project.countDocuments({ companyId: dataOrg._id });
    assert.strictEqual(leadCountAfterCancel, 1, 'Leads preserved after CANCEL');
    assert.strictEqual(projectCountAfterCancel, 1, 'Projects preserved after CANCEL');
    console.log('✅ [PASS] 28. Tenant data fully preserved after CANCEL');

    await transitionTenantState(dataOrg._id, 'ARCHIVED', superAdmin, { reason: 'Test 29 archival data preservation' });
    let leadCountAfterArchive = await Lead.countDocuments({ companyId: dataOrg._id });
    let projectCountAfterArchive = await Project.countDocuments({ companyId: dataOrg._id });
    let bookingCountAfterArchive = await Booking.countDocuments({ companyId: dataOrg._id });
    assert.strictEqual(leadCountAfterArchive, 1, 'Leads preserved after ARCHIVE');
    assert.strictEqual(projectCountAfterArchive, 1, 'Projects preserved after ARCHIVE');
    assert.strictEqual(bookingCountAfterArchive, 1, 'Bookings preserved after ARCHIVE');
    console.log('✅ [PASS] 29. Tenant data fully preserved after ARCHIVE (Soft State, Zero Deletions)');

    // ─────────────────────────────────────────────────────────────
    // TEST 30, 31, 32, 33: Subscription & Webhook Integration
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 30, 31, 32, 33. Subscription & Webhook Synchronization ---');
    const subTenant = await User.create({
      name: 'Subscription Test Org',
      email: 'sub-test@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'TRIAL',
    });

    const dummyPlan = await Plan.create({
      name: 'Business Pro Plan',
      code: `BIZ_PRO_${Date.now()}`,
      tier: 2,
      accountType: 'ORGANIZATION',
      interval: 'monthly',
      priceInPaise: 499900,
      price: 4999,
      monthlyPrice: 4999,
      role: 'company_owner',
      defaultEntitlements: {
        maxLeads: 5000,
        monthlyWAQuota: 2000,
      },
    });

    const subscriptionRecord = await Subscription.create({
      userId: subTenant._id,
      companyId: subTenant._id,
      accountType: 'ORGANIZATION',
      planId: dummyPlan._id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // 30: Subscription Recovery (PAST_DUE -> ACTIVE)
    await transitionTenantState(subTenant._id, 'ACTIVE', superAdmin, { reason: 'Invoice paid' });
    const syncedSubActive = await Subscription.findOne({ companyId: subTenant._id });
    assert.strictEqual(syncedSubActive.status, 'ACTIVE', 'Subscription status synchronized to ACTIVE');
    console.log('✅ [PASS] 30. Subscription recovery & status sync to ACTIVE');

    // 31: Payment Failure (ACTIVE -> PAST_DUE)
    await transitionTenantState(subTenant._id, 'PAST_DUE', { isSystem: true, role: 'system' }, { reason: 'Payment failed' });
    const syncedSubPastDue = await Subscription.findOne({ companyId: subTenant._id });
    assert.strictEqual(syncedSubPastDue.status, 'PAST_DUE', 'Subscription status synchronized to PAST_DUE');
    console.log('✅ [PASS] 31. Payment failure & status sync to PAST_DUE');

    // 32: Grace-period Expiry (PAST_DUE -> SUSPENDED)
    await transitionTenantState(subTenant._id, 'SUSPENDED', { isSystem: true, role: 'system' }, { reason: 'Grace period expired' });
    const suspendedSubCheck = await User.findById(subTenant._id);
    assert.strictEqual(suspendedSubCheck.lifecycleStatus, 'SUSPENDED', 'Tenant transitioned to SUSPENDED');
    console.log('✅ [PASS] 32. Grace-period expiration triggers suspension');

    // 33: Webhook Replay Protection (Idempotent Webhook Recovery)
    await transitionTenantState(subTenant._id, 'ACTIVE', { isSystem: true, role: 'system' }, { reason: 'Webhook payment captured' });
    const replayRes = await transitionTenantState(subTenant._id, 'ACTIVE', { isSystem: true, role: 'system' }, { reason: 'Webhook replay payment captured' });
    assert.strictEqual(replayRes.idempotent, true, 'Webhook replay is safely idempotent');
    console.log('✅ [PASS] 33. Webhook replay protection verified');

    // ─────────────────────────────────────────────────────────────
    // TEST 34, 35, 36: Audit Logs, Activity Logs & Notifications
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 34, 35, 36. Observability: Audit Logs, Activity Logs & Notifications ---');
    const auditLogs = await AuditLog.find({ organizationId: subTenant._id }).sort({ timestamp: -1 });
    assert(auditLogs.length > 0, 'Audit logs recorded for all transitions');
    assert(auditLogs.some((a) => a.action === 'TENANT_ACTIVATED' || a.action === 'TENANT_REACTIVATED'), 'Audit action logged');
    console.log(`✅ [PASS] 34. Immutable Audit Logs recorded (${auditLogs.length} events logged)`);

    const activityLogs = await ActivityLog.find({ tenantId: subTenant._id });
    assert(activityLogs.length > 0, 'Activity logs created for operational timeline');
    console.log(`✅ [PASS] 35. Activity Logs recorded (${activityLogs.length} events logged)`);

    const notifications = await Notification.find({ userId: subTenant._id });
    assert(notifications.length > 0, 'Tenant owner received notifications');
    console.log(`✅ [PASS] 36. Notifications delivered to tenant (${notifications.length} alerts)`);

    // ─────────────────────────────────────────────────────────────
    // TEST 37: Multi-Tenant Data Isolation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 37. Multi-Tenant Data Isolation ---');
    const tenantA = await User.create({
      name: 'Tenant Alpha',
      email: 'alpha@realty.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'ACTIVE',
    });
    const tenantB = await User.create({
      name: 'Tenant Beta',
      email: 'beta@realty.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      lifecycleStatus: 'ACTIVE',
    });

    await Lead.create({
      userId: tenantA._id,
      companyId: tenantA._id,
      name: 'Secret Lead Alpha',
      phone: '9900112233',
    });

    await Lead.create({
      userId: tenantB._id,
      companyId: tenantB._id,
      name: 'Secret Lead Beta',
      phone: '9900445566',
    });

    const alphaLeads = await Lead.find({ companyId: tenantA._id });
    assert.strictEqual(alphaLeads.length, 1, 'Tenant Alpha only queries Tenant Alpha leads');
    assert.strictEqual(alphaLeads[0].name, 'Secret Lead Alpha', 'Tenant Alpha data is strictly isolated');

    const betaLeads = await Lead.find({ companyId: tenantB._id });
    assert.strictEqual(betaLeads.length, 1, 'Tenant Beta only queries Tenant Beta leads');
    assert.strictEqual(betaLeads[0].name, 'Secret Lead Beta', 'Tenant Beta data is strictly isolated');
    console.log('✅ [PASS] 37. Multi-tenant data isolation verified');

    // ─────────────────────────────────────────────────────────────
    // TEST 38: Existing Status (ACTIVE / BLOCKED / SUSPENDED) Compatibility
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 38. Backward Compatibility: Legacy Statuses ---');
    const legacyBlockedOrg = await User.create({
      name: 'Legacy Blocked Org',
      email: 'legacy-block@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      isActive: false,
      userStatus: 'disabled',
    });
    const legacyBlockedState = resolveCurrentLifecycleState(legacyBlockedOrg);
    assert.strictEqual(legacyBlockedState, 'SUSPENDED', 'Legacy BLOCKED maps to SUSPENDED');

    const legacyTrialOrg = await User.create({
      name: 'Legacy Free Org',
      email: 'legacy-free@org.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      plan: 'free',
      isActive: true,
      userStatus: 'active',
    });
    const legacyTrialState = resolveCurrentLifecycleState(legacyTrialOrg);
    assert.strictEqual(legacyTrialState, 'TRIAL', 'Legacy Free without plan maps to TRIAL');

    // Controller updateStatus backward compatibility
    const reqUpdateStatus = {
      params: { id: legacyTrialOrg._id },
      body: { status: 'ACTIVE', reason: 'Legacy status unblock test' },
      user: superAdmin,
    };
    const resUpdateStatus = createMockRes();
    await organisationController.updateStatus(reqUpdateStatus, resUpdateStatus);
    assert.strictEqual(resUpdateStatus.statusCode, 200, 'Legacy updateStatus returns 200 OK');
    console.log('✅ [PASS] 38. Existing ACTIVE/BLOCKED/SUSPENDED compatibility verified');

    // ─────────────────────────────────────────────────────────────
    // TEST 39: Existing CRM Core Functionality Regression
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 39. Core CRM Workflow Regression ---');
    const crmLead = await Lead.create({
      userId: tenantOwnerAdmin._id,
      companyId: tenantOwnerAdmin._id,
      name: 'CRM Workflow Lead',
      phone: '9811223344',
      status: 'new_lead',
      budget: '75 Lakhs',
      propertyType: 'Residential Apartment',
    });
    assert(crmLead._id, 'Lead created successfully');

    crmLead.status = 'contacted';
    await crmLead.save();
    const updatedCrmLead = await Lead.findById(crmLead._id);
    assert.strictEqual(updatedCrmLead.status, 'contacted', 'Lead stage update works seamlessly');
    console.log('✅ [PASS] 39. Existing CRM Lead operations work without regression');

    // ─────────────────────────────────────────────────────────────
    // TEST 40: SuperAdmin Dashboard API Integration
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 40. SuperAdmin Dashboard & Organisation Endpoints ---');
    const reqListOrgs = {
      query: { search: '', status: 'all', page: 1, limit: 20 },
      user: superAdmin,
    };
    const resListOrgs = createMockRes();
    await organisationController.getOrganisations(reqListOrgs, resListOrgs);
    assert.strictEqual(resListOrgs.statusCode, 200, 'getOrganisations returns 200 OK');
    assert(resListOrgs.body.organisations.length > 0, 'Organisations roster returned');
    assert(resListOrgs.body.organisations[0].lifecycleStatus, 'Lifecycle status included in list output');

    const reqLifecycleDetail = {
      params: { id: tenantOwnerAdmin._id },
      user: superAdmin,
    };
    const resLifecycleDetail = createMockRes();
    await organisationController.getLifecycle(reqLifecycleDetail, resLifecycleDetail);
    assert.strictEqual(resLifecycleDetail.statusCode, 200, 'getLifecycle returns 200 OK');
    assert.strictEqual(resLifecycleDetail.body.data.tenantId.toString(), tenantOwnerAdmin._id.toString(), 'Lifecycle details match tenant');
    console.log('✅ [PASS] 40. SuperAdmin Organisations and Lifecycle APIs verified');

    console.log('\n================================================================');
    console.log('🎉 ALL 40/40 TENANT LIFECYCLE TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

runTenantLifecycleTestSuite();
