const mongoose = require('mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const companyController = require('../src/controllers/companyController');
const adminController = require('../src/controllers/adminController');
const agencyController = require('../src/controllers/agencyController');
const realEstateController = require('../src/controllers/realEstateController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_realestate_manager_creation';

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
  console.log('🚀 TESTING REAL ESTATE OWNER ADDING MANAGER...');
  try {
    await mongoose.connect(MONGODB_URI);
    await mongoose.connection.dropDatabase();

    // 1. Create Real Estate Owner
    const reOwner = await User.create({
      name: 'Abhishek RealEstate Owner',
      email: 'owner@realestate.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      industryType: 'Real Estate',
      plan: 'free',
      usercode: 'REA-OWNER01',
      companyInfo: { companyName: 'Sahyak Realty' },
    });

    console.log('✓ Created Real Estate Owner with industryType:', reOwner.industryType);

    // 2. Add Manager via POST /api/company/agents
    console.log('\n--- Test 1: Add Manager via /api/company/agents ---');
    const req1 = {
      user: reOwner,
      body: {
        name: 'Amitabh Senior Manager',
        email: 'amitabh.mgr@realestate.com',
        phone: '9876500001',
        password: 'password123',
        role: 'manager',
        companyRole: 'manager',
      },
    };
    const res1 = mockResponse();
    await companyController.createCompanyAgent(req1, res1);

    if (res1.statusCode !== 201 || !res1.data?.agent) {
      throw new Error(`Failed to create manager: ${JSON.stringify(res1.data)}`);
    }

    const mgr1 = await User.findById(res1.data.agent._id);
    console.log('Created Manager Details:');
    console.log(' - Name:', mgr1.name);
    console.log(' - Role:', mgr1.role);
    console.log(' - CompanyRole:', mgr1.companyRole);
    console.log(' - WorkStatus:', mgr1.workStatus);
    console.log(' - IndustryType:', mgr1.industryType);
    console.log(' - Usercode:', mgr1.usercode);

    if (mgr1.role !== 'manager') throw new Error(`Expected role 'manager', got '${mgr1.role}'`);
    if (mgr1.companyRole !== 'manager') throw new Error(`Expected companyRole 'manager', got '${mgr1.companyRole}'`);
    if (mgr1.industryType !== 'Real Estate') throw new Error(`Expected industryType 'Real Estate', got '${mgr1.industryType}'`);
    if (mgr1.workStatus !== 'employee') throw new Error(`Expected workStatus 'employee', got '${mgr1.workStatus}'`);

    // 3. Add Manager via POST /api/admin/agents
    console.log('\n--- Test 2: Add Manager via /api/admin/agents ---');
    const req2 = {
      user: reOwner,
      body: {
        name: 'Sunil Admin Manager',
        email: 'sunil.mgr@realestate.com',
        phone: '9876500002',
        password: 'password123',
        role: 'manager',
        companyRole: 'manager',
        leadCap: 75,
      },
    };
    const res2 = mockResponse();
    await adminController.createAdminAgent(req2, res2);

    if (res2.statusCode !== 201 || !res2.data?.user) {
      throw new Error(`Failed to create admin manager: ${JSON.stringify(res2.data)}`);
    }

    const mgr2 = await User.findById(res2.data.user._id);
    console.log('Created Admin Manager Details:');
    console.log(' - Name:', mgr2.name);
    console.log(' - Role:', mgr2.role);
    console.log(' - CompanyRole:', mgr2.companyRole);
    console.log(' - WorkStatus:', mgr2.workStatus);
    console.log(' - IndustryType:', mgr2.industryType);

    if (mgr2.role !== 'manager') throw new Error(`Expected role 'manager', got '${mgr2.role}'`);
    if (mgr2.companyRole !== 'manager') throw new Error(`Expected companyRole 'manager', got '${mgr2.companyRole}'`);
    if (mgr2.industryType !== 'Real Estate') throw new Error(`Expected industryType 'Real Estate', got '${mgr2.industryType}'`);

    // 4. Test /real-estate/team/members returns both managers
    console.log('\n--- Test 3: Verify /real-estate/team/members list ---');
    const reqMbrs = { user: reOwner };
    const resMbrs = mockResponse();
    await realEstateController.getManagerTeamMembers(reqMbrs, resMbrs);

    if (resMbrs.statusCode !== 200 || !Array.isArray(resMbrs.data?.data)) {
      throw new Error(`Failed to fetch team members: ${JSON.stringify(resMbrs.data)}`);
    }

    const members = resMbrs.data.data;
    console.log(`✓ Fetched ${members.length} team members:`);
    members.forEach(m => {
      console.log(`   - ${m.name} | Role: ${m.role} | CompanyRole: ${m.companyRole}`);
    });

    const amitabh = members.find(m => m.name === 'Amitabh Senior Manager');
    const sunil = members.find(m => m.name === 'Sunil Admin Manager');

    if (!amitabh || amitabh.role !== 'manager' || amitabh.companyRole !== 'manager') {
      throw new Error('Amitabh role check failed in /real-estate/team/members');
    }
    if (!sunil || sunil.role !== 'manager' || sunil.companyRole !== 'manager') {
      throw new Error('Sunil role check failed in /real-estate/team/members');
    }

    // 5. Test /company/agents returns enriched list with manager role
    console.log('\n--- Test 4: Verify /company/agents list ---');
    const reqComp = { user: reOwner };
    const resComp = mockResponse();
    await companyController.getCompanyAgents(reqComp, resComp);

    if (resComp.statusCode !== 200 || !Array.isArray(resComp.data?.agents)) {
      throw new Error(`Failed to fetch company agents: ${JSON.stringify(resComp.data)}`);
    }

    const compAgents = resComp.data.agents;
    const amitabhComp = compAgents.find(a => a.name === 'Amitabh Senior Manager');
    if (!amitabhComp || amitabhComp.role !== 'manager' || amitabhComp.companyRole !== 'manager') {
      throw new Error('Amitabh role check failed in /company/agents');
    }

    console.log('\n🎉 ALL REAL ESTATE MANAGER TESTS PASSED SUCCESSFULLY! ✅');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
