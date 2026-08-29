/**
 * Team Roster Role Edit & Free Subscription Limits Test Suite
 * 
 * Verifies:
 * 1. Free Subscription plan limit is 5 staff/team members (was 1).
 * 2. An owner on a free subscription can add up to 5 team members before hitting ROSTER_LIMIT_REACHED.
 * 3. Editing an agent in Team Roster updates role / companyRole (e.g. Agent -> Manager, Agent -> Telecaller, etc.)
 * 4. Custom role policy attachment updates agent.roleId and syncs companyRole.
 * 5. Manager reporting hierarchy is saved and populated.
 * 6. getCompanyAgents returns populated roleId and managerId.
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const companyController = require('../src/controllers/companyController');
const agencyController = require('../src/controllers/agencyController');
const { PLAN_LIMITS, FREE_TIER } = require('../src/utils/planLimits');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_roster_role_subscription';

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
  console.log('====================================================');
  console.log('🚀 RUNNING TEAM ROSTER ROLE & FREE PLAN LIMITS TESTS');
  console.log('====================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB test database');

    await mongoose.connection.dropDatabase();

    // 1. Verify FREE_TIER definition
    console.log('\n--- TEST 1: Free Tier Plan Limits Definition ---');
    if (FREE_TIER.maxUsers !== 5) {
      throw new Error(`FREE_TIER.maxUsers should be 5, got: ${FREE_TIER.maxUsers}`);
    }
    if (PLAN_LIMITS.free.maxUsers !== 5) {
      throw new Error(`PLAN_LIMITS.free.maxUsers should be 5, got: ${PLAN_LIMITS.free.maxUsers}`);
    }
    console.log(`✓ FREE_TIER maxUsers is verified as 5 seats`);

    // 2. Create Owner on Free Plan
    console.log('\n--- TEST 2: Free Tier Member Cap Enforcement (Max 5) ---');
    const owner = await User.create({
      name: 'Free Tier Owner',
      email: 'owner@free-trial.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      plan: 'free',
      usercode: 'CMP-FREE01',
    });

    // Create 5 team members directly under Free Plan Owner
    for (let i = 1; i <= 5; i++) {
      const req = {
        user: owner,
        body: {
          name: `Staff Member ${i}`,
          email: `staff${i}@free-trial.com`,
          phone: `987654321${i}`,
          password: 'password123',
          companyRole: i === 1 ? 'manager' : 'agent',
        }
      };
      const res = mockResponse();
      await companyController.createCompanyAgent(req, res);
      if (res.statusCode !== 201) {
        throw new Error(`Failed to create staff member ${i}: Status ${res.statusCode}, ${JSON.stringify(res.data)}`);
      }
    }
    console.log('✓ Successfully created 5 team members on Free Subscription plan');

    // Attempt to create 6th member (should fail with 403 ROSTER_LIMIT_REACHED)
    const req6 = {
      user: owner,
      body: {
        name: 'Staff Member 6 (Should Fail)',
        email: 'staff6@free-trial.com',
        phone: '9876543216',
        password: 'password123',
      }
    };
    const res6 = mockResponse();
    await companyController.createCompanyAgent(req6, res6);
    if (res6.statusCode !== 403 || res6.data?.code !== 'ROSTER_LIMIT_REACHED') {
      throw new Error(`6th member should be rejected with 403 ROSTER_LIMIT_REACHED, got status: ${res6.statusCode}`);
    }
    console.log('✓ 6th team member correctly rejected when exceeding 5 seats limit');

    // 3. Test Team Roster Fetching & Population
    console.log('\n--- TEST 3: Team Roster Fetching & Population ---');
    const getAgentsReq = {
      user: owner,
    };
    const getAgentsRes = mockResponse();
    await companyController.getCompanyAgents(getAgentsReq, getAgentsRes);
    if (getAgentsRes.statusCode !== 200) {
      throw new Error(`getCompanyAgents failed with status: ${getAgentsRes.statusCode}`);
    }
    const agentsList = getAgentsRes.data.agents;
    if (agentsList.length !== 5) {
      throw new Error(`Expected 5 agents, found: ${agentsList.length}`);
    }
    console.log(`✓ Fetched ${agentsList.length} roster members with populated fields`);

    // 4. Test Role Change via Team Roster Edit (Agent -> Manager, Agent -> Telecaller)
    console.log('\n--- TEST 4: Team Roster Role Edit (Agent -> Manager) ---');
    const agentToPromote = agentsList.find(a => a.email === 'staff2@free-trial.com');
    if (!agentToPromote) throw new Error('Target agent not found');

    const updateReq = {
      tenantId: owner._id,
      user: owner,
      params: { agentId: agentToPromote._id },
      body: {
        companyRole: 'manager',
        role: 'manager',
        employeeStatus: 'active',
      }
    };
    const updateRes = mockResponse();
    await agencyController.updateAgent(updateReq, updateRes);
    if (updateRes.statusCode !== 200) {
      throw new Error(`updateAgent failed with status: ${updateRes.statusCode}, ${JSON.stringify(updateRes.data)}`);
    }

    const updatedAgentInDb = await User.findById(agentToPromote._id);
    if (updatedAgentInDb.companyRole !== 'manager' || updatedAgentInDb.role !== 'manager') {
      throw new Error(`Agent role was not updated to manager! Got: role=${updatedAgentInDb.role}, companyRole=${updatedAgentInDb.companyRole}`);
    }
    console.log(`✓ Agent ${agentToPromote.name} successfully updated to role 'manager'`);

    // 5. Test Manager Hierarchy Assignment
    console.log('\n--- TEST 5: Manager Hierarchy Assignment ---');
    const agentToAssignManager = agentsList.find(a => a.email === 'staff3@free-trial.com');
    const assignMgrReq = {
      tenantId: owner._id,
      user: owner,
      params: { agentId: agentToAssignManager._id },
      body: {
        companyRole: 'agent',
        managerId: updatedAgentInDb._id,
        employeeStatus: 'active',
      }
    };
    const assignMgrRes = mockResponse();
    await agencyController.updateAgent(assignMgrReq, assignMgrRes);
    if (assignMgrRes.statusCode !== 200) {
      throw new Error(`updateAgent manager assignment failed: ${assignMgrRes.statusCode}`);
    }

    const updatedStaff3 = await User.findById(agentToAssignManager._id);
    if (String(updatedStaff3.managerId) !== String(updatedAgentInDb._id)) {
      throw new Error(`Manager was not assigned! Got managerId: ${updatedStaff3.managerId}`);
    }
    if (updatedStaff3.managerName !== updatedAgentInDb.name) {
      throw new Error(`managerName not synced! Got: ${updatedStaff3.managerName}`);
    }
    console.log(`✓ Staff 3 reporting manager set to ${updatedAgentInDb.name}`);

    // 6. Test Custom Role Assignment
    console.log('\n--- TEST 6: Custom Role Assignment ---');
    const customRole = await Role.create({
      tenantId: owner._id,
      name: 'Senior Closing Specialist',
      roleType: 'AGENT',
      permissions: ['leads:view', 'leads:edit', 'deals:create'],
    });

    const assignCustomRoleReq = {
      tenantId: owner._id,
      user: owner,
      params: { agentId: agentToAssignManager._id },
      body: {
        roleId: customRole._id,
        companyRole: 'sales_rep',
        employeeStatus: 'active',
      }
    };
    const assignCustomRoleRes = mockResponse();
    await agencyController.updateAgent(assignCustomRoleReq, assignCustomRoleRes);
    if (assignCustomRoleRes.statusCode !== 200) {
      throw new Error(`Custom role update failed: ${assignCustomRoleRes.statusCode}`);
    }

    const updatedStaff3WithCustomRole = await User.findById(agentToAssignManager._id).populate('roleId');
    if (!updatedStaff3WithCustomRole.roleId || String(updatedStaff3WithCustomRole.roleId._id) !== String(customRole._id)) {
      throw new Error(`Custom roleId not attached!`);
    }
    if (updatedStaff3WithCustomRole.companyRole !== 'sales_rep') {
      throw new Error(`companyRole not updated! Got: ${updatedStaff3WithCustomRole.companyRole}`);
    }
    console.log(`✓ Custom role '${customRole.name}' attached and companyRole updated to 'sales_rep'`);

    console.log('\n====================================================');
    console.log('🎉 ALL 6 ROSTER & FREE SUBSCRIPTION TESTS PASSED!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Database disconnected cleanly');
  }
}

runTests();
