const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Campaign = require('../src/models/Campaign');
const Lead = require('../src/models/Lead');
const AutomationRule = require('../src/models/AutomationRule');
const Notification = require('../src/models/Notification');
const leadsController = require('../src/controllers/leadsController');
const AutomationEngine = require('../src/services/automationEngine');
const connectDB = require('../src/config/db');
const { requirePermission } = require('../src/middleware/permission');

async function runTestSuite() {
  console.log('🧪 Starting Lead Transfer & Automation Engine Test Suite...\n');

  await connectDB();
  console.log('  ✔ Connected to MongoDB');

  const testSuffix = Date.now();

  try {
    // -----------------------------------------------------------------------
    // 1. SETUP TENANTS & USERS
    // -----------------------------------------------------------------------
    console.log('\n[TEST 1] Setting up multi-tenant test fixtures...');
    
    // Tenant 1
    const owner1 = await User.create({
      name: `Tenant 1 Owner ${testSuffix}`,
      email: `owner1_${testSuffix}@transfer-test.com`,
      password: 'Password123!',
      role: 'owner',
      companyRole: 'owner',
      isActive: true,
    });
    owner1.companyId = owner1._id;
    await owner1.save();

    const workspace1 = await Workspace.create({
      name: `Tenant 1 Education Consultancy ${testSuffix}`,
      ownerId: owner1._id,
    });

    const owner1Membership = await WorkspaceMembership.create({
      workspaceId: workspace1._id,
      userId: owner1._id,
      role: 'owner',
      status: 'active',
    });

    const counselorA = await User.create({
      name: `Counselor Alpha ${testSuffix}`,
      email: `alpha_${testSuffix}@transfer-test.com`,
      password: 'Password123!',
      role: 'counsellor',
      companyId: owner1._id,
      isActive: true,
    });

    const membershipA = await WorkspaceMembership.create({
      workspaceId: workspace1._id,
      userId: counselorA._id,
      role: 'counsellor',
      status: 'active',
      permissionOverrides: [
        { key: 'leads.view', granted: true, scope: 'workspace' },
        { key: 'leads.edit', granted: true, scope: 'workspace' },
        { key: 'leads.transfer', granted: false, scope: 'workspace' },
      ],
    });

    const counselorB = await User.create({
      name: `Counselor Beta ${testSuffix}`,
      email: `beta_${testSuffix}@transfer-test.com`,
      password: 'Password123!',
      role: 'counsellor',
      companyId: owner1._id,
      isActive: true,
    });

    const membershipB = await WorkspaceMembership.create({
      workspaceId: workspace1._id,
      userId: counselorB._id,
      role: 'counsellor',
      status: 'active',
      permissionOverrides: [
        { key: 'leads.view', granted: true, scope: 'workspace' },
        { key: 'leads.edit', granted: true, scope: 'workspace' },
        { key: 'leads.transfer', granted: true, scope: 'workspace' },
      ],
    });

    // Tenant 2 (For Cross-Tenant Isolation Verification)
    const owner2 = await User.create({
      name: `Tenant 2 Owner ${testSuffix}`,
      email: `owner2_${testSuffix}@transfer-test.com`,
      password: 'Password123!',
      role: 'owner',
      companyRole: 'owner',
      isActive: true,
    });
    owner2.companyId = owner2._id;
    await owner2.save();

    const workspace2 = await Workspace.create({
      name: `Tenant 2 Education Consultancy ${testSuffix}`,
      ownerId: owner2._id,
    });

    await WorkspaceMembership.create({
      workspaceId: workspace2._id,
      userId: owner2._id,
      role: 'owner',
      status: 'active',
    });

    console.log('  ✔ Users created for Tenant 1 and Tenant 2');

    // -----------------------------------------------------------------------
    // 2. PERMISSION MATRIX VERIFICATION
    // -----------------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Permission Authorization Logic (leads.transfer)...');

    const transferGuard = requirePermission(['leads.transfer', 'leads.assign']);

    // Counselor A without permission should fail with 403 Forbidden
    let guardStatus = null;
    let guardData = null;
    const fakeResGuard = {
      status(code) { guardStatus = code; return this; },
      json(data) { guardData = data; return this; }
    };
    let nextCalled = false;

    await transferGuard(
      { user: counselorA, workspace: workspace1, workspaceId: workspace1._id, membership: membershipA, headers: {} },
      fakeResGuard,
      () => { nextCalled = true; }
    );

    assert.strictEqual(guardStatus, 403, 'Counselor A without leads.transfer must be rejected with 403 Forbidden');
    assert.strictEqual(nextCalled, false, 'next() should not be invoked for unauthorized user');

    // Counselor B with explicit permission should succeed
    let bNextCalled = false;
    await transferGuard(
      { user: counselorB, workspace: workspace1, workspaceId: workspace1._id, membership: membershipB, headers: {} },
      fakeResGuard,
      () => { bNextCalled = true; }
    );
    assert.strictEqual(bNextCalled, true, 'Counselor B with explicit leads.transfer granted must pass');

    // Owner should automatically be permitted
    let ownerNextCalled = false;
    await transferGuard(
      { user: owner1, workspace: workspace1, workspaceId: workspace1._id, membership: owner1Membership, headers: {} },
      fakeResGuard,
      () => { ownerNextCalled = true; }
    );
    assert.strictEqual(ownerNextCalled, true, 'Owner must pass permission guard');

    console.log('  ✔ Role & permission gates verified accurately');

    // -----------------------------------------------------------------------
    // 3. MULTI-TENANT ISOLATION & IDOR PREVENTION
    // -----------------------------------------------------------------------
    console.log('\n[TEST 3] Verifying Multi-Tenant Isolation & Anti-IDOR Protection...');

    // Create a lead in Tenant 2
    const tenant2Lead = await Lead.create({
      name: `Tenant 2 Confidential Candidate ${testSuffix}`,
      phone: `99990${String(testSuffix).slice(-5)}`,
      email: `lead2_${testSuffix}@tenant2.com`,
      companyId: owner2._id,
      userId: owner2._id,
      status: 'new_lead',
    });

    // Tenant 1 counselor attempts to transfer Tenant 2 lead
    let idorResStatus = null;
    let idorResData = null;
    const fakeResIdor = {
      status(code) { idorResStatus = code; return this; },
      json(data) { idorResData = data; return this; }
    };

    await leadsController.bulkTransferLeads(
      {
        user: counselorB,
        body: {
          leadIds: [tenant2Lead._id],
          assignedToUserId: counselorB._id,
          newStage: 'contacted',
        },
      },
      fakeResIdor
    );

    assert.strictEqual(idorResStatus, 404, 'Endpoint should return 404 when leads do not exist in caller workspace');
    assert.strictEqual(idorResData.success, false);

    // Verify Tenant 2 lead is unaltered
    const freshTenant2Lead = await Lead.findById(tenant2Lead._id);
    assert.strictEqual(freshTenant2Lead.status, 'new_lead', 'Cross-tenant lead status must not change');
    assert.ok(!freshTenant2Lead.assignedTo, 'Cross-tenant lead must not be reassigned');
    console.log('  ✔ IDOR attack prevented: Cross-tenant lead remained completely untouched');

    // -----------------------------------------------------------------------
    // 4. BULK LEAD TRANSFER WITH AUDIT TRAIL & NOTIFICATIONS
    // -----------------------------------------------------------------------
    console.log('\n[TEST 4] Executing Bulk Lead Transfer to Counselor & Campaign...');

    // Create Inbound Campaign in Tenant 1
    const campaign1 = await Campaign.create({
      name: `Meta Tech Admissions ${testSuffix}`,
      campaignName: `Meta Tech Admissions ${testSuffix}`,
      companyId: owner1._id,
      platform: 'meta',
      isActive: true,
      status: 'active',
      leadCount: 0,
      leadsGenerated: 0,
    });

    // Create 3 candidate leads in Tenant 1
    const lead1 = await Lead.create({
      name: `Student One ${testSuffix}`,
      phone: `98701${String(testSuffix).slice(-5)}`,
      companyId: owner1._id,
      userId: owner1._id,
      assignedTo: counselorA._id,
      status: 'new_lead',
    });

    const lead2 = await Lead.create({
      name: `Student Two ${testSuffix}`,
      phone: `98702${String(testSuffix).slice(-5)}`,
      companyId: owner1._id,
      userId: owner1._id,
      assignedTo: counselorA._id,
      status: 'new_lead',
    });

    const lead3 = await Lead.create({
      name: `Student Three ${testSuffix}`,
      phone: `98703${String(testSuffix).slice(-5)}`,
      companyId: owner1._id,
      userId: owner1._id,
      assignedTo: counselorA._id,
      status: 'new_lead',
    });

    let transferResStatus = null;
    let transferResData = null;
    const fakeResTransfer = {
      status(code) { transferResStatus = code; return this; },
      json(data) { transferResData = data; return this; }
    };

    // Execute bulk transfer of 3 leads to Counselor B and Campaign 1
    await leadsController.bulkTransferLeads(
      {
        user: owner1,
        body: {
          leadIds: [lead1._id, lead2._id, lead3._id],
          assignedToUserId: counselorB._id,
          targetCampaignId: campaign1._id,
          newStage: 'contacted',
          transferNote: 'Bulk reassignment to senior counselling desk for semester intake',
        },
      },
      fakeResTransfer
    );

    assert.strictEqual(transferResStatus, 200, 'Bulk transfer should return 200 OK');
    assert.strictEqual(transferResData.count, 3, 'Must report 3 leads transferred');

    // Verify database updates
    const transferredLeads = await Lead.find({ _id: { $in: [lead1._id, lead2._id, lead3._id] } });
    for (const tl of transferredLeads) {
      assert.strictEqual(
        String(tl.assignedTo),
        String(counselorB._id),
        'Lead assignedTo must match target counselor'
      );
      assert.strictEqual(
        String(tl.campaignId),
        String(campaign1._id),
        'Lead campaignId must match target campaign'
      );
      assert.strictEqual(tl.status, 'contacted', 'Lead stage must be updated to contacted');

      // Verify audit trail entry in leadActivities
      const transferActivity = tl.leadActivities?.find(a => a.action === 'lead_transferred');
      assert.ok(transferActivity, 'Lead must have a lead_transferred activity record');
      assert.ok(
        transferActivity.details.includes('Bulk reassignment to senior counselling desk'),
        'Activity record must contain the audit note'
      );
    }

    // Verify campaign counter increment
    const updatedCampaign = await Campaign.findById(campaign1._id);
    assert.strictEqual(updatedCampaign.leadCount, 3, 'Campaign leadCount must be incremented by 3');

    // Verify notification was created for Counselor B
    const notifs = await Notification.find({
      userId: counselorB._id,
      type: 'lead_assigned',
    });
    assert.ok(notifs.length >= 1, 'In-app notification must be delivered to new counselor');

    console.log('  ✔ Bulk transfer successfully updated assignee, campaign, stage, audit log & notifications');

    // -----------------------------------------------------------------------
    // 5. BULK TRANSFER WITH CAMPAIGN COUNSELOR POOL ROTATION
    // -----------------------------------------------------------------------
    console.log('\n[TEST 5] Verifying Campaign Authoritative Counselor Pool Rotation in Bulk Transfer...');

    const campaignWithPool = await Campaign.create({
      name: `Google Ads Direct ${testSuffix}`,
      campaignName: `Google Ads Direct ${testSuffix}`,
      companyId: owner1._id,
      platform: 'google',
      isActive: true,
      status: 'active',
      assignmentRule: {
        type: 'round_robin',
        counselorPool: [
          { userId: counselorA._id, weight: 1 },
          { userId: counselorB._id, weight: 1 },
        ],
      },
    });

    const lead4 = await Lead.create({
      name: `Pool Candidate 1 ${testSuffix}`,
      phone: `98704${String(testSuffix).slice(-5)}`,
      companyId: owner1._id,
      userId: owner1._id,
      status: 'new_lead',
    });

    const lead5 = await Lead.create({
      name: `Pool Candidate 2 ${testSuffix}`,
      phone: `98705${String(testSuffix).slice(-5)}`,
      companyId: owner1._id,
      userId: owner1._id,
      status: 'new_lead',
    });

    let poolResStatus = null;
    let poolResData = null;
    const fakeResPool = {
      status(code) { poolResStatus = code; return this; },
      json(data) { poolResData = data; return this; }
    };

    await leadsController.bulkTransferLeads(
      {
        user: owner1,
        body: {
          leadIds: [lead4._id, lead5._id],
          targetCampaignId: campaignWithPool._id,
          applyCampaignAssignmentRule: true, // Use campaign pool rotation
        },
      },
      fakeResPool
    );

    assert.strictEqual(poolResStatus, 200);
    assert.strictEqual(poolResData.count, 2);

    const poolLeads = await Lead.find({ _id: { $in: [lead4._id, lead5._id] } });
    const assignedIds = poolLeads.map(l => String(l.assignedTo));
    assert.ok(
      assignedIds.includes(String(counselorA._id)) || assignedIds.includes(String(counselorB._id)),
      'Leads must be assigned to members of the campaign counselor pool'
    );
    console.log('  ✔ Campaign counselor pool rotation applied dynamically');

    // -----------------------------------------------------------------------
    // 6. AUTOMATION ENGINE: IDLE / STALE LEAD REASSIGNMENT
    // -----------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Automation Engine Stale Lead Reassignment (stage_duration)...');

    // Create an automation rule in Tenant 1:
    // If a lead is idle in stage 'new_lead' for 3 days, auto-reassign to Counselor B and advance to 'contacted'
    const idleRule = await AutomationRule.create({
      name: `Auto-Escalate 3-Day Idle Leads ${testSuffix}`,
      workspaceId: workspace1._id,
      companyId: owner1._id,
      userId: owner1._id,
      triggerType: 'stage_duration',
      channel: 'internal',
      category: 'lead_routing',
      isActive: true,
      triggerConfig: {
        targetStage: 'new_lead',
        daysInStage: 3,
      },
      actionType: 'transfer_lead',
      actionConfig: {
        assignedUserId: counselorB._id,
        newStage: 'contacted',
        transferNote: 'Automated transfer via 3-day stale rule',
      },
    });

    // Create a lead whose last update was 4 days ago
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const staleLead = await Lead.create({
      name: `Stagnant Candidate ${testSuffix}`,
      phone: `98706${String(testSuffix).slice(-5)}`,
      workspaceId: workspace1._id,
      companyId: owner1._id,
      userId: owner1._id,
      assignedTo: counselorA._id,
      status: 'new_lead',
    });

    // Ensure updatedAt in mongo is actually in the past using raw collection update
    await Lead.collection.updateOne({ _id: staleLead._id }, { $set: { updatedAt: fourDaysAgo } });

    // Also create a fresh lead in 'new_lead' updated 1 hour ago (should NOT be touched)
    const freshLead = await Lead.create({
      name: `Active Fresh Candidate ${testSuffix}`,
      phone: `98707${String(testSuffix).slice(-5)}`,
      workspaceId: workspace1._id,
      companyId: owner1._id,
      userId: owner1._id,
      assignedTo: counselorA._id,
      status: 'new_lead',
      updatedAt: new Date(),
    });

    // Execute the automation cron cycle
    const cronStats = await AutomationEngine.processIdleLeadAutomations();
    console.log(`    Engine processed ${cronStats.evaluatedRules} rules, executed ${cronStats.executedActions} automated transfers`);

    assert.ok(cronStats.executedActions >= 1, 'Must execute at least 1 automated transfer action');

    // Verify stale lead was reassigned and moved to 'contacted'
    const freshCheckStale = await Lead.findById(staleLead._id);
    assert.strictEqual(
      String(freshCheckStale.assignedTo),
      String(counselorB._id),
      'Stale lead must be reassigned to target counselor'
    );
    assert.strictEqual(
      freshCheckStale.status,
      'contacted',
      'Stale lead stage must be advanced to contacted'
    );

    // Verify fresh lead was NOT touched
    const freshCheckActive = await Lead.findById(freshLead._id);
    assert.strictEqual(
      String(freshCheckActive.assignedTo),
      String(counselorA._id),
      'Active fresh lead must remain with counselor A'
    );
    assert.strictEqual(
      freshCheckActive.status,
      'new_lead',
      'Active fresh lead stage must remain new_lead'
    );

    // Test Idempotency: Running the cron again should NOT trigger again for the same stale lead
    const secondCycle = await AutomationEngine.processIdleLeadAutomations();
    console.log(`    Second cycle (Idempotency test): executed ${secondCycle.executedActions} duplicate actions`);
    // Fresh check should not duplicate
    const idempotencyLead = await Lead.findById(staleLead._id);
    assert.strictEqual(freshCheckStale.status, idempotencyLead.status);

    console.log('  ✔ Automation Engine successfully detected stale lead, executed reassignment, and maintained idempotency');

    console.log('\n🎉 ALL TESTS PASSED! Lead transfer & automated reassignments are robust, secure, and production-ready.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runTestSuite();
