const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Deals Counselor Search & Role Scoping Integrity (B4)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const AdmissionDeal = require('../src/models/AdmissionDeal');
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  const { getDeals } = require('../src/controllers/dealController');

  const ws = await Workspace.create({ name: 'Deals WS', slug: 'deals-ws', ownerId: new mongoose.Types.ObjectId() });

  const owner = await User.create({
    name: 'Owner User',
    email: 'owner@crm.local',
    password: 'Password123!',
    phone: '9876543110',
    role: 'admin',
  });
  owner.workspaceId = ws._id;
  owner.workspaceRole = 'owner';

  const counselorA = await User.create({
    name: 'Counselor A',
    email: 'counselorA@crm.local',
    password: 'Password123!',
    phone: '9876543111',
    role: 'counselor',
  });
  counselorA.workspaceId = ws._id;
  counselorA.workspaceRole = 'counselor';

  const counselorB = await User.create({
    name: 'Counselor B',
    email: 'counselorB@crm.local',
    password: 'Password123!',
    phone: '9876543112',
    role: 'counselor',
  });
  counselorB.workspaceId = ws._id;
  counselorB.workspaceRole = 'counselor';

  // Seed deals
  const deal1 = await AdmissionDeal.create({
    workspaceId: ws._id,
    leadId: new mongoose.Types.ObjectId(),
    studentName: 'Rohan Sharma',
    studentPhone: '9111111111',
    collegeName: 'Oxford College',
    courseName: 'Computer Science',
    assignedTo: counselorA._id,
    createdBy: counselorA._id,
  });

  const deal2 = await AdmissionDeal.create({
    workspaceId: ws._id,
    leadId: new mongoose.Types.ObjectId(),
    studentName: 'Priya Singh',
    studentPhone: '9222222222',
    collegeName: 'Cambridge Institute',
    courseName: 'Information Tech',
    assignedTo: counselorA._id,
    createdBy: counselorA._id,
  });

  const deal3 = await AdmissionDeal.create({
    workspaceId: ws._id,
    leadId: new mongoose.Types.ObjectId(),
    studentName: 'Rohan Verma',
    studentPhone: '9333333333',
    collegeName: 'Harvard University',
    courseName: 'Data Science',
    assignedTo: counselorB._id,
    createdBy: counselorB._id,
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

  // 1. Counselor A with no search -> sees Deal 1 and Deal 2, not Deal 3
  {
    const req = {
      workspaceId: ws._id,
      query: {},
      user: counselorA,
      membership: { role: 'counselor' },
    };
    const res = mockRes();
    await getDeals(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.pagination.total, 2);
    const ids = res.data.data.map((d) => d._id.toString());
    assert.ok(ids.includes(deal1._id.toString()));
    assert.ok(ids.includes(deal2._id.toString()));
    assert.ok(!ids.includes(deal3._id.toString()));
    console.log('✅ Step 1: Counselor A sees only their own deals when unscoped.');
  }

  // 2. Counselor A searches 'Rohan' -> sees ONLY Deal 1 (not Deal 2, and not Counselor B's Deal 3)
  {
    const req = {
      workspaceId: ws._id,
      query: { search: 'Rohan' },
      user: counselorA,
      membership: { role: 'counselor' },
    };
    const res = mockRes();
    await getDeals(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.pagination.total, 1);
    assert.strictEqual(res.data.data[0]._id.toString(), deal1._id.toString());
    console.log('✅ Step 2: Counselor A search combines search query AND counselor role isolation with $and.');
  }

  // 3. Owner searches 'Rohan' -> sees both Deal 1 and Deal 3 across all counselors
  {
    const req = {
      workspaceId: ws._id,
      query: { search: 'Rohan' },
      user: owner,
      membership: { role: 'owner' },
    };
    const res = mockRes();
    await getDeals(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.pagination.total, 2);
    const ids = res.data.data.map((d) => d._id.toString());
    assert.ok(ids.includes(deal1._id.toString()));
    assert.ok(ids.includes(deal3._id.toString()));
    console.log('✅ Step 3: Owner search returns all matching deals in workspace.');
  }

  // 4. Regex special characters in search do not crash
  {
    const req = {
      workspaceId: ws._id,
      query: { search: 'Rohan (Tech)+' },
      user: counselorA,
      membership: { role: 'counselor' },
    };
    const res = mockRes();
    await getDeals(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.pagination.total, 0);
    console.log('✅ Step 4: Special characters escaped cleanly, no regex error.');
  }

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL B4 DEALS COUNSELOR SEARCH INTEGRITY TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
