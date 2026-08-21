const mongoose = require('mongoose');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const LeadDistributionRule = require('../src/models/LeadDistributionRule');
const CommissionRule = require('../src/models/CommissionRule');
const CommissionPayout = require('../src/models/CommissionPayout');
const leadDistributionService = require('../src/services/leadDistributionService');
const commissionService = require('../src/services/commissionService');

const MONGO_URI = 'mongodb://127.0.0.1:27017/mobile-crm';

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING ADMIN REBUILD ACCEPTANCE & INTEGRITY TESTS');
  console.log('======================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB for testing.');

  let passedCount = 0;
  let totalCount = 0;

  const assert = (condition, msg) => {
    totalCount++;
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  };

  try {
    // 1. Single Admin Model & User Hierarchy
    console.log('\n--- 1. Testing Single Admin & User Hierarchy ---');
    const testAdmin = await User.findOne({ email: 'admin@crm.com' });
    assert(testAdmin !== null, 'Admin account exists with email admin@crm.com');
    assert(testAdmin.role === 'superadmin' || testAdmin.role === 'admin', 'Admin account has administrative authority');

    // Create a Test Manager
    const testManager = await User.findOneAndUpdate(
      { email: 'unit_test_manager@crm.com' },
      {
        name: 'Test Manager Unit',
        email: 'unit_test_manager@crm.com',
        password: 'Password@123',
        role: 'manager',
        userStatus: 'active',
        incentive_pct: 15,
        isAvailable: true,
      },
      { upsert: true, new: true }
    );
    assert(testManager.role === 'manager', 'Manager account created with role "manager"');

    // Create a Test Agent assigned to Manager
    const testAgent = await User.findOneAndUpdate(
      { email: 'unit_test_agent@crm.com' },
      {
        name: 'Test Agent Unit',
        email: 'unit_test_agent@crm.com',
        password: 'Password@123',
        role: 'agent',
        managerId: testManager._id,
        managerName: testManager.name,
        userStatus: 'active',
        incentive_pct: 10,
        leadCap: 10,
        isAvailable: true,
      },
      { upsert: true, new: true }
    );
    assert(String(testAgent.managerId) === String(testManager._id), 'Agent is linked to designated Manager');

    // 2. Lead Distribution Engine Test
    console.log('\n--- 2. Testing Lead Distribution Engine ---');
    const testDistRule = await LeadDistributionRule.findOneAndUpdate(
      { name: 'Unit Test Round Robin' },
      {
        name: 'Unit Test Round Robin',
        strategy: 'round_robin',
        isActive: true,
        priority: 10,
        assignees: [
          { userId: testAgent._id, role: 'agent', weight: 1, maxActiveLeadsCap: 20, isActive: true },
        ],
        createdBy: testAdmin._id,
      },
      { upsert: true, new: true }
    );
    assert(testDistRule.strategy === 'round_robin', 'Lead distribution rule created');

    const distributedResult = await leadDistributionService.distributeLead({
      name: 'Ad Inbound Lead',
      phone: '9876543210',
      source: 'meta_ads',
      primarySource: 'SOURCE_C_ADS',
    });

    assert(String(distributedResult.assignedTo) === String(testAgent._id), 'Lead successfully distributed to Agent');
    assert(String(distributedResult.assignedManager) === String(testManager._id), 'Lead automatically inherited Agent\'s Manager');

    // 3. Lead Creation & 3 Primary Sources Test
    console.log('\n--- 3. Testing Lead 3 Primary Sources ---');
    const createdLead = await Lead.create({
      userId: testAdmin._id,
      name: 'Meta Ads Test Prospect',
      phone: '9876543210',
      source: 'meta_ads',
      primarySource: 'SOURCE_C_ADS',
      service_required: 'smart_solo',
      monthly_spend: 50000,
      assignedTo: testAgent._id,
      assignedToName: testAgent.name,
      assignedManager: testManager._id,
      assignedManagerName: testManager.name,
      status: 'new_lead',
    });
    assert(createdLead.primarySource === 'SOURCE_C_ADS', 'Primary source tagged as SOURCE_C_ADS');

    // 4. Commission Engine Test
    console.log('\n--- 4. Testing Commission Engine & Immutable Ledger ---');
    const commissionResult = await commissionService.processCommission({
      lead: createdLead,
      dealAmount: 50000,
      stageId: 'payment_done',
      performedBy: testAdmin._id,
    });

    assert(commissionResult !== null, 'Commission processed successfully');
    assert(commissionResult.agentPayout !== null, 'Agent payout record generated');
    assert(commissionResult.agentPayout.commissionAmount === 5000, 'Agent 10% commission calculated correctly (₹5,000)');
    assert(commissionResult.managerPayout !== null, 'Manager override payout record generated');
    assert(commissionResult.managerPayout.commissionAmount === 1500, 'Manager 3% override calculated correctly (₹1,500)');

    // 5. Cleanup Test Artifacts
    console.log('\n--- 5. Cleaning Up Acceptance Test Artifacts ---');
    await Lead.findByIdAndDelete(createdLead._id);
    await LeadDistributionRule.findByIdAndDelete(testDistRule._id);
    await CommissionPayout.deleteMany({ leadId: createdLead._id });
    await User.findByIdAndDelete(testAgent._id);
    await User.findByIdAndDelete(testManager._id);
    console.log('✅ Cleaned up temporary test entities.');

    console.log(`\n🎉 ALL ${passedCount}/${totalCount} TESTS PASSED SUCCESSFULLY!\n`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test suite failure:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
