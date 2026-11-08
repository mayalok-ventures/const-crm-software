const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Pipeline Delete & Remap Status Integrity (B2)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const Pipeline = require('../src/models/Pipeline');
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  const { deletePipeline, remapStageLeads } = require('../src/controllers/pipelineController');
  const { repairCorruptedLeadStatuses } = require('../src/scripts/repairCorruptedLeadStatuses');

  const ws = await Workspace.create({ name: 'Pipeline WS', slug: 'pipeline-ws', ownerId: new mongoose.Types.ObjectId() });
  const user = await User.create({
    name: 'Admin User',
    email: 'admin@crm.local',
    password: 'Password123!',
    phone: '9876543119',
    role: 'admin',
  });
  user.workspaceId = ws._id;
  user.workspaceRole = 'owner';

  // Custom Pipeline 1
  const pipeline1 = await Pipeline.create({
    name: 'Study Abroad Pipeline',
    workspaceId: ws._id,
    createdBy: user._id,
    stages: [
      { stageId: 'stage_open_1', name: 'Application Submitted', category: 'open', order: 0 },
      { stageId: 'stage_won_2', name: 'Visa Approved', category: 'won', order: 1 },
      { stageId: 'stage_lost_3', name: 'Visa Rejected', category: 'lost', order: 2 },
    ],
  });

  // Target Pipeline 2
  const targetPipeline = await Pipeline.create({
    name: 'Domestic Admissions',
    workspaceId: ws._id,
    createdBy: user._id,
    stages: [
      { stageId: 'stage_target_open', name: 'Inquiry', category: 'open', order: 0 },
      { stageId: 'stage_target_won', name: 'Enrolled', category: 'won', order: 1 },
      { stageId: 'stage_target_lost', name: 'Dropped', category: 'lost', order: 2 },
    ],
  });

  // Seed leads in pipeline 1
  const leadOpen = await Lead.create({
    name: 'Student Open',
    phone: '9100000001',
    workspaceId: ws._id,
    userId: user._id,
    pipelineId: pipeline1._id,
    pipelineStage: 'stage_open_1',
    status: 'new_lead',
    targetDomain: 'Engineering',
  });

  const leadWon = await Lead.create({
    name: 'Student Won',
    phone: '9100000002',
    workspaceId: ws._id,
    userId: user._id,
    pipelineId: pipeline1._id,
    pipelineStage: 'stage_won_2',
    status: 'won',
    targetDomain: 'Engineering',
  });

  const leadLost = await Lead.create({
    name: 'Student Lost',
    phone: '9100000003',
    workspaceId: ws._id,
    userId: user._id,
    pipelineId: pipeline1._id,
    pipelineStage: 'stage_lost_3',
    status: 'lost',
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

  // 1. Remap Stage Leads: remapping to a won stage must set status='won', NOT the raw stageId
  {
    const req = {
      params: { id: pipeline1._id.toString() },
      workspaceId: ws._id,
      body: {
        fromStageId: 'stage_open_1',
        toStageId: 'stage_won_2',
      },
      user,
    };
    const res = mockRes();
    await remapStageLeads(req, res);
    assert.strictEqual(res.statusCode, 200);

    const updatedLead = await Lead.findById(leadOpen._id);
    assert.strictEqual(updatedLead.pipelineStage, 'stage_won_2');
    assert.strictEqual(updatedLead.status, 'won', 'status must be canonical won, not raw stageId stage_won_2');
    console.log('✅ Step 1: remapStageLeads correctly set canonical status="won" instead of raw stage ID.');
  }

  // 2. Delete Pipeline: reassign to targetPipeline preserving won/lost semantics
  {
    const req = {
      params: { id: pipeline1._id.toString() },
      workspaceId: ws._id,
      body: {
        reassignPipelineId: targetPipeline._id.toString(),
      },
      user,
    };
    const res = mockRes();
    await deletePipeline(req, res);
    assert.strictEqual(res.statusCode, 200);

    const checkedWon = await Lead.findById(leadWon._id);
    assert.strictEqual(checkedWon.pipelineId.toString(), targetPipeline._id.toString());
    assert.strictEqual(checkedWon.pipelineStage, 'stage_target_won');
    assert.strictEqual(checkedWon.status, 'won', 'Won lead must maintain won status on pipeline delete');

    const checkedLost = await Lead.findById(leadLost._id);
    assert.strictEqual(checkedLost.pipelineId.toString(), targetPipeline._id.toString());
    assert.strictEqual(checkedLost.pipelineStage, 'stage_target_lost');
    assert.strictEqual(checkedLost.status, 'lost', 'Lost lead must maintain lost status on pipeline delete');
    console.log('✅ Step 2: deletePipeline preserved won/lost semantics and mapped to target won/lost stages.');
  }

  // 3. Test repairCorruptedLeadStatuses script
  {
    // Seed a lead with an intentionally corrupted raw stageId in status
    const corruptedLead = await Lead.create({
      name: 'Corrupted Lead',
      phone: '9100000009',
      workspaceId: ws._id,
      userId: user._id,
      pipelineId: targetPipeline._id,
      pipelineStage: 'stage_target_won',
      status: 'stage_raw_17300099',
      targetDomain: 'Engineering',
    });

    // Dry run
    const dryRunRes = await repairCorruptedLeadStatuses({ apply: false });
    assert.strictEqual(dryRunRes.repaired, 1);
    const unchanged = await Lead.findById(corruptedLead._id);
    assert.strictEqual(unchanged.status, 'stage_raw_17300099');

    // Apply run
    const applyRes = await repairCorruptedLeadStatuses({ apply: true });
    assert.strictEqual(applyRes.repaired, 1);
    const fixed = await Lead.findById(corruptedLead._id);
    assert.strictEqual(fixed.status, 'won');
    console.log('✅ Step 3: repairCorruptedLeadStatuses successfully detected and repaired corrupted status.');
  }

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL B2 PIPELINE STATUS INTEGRITY TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
