const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Lead Soft Delete Partial Index, Phone Preservation & Aggregate Exclusion...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const User = require('../src/models/User');
  const Workspace = require('../src/models/Workspace');

  await Lead.init();
  const indexes = await Lead.collection.listIndexes().toArray();
  console.log('✅ Lead.init() built successfully! Active indexes count:', indexes.length);

  const userId = new mongoose.Types.ObjectId();
  const ws = await Workspace.create({ name: 'Partial Index WS', slug: 'partial-idx-ws', ownerId: userId });
  const user = await User.create({
    _id: userId,
    name: 'Agent Tester',
    email: 'agent_partial@crm.local',
    password: 'Password123!',
    phone: '9876543210',
    role: 'agent',
    companyRole: 'owner',
    workspaceId: ws._id,
  });

  const testPhone = '9988776655';

  // 1. Create first lead
  const lead1 = await Lead.create({
    name: 'Lead One',
    phone: testPhone,
    status: 'Inquiry',
    companyId: user._id,
    userId: user._id,
    workspaceId: ws._id,
    targetDomain: 'Engineering (B.Tech/BE)',
  });
  assert.strictEqual(lead1.phone, testPhone);
  assert.strictEqual(lead1.status, 'Inquiry');

  // 2. Soft-delete lead1
  lead1.deletedAt = new Date();
  lead1.deletedBy = user._id;
  await lead1.save();

  // Verify phone and status are NOT mutated on the underlying document
  const rawLead1 = await Lead.collection.findOne({ _id: lead1._id });
  assert.strictEqual(rawLead1.phone, testPhone, 'Phone number must NOT be mutated to _del_');
  assert.strictEqual(rawLead1.status, 'Inquiry', 'Status must NOT be mutated to deleted');
  assert.ok(rawLead1.deletedAt, 'deletedAt must be set');
  console.log('✅ Step 1: Soft-deleted lead preserves original phone and original status.');

  // 3. Create second lead with the EXACT same phone number
  const lead2 = await Lead.create({
    name: 'Lead Two (Recreated)',
    phone: testPhone,
    status: 'Lead Received',
    companyId: user._id,
    userId: user._id,
    workspaceId: ws._id,
    targetDomain: 'Engineering (B.Tech/BE)',
  });
  assert.ok(lead2._id);
  assert.strictEqual(lead2.phone, testPhone);
  console.log('✅ Step 2: Re-creating lead with same phone succeeds because deletedAt != null is excluded from partial index.');

  // 4. Attempting to create a third lead with the same phone (active duplicate) must fail with E11000
  let duplicateFailed = false;
  try {
    await Lead.create({
      name: 'Lead Three (Duplicate Active)',
      phone: testPhone,
      status: 'Lead Received',
      companyId: user._id,
      userId: user._id,
      workspaceId: ws._id,
      targetDomain: 'Engineering (B.Tech/BE)',
    });
  } catch (err) {
    if (err.code === 11000 || err.message.includes('E11000')) {
      duplicateFailed = true;
    } else {
      throw err;
    }
  }
  assert.strictEqual(duplicateFailed, true, 'Active duplicate lead with same phone must be rejected by unique index');
  console.log('✅ Step 3: Active duplicate lead with same phone correctly rejected with E11000.');

  // 5. Test Aggregate Exclusion
  const aggResult = await Lead.aggregate([
    { $match: { companyId: user._id } },
    { $project: { name: 1, phone: 1 } }
  ]);
  assert.strictEqual(aggResult.length, 1, 'Aggregate must automatically exclude soft-deleted leads');
  assert.strictEqual(aggResult[0].name, 'Lead Two (Recreated)');
  console.log('✅ Step 4: Lead.aggregate automatically excludes soft-deleted leads without breaking pipeline.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL SOFT DELETE PARTIAL INDEX ASSERTIONS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
