const mongoose = require('mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const companyController = require('../src/controllers/companyController');
const agencyController = require('../src/controllers/agencyController');
const realEstateController = require('../src/controllers/realEstateController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_realestate_role_update_fix';

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

async function run() {
  console.log('🚀 TESTING REAL ESTATE TEAM ROLE UPDATE & ADDITION FIXES...');
  try {
    await mongoose.connect(MONGODB_URI);
    await mongoose.connection.dropDatabase();

    // 1. Create Tenant Owner
    const owner = await User.create({
      name: 'Owner Real Estate',
      email: 'owner@realestatecrm.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      industryType: 'Real Estate',
      plan: 'pro',
      usercode: 'CMP-OWNER1',
    });

    console.log('✓ Created Tenant Owner:', owner.name);

    // 2. Create Team Member as Agent
    console.log('\n--- Step 1: Create Team Member as Agent ---');
    const reqCreate = {
      user: owner,
      body: {
        name: 'Abhishek Yadav',
        email: 'abhishek.agent@crm.com',
        phone: '9998887771',
        password: 'password123',
        role: 'agent',
        companyRole: 'agent',
      },
    };
    const resCreate = mockResponse();
    await companyController.createCompanyAgent(reqCreate, resCreate);

    if (resCreate.statusCode !== 201 || !resCreate.data?.agent) {
      throw new Error(`Failed to create agent: ${JSON.stringify(resCreate.data)}`);
    }

    const createdAgent = resCreate.data.agent;
    console.log('✓ Created agent:', createdAgent.name, '| Role:', createdAgent.role, '| CompanyRole:', createdAgent.companyRole);

    // 3. Edit Agent -> Manager with roleId = 'default_manager' (the exact bug reproduction)
    console.log('\n--- Step 2: Update Agent to Manager with roleId="default_manager" ---');
    const reqUpdate1 = {
      user: owner,
      tenantId: owner._id,
      params: { agentId: createdAgent._id.toString() },
      body: {
        roleId: 'default_manager',
        companyRole: 'manager',
        role: 'manager',
        managerId: null,
        employeeStatus: 'active',
      },
    };
    const resUpdate1 = mockResponse();
    await agencyController.updateAgent(reqUpdate1, resUpdate1);

    if (resUpdate1.statusCode !== 200 || !resUpdate1.data?.agent) {
      throw new Error(`Failed to update agent to manager with default_manager: ${JSON.stringify(resUpdate1.data)}`);
    }

    const updatedAgent1 = await User.findById(createdAgent._id);
    console.log('✓ Successfully updated to Manager without CastError!');
    console.log('  - Role:', updatedAgent1.role);
    console.log('  - CompanyRole:', updatedAgent1.companyRole);
    console.log('  - WorkStatus:', updatedAgent1.workStatus);
    console.log('  - RoleId:', updatedAgent1.roleId);

    if (updatedAgent1.role !== 'manager' || updatedAgent1.companyRole !== 'manager') {
      throw new Error(`Role update failed: expected 'manager', got '${updatedAgent1.role}'`);
    }

    // 4. Update Manager -> Telecaller with roleId = ""
    console.log('\n--- Step 3: Update Manager to Telecaller with roleId="" ---');
    const reqUpdate2 = {
      user: owner,
      tenantId: owner._id,
      params: { agentId: createdAgent._id.toString() },
      body: {
        roleId: '',
        companyRole: 'telecaller',
        role: 'agent',
        employeeStatus: 'active',
      },
    };
    const resUpdate2 = mockResponse();
    await agencyController.updateAgent(reqUpdate2, resUpdate2);

    if (resUpdate2.statusCode !== 200 || !resUpdate2.data?.agent) {
      throw new Error(`Failed to update to telecaller: ${JSON.stringify(resUpdate2.data)}`);
    }

    const updatedAgent2 = await User.findById(createdAgent._id);
    console.log('✓ Successfully updated to Telecaller!');
    console.log('  - Role:', updatedAgent2.role);
    console.log('  - CompanyRole:', updatedAgent2.companyRole);

    if (updatedAgent2.companyRole !== 'telecaller') {
      throw new Error(`Expected companyRole 'telecaller', got '${updatedAgent2.companyRole}'`);
    }

    // 5. Add new Member directly as Manager via createCompanyAgent
    console.log('\n--- Step 4: Add new Member directly as Manager ---');
    const reqCreateMgr = {
      user: owner,
      body: {
        name: 'Rahul Supervisor',
        email: 'rahul.mgr@crm.com',
        phone: '9998887772',
        password: 'password123',
        companyRole: 'manager',
        role: 'manager',
        roleId: 'default_manager',
      },
    };
    const resCreateMgr = mockResponse();
    await companyController.createCompanyAgent(reqCreateMgr, resCreateMgr);

    if (resCreateMgr.statusCode !== 201 || !resCreateMgr.data?.agent) {
      throw new Error(`Failed to create direct manager: ${JSON.stringify(resCreateMgr.data)}`);
    }

    const rahulMgr = await User.findById(resCreateMgr.data.agent._id);
    console.log('✓ Directly created manager:');
    console.log('  - Name:', rahulMgr.name);
    console.log('  - Role:', rahulMgr.role);
    console.log('  - CompanyRole:', rahulMgr.companyRole);
    console.log('  - Usercode:', rahulMgr.usercode);

    if (rahulMgr.role !== 'manager' || rahulMgr.companyRole !== 'manager') {
      throw new Error(`Expected role 'manager', got '${rahulMgr.role}'`);
    }

    // 6. Verify /real-estate/team/members returns all team members
    console.log('\n--- Step 5: Verify /real-estate/team/members list ---');
    const reqTeam = { user: owner };
    const resTeam = mockResponse();
    await realEstateController.getManagerTeamMembers(reqTeam, resTeam);

    if (resTeam.statusCode !== 200 || !Array.isArray(resTeam.data?.data)) {
      throw new Error(`Failed to get team members: ${JSON.stringify(resTeam.data)}`);
    }

    const members = resTeam.data.data;
    console.log(`✓ Fetched ${members.length} team members from /real-estate/team/members:`);
    members.forEach(m => {
      console.log(`   - ${m.name} | Role: ${m.role} | CompanyRole: ${m.companyRole}`);
    });

    if (members.length < 2) {
      throw new Error(`Expected at least 2 team members, got ${members.length}`);
    }

    console.log('\n🎉 ALL REAL ESTATE ROLE AND TEAM MEMBER FIXES TESTED AND PASSED! ✅');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
