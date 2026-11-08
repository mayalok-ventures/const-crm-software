const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

async function runTest() {
  console.log('🧪 Running Issue 6 Test: Lead Soft Delete & Non-Financial Cascade Cleanup...');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Payment = require('../src/models/Payment');
  const FollowUp = require('../src/models/FollowUp');
  const Group = require('../src/models/Group');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');
  require('../src/models/Catalogue');

  // Create Workspace and Owner
  const owner = await User.create({
    name: 'Delete Tester',
    email: 'del_owner@example.com',
    password: 'Password123!',
    role: 'admin',
    companyRole: 'owner',
  });
  const ws = await Workspace.create({ name: 'Delete Test Workspace', ownerId: owner._id });
  await WorkspaceMembership.create({ workspaceId: ws._id, userId: owner._id, role: 'owner', status: 'active' });
  const token = jwt.sign({ id: owner._id, role: owner.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  const testPhone = '+919876543219';

  // 1. Create Lead
  const lead = await Lead.create({
    name: 'Lead To Delete',
    phone: testPhone,
    status: 'hot',
    userId: owner._id,
    companyId: owner._id,
    workspaceId: ws._id,
  });

  // 2. Create child records: FollowUp, Group membership, Payment
  const followUp = await FollowUp.create({
    lead_id: lead._id,
    leadId: lead._id,
    userId: owner._id,
    scheduled_at: new Date(Date.now() + 86400000),
    scheduledAt: new Date(Date.now() + 86400000),
    note: 'Initial follow up',
    status: 'pending',
    type: 'call',
  });

  const group = await Group.create({
    name: 'Target Group',
    userId: owner._id,
    companyId: owner._id,
    leadIds: [lead._id],
  });

  const payment = await Payment.create({
    lead_id: lead._id,
    leadId: lead._id,
    workspaceId: ws._id,
    amount: 12000,
    status: 'completed',
    transaction_id: 'TXN-SOFT-DEL-01',
  });

  const app = express();
  app.use(express.json());
  app.use('/api/leads', require('../src/routes/leads'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/leads`;

  try {
    // 3. Send DELETE request to soft-delete lead
    const resDel = await fetch(`${baseUrl}/${lead._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-workspace-id': ws._id.toString(),
      },
    });
    assert.strictEqual(resDel.status, 200);
    const delBody = await resDel.json();
    assert.strictEqual(delBody.message, 'Lead deleted successfully');

    // 4. Verify Lead is excluded from standard find queries
    const findNormal = await Lead.findById(lead._id);
    assert.strictEqual(findNormal, null, 'Lead must not be returned by standard findById');

    // Verify Lead document is preserved in database with deletedAt and deletedBy
    const rawLead = await Lead.collection.findOne({ _id: lead._id });
    assert.ok(rawLead, 'Lead must exist in underlying collection (not hard-deleted)');
    assert.ok(rawLead.deletedAt, 'deletedAt must be set');
    assert.strictEqual(rawLead.deletedBy.toString(), owner._id.toString(), 'deletedBy must match actor');

    // 5. Verify Pending Follow-up is cancelled
    const updatedFollowUp = await FollowUp.findById(followUp._id);
    assert.strictEqual(updatedFollowUp.status, 'cancelled', 'Pending follow-up must be cancelled');

    // 6. Verify Group has lead removed from leadIds array
    const updatedGroup = await Group.findById(group._id);
    assert.strictEqual(updatedGroup.leadIds.length, 0, 'Lead must be pulled from group leadIds');

    // 7. Verify Payment record remains intact (financial records must NOT be deleted)
    const checkPayment = await Payment.findById(payment._id);
    assert.ok(checkPayment, 'Payment record must remain intact');
    assert.strictEqual(checkPayment.amount, 12000);

    // 8. Verify the same phone number can now be reused to create a NEW lead without collision
    const resRecreate = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-workspace-id': ws._id.toString(),
      },
      body: JSON.stringify({
        name: 'Recreated Lead Same Phone',
        phone: testPhone,
        targetDomain: 'Engineering (B.Tech/BE)',
        status: 'new',
      }),
    });
    const resRecreateBody = await resRecreate.json();
    if (resRecreate.status !== 201) {
      console.log('Recreate failed with:', resRecreate.status, resRecreateBody);
    }
    assert.strictEqual(resRecreate.status, 201, 'Re-creating a lead with the same phone must succeed');
    assert.strictEqual(resRecreateBody.phone, '919876543219');

    console.log('✅ Issue 6 Test PASSED: Soft delete, non-financial cascade cleanup, payment retention, and phone reuse verified.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 6 Test FAILED:', err);
    process.exit(1);
  });
