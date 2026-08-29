/**
 * Super Admin Manual Subscription Plan Override Verification Test Suite
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const { updateTenantPlan } = require('../src/superadmin/services/tenantService');
const organisationController = require('../src/superadmin/controllers/organisationController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_superadmin_plan_override';

function mockResponse() {
  const res = {};
  res.statusCode = 200;
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.data = data;
    return this;
  };
  return res;
}

async function runTests() {
  console.log('===========================================================');
  console.log('🚀 RUNNING SUPER ADMIN MANUAL SUBSCRIPTION PLAN OVERRIDE TEST');
  console.log('===========================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB test database');
    await mongoose.connection.dropDatabase();

    // 1. Create Super Admin User
    const superAdmin = await User.create({
      name: 'Platform SuperAdmin',
      email: 'admin@platform.com',
      password: 'password123',
      role: 'superadmin',
      usercode: 'ADM-001',
    });

    // 2. Create Tenant / Organisation on Free Plan
    const tenantOrg = await User.create({
      name: 'Test Real Estate Agency',
      email: 'owner@agency.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      plan: 'free',
      billingCycle: 'monthly',
      usercode: 'REA-7A3M86',
      companyInfo: { companyName: 'Root Abhi Realty' },
    });

    console.log(`✓ Created test organisation "${tenantOrg.companyInfo.companyName}" on plan "${tenantOrg.plan}"`);

    // 3. Test Manual Upgrade to Business Agency (10 Seats, Yearly Cycle, 365 Days)
    console.log('\n--- TEST 1: Super Admin Manual Upgrade to Business Agency ---');
    const req = {
      user: superAdmin,
      params: { id: tenantOrg._id },
      body: {
        planCode: 'business',
        billingCycle: 'yearly',
        durationDays: 365,
        reason: 'Client requested annual business license via phone support',
      },
    };
    const res = mockResponse();
    await organisationController.updatePlan(req, res);

    if (res.statusCode !== 200 || !res.data.success) {
      throw new Error(`updatePlan failed: Status ${res.statusCode}, ${JSON.stringify(res.data)}`);
    }

    const updatedTenant = await User.findById(tenantOrg._id);
    if (updatedTenant.plan !== 'business') {
      throw new Error(`Expected plan 'business', got: ${updatedTenant.plan}`);
    }
    if (updatedTenant.billingCycle !== 'yearly') {
      throw new Error(`Expected billingCycle 'yearly', got: ${updatedTenant.billingCycle}`);
    }
    if (!updatedTenant.planEndDate) {
      throw new Error('Expected planEndDate to be set for 365 days');
    }
    console.log(`✓ Organisation plan successfully upgraded to: ${updatedTenant.plan} (${updatedTenant.billingCycle})`);
    console.log(`✓ Plan Expiration set to: ${updatedTenant.planEndDate.toISOString()}`);

    // 4. Test Audit Log Entry
    console.log('\n--- TEST 2: Immutable Audit Log Verification ---');
    const audit = await AuditLog.findOne({ organizationId: tenantOrg._id, action: 'PLAN_CHANGE' });
    if (!audit) {
      throw new Error('Audit log for PLAN_CHANGE was not created!');
    }
    if (audit.actorRole !== 'superadmin' || String(audit.actorId) !== String(superAdmin._id)) {
      throw new Error(`Audit actor mismatch! Got: ${audit.actorRole}`);
    }
    if (audit.after?.plan !== 'business') {
      throw new Error(`Audit after state mismatch! Got: ${JSON.stringify(audit.after)}`);
    }
    console.log('✓ Audit log created with full before/after diff and superadmin attribution');

    // 5. Test Enterprise Command Assignment
    console.log('\n--- TEST 3: Super Admin Upgrade to Enterprise Command ---');
    const req2 = {
      user: superAdmin,
      params: { id: tenantOrg._id },
      body: {
        planCode: 'enterprise',
        billingCycle: 'monthly',
        durationDays: 90,
        reason: 'VIP Enterprise evaluation trial',
      },
    };
    const res2 = mockResponse();
    await organisationController.updatePlan(req2, res2);

    const updatedTenant2 = await User.findById(tenantOrg._id);
    if (updatedTenant2.plan !== 'enterprise') {
      throw new Error(`Expected plan 'enterprise', got: ${updatedTenant2.plan}`);
    }
    console.log(`✓ Organisation plan updated to: ${updatedTenant2.plan}`);

    console.log('\n===========================================================');
    console.log('🎉 ALL SUPER ADMIN PLAN OVERRIDE TESTS PASSED!');
    console.log('===========================================================\n');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Database disconnected');
  }
}

runTests();
