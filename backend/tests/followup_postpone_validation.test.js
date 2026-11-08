const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Follow-Up Postpone Validation & Integrity (B5)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  const { updateLead } = require('../src/controllers/leadsController');

  const ws = await Workspace.create({ name: 'FollowUp WS', slug: 'followup-ws', ownerId: new mongoose.Types.ObjectId() });
  const user = await User.create({
    name: 'Agent Tester',
    email: 'agent@crm.local',
    password: 'Password123!',
    phone: '9876543233',
    role: 'admin',
  });
  user.workspaceId = ws._id;
  user.workspaceRole = 'owner';

  const baseDate = new Date('2026-11-10T10:00:00Z');
  const lead = await Lead.create({
    name: 'Student FollowUp',
    phone: '9877766655',
    workspaceId: ws._id,
    userId: user._id,
    targetDomain: 'Engineering (B.Tech/BE)',
    followUpDate: baseDate,
  });

  const mockRes = () => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.data = payload;
        return this;
      },
    };
    return res;
  };

  // 1. Invalid date string rejected with 400 INVALID_FOLLOWUP_DATE
  {
    const req = {
      params: { id: lead._id.toString() },
      body: { followUpDate: 'not-a-valid-date' },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await updateLead(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.code, 'INVALID_FOLLOWUP_DATE');
    console.log('✅ Step 1: Invalid date string rejected with 400 INVALID_FOLLOWUP_DATE.');
  }

  // 2. Postpone to future date without remark rejected with 400 POSTPONE_REMARK_REQUIRED
  {
    const req = {
      params: { id: lead._id.toString() },
      body: { followUpDate: '2026-11-15T10:00:00Z' },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await updateLead(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.code, 'POSTPONE_REMARK_REQUIRED');
    console.log('✅ Step 2: Postponing to future date without remark rejected with 400 POSTPONE_REMARK_REQUIRED.');
  }

  // 3. Postpone to future date WITH remark succeeds and logs note
  {
    const req = {
      params: { id: lead._id.toString() },
      body: {
        followUpDate: '2026-11-15T10:00:00Z',
        postponeRemark: 'Student asked to call back next week',
      },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await updateLead(req, res);
    assert.strictEqual(res.statusCode, 200);

    const updated = await Lead.findById(lead._id);
    assert.strictEqual(new Date(updated.followUpDate).toISOString(), new Date('2026-11-15T10:00:00Z').toISOString());
    const hasNote = updated.notes.some((n) => n.text.includes('Student asked to call back next week'));
    assert.ok(hasNote, 'Postpone note must be appended');
    console.log('✅ Step 3: Postpone with remark succeeds and saves postponement audit note.');
  }

  // 4. Moving date earlier does NOT require postpone remark
  {
    const req = {
      params: { id: lead._id.toString() },
      body: { followUpDate: '2026-11-12T10:00:00Z' },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await updateLead(req, res);
    assert.strictEqual(res.statusCode, 200);
    const updated = await Lead.findById(lead._id);
    assert.strictEqual(new Date(updated.followUpDate).toISOString(), new Date('2026-11-12T10:00:00Z').toISOString());
    console.log('✅ Step 4: Moving follow-up date earlier succeeds without postpone remark.');
  }

  // 5. Clearing follow-up date (null) succeeds without postpone remark
  {
    const req = {
      params: { id: lead._id.toString() },
      body: { followUpDate: null },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await updateLead(req, res);
    assert.strictEqual(res.statusCode, 200);
    const updated = await Lead.findById(lead._id);
    assert.strictEqual(updated.followUpDate, null);
    console.log('✅ Step 5: Clearing follow-up date succeeds without remark.');
  }

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL B5 FOLLOW-UP POSTPONE VALIDATION TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
