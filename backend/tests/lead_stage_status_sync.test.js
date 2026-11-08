const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Lead Stage & Status Synchronization Integrity (B6)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const Pipeline = require('../src/models/Pipeline');
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  const { updateLead } = require('../src/controllers/leadsController');
  const { reportAndFixStageStatusDrift } = require('../src/scripts/reportAndFixStageStatusDrift');

  const ws = await Workspace.create({ name: 'Sync WS', slug: 'sync-ws', ownerId: new mongoose.Types.ObjectId() });
  const user = await User.create({
    name: 'Sync Admin',
    email: 'syncadmin@crm.local',
    password: 'Password123!',
    phone: '9876543120',
    role: 'admin',
  });
  user.workspaceId = ws._id;
  user.workspaceRole = 'owner';

  const pipeline = await Pipeline.create({
    name: 'Engineering Admissions',
    workspaceId: ws._id,
    createdBy: user._id,
    stages: [
      { stageId: 'stage_173001', name: 'Lead Intake', category: 'open', order: 0 },
      { stageId: 'stage_173002', name: 'Campus Visit', category: 'open', order: 1 },
      { stageId: 'stage_173003', name: 'Admission Confirmed', category: 'won', order: 2 },
      { stageId: 'stage_173004', name: 'Declined Offer', category: 'lost', order: 3 },
    ],
  });

  const lead = await Lead.create({
    name: 'Sync Student',
    phone: '9888811112',
    workspaceId: ws._id,
    userId: user._id,
    pipelineId: pipeline._id,
    pipelineStage: 'stage_173001',
    status: 'new_lead',
    targetDomain: 'Engineering',
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

  // 1. Kanban drag-and-drop: sending pipelineStage='stage_173003' (won category)
  // Must update status to 'won', NOT 'stage_173003'
  {
    const req = {
      params: { id: lead._id.toString() },
      body: { pipelineStage: 'stage_173003' },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await updateLead(req, res);
    assert.strictEqual(res.statusCode, 200);

    const updated = await Lead.findById(lead._id);
    assert.strictEqual(updated.pipelineStage, 'stage_173003');
    assert.strictEqual(updated.status, 'won', 'status must be canonical "won", not raw stage ID');
    console.log('✅ Step 1: Kanban stage update correctly synchronized canonical status="won".');
  }

  // 2. Direct status change to 'lost' with lostReason
  // Must automatically map pipelineStage to the lost stage 'stage_173004'
  {
    const req = {
      params: { id: lead._id.toString() },
      body: {
        status: 'lost',
        lostReason: 'Budget Exceeded',
      },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await updateLead(req, res);
    assert.strictEqual(res.statusCode, 200);

    const updated = await Lead.findById(lead._id);
    assert.strictEqual(updated.status, 'lost');
    assert.strictEqual(updated.pipelineStage, 'stage_173004', 'pipelineStage must map to pipeline lost stage');
    console.log('✅ Step 2: Direct status change to "lost" synchronized pipelineStage="stage_173004".');
  }

  // 3. Test reportAndFixStageStatusDrift script
  {
    const corrupted = await Lead.create({
      name: 'Drifted Lead',
      phone: '9888811119',
      workspaceId: ws._id,
      userId: user._id,
      pipelineId: pipeline._id,
      pipelineStage: 'stage_173003',
      status: 'stage_173003', // Corrupted raw stage ID
      targetDomain: 'Engineering',
    });

    // Dry run
    const dryRun = await reportAndFixStageStatusDrift({ apply: false });
    assert.ok(dryRun.drifted >= 1);
    const untouched = await Lead.findById(corrupted._id);
    assert.strictEqual(untouched.status, 'stage_173003');

    // Apply
    const applied = await reportAndFixStageStatusDrift({ apply: true });
    assert.ok(applied.drifted >= 1);
    const fixed = await Lead.findById(corrupted._id);
    assert.strictEqual(fixed.status, 'won', 'Corrupted status must be healed to canonical status');
    console.log('✅ Step 3: reportAndFixStageStatusDrift healed drifted status.');
  }

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL B6 LEAD STAGE & STATUS SYNC TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
