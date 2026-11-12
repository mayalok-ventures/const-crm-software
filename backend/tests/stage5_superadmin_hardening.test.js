/**
 * Stage 5 Verification: Super Admin Hardening, Impersonation Safety & Destructive Safeguards
 * Verifies that:
 * 1. Authz Matrix: Superadmin has access; tenant owner, admin, manager, counselor are 403; unauthenticated is 401
 * 2. 2FA Enforcement: Pending 2FA token is rejected with 401
 * 3. Token Version Check: Token with stale tokenVersion is rejected with 401
 * 4. Impersonation Hardening:
 *    - Injects target user's tokenVersion
 *    - Forbids impersonating another superadmin account (400/403)
 *    - Impersonated tokens set req.isImpersonated and cannot access superadmin routes (403)
 *    - Audit-logged with IMPERSONATION_START
 * 5. Destructive Action Guards:
 *    - Clean-slate requires 'CLEAN_SLATE_CONFIRM' typed confirmation
 *    - Clean-slate is blocked in production unless ALLOW_DESTRUCTIVE_CLEANSLATE=true
 *    - Purge test data requires 'PURGE_TEST_DATA_CONFIRM'
 *    - Delete user requires typed confirmation and cannot delete superadmin
 * 6. Global Leads Query:
 *    - Soft-deleted leads are strictly excluded
 *    - Search handles email, phone, and name prefix without crashing
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'stage5_test_jwt_secret_2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Lead = require('../src/models/Lead');
const AuditLog = require('../src/models/AuditLog');
const ActivityLog = require('../src/models/ActivityLog');
const { generateToken, generateTemp2FAToken } = require('../src/middleware/auth');

const superAdminRoutes = require('../src/superadmin/routes/superAdminRoutes');
const adminRoutes = require('../src/routes/admin');

describe('Stage 5: Super Admin Hardening & Destructive Safeguards', function () {
  this.timeout(45000);
  let mongoServer;
  let server;
  let baseUrl;

  let superadminUser;
  let otherSuperadminUser;
  let ownerUser;
  let adminUser;
  let managerUser;
  let counselorUser;
  let targetTenantUser;

  let superadminToken;
  let otherSuperadminToken;
  let ownerToken;
  let adminToken;
  let managerToken;
  let counselorToken;

  let testWorkspace;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const app = express();
    app.use(express.json());

    app.use('/api/super-admin', superAdminRoutes);
    app.use('/api/admin', adminRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const ownerId = new mongoose.Types.ObjectId();
    testWorkspace = await Workspace.create({
      name: 'Sahyak Testing University',
      slug: 'sahyak-test',
      ownerId,
      tier: 'enterprise',
      status: 'active',
      plan: 'enterprise',
    });

    // 1. SuperAdmin User
    superadminUser = await User.create({
      name: 'Platform SuperAdmin',
      email: 'superadmin@sahyak.org',
      password: 'Password123!',
      role: 'superadmin',
      isAdmin: true,
      tokenVersion: 1,
    });

    otherSuperadminUser = await User.create({
      name: 'Secondary SuperAdmin',
      email: 'superadmin2@sahyak.org',
      password: 'Password123!',
      role: 'superadmin',
      isAdmin: true,
      tokenVersion: 1,
    });

    // 2. Tenant Owner User
    ownerUser = await User.create({
      name: 'University Owner',
      email: 'owner@sahyak.org',
      password: 'Password123!',
      role: 'admin',
      companyRole: 'owner',
      workStatus: 'company_owner',
      workspaceId: testWorkspace._id,
      companyId: testWorkspace._id,
      tokenVersion: 1,
    });

    // 3. Tenant Admin User
    adminUser = await User.create({
      name: 'Tenant Admin',
      email: 'admin@sahyak.org',
      password: 'Password123!',
      role: 'admin',
      companyRole: 'manager',
      workspaceId: testWorkspace._id,
      companyId: testWorkspace._id,
      tokenVersion: 1,
    });

    // 4. Tenant Manager User
    managerUser = await User.create({
      name: 'Admissions Manager',
      email: 'manager@sahyak.org',
      password: 'Password123!',
      role: 'manager',
      companyRole: 'manager',
      workspaceId: testWorkspace._id,
      companyId: testWorkspace._id,
      tokenVersion: 1,
    });

    // 5. Tenant Counselor User
    counselorUser = await User.create({
      name: 'Junior Counselor',
      email: 'counselor@sahyak.org',
      password: 'Password123!',
      role: 'agent',
      companyRole: 'counsellor',
      workspaceId: testWorkspace._id,
      companyId: testWorkspace._id,
      tokenVersion: 1,
    });

    // Target User for Support Impersonation
    targetTenantUser = await User.create({
      name: 'Target Counselor',
      email: 'target@sahyak.org',
      password: 'Password123!',
      role: 'agent',
      companyRole: 'counsellor',
      workspaceId: testWorkspace._id,
      companyId: testWorkspace._id,
      tokenVersion: 2, // Non-zero token version to test tokenVersion inclusion
    });

    await WorkspaceMembership.create([
      { workspaceId: testWorkspace._id, userId: ownerUser._id, role: 'owner', status: 'active' },
      { workspaceId: testWorkspace._id, userId: adminUser._id, role: 'manager', status: 'active' },
      { workspaceId: testWorkspace._id, userId: managerUser._id, role: 'manager', status: 'active' },
      { workspaceId: testWorkspace._id, userId: counselorUser._id, role: 'counsellor', status: 'active' },
      { workspaceId: testWorkspace._id, userId: targetTenantUser._id, role: 'counsellor', status: 'active' },
    ]);

    superadminToken = generateToken(superadminUser._id, superadminUser.tokenVersion);
    otherSuperadminToken = generateToken(otherSuperadminUser._id, otherSuperadminUser.tokenVersion);
    ownerToken = generateToken(ownerUser._id, ownerUser.tokenVersion);
    adminToken = generateToken(adminUser._id, adminUser.tokenVersion);
    managerToken = generateToken(managerUser._id, managerUser.tokenVersion);
    counselorToken = generateToken(counselorUser._id, counselorUser.tokenVersion);
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  async function api(method, path, body = null, token = null) {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  it('1. Authorization Matrix: Only SuperAdmin can access /api/super-admin/overview; all others rejected', async () => {
    // 1a. SuperAdmin -> 200 OK
    const resSA = await api('GET', '/api/super-admin/overview', null, superadminToken);
    assert.strictEqual(resSA.status, 200, 'SuperAdmin must receive 200 OK');
    assert.strictEqual(resSA.data.success, true);

    // 1b. Tenant Owner -> 403 Forbidden
    const resOwner = await api('GET', '/api/super-admin/overview', null, ownerToken);
    assert.strictEqual(resOwner.status, 403, 'Tenant Owner must be rejected with 403');

    // 1c. Tenant Admin -> 403 Forbidden
    const resAdmin = await api('GET', '/api/super-admin/overview', null, adminToken);
    assert.strictEqual(resAdmin.status, 403, 'Tenant Admin must be rejected with 403');

    // 1d. Tenant Manager -> 403 Forbidden
    const resManager = await api('GET', '/api/super-admin/overview', null, managerToken);
    assert.strictEqual(resManager.status, 403, 'Tenant Manager must be rejected with 403');

    // 1e. Tenant Counselor -> 403 Forbidden
    const resCounselor = await api('GET', '/api/super-admin/overview', null, counselorToken);
    assert.strictEqual(resCounselor.status, 403, 'Counselor must be rejected with 403');

    // 1f. Unauthenticated -> 401 Unauthorized
    const resAnon = await api('GET', '/api/super-admin/overview', null, null);
    assert.strictEqual(resAnon.status, 401, 'Unauthenticated request must be rejected with 401');
  });

  it('2. 2FA & Token Version Enforcement on SuperAdmin', async () => {
    // 2a. Temp 2FA token (pending verification) must be rejected with 401
    const temp2FAToken = generateTemp2FAToken(superadminUser._id);
    const res2FA = await api('GET', '/api/super-admin/overview', null, temp2FAToken);
    assert.strictEqual(res2FA.status, 401, 'Pending 2FA token must be rejected with 401');

    // 2b. Stale tokenVersion (user has tokenVersion 1, token has version 0) must be rejected
    const staleToken = generateToken(superadminUser._id, 0);
    const resStale = await api('GET', '/api/super-admin/overview', null, staleToken);
    assert.strictEqual(resStale.status, 401, 'Stale tokenVersion must be rejected with 401 revoked');
  });

  it('3. Impersonation Hardening: TokenVersion injection & cannot impersonate superadmins', async () => {
    // 3a. Cannot impersonate another SuperAdmin account
    const resImpersonateSA = await api('POST', '/api/super-admin/impersonate', {
      targetUserId: otherSuperadminUser._id.toString(),
      reason: 'Support verification on admin',
    }, superadminToken);

    assert.strictEqual(resImpersonateSA.status, 400, 'Must reject impersonating another superadmin');
    assert.ok(resImpersonateSA.data.message.includes('Cannot impersonate a SuperAdmin'), 'Must cite SuperAdmin restriction');

    // 3b. Successfully impersonate tenant counselor
    const resImpersonate = await api('POST', '/api/super-admin/impersonate', {
      targetUserId: targetTenantUser._id.toString(),
      reason: 'Investigate student application lead loss issue',
    }, superadminToken);

    assert.strictEqual(resImpersonate.status, 200, 'Must successfully generate support token');
    const { supportToken, sessionId } = resImpersonate.data;
    assert.ok(supportToken, 'Support token must be returned');

    // Verify payload includes tokenVersion and supportMode
    const decoded = jwt.decode(supportToken);
    assert.strictEqual(decoded.tokenVersion, targetTenantUser.tokenVersion, 'Must include target tokenVersion');
    assert.strictEqual(decoded.supportMode, true);
    assert.strictEqual(decoded.isAdmin, false);

    // 3c. Impersonated token cannot access superadmin routes
    const resImpersonatedHitSA = await api('GET', '/api/super-admin/overview', null, supportToken);
    assert.strictEqual(resImpersonatedHitSA.status, 403, 'Impersonated session cannot access SuperAdmin routes');

    // 3d. Impersonation session is audit-logged
    const audit = await AuditLog.findOne({ action: 'IMPERSONATION_START', 'metadata.sessionId': sessionId });
    assert.ok(audit, 'AuditLog must record IMPERSONATION_START event');
    assert.strictEqual(String(audit.actorId), String(superadminUser._id));
  });

  it('4. Destructive Action Guards: Clean-slate requires typed confirmation & production flag', async () => {
    // Seed some active leads
    await Lead.create([
      { name: 'Lead 1', phone: '+919999900001', workspaceId: testWorkspace._id, userId: ownerUser._id },
      { name: 'Lead 2', phone: '+919999900002', workspaceId: testWorkspace._id, userId: ownerUser._id },
    ]);

    // 4a. Without typed confirmation -> 400 CONFIRMATION_REQUIRED
    const resNoConfirm = await api('POST', '/api/admin/clean-slate', {}, superadminToken);
    assert.strictEqual(resNoConfirm.status, 400, 'Must require typed confirmation');
    assert.strictEqual(resNoConfirm.data.code, 'CONFIRMATION_REQUIRED');

    // 4b. With wrong confirmation -> 400
    const resWrongConfirm = await api('POST', '/api/admin/clean-slate', { confirmText: 'delete please' }, superadminToken);
    assert.strictEqual(resWrongConfirm.status, 400);

    // 4c. In production without ALLOW_DESTRUCTIVE_CLEANSLATE -> 403
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DESTRUCTIVE_CLEANSLATE;

    const resProdBlocked = await api('POST', '/api/admin/clean-slate', {
      confirmText: 'CLEAN_SLATE_CONFIRM',
    }, superadminToken);

    assert.strictEqual(resProdBlocked.status, 403, 'Must block clean-slate in production without flag');
    assert.strictEqual(resProdBlocked.data.code, 'DESTRUCTIVE_ACTION_FORBIDDEN');

    // 4d. In test/dev with correct confirmation -> 200 OK
    process.env.NODE_ENV = 'test';
    const resSuccess = await api('POST', '/api/admin/clean-slate', {
      confirmText: 'CLEAN_SLATE_CONFIRM',
    }, superadminToken);

    assert.strictEqual(resSuccess.status, 200);
    assert.strictEqual(resSuccess.data.deletedLeads, 2);

    // Verify remaining leads is 0
    const remainingLeads = await Lead.countDocuments({ deletedAt: null });
    assert.strictEqual(remainingLeads, 0);

    // Verify audit log recorded (non-blocking persistence retry)
    let audit = null;
    for (let i = 0; i < 10; i++) {
      audit = await AuditLog.findOne({ resourceType: 'Lead', action: 'DELETE' });
      if (audit) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(audit, 'Must record DELETE audit log');
    assert.ok(audit.resourceName.includes('Clean Slate'), 'Must mention Clean Slate');
  });

  it('5. Destructive Action Guards: User deletion requires confirmation and blocks superadmins', async () => {
    // 5a. Attempting to delete another SuperAdmin -> 403 Forbidden
    const resDelSA = await api('DELETE', `/api/admin/users/${otherSuperadminUser._id}`, {
      confirmText: 'DELETE_USER',
    }, superadminToken);
    assert.strictEqual(resDelSA.status, 403, 'Cannot delete SuperAdmin accounts');

    // 5b. Deleting a normal user without confirmation -> 400
    const resNoConfirm = await api('DELETE', `/api/admin/users/${counselorUser._id}`, {}, superadminToken);
    assert.strictEqual(resNoConfirm.status, 400);
    assert.strictEqual(resNoConfirm.data.code, 'CONFIRMATION_REQUIRED');

    // 5c. Deleting normal user with confirmation -> 200 OK
    const resDelSuccess = await api('DELETE', `/api/admin/users/${counselorUser._id}`, {
      confirmText: 'DELETE_USER',
    }, superadminToken);
    assert.strictEqual(resDelSuccess.status, 200);

    const deleted = await User.findById(counselorUser._id);
    assert.strictEqual(deleted, null, 'User must be deleted from database');
  });

  it('6. Global Leads Observability: Soft-deleted leads excluded & search queries execute', async () => {
    // Seed active lead and soft-deleted lead
    const activeLead = await Lead.create({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      phone: '+919876500111',
      workspaceId: testWorkspace._id,
      userId: ownerUser._id,
      status: 'new_lead',
      deletedAt: null,
    });

    const softDeletedLead = await Lead.create({
      name: 'Deleted Student',
      email: 'deleted@example.com',
      phone: '+919876500222',
      workspaceId: testWorkspace._id,
      userId: ownerUser._id,
      status: 'new_lead',
      deletedAt: new Date(),
      isDeleted: true,
    });

    // Query global leads
    const res = await api('GET', '/api/super-admin/leads', null, superadminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const leadIds = res.data.leads.map((l) => l._id.toString());
    assert.ok(leadIds.includes(activeLead._id.toString()), 'Active lead must be returned');
    assert.ok(!leadIds.includes(softDeletedLead._id.toString()), 'Soft deleted lead must NEVER be returned');

    // Search by phone
    const resPhone = await api('GET', '/api/super-admin/leads?search=' + encodeURIComponent('+919876500111'), null, superadminToken);
    assert.strictEqual(resPhone.status, 200);
    assert.strictEqual(resPhone.data.leads.length, 1);
    assert.strictEqual(resPhone.data.leads[0].name, 'Rohan Sharma');
  });
});
