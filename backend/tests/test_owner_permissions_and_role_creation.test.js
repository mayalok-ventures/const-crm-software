/**
 * Test Suite: Verify Owner can create/edit any role & permission without ceiling errors
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const agencyController = require('../src/controllers/agencyController');
const { PERMISSIONS } = require('../src/middleware/permission');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_owner_permissions_and_role_creation';

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
  console.log('🚀 TESTING OWNER UNRESTRICTED ROLE & PERMISSION MANAGEMENT');
  console.log('===========================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB test database');
    await mongoose.connection.dropDatabase();

    // 1. Create Organization Owner (simulating real user in production)
    const owner = await User.create({
      name: 'Root Abhi Owner',
      email: 'rootabhi@realestate.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      plan: 'free',
      usercode: 'REA-OWNER1',
    });

    console.log('✓ Created organization owner user');

    // 2. TEST 1: Owner creates a Senior Manager custom role with ALL permissions including INCENTIVE_MANAGE
    console.log('\n--- TEST 1: Owner creates Senior Manager role with extensive permissions ---');
    const reqCreate = {
      user: owner,
      tenantId: owner._id,
      body: {
        name: 'SENIOR MANAGER VIP',
        description: 'Full team leadership role with manager permissions',
        roleType: 'MANAGER',
        permissions: [
          'LEAD_VIEW',
          'LEAD_EDIT',
          'LEAD_CLAIM',
          'LEAD_TRANSFER_APPROVE',
          'ROLE_CREATE',
          'INCENTIVE_VIEW_SELF',
          'INCENTIVE_MANAGE',
          'ACTIVITY_VIEW',
          'REPORT_VIEW_AGENCY',
        ],
      },
    };
    const resCreate = mockResponse();
    await agencyController.createRole(reqCreate, resCreate);

    if (resCreate.statusCode !== 201 || !resCreate.data.role) {
      throw new Error(`Owner failed to create role: ${JSON.stringify(resCreate.data)}`);
    }

    const createdRole = resCreate.data.role;
    console.log(`✓ Role "${createdRole.name}" created successfully with ${createdRole.permissions.length} permissions!`);
    console.log(`✓ Role type: ${createdRole.roleType}`);

    // 3. TEST 2: Owner edits existing role and changes base roleType from AGENT to MANAGER with full permissions
    console.log('\n--- TEST 2: Owner updates roleType and permissions ---');
    const reqUpdate = {
      user: owner,
      tenantId: owner._id,
      params: { id: createdRole._id },
      body: {
        name: 'SENIOR',
        roleType: 'MANAGER',
        permissions: [
          'ROLE_CREATE',
          'INCENTIVE_VIEW_SELF',
          'INCENTIVE_MANAGE',
          'ACTIVITY_VIEW',
          'EXPORT_LEADS',
        ],
      },
    };
    const resUpdate = mockResponse();
    await agencyController.updateRole(reqUpdate, resUpdate);

    if (resUpdate.statusCode !== 200 || !resUpdate.data.success) {
      throw new Error(`Owner failed to update role: ${JSON.stringify(resUpdate.data)}`);
    }

    const updatedRoleDoc = await Role.findById(createdRole._id);
    if (updatedRoleDoc.roleType !== 'MANAGER') {
      throw new Error(`Expected roleType 'MANAGER', got: ${updatedRoleDoc.roleType}`);
    }
    if (!updatedRoleDoc.permissions.includes('INCENTIVE_MANAGE')) {
      throw new Error('Expected permissions to include INCENTIVE_MANAGE');
    }
    console.log(`✓ Role "${updatedRoleDoc.name}" updated to roleType="${updatedRoleDoc.roleType}" with permissions successfully!`);

    console.log('\n===========================================================');
    console.log('🎉 ALL OWNER PERMISSION & ROLE TESTS PASSED!');
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
