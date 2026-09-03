const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Role = require('../src/models/Role');
const { getLeads, getLead, reassignLead, releaseLead } = require('../src/controllers/leadsController');
const { getCompanyAgents } = require('../src/controllers/companyController');

const runTest = async () => {
  console.log('🧪 Starting Lead Assignment, Pool & Release Test Suite...');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MongoDB URI not found in .env');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const ts = Date.now();

  // 1. Create Organization Owner, Manager, Agent 1, Agent 2
  const owner = await User.create({
    name: `Owner_${ts}`,
    email: `owner_${ts}@test.com`,
    phone: `99${ts.toString().slice(-8)}`,
    password: 'password123',
    workStatus: 'company_owner',
    companyRole: 'owner',
    role: 'admin',
  });

  const manager = await User.create({
    name: `Manager_${ts}`,
    email: `manager_${ts}@test.com`,
    phone: `98${ts.toString().slice(-8)}`,
    password: 'password123',
    companyId: owner._id,
    workStatus: 'agent',
    companyRole: 'manager',
    role: 'manager',
  });

  const agent1 = await User.create({
    name: `Agent1_${ts}`,
    email: `agent1_${ts}@test.com`,
    phone: `97${ts.toString().slice(-8)}`,
    password: 'password123',
    companyId: owner._id,
    workStatus: 'agent',
    companyRole: 'agent',
    role: 'agent',
  });

  const agent2 = await User.create({
    name: `Agent2_${ts}`,
    email: `agent2_${ts}@test.com`,
    phone: `96${ts.toString().slice(-8)}`,
    password: 'password123',
    companyId: owner._id,
    workStatus: 'agent',
    companyRole: 'agent',
    role: 'agent',
  });

  console.log('✅ Created Owner, Manager, Agent 1, Agent 2');

  // Test 1: Manager and Owner get company agents list
  let agentsList = [];
  const reqAgents = { user: manager };
  const resAgents = {
    json: (data) => { agentsList = data.agents; },
    status: () => resAgents,
  };
  await getCompanyAgents(reqAgents, resAgents);
  console.log(`✅ Manager fetched ${agentsList.length} company agents (Expected: >=3)`);
  if (!agentsList || agentsList.length < 3) throw new Error('Failed to fetch agents for manager');

  // Test 2: Create an Unassigned Lead in the Company
  const unassignedLead = await Lead.create({
    name: `Unassigned Lead ${ts}`,
    phone: `95${ts.toString().slice(-8)}`,
    userId: owner._id,
    companyId: owner._id,
    status: 'new_lead',
    assignedTo: null,
    currentOwnerId: null,
    ownershipStatus: 'unclaimed',
  });

  // Test 3: Create Lead Assigned to Agent 1
  const agent1Lead = await Lead.create({
    name: `Agent 1 Lead ${ts}`,
    phone: `94${ts.toString().slice(-8)}`,
    userId: owner._id,
    companyId: owner._id,
    status: 'new_lead',
    assignedTo: agent1._id,
    assignedToName: agent1.name,
    currentOwnerId: agent1._id,
    ownershipStatus: 'assigned',
  });

  // Test 4: Agent 1 views "My Leads"
  let agent1Leads = [];
  await getLeads({ user: agent1, query: {} }, {
    json: (data) => { agent1Leads = data.leads; },
    status: (code) => ({ json: (err) => { console.error(err); } }),
  });
  console.log(`Agent 1 sees ${agent1Leads.length} leads in My Leads`);
  const agent1SeesOwnLead = agent1Leads.some(l => String(l._id) === String(agent1Lead._id));
  const agent1SeesUnassigned = agent1Leads.some(l => String(l._id) === String(unassignedLead._id));
  if (!agent1SeesOwnLead) throw new Error('Agent 1 must see own assigned lead');
  if (agent1SeesUnassigned) throw new Error('Agent 1 must NOT see unassigned leads in My Leads');
  console.log('✅ Agent 1 sees own assigned lead and NOT unassigned leads in My Leads');

  // Test 5: Agent 2 views "My Leads" -> Must NOT see Agent 1's lead
  let agent2Leads = [];
  await getLeads({ user: agent2, query: {} }, {
    json: (data) => { agent2Leads = data.leads; },
    status: () => ({ json: () => {} }),
  });
  const agent2SeesAgent1Lead = agent2Leads.some(l => String(l._id) === String(agent1Lead._id));
  if (agent2SeesAgent1Lead) throw new Error('Agent 2 MUST NOT see Agent 1 lead (Privacy Violation)');
  console.log('✅ Agent 2 CANNOT see Agent 1 assigned lead (Strict Privacy Enforced)');

  // Test 6: Agent 2 views Unassigned Pool
  let unassignedPoolLeads = [];
  await getLeads({ user: agent2, query: { unclaimed: 'true' } }, {
    json: (data) => { unassignedPoolLeads = data.leads; },
    status: () => ({ json: () => {} }),
  });
  const poolHasUnassignedLead = unassignedPoolLeads.some(l => String(l._id) === String(unassignedLead._id));
  const poolHasAgent1Lead = unassignedPoolLeads.some(l => String(l._id) === String(agent1Lead._id));
  if (!poolHasUnassignedLead) throw new Error('Unassigned lead must be present in Unassigned Pool');
  if (poolHasAgent1Lead) throw new Error('Assigned lead must NOT be in Unassigned Pool');
  console.log('✅ Unassigned Pool contains unassigned leads and excludes claimed leads');

  // Test 7: Agent 2 claims the Unassigned Lead
  await reassignLead(
    { user: agent2, params: { id: unassignedLead._id }, body: { toAgentId: agent2._id, reason: 'Claimed by Agent 2' } },
    { json: (d) => {}, status: () => ({ json: () => {} }) }
  );
  const claimedLead = await Lead.findById(unassignedLead._id);
  if (String(claimedLead.assignedTo) !== String(agent2._id)) throw new Error('Lead claim failed');
  console.log('✅ Agent 2 successfully claimed the unassigned lead');

  // Test 8: Agent 2 releases the claimed lead back to pool with reason
  await releaseLead(
    { user: agent2, params: { id: claimedLead._id }, body: { reason: 'Client looking for 4BHK in South Mumbai outside my area' } },
    {
      json: (d) => { console.log('Release response:', d.message); },
      status: (code) => ({ json: (e) => { throw new Error(`Release failed with status ${code}: ${JSON.stringify(e)}`); } })
    }
  );
  const releasedLead = await Lead.findById(claimedLead._id);
  if (releasedLead.assignedTo !== null) throw new Error('Released lead must have assignedTo = null');
  if (releasedLead.releaseReason !== 'Client looking for 4BHK in South Mumbai outside my area') throw new Error('Release reason not stored');
  if (String(releasedLead.releasedBy) !== String(agent2._id)) throw new Error('releasedBy not stored');
  console.log('✅ Lead successfully released to Unassigned Pool with reason stored');

  // Test 9: Manager views all leads
  let managerLeads = [];
  await getLeads({ user: manager, query: {} }, {
    json: (data) => { managerLeads = data.leads; },
    status: () => ({ json: () => {} }),
  });
  console.log(`✅ Manager sees ${managerLeads.length} leads across the entire company`);

  // Clean up test data
  await User.deleteMany({ _id: { $in: [owner._id, manager._id, agent1._id, agent2._id] } });
  await Lead.deleteMany({ _id: { $in: [unassignedLead._id, agent1Lead._id] } });
  console.log('🧹 Cleaned up test data');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);
};

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
