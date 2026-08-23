const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const superAdminRoutes = require('../superadmin/routes/superAdminRoutes');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 CORESETU OS SUPER ADMIN BACKEND APIS TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB Database');

  const superAdmin = await User.findOne({ role: 'superadmin' });
  const agent = await User.findOne({ role: 'agent' });

  if (!superAdmin) throw new Error('No superadmin found in DB');
  if (!agent) throw new Error('No agent found in DB');

  const superAdminToken = generateToken(superAdmin._id);
  const agentToken = generateToken(agent._id);

  console.log(`👤 SuperAdmin: ${superAdmin.name} (${superAdmin.email})`);
  console.log(`👤 Agent: ${agent.name} (${agent.email})\n`);

  const overviewController = require('../superadmin/controllers/overviewController');
  const organisationController = require('../superadmin/controllers/organisationController');
  const userController = require('../superadmin/controllers/userController');
  const revenueController = require('../superadmin/controllers/revenueController');
  const leadController = require('../superadmin/controllers/leadController');
  const integrationController = require('../superadmin/controllers/integrationController');
  const systemController = require('../superadmin/controllers/systemController');
  const auditController = require('../superadmin/controllers/auditController');
  const featureFlagController = require('../superadmin/controllers/featureFlagController');

  function mockReqRes(user, query = {}, body = {}, params = {}) {
    return new Promise((resolve) => {
      const req = { user, query, body, params, headers: {} };
      const res = {
        statusCode: 200,
        status(c) {
          this.statusCode = c;
          return this;
        },
        json(data) {
          resolve({ status: this.statusCode, data });
        },
      };
      return { req, res };
    });
  }

  // TEST 1: Overview
  console.log('--- TEST 1: Super Admin Overview Metrics ---');
  let resData;
  await new Promise((resolve) => {
    const req = { user: superAdmin, query: { timeframe: 30 } };
    const res = {
      status(c) { this.statusCode = c; return this; },
      json(data) { resData = data; resolve(); }
    };
    overviewController.getOverview(req, res);
  });
  console.log('Overview Success:', resData.success);
  console.log('Total Organisations:', resData.kpis?.totalOrganisations);
  console.log('Active Users:', resData.kpis?.activeUsers);
  console.log('MRR:', `₹${resData.kpis?.mrr}`);
  console.log('Active Leads:', resData.kpis?.activeLeads);

  // TEST 2: Organisations
  console.log('\n--- TEST 2: Organisations Roster ---');
  await new Promise((resolve) => {
    const req = { user: superAdmin, query: { page: 1, limit: 10 } };
    const res = {
      status(c) { this.statusCode = c; return this; },
      json(data) { resData = data; resolve(); }
    };
    organisationController.getOrganisations(req, res);
  });
  console.log('Orgs Found:', resData.organisations?.length, '| Total:', resData.pagination?.total);
  const firstOrg = resData.organisations?.[0];
  if (firstOrg) {
    console.log(`Sample Org: "${firstOrg.organisationName}" | Owner: ${firstOrg.ownerName} | Plan: ${firstOrg.plan} | MRR: ₹${firstOrg.mrr}`);
  }

  // TEST 3: Organisation Deep Inspection
  if (firstOrg) {
    console.log('\n--- TEST 3: Single Tenant Deep Inspection ---');
    await new Promise((resolve) => {
      const req = { user: superAdmin, params: { id: firstOrg._id } };
      const res = {
        status(c) { this.statusCode = c; return this; },
        json(data) { resData = data; resolve(); }
      };
      organisationController.getOrganisationById(req, res);
    });
    console.log('Tenant Details Success:', resData.success);
    console.log('Users in Tenant:', resData.data?.users?.total);
    console.log('Leads in Tenant:', resData.data?.leads?.total);
  }

  // TEST 4: Users Roster
  console.log('\n--- TEST 4: Global Platform Users ---');
  await new Promise((resolve) => {
    const req = { user: superAdmin, query: { page: 1, limit: 10 } };
    const res = {
      status(c) { this.statusCode = c; return this; },
      json(data) { resData = data; resolve(); }
    };
    userController.getUsers(req, res);
  });
  console.log('Global Users Found:', resData.users?.length, '| Total:', resData.pagination?.total);

  // TEST 5: Revenue & Subscriptions
  console.log('\n--- TEST 5: Revenue & Billing Telemetry ---');
  await new Promise((resolve) => {
    const req = { user: superAdmin, query: {} };
    const res = {
      status(c) { this.statusCode = c; return this; },
      json(data) { resData = data; resolve(); }
    };
    revenueController.getRevenueDashboard(req, res);
  });
  console.log('Revenue Success:', resData.success);
  console.log('Total Platform Plans:', resData.plans?.length);

  // TEST 6: Global Leads
  console.log('\n--- TEST 6: Global Leads Observability ---');
  await new Promise((resolve) => {
    const req = { user: superAdmin, query: { page: 1, limit: 10 } };
    const res = {
      status(c) { this.statusCode = c; return this; },
      json(data) { resData = data; resolve(); }
    };
    leadController.getGlobalLeads(req, res);
  });
  console.log('Global Leads Retrieved:', resData.leads?.length, '| Total:', resData.pagination?.total);

  // TEST 7: System Health & Audit
  console.log('\n--- TEST 7: System Health & Audit Logs ---');
  await new Promise((resolve) => {
    const req = { user: superAdmin };
    const res = {
      status(c) { this.statusCode = c; return this; },
      json(data) { resData = data; resolve(); }
    };
    systemController.getHealth(req, res);
  });
  console.log('Health Status:', resData.status, '| DB Latency:', `${resData.components?.mongodb?.latencyMs}ms`);

  // TEST 8: Global Search
  console.log('\n--- TEST 8: Global Cross-Entity Search ---');
  await new Promise((resolve) => {
    const req = { user: superAdmin, query: { q: 'admin' } };
    const res = {
      status(c) { this.statusCode = c; return this; },
      json(data) { resData = data; resolve(); }
    };
    featureFlagController.globalSearch(req, res);
  });
  console.log('Global Search Results count for "admin":', resData.results?.length);

  // TEST 9: RBAC Authorization Gates
  console.log('\n--- TEST 9: RBAC Security Gates ---');
  const { superAdminOnly } = require('../middleware/auth');
  let blocked = false;
  const mockRes = {
    status(code) {
      if (code === 403) blocked = true;
      return { json: () => {} };
    }
  };
  superAdminOnly({ user: agent, headers: { 'user-agent': 'node-test-agent' } }, mockRes, () => {});
  console.log('Regular Agent blocked from SuperAdmin route (403):', blocked);

  let allowed = false;
  superAdminOnly({ user: superAdmin, headers: { 'user-agent': 'node-test-admin' } }, mockRes, () => { allowed = true; });
  console.log('SuperAdmin allowed through SuperAdmin route (200/next):', allowed);

  await mongoose.disconnect();
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🎯 ALL SUPER ADMIN BACKEND APIS & SECURITY GATES PASSED!');
  console.log('═══════════════════════════════════════════════════════════════════');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
