const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Assignment Service maxActiveLeads & Capacity Fallback (B1)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const User = require('../src/models/User');
  const Workspace = require('../src/models/Workspace');
  const Pipeline = require('../src/models/Pipeline');
  const assignmentService = require('../src/services/integrations/assignmentService');

  const ws = await Workspace.create({ name: 'Assignment WS', slug: 'assign-ws', ownerId: new mongoose.Types.ObjectId() });

  const counselorA = await User.create({
    name: 'Counselor Alpha',
    email: 'alpha@crm.local',
    password: 'Password123!',
    phone: '9876543301',
    role: 'counselor',
  });
  counselorA.workspaceId = ws._id;

  const counselorB = await User.create({
    name: 'Counselor Beta',
    email: 'beta@crm.local',
    password: 'Password123!',
    phone: '9876543302',
    role: 'counselor',
  });
  counselorB.workspaceId = ws._id;

  // Pipeline with open and terminal stages
  await Pipeline.create({
    name: 'Main Pipeline',
    workspaceId: ws._id,
    stages: [
      { stageId: 'open_1', name: 'Open Intake', category: 'open', order: 0 },
      { stageId: 'won_1', name: 'Admission Confirmed', category: 'won', order: 1 },
      { stageId: 'lost_1', name: 'Not Interested', category: 'lost', order: 2 },
    ],
  });

  const mockIntegration = {
    _id: new mongoose.Types.ObjectId(),
    workspaceId: ws._id,
    userId: ws.ownerId,
    assignmentRule: {
      type: 'round_robin',
      counselorPool: [
        { userId: counselorA._id, maxActiveLeads: 2, weight: 1 },
        { userId: counselorB._id, maxActiveLeads: 5, weight: 1 },
      ],
    },
  };

  // Seed 2 active leads for Counselor Alpha (reaches cap of 2)
  await Lead.create([
    {
      name: 'Lead 1 for A',
      phone: '9111100001',
      workspaceId: ws._id,
      userId: ws.ownerId,
      assignedTo: counselorA._id,
      status: 'open',
      pipelineStage: 'open_1',
      targetDomain: 'Engineering',
    },
    {
      name: 'Lead 2 for A',
      phone: '9111100002',
      workspaceId: ws._id,
      userId: ws.ownerId,
      assignedTo: counselorA._id,
      status: 'open',
      pipelineStage: 'open_1',
      targetDomain: 'Engineering',
    },
  ]);

  // 1. Resolve assignment -> Alpha is at cap (2/2), Beta has 0/5. Must assign to Beta!
  const res1 = await assignmentService.resolveAssignment({
    integration: mockIntegration,
  });
  assert.strictEqual(res1.assignedTo.toString(), counselorB._id.toString(), 'Should assign to Counselor Beta because Alpha is at cap');
  console.log('✅ Step 1: Counselor at maxActiveLeads cap correctly bypassed.');

  // Seed 5 active leads for Counselor Beta (reaches cap of 5)
  for (let i = 0; i < 5; i++) {
    await Lead.create({
      name: `Lead ${i} for B`,
      phone: `922220000${i}`,
      workspaceId: ws._id,
      userId: ws.ownerId,
      assignedTo: counselorB._id,
      status: 'open',
      pipelineStage: 'open_1',
      targetDomain: 'Engineering',
    });
  }

  // 2. Both Alpha (2/2) and Beta (5/5) at cap -> Fallback to least-loaded counselor (Alpha with 2 vs Beta with 5)
  const res2 = await assignmentService.resolveAssignment({
    integration: mockIntegration,
  });
  assert.strictEqual(res2.assignedTo.toString(), counselorA._id.toString(), 'Must fallback to least-loaded counselor (Alpha: 2 active)');
  assert.ok(res2.assignmentReason.includes('Capacity Overflow Fallback'), 'Reason must indicate capacity overflow fallback');
  console.log('✅ Step 2: Capacity overflow fallback safely selected least-loaded counselor.');

  // 3. Mark one of Alpha\'s leads as terminal (won) and one as soft-deleted -> Alpha count drops to 0 active
  const alphaLeads = await Lead.find({ assignedTo: counselorA._id });
  alphaLeads[0].status = 'won';
  alphaLeads[0].pipelineStage = 'won_1';
  await alphaLeads[0].save();

  alphaLeads[1].deletedAt = new Date();
  await alphaLeads[1].save();

  // Alpha now has 0 active leads. Beta is still at 5/5. Must assign to Alpha normally!
  const res3 = await assignmentService.resolveAssignment({
    integration: mockIntegration,
  });
  assert.strictEqual(res3.assignedTo.toString(), counselorA._id.toString(), 'Should assign to Alpha whose active count dropped below cap');
  console.log('✅ Step 3: Terminal and soft-deleted leads excluded from active count; counselor became available again.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL B1 ASSIGNMENT MAX ACTIVE LEADS TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
