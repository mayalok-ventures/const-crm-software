/**
 * Test Suite: Team Member Creation as Manager & Team Member Deletion
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const Lead = require('../src/models/Lead');
const AuditLog = require('../src/models/AuditLog');
const companyController = require('../src/controllers/companyController');
const agencyController = require('../src/controllers/agencyController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_agent_manager_create_and_delete';

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
  console.log('🚀 TESTING TEAM MEMBER MANAGER CREATION & DELETION SUITE');
  console.log('===========================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB test database');
    await mongoose.connection.dropDatabase();

    // 1. Create Organization Owner on Free Plan (with 10 seats)
    const owner = await User.create({
      name: 'Agency Root Owner',
      email: 'owner@agencycrm.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      plan: 'free',
      usercode: 'REA-ROOT01',
      companyInfo: { companyName: 'Root Realty' },
    });

    // 2. Create a Custom Role with roleType = 'MANAGER'
    const seniorManagerRole = await Role.create({
      tenantId: owner._id,
      companyId: owner._id,
      name: 'Senior Sales Manager',
      roleType: 'MANAGER',
      permissions: ['LEAD_VIEW', 'LEAD_EDIT', 'LEAD_TRANSFER_APPROVE'],
    });

    // 3. TEST 1: Create a Team Member choosing Manager Role directly
    console.log('\n--- TEST 1: Create Team Member with Manager Role ---');
    const req1 = {
      user: owner,
      body: {
        name: 'Vikram Manager',
        email: 'vikram.manager@agencycrm.com',
        phone: '9876543210',
        password: 'password123',
        role: 'manager',
        companyRole: 'manager',
      },
    };
    const res1 = mockResponse();
    await companyController.createCompanyAgent(req1, res1);

    if (res1.statusCode !== 201 || !res1.data.agent) {
      throw new Error(`Failed to create manager agent: ${JSON.stringify(res1.data)}`);
    }

    const createdMgr = await User.findById(res1.data.agent._id);
    if (createdMgr.role !== 'manager' || createdMgr.companyRole !== 'manager') {
      throw new Error(`Expected role & companyRole 'manager', got: role=${createdMgr.role}, companyRole=${createdMgr.companyRole}`);
    }
    console.log(`✓ Manager member created: name=${createdMgr.name}, role=${createdMgr.role}, companyRole=${createdMgr.companyRole}`);

    // 4. TEST 2: Create a Team Member by selecting Custom Role of type MANAGER
    console.log('\n--- TEST 2: Create Team Member with Custom Role (MANAGER type) ---');
    const req2 = {
      user: owner,
      body: {
        name: 'Pooja Custom Manager',
        email: 'pooja.manager@agencycrm.com',
        phone: '9876543211',
        password: 'password123',
        roleId: seniorManagerRole._id,
      },
    };
    const res2 = mockResponse();
    await companyController.createCompanyAgent(req2, res2);

    const createdCustomMgr = await User.findById(res2.data.agent._id);
    if (createdCustomMgr.role !== 'manager' || createdCustomMgr.companyRole !== 'manager') {
      throw new Error(`Expected role 'manager' from custom role, got: role=${createdCustomMgr.role}, companyRole=${createdCustomMgr.companyRole}`);
    }
    console.log(`✓ Custom Manager created with automatic role promotion: role=${createdCustomMgr.role}, companyRole=${createdCustomMgr.companyRole}`);

    // 5. TEST 3: Create an Agent and Assign Leads, then Delete / Remove Agent
    console.log('\n--- TEST 3: Create Agent, assign leads, and Delete / Remove ---');
    const req3 = {
      user: owner,
      body: {
        name: 'Rohan Sales Rep',
        email: 'rohan.sales@agencycrm.com',
        phone: '9876543212',
        password: 'password123',
        companyRole: 'sales_rep',
      },
    };
    const res3 = mockResponse();
    await companyController.createCompanyAgent(req3, res3);
    const rohanAgent = res3.data.agent;

    // Create a lead assigned to Rohan
    const testLead = await Lead.create({
      userId: rohanAgent._id,
      assignedTo: rohanAgent._id,
      assignedToName: rohanAgent.name,
      companyId: owner._id,
      name: 'Prospect Buyer For 3BHK',
      phone: '9123456789',
      stage: 'site_visit_scheduled',
      status: 'site_visit_scheduled',
    });

    // Delete Rohan via agencyController.deleteAgent
    const reqDelete = {
      user: owner,
      tenantId: owner._id,
      params: { agentId: rohanAgent._id },
    };
    const resDelete = mockResponse();
    await agencyController.deleteAgent(reqDelete, resDelete);

    if (resDelete.statusCode !== 200 || !resDelete.data.success) {
      throw new Error(`Failed to delete agent: ${JSON.stringify(resDelete.data)}`);
    }

    // Verify agent is removed from User collection
    const checkDeleted = await User.findById(rohanAgent._id);
    if (checkDeleted) {
      throw new Error('Agent was not deleted from database!');
    }
    console.log(`✓ Agent ${rohanAgent.name} successfully deleted`);

    // Verify lead was reclaimed by organization owner
    const updatedLead = await Lead.findById(testLead._id);
    if (String(updatedLead.userId) !== String(owner._id) || updatedLead.assignedTo !== null) {
      throw new Error(`Lead was not reclaimed by owner! Lead state: ${JSON.stringify(updatedLead)}`);
    }
    console.log('✓ Lead was successfully reclaimed to organization owner common pool');

    // Verify audit log
    const audit = await AuditLog.findOne({ organizationId: owner._id, action: 'DELETE' });
    if (!audit) {
      throw new Error('Audit log for DELETE action was not created!');
    }
    console.log('✓ Audit log for deletion created');

    console.log('\n===========================================================');
    console.log('🎉 ALL MANAGER CREATION & AGENT DELETION TESTS PASSED!');
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
