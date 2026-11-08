const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Lead Pre-Save Tenant Resolution & CompanyId Assurance...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const User = require('../src/models/User');
  const Workspace = require('../src/models/Workspace');

  const companyAdmin = await User.create({
    name: 'Org Owner',
    email: 'orgowner@crm.local',
    password: 'Password123!',
    phone: '9876543201',
    role: 'admin',
    companyRole: 'owner',
  });

  const ws = await Workspace.create({ name: 'Assurance WS', slug: 'assurance-ws', ownerId: companyAdmin._id });

  const agent = await User.create({
    name: 'Org Agent',
    email: 'orgagent@crm.local',
    password: 'Password123!',
    phone: '9876543202',
    role: 'agent',
    companyRole: 'agent',
    companyId: companyAdmin._id,
    workspaceId: ws._id,
  });

  // 1. Create a lead providing only workspaceId and userId (companyId omitted)
  const lead1 = await Lead.create({
    name: 'Lead Without CompanyId',
    phone: '9111222333',
    userId: agent._id,
    workspaceId: ws._id,
    targetDomain: 'Engineering (B.Tech/BE)',
  });

  assert.ok(lead1.workspaceId, 'workspaceId must be set');
  assert.strictEqual(lead1.companyId.toString(), companyAdmin._id.toString(), 'companyId must be resolved even when workspaceId was supplied');
  console.log('✅ Step 1: Pre-save hook correctly resolved companyId when only workspaceId was supplied.');

  // 2. Fast-path: lead created with both workspaceId and valid companyId
  const lead2 = await Lead.create({
    name: 'Lead With Both Presupplied',
    phone: '9111222334',
    userId: agent._id,
    companyId: companyAdmin._id,
    workspaceId: ws._id,
    targetDomain: 'Engineering (B.Tech/BE)',
  });
  assert.strictEqual(lead2.companyId.toString(), companyAdmin._id.toString());
  console.log('✅ Step 2: Fast-path preserved supplied companyId and workspaceId.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL PRE-SAVE TENANT FIX ASSERTIONS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
