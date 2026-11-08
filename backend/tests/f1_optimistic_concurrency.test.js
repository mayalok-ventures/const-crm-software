const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let Lead;
let User;
let Workspace;

const leadsController = require('../src/controllers/leadsController');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  Lead = require('../src/models/Lead');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F1.4: Optimistic Concurrency Control (OCC) for Lead Saves', () => {
  it('rejects stale concurrent save with HTTP 409 when client version does not match __v', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'OCC Test WS', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Agent Alice',
      email: 'alice_occ@test.com',
      password: 'Password123!',
      role: 'admin',
      companyRole: 'owner',
      workspaceRole: 'owner',
      workspaceId: ws._id,
      companyId: ws._id,
      isActive: true,
    });

    const lead = await Lead.create({
      workspaceId: ws._id,
      companyId: ws._id,
      userId: user._id,
      assignedTo: user._id,
      name: 'Initial Lead Name',
      phone: '9777711111',
      phoneDigits: '9777711111',
      status: 'new',
    });

    assert.strictEqual(lead.__v, 0, 'Initial document version should be 0');

    // First user updates name with version: 0
    const req1 = {
      params: { id: lead._id.toString() },
      body: { name: 'Name Updated by User 1', version: 0 },
      user,
      workspaceId: ws._id,
    };
    const res1 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.updateLead(req1, res1);
    assert.strictEqual(res1.statusCode || 200, 200, 'User 1 update should succeed');

    // Check version in database
    const freshLead = await Lead.findById(lead._id);
    assert.strictEqual(freshLead.__v, 1, 'Version should increment to 1');

    // Second user (who loaded the form before User 1 saved) attempts to save with stale version: 0
    const req2 = {
      params: { id: lead._id.toString() },
      body: { name: 'Stale Overwrite by User 2', version: 0 },
      user,
      workspaceId: ws._id,
    };
    const res2 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.updateLead(req2, res2);

    // MUST reject with 409 Conflict
    assert.strictEqual(res2.statusCode, 409, 'Expected HTTP 409 Conflict on stale version');
    assert.strictEqual(res2.body.code, 'VERSION_CONFLICT');

    // User 2 refreshes and sends with version: 1 -> should succeed
    const req3 = {
      params: { id: lead._id.toString() },
      body: { name: 'Fresh Update by User 2', version: 1 },
      user,
      workspaceId: ws._id,
    };
    const res3 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.updateLead(req3, res3);
    assert.strictEqual(res3.statusCode || 200, 200, 'Update with current version should succeed');

    // Legacy caller without version field in body should succeed (backward compatibility)
    const reqLegacy = {
      params: { id: lead._id.toString() },
      body: { notes: [{ text: 'Legacy note' }] },
      user,
      workspaceId: ws._id,
    };
    const resLegacy = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.updateLead(reqLegacy, resLegacy);
    assert.strictEqual(resLegacy.statusCode || 200, 200, 'Legacy update without version must succeed');
  });
});
