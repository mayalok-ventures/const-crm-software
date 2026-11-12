/**
 * Stage 1a Reproduction & Verification: Privilege Escalation & Cross-Tenant User Modification
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'stage1a_test_jwt_secret_2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const { generateToken } = require('../src/middleware/auth');
const adminRoutes = require('../src/routes/admin');

describe('Stage 1a: Privilege Escalation & Cross-Tenant Agent Modification', function () {
  this.timeout(45000);
  let mongoServer;
  let server;
  let baseUrl;

  let ownerA, adminA, agentA, superAdmin;
  let ownerB, agentB;
  let tokenAdminA;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const app = express();
    app.use(express.json());

    // Resolve workspace mock middleware
    app.use((req, res, next) => {
      req.workspaceId = req.headers['x-workspace-id'] || null;
      next();
    });

    app.use('/api/admin', adminRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Seed SuperAdmin
    superAdmin = await User.create({
      name: 'Platform SuperAdmin',
      email: 'super@crm.com',
      password: 'Password@123',
      role: 'superadmin',
      isAdmin: true,
      userStatus: 'active',
    });

    // Seed Tenant A (Owner, Admin, Agent)
    const companyAId = new mongoose.Types.ObjectId();
    ownerA = await User.create({
      _id: companyAId,
      name: 'Owner A',
      email: 'ownerA@orgA.com',
      password: 'Password@123',
      role: 'owner',
      companyRole: 'owner',
      companyId: companyAId,
      isAdmin: false,
      userStatus: 'active',
    });

    adminA = await User.create({
      name: 'Admin A',
      email: 'adminA@orgA.com',
      password: 'Password@123',
      role: 'admin',
      companyRole: 'manager',
      companyId: companyAId,
      isAdmin: false,
      userStatus: 'active',
    });

    agentA = await User.create({
      name: 'Agent A',
      email: 'agentA@orgA.com',
      password: 'Password@123',
      role: 'agent',
      companyRole: 'agent',
      companyId: companyAId,
      isAdmin: false,
      userStatus: 'active',
    });

    // Seed Tenant B (Owner, Agent)
    const companyBId = new mongoose.Types.ObjectId();
    ownerB = await User.create({
      _id: companyBId,
      name: 'Owner B',
      email: 'ownerB@orgB.com',
      password: 'Password@123',
      role: 'owner',
      companyRole: 'owner',
      companyId: companyBId,
      isAdmin: false,
      userStatus: 'active',
    });

    agentB = await User.create({
      name: 'Agent B',
      email: 'agentB@orgB.com',
      password: 'Password@123',
      role: 'agent',
      companyRole: 'agent',
      companyId: companyBId,
      isAdmin: false,
      userStatus: 'active',
    });

    tokenAdminA = generateToken(adminA._id, adminA.tokenVersion || 0);
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  async function apiPatch(path, body, token) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  it('1. Privilege Escalation: Tenant Admin cannot set isAdmin=true via agent update', async () => {
    const res = await apiPatch(`/api/admin/agents/${agentA._id}`, { isAdmin: true }, tokenAdminA);
    const updatedAgent = await User.findById(agentA._id).lean();
    assert.strictEqual(updatedAgent.isAdmin, false, 'VULNERABILITY: agent isAdmin was escalated to true!');
  });

  it('2. Role Escalation: Tenant Admin cannot escalate role to superadmin', async () => {
    const res = await apiPatch(`/api/admin/agents/${agentA._id}`, { role: 'superadmin' }, tokenAdminA);
    const updatedAgent = await User.findById(agentA._id).lean();
    assert.notStrictEqual(updatedAgent.role, 'superadmin', 'VULNERABILITY: agent role was escalated to superadmin!');
  });

  it('3. Cross-Tenant Protection: Tenant Admin cannot mutate agent in another workspace', async () => {
    const res = await apiPatch(`/api/admin/agents/${agentB._id}`, { name: 'Hacked Agent B' }, tokenAdminA);
    assert.ok(res.status === 403 || res.status === 404, `Expected 403/404 for cross-tenant edit, got ${res.status}`);
    const agentBPost = await User.findById(agentB._id).lean();
    assert.strictEqual(agentBPost.name, 'Agent B', 'VULNERABILITY: cross-tenant agent was mutated!');
  });

  it('4. Hierarchy Protection: Tenant Admin cannot edit organization owner or superadmin', async () => {
    const resOwner = await apiPatch(`/api/admin/agents/${ownerA._id}`, { name: 'Demoted Owner' }, tokenAdminA);
    assert.ok(resOwner.status === 403 || resOwner.status === 404, `Expected 403 for editing owner, got ${resOwner.status}`);

    const resSuper = await apiPatch(`/api/admin/agents/${superAdmin._id}`, { name: 'Hacked SuperAdmin' }, tokenAdminA);
    assert.ok(resSuper.status === 403 || resSuper.status === 404, `Expected 403 for editing superadmin, got ${resSuper.status}`);
  });
});
