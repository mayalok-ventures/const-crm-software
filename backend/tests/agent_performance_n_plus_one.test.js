const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Agent Performance Single Aggregation Optimization (P1)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const { getAgentsPerformance } = require('../src/controllers/adminController');

  const ws = await Workspace.create({ name: 'Perf WS', slug: 'perf-ws', ownerId: new mongoose.Types.ObjectId() });

  const adminUser = await User.create({
    name: 'Admin Boss',
    email: 'boss@crm.local',
    password: 'Password123!',
    phone: '9876543400',
    role: 'admin',
    companyRole: 'owner',
  });
  adminUser.workspaceId = ws._id;

  const agent1 = await User.create({
    name: 'Agent One',
    email: 'agent1@crm.local',
    password: 'Password123!',
    phone: '9876543401',
    role: 'agent',
    companyRole: 'agent',
    incentive_pct: 10,
    companyId: adminUser._id,
  });
  agent1.workspaceId = ws._id;

  const agent2 = await User.create({
    name: 'Agent Two',
    email: 'agent2@crm.local',
    password: 'Password123!',
    phone: '9876543402',
    role: 'agent',
    companyRole: 'agent',
    incentive_pct: 15,
    companyId: adminUser._id,
  });
  agent2.workspaceId = ws._id;

  const agent3 = await User.create({
    name: 'Agent Three',
    email: 'agent3@crm.local',
    password: 'Password123!',
    phone: '9876543403',
    role: 'agent',
    companyRole: 'agent',
    companyId: adminUser._id,
  });
  agent3.workspaceId = ws._id;

  // Seed leads for Agent 1: 5 active (2 converted with 10k each), 1 soft-deleted (converted with 50k - must NOT count)
  await Lead.create([
    { name: 'Lead 1', phone: '9000000001', userId: adminUser._id, assignedTo: agent1._id, status: 'converted', paid_amount: 10000, targetDomain: 'Engineering' },
    { name: 'Lead 2', phone: '9000000002', userId: adminUser._id, assignedTo: agent1._id, status: 'converted', paid_amount: 10000, targetDomain: 'Engineering' },
    { name: 'Lead 3', phone: '9000000003', userId: adminUser._id, assignedTo: agent1._id, status: 'open', paid_amount: 0, targetDomain: 'Engineering' },
    { name: 'Lead 4', phone: '9000000004', userId: adminUser._id, assignedTo: agent1._id, status: 'open', paid_amount: 0, targetDomain: 'Engineering' },
    { name: 'Lead 5', phone: '9000000005', userId: adminUser._id, assignedTo: agent1._id, status: 'open', paid_amount: 0, targetDomain: 'Engineering' },
    { name: 'Lead Del', phone: '9000000006', userId: adminUser._id, assignedTo: agent1._id, status: 'converted', paid_amount: 50000, deletedAt: new Date(), targetDomain: 'Engineering' },
  ]);

  // Seed leads for Agent 2: 3 active (1 converted with 50k)
  await Lead.create([
    { name: 'Lead 6', phone: '9000000007', userId: adminUser._id, assignedTo: agent2._id, status: 'converted', paid_amount: 50000, targetDomain: 'Engineering' },
    { name: 'Lead 7', phone: '9000000008', userId: adminUser._id, assignedTo: agent2._id, status: 'open', paid_amount: 0, targetDomain: 'Engineering' },
    { name: 'Lead 8', phone: '9000000009', userId: adminUser._id, assignedTo: agent2._id, status: 'open', paid_amount: 0, targetDomain: 'Engineering' },
  ]);

  // Agent 3 has 0 leads

  const mockRes = () => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    return res;
  };

  const req = {
    user: adminUser,
  };
  const res = mockRes();

  await getAgentsPerformance(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.data.success);
  assert.strictEqual(res.data.performance.length, 3);

  const p1 = res.data.performance.find((p) => p.email === 'agent1@crm.local');
  assert.strictEqual(p1.totalLeads, 5, 'Agent 1 must have 5 active leads (deleted excluded)');
  assert.strictEqual(p1.convertedLeads, 2);
  assert.strictEqual(p1.salesRevenue, 20000);
  assert.strictEqual(p1.conversionRate, '40.0%');
  assert.strictEqual(p1.totalIncentives, 2000); // 10% of 20000

  const p2 = res.data.performance.find((p) => p.email === 'agent2@crm.local');
  assert.strictEqual(p2.totalLeads, 3);
  assert.strictEqual(p2.convertedLeads, 1);
  assert.strictEqual(p2.salesRevenue, 50000);
  assert.strictEqual(p2.conversionRate, '33.3%');
  assert.strictEqual(p2.totalIncentives, 5000); // 10% default of 50000

  const p3 = res.data.performance.find((p) => p.email === 'agent3@crm.local');
  assert.strictEqual(p3.totalLeads, 0);
  assert.strictEqual(p3.convertedLeads, 0);
  assert.strictEqual(p3.salesRevenue, 0);
  assert.strictEqual(p3.conversionRate, '0%');
  assert.strictEqual(p3.totalIncentives, 0);

  console.log('✅ Single aggregation returned exact agent metrics without N+1 queries.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL P1 AGENT PERFORMANCE OPTIMIZATION TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
