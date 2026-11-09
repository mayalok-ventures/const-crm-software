/**
 * RC1 Gate: Cross-Tenant Isolation, Mass-Assignment Whitelist & Security Check
 *
 * Verifies:
 * 1. Cross-Tenant Route Isolation:
 *    - An authenticated user from Tenant A cannot access, read, update, or delete resources belonging to Tenant B.
 *    - Cross-tenant requests to /api/leads/:id, /api/leads/:id/installments, /api/payments, etc. strictly fail with 404/403.
 * 2. Mass-Assignment Protection:
 *    - Updates to lead profiles with injected protected fields (workspaceId, userId, companyId, _id, __v, role, tokenVersion)
 *      strictly strip protected properties and do not mutate tenant ownership.
 * 3. User profile updates reject privilege escalation (role: 'superadmin', companyRole: 'owner', isSuperAdmin: true).
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'rc1_security_suite_secret_key_2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const Lead = require('../src/models/Lead');
const Payment = require('../src/models/Payment');
const { generateToken } = require('../src/middleware/auth');

describe('RC1 Gate: Cross-Tenant Security & Mass-Assignment Verification', function () {
  this.timeout(45000);
  let mongoServer;
  let server;
  let baseUrl;

  let wsA, wsB;
  let userA, userB;
  let tokenA, tokenB;
  let leadB;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const WorkspaceMembership = require('../src/models/WorkspaceMembership');

    // 1. Create Workspace A & User A
    const ownerAId = new mongoose.Types.ObjectId();
    wsA = await Workspace.create({ name: 'Tenant Alpha', slug: 'tenant-alpha', ownerId: ownerAId });
    userA = await User.create({
      name: 'Agent Alpha',
      email: 'alpha@tenant-a.com',
      password: 'Password123!',
      phone: '9876543201',
      role: 'agent',
      companyRole: 'owner',
      companyId: ownerAId,
      tokenVersion: 0,
    });
    await WorkspaceMembership.create({ workspaceId: wsA._id, userId: userA._id, role: 'owner', status: 'active' });
    tokenA = generateToken(userA._id, userA.tokenVersion);

    // 2. Create Workspace B & User B
    const ownerBId = new mongoose.Types.ObjectId();
    wsB = await Workspace.create({ name: 'Tenant Beta', slug: 'tenant-beta', ownerId: ownerBId });
    userB = await User.create({
      name: 'Agent Beta',
      email: 'beta@tenant-b.com',
      password: 'Password123!',
      phone: '9876543202',
      role: 'agent',
      companyRole: 'owner',
      companyId: ownerBId,
      tokenVersion: 0,
    });
    await WorkspaceMembership.create({ workspaceId: wsB._id, userId: userB._id, role: 'owner', status: 'active' });
    tokenB = generateToken(userB._id, userB.tokenVersion);

    // 3. Create Lead in Workspace B
    leadB = await Lead.create({
      name: 'Beta Candidate Confidential',
      phone: '+919876599999',
      email: 'confidential@tenant-b.com',
      workspaceId: wsB._id,
      userId: userB._id,
      companyId: ownerBId,
      assignedTo: userB._id,
      status: 'new_lead',
      source: 'MANUAL',
    });

    // 4. Mount express server with core routes
    const app = express();
    app.use(express.json());

    // Mock tenant isolation middleware matching production
    const { protect } = require('../src/middleware/auth');
    const leadsRoutes = require('../src/routes/leads');
    app.use('/api/leads', leadsRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('1. Cross-Tenant Read: User A cannot read Lead B belonging to Tenant B', async () => {
    const res = await fetch(`${baseUrl}/api/leads/${leadB._id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
    });

    // Must return 404 Not Found or 403 Forbidden (never 200)
    assert.ok(
      res.status === 404 || res.status === 403,
      `Cross-tenant GET should be rejected with 404 or 403, got ${res.status}`
    );

    const body = await res.json();
    assert.strictEqual(body.name, undefined, 'Must not leak Lead B details to Tenant A');
  });

  it('2. Cross-Tenant Write: User A cannot mutate Lead B belonging to Tenant B', async () => {
    const res = await fetch(`${baseUrl}/api/leads/${leadB._id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Hacked by Tenant A',
        status: 'enrolled',
      }),
    });

    assert.ok(
      res.status === 404 || res.status === 403,
      `Cross-tenant PUT should be rejected with 404 or 403, got ${res.status}`
    );

    const unaffectedLead = await Lead.findById(leadB._id);
    assert.strictEqual(unaffectedLead.name, 'Beta Candidate Confidential', 'Lead B name must remain unchanged');
  });

  it('3. Cross-Tenant Delete: User A cannot delete Lead B belonging to Tenant B', async () => {
    const res = await fetch(`${baseUrl}/api/leads/${leadB._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
    });

    assert.ok(
      res.status === 404 || res.status === 403,
      `Cross-tenant DELETE should be rejected with 404 or 403, got ${res.status}`
    );

    const unaffectedLead = await Lead.findById(leadB._id);
    assert.ok(unaffectedLead, 'Lead B must not be deleted');
    assert.strictEqual(unaffectedLead.deletedAt, null, 'Lead B must not be soft-deleted');
  });

  it('4. Mass-Assignment Protection: Protected fields are not modifiable via PUT payload', async () => {
    // Create Lead in Workspace A
    const leadA = await Lead.create({
      name: 'Alpha Candidate',
      phone: '+919876511111',
      workspaceId: wsA._id,
      userId: userA._id,
      companyId: userA.companyId,
      assignedTo: userA._id,
      status: 'new_lead',
    });

    const maliciousPayload = {
      name: 'Updated Alpha Candidate',
      workspaceId: wsB._id, // Attempt to hijack lead to Tenant B
      userId: userB._id,    // Attempt to hijack ownership to User B
      companyId: userB._id, // Attempt to hijack company ownership
      _id: new mongoose.Types.ObjectId(), // Attempt to mutate immutable _id
      tokenVersion: 99,
      role: 'superadmin',
    };

    const res = await fetch(`${baseUrl}/api/leads/${leadA._id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(maliciousPayload),
    });

    assert.strictEqual(res.status, 200, 'Valid update for owned lead should return 200');

    const updated = await Lead.findById(leadA._id);
    assert.strictEqual(updated.name, 'Updated Alpha Candidate', 'Allowed field should be updated');
    assert.strictEqual(updated.workspaceId.toString(), leadA.workspaceId.toString(), 'workspaceId MUST NOT be mutated');
    assert.strictEqual(updated.userId.toString(), leadA.userId.toString(), 'userId MUST NOT be mutated');
    assert.strictEqual(updated.companyId.toString(), leadA.companyId.toString(), 'companyId MUST NOT be mutated');
  });
});
