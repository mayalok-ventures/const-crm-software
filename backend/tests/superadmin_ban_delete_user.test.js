const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Lead = require('../src/models/Lead');
const superAdminRoutes = require('../src/superadmin/routes/superAdminRoutes');
const authRoutes = require('../src/routes/auth');

describe('Super Admin Ban, Delete User & Remove Account Actions Test Suite', function () {
  this.timeout(20000);

  let server;
  let baseUrl;
  let superAdminToken;
  let superAdminUser;
  let testWorkspace;
  let testUser;
  let testLead;

  before(async function () {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const app = express();
    app.use(express.json());
    app.use('/api/super-admin', superAdminRoutes);
    app.use('/api/auth', authRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Get or create Super Admin
    superAdminUser = await User.findOne({ role: 'superadmin' });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        name: 'Test SuperAdmin',
        email: 'superadmin_test_actions@sahyak.com',
        password: 'Password123!',
        role: 'superadmin',
        isAdmin: true,
        isActive: true,
      });
    }

    superAdminToken = jwt.sign(
      { id: superAdminUser._id, tokenVersion: superAdminUser.tokenVersion || 0, role: 'superadmin' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );

    // 2. Create test workspace
    testWorkspace = await Workspace.create({
      name: 'Test Action Workspace Corp',
      ownerId: superAdminUser._id,
      status: 'active',
      plan: 'team_starter',
    });

    // 3. Create test user
    testUser = await User.create({
      name: 'Test Agent To Ban',
      email: `test_agent_${Date.now()}@testcorp.com`,
      password: 'Password123!',
      role: 'counsellor',
      isActive: true,
      userStatus: 'active',
      companyId: testWorkspace._id,
      workspaceId: testWorkspace._id,
      currentWorkspace: testWorkspace._id,
    });

    // 4. Create membership
    await WorkspaceMembership.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      role: 'counsellor',
      status: 'active',
    });

    // 5. Create test lead assigned to testUser
    testLead = await Lead.create({
      userId: superAdminUser._id,
      name: 'Assigned Lead Candidate',
      phone: '9876543210',
      email: 'candidate@testcorp.com',
      workspaceId: testWorkspace._id,
      assignedTo: testUser._id,
      assignedToName: testUser.name,
      status: 'new_lead',
    });
  });

  after(async function () {
    if (testWorkspace?._id) {
      await Workspace.findByIdAndDelete(testWorkspace._id);
      await WorkspaceMembership.deleteMany({ workspaceId: testWorkspace._id });
    }
    if (testUser?._id) {
      await User.findByIdAndDelete(testUser._id);
    }
    if (testLead?._id) {
      await Lead.findByIdAndDelete(testLead._id);
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. POST /api/super-admin/users/:id/ban - bans user and revokes their active access', async function () {
    const res = await fetch(`${baseUrl}/api/super-admin/users/${testUser._id}/ban`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Security terms violation' }),
    });

    const data = await res.json();
    if (res.status !== 200) console.error('TEST 1 ERROR:', data);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.isActive, false);
    assert.strictEqual(data.user.userStatus, 'banned');
    assert.strictEqual(data.user.suspension.isSuspended, true);

    // Verify user in database has updated tokenVersion and suspension
    const updatedUser = await User.findById(testUser._id);
    assert.strictEqual(updatedUser.isActive, false);
    assert.strictEqual(updatedUser.userStatus, 'banned');
    assert.strictEqual(updatedUser.suspension.isSuspended, true);
    assert.strictEqual(updatedUser.suspension.reason, 'Security terms violation');
    assert.strictEqual(updatedUser.tokenVersion, 1);
  });

  it('2. POST /api/auth/login - banned user cannot log in and receives 403', async function () {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'Password123!',
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, 'ACCOUNT_SUSPENDED');
  });

  it('3. POST /api/super-admin/users/:id/unban - unbans user and restores access', async function () {
    const res = await fetch(`${baseUrl}/api/super-admin/users/${testUser._id}/unban`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (res.status !== 200) console.error('TEST 1 ERROR:', data);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.isActive, true);
    assert.strictEqual(data.user.userStatus, 'active');
    assert.strictEqual(data.user.suspension.isSuspended, false);

    // Verify user in database is active
    const updatedUser = await User.findById(testUser._id);
    assert.strictEqual(updatedUser.isActive, true);
    assert.strictEqual(updatedUser.suspension.isSuspended, false);
  });

  it('4. DELETE /api/super-admin/organisations/:orgId/users/:userId - removes user from organisation and unassigns leads', async function () {
    const res = await fetch(`${baseUrl}/api/super-admin/organisations/${testWorkspace._id}/users/${testUser._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const data = await res.json();
    if (res.status !== 200) console.error('TEST 1 ERROR:', data);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    // Verify membership was deleted
    const membership = await WorkspaceMembership.findOne({ workspaceId: testWorkspace._id, userId: testUser._id });
    assert.strictEqual(membership, null);

    // Verify lead was unassigned to protect data
    const lead = await Lead.findById(testLead._id);
    assert.strictEqual(lead.assignedTo, null);
    assert.strictEqual(lead.assignedToName, 'Unassigned');
  });

  it('5. DELETE /api/super-admin/users/:id - prevents deleting superadmin account', async function () {
    const res = await fetch(`${baseUrl}/api/super-admin/users/${superAdminUser._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assert.strictEqual(res.status, 400);
  });

  it('6. DELETE /api/super-admin/users/:id - permanently deletes user account', async function () {
    const res = await fetch(`${baseUrl}/api/super-admin/users/${testUser._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const data = await res.json();
    if (res.status !== 200) console.error('TEST 1 ERROR:', data);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    const check = await User.findById(testUser._id);
    assert.strictEqual(check, null);
  });

  it('7. DELETE /api/super-admin/organisations/:id - permanently deletes organisation account', async function () {
    // Create separate org to delete
    const orgToDelete = await Workspace.create({
      name: 'Temporary Workspace To Delete',
      ownerId: new mongoose.Types.ObjectId(),
      status: 'active',
    });

    const res = await fetch(`${baseUrl}/api/super-admin/organisations/${orgToDelete._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const data = await res.json();
    if (res.status !== 200) console.error('TEST 1 ERROR:', data);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    const check = await Workspace.findById(orgToDelete._id);
    assert.strictEqual(check, null);
  });
});
