const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_matrix_secret_key_32_bytes_long_!';
process.env.QUICK_ACTION_SECRET = 'test_quick_action_secret_key_32_bytes!';
process.env.PORT = '0';

async function runMatrix() {
  console.log('🚀 Starting Cross-Tenant & RBAC Route Authorization Generator...\n');

  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  process.env.MONGO_URI = mongoUri;
  process.env.MONGODB_URI = mongoUri;

  await mongoose.connect(mongoUri);

  const User = require('../src/models/User');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');
  const Lead = require('../src/models/Lead');
  const AdmissionDeal = require('../src/models/AdmissionDeal');
  const Deal = AdmissionDeal;
  const Campaign = require('../src/models/Campaign');
  const FollowUp = require('../src/models/FollowUp');
  const AutomationRule = require('../src/models/AutomationRule');
  const { generateToken } = require('../src/middleware/auth');

  // 1. Seed Tenant A
  const companyAId = new mongoose.Types.ObjectId();
  const wsA = await Workspace.create({
    name: 'Workspace Alpha',
    slug: 'ws-alpha',
    ownerId: companyAId,
  });

  const ownerA = await User.create({
    _id: companyAId,
    name: 'Owner Alpha',
    email: 'owner@alpha.local',
    password: 'Password123!',
    role: 'owner',
    companyRole: 'owner',
    companyId: companyAId,
    workspaceId: wsA._id,
    tokenVersion: 1,
  });

  const adminA = await User.create({
    name: 'Admin Alpha',
    email: 'admin@alpha.local',
    password: 'Password123!',
    role: 'admin',
    isAdmin: false,
    companyRole: 'owner',
    companyId: companyAId,
    workspaceId: wsA._id,
    tokenVersion: 1,
  });

  const managerA = await User.create({
    name: 'Manager Alpha',
    email: 'manager@alpha.local',
    password: 'Password123!',
    role: 'manager',
    companyRole: 'manager',
    companyId: companyAId,
    workspaceId: wsA._id,
    tokenVersion: 1,
  });

  const counselorA = await User.create({
    name: 'Counselor Alpha',
    email: 'counselor@alpha.local',
    password: 'Password123!',
    role: 'counsellor',
    companyRole: 'counsellor',
    companyId: companyAId,
    workspaceId: wsA._id,
    tokenVersion: 1,
  });

  await WorkspaceMembership.create([
    { workspaceId: wsA._id, userId: ownerA._id, role: 'owner', status: 'active' },
    { workspaceId: wsA._id, userId: adminA._id, role: 'owner', status: 'active' },
    { workspaceId: wsA._id, userId: managerA._id, role: 'manager', status: 'active' },
    { workspaceId: wsA._id, userId: counselorA._id, role: 'counsellor', status: 'active' },
  ]);

  // 2. Seed Tenant B
  const companyBId = new mongoose.Types.ObjectId();
  const wsB = await Workspace.create({
    name: 'Workspace Beta',
    slug: 'ws-beta',
    ownerId: companyBId,
  });

  const ownerB = await User.create({
    _id: companyBId,
    name: 'Owner Beta',
    email: 'owner@beta.local',
    password: 'Password123!',
    role: 'owner',
    companyRole: 'owner',
    companyId: companyBId,
    workspaceId: wsB._id,
    tokenVersion: 1,
  });

  const leadB = await Lead.create({
    name: 'Beta Secret Lead',
    phone: '+919876599999',
    email: 'secret@beta.local',
    workspaceId: wsB._id,
    companyId: companyBId,
    userId: ownerB._id,
    status: 'new_lead',
  });

  const dealB = await Deal.create({
    studentName: 'Beta Student',
    collegeName: 'Beta University',
    courseName: 'MBA Tech',
    dealValue: 500000,
    workspaceId: wsB._id,
    companyId: companyBId,
    userId: ownerB._id,
    createdBy: ownerB._id,
    status: 'open',
  });

  const campaignB = await Campaign.create({
    name: 'Beta Private Campaign',
    workspaceId: wsB._id,
    companyId: companyBId,
    createdBy: ownerB._id,
  });

  const followUpB = await FollowUp.create({
    leadId: leadB._id,
    lead_id: leadB._id,
    agentId: ownerB._id,
    agent_id: ownerB._id,
    workspaceId: wsB._id,
    companyId: companyBId,
    scheduledAt: new Date(),
    scheduled_at: new Date(),
    note: 'Follow-up on admission status',
    status: 'open',
  });

  const ruleB = await AutomationRule.create({
    name: 'Beta Confidential Automation',
    workspaceId: wsB._id,
    userId: ownerB._id,
    triggerType: 'lead_created',
    actions: [{ order: 1, actionType: 'add_lead_tag', config: { tagToAdd: 'beta-only' } }],
    isActive: true,
  });

  // 3. Platform SuperAdmin
  const superAdmin = await User.create({
    name: 'Platform SuperAdmin',
    email: 'superadmin@sahyak.local',
    password: 'Password123!',
    role: 'superadmin',
    isAdmin: true,
    twoFactorEnabled: true,
    tokenVersion: 1,
  });

  // Tokens
  const tokens = {
    unauthenticated: null,
    counselor: generateToken(counselorA),
    manager: generateToken(managerA),
    admin: generateToken(adminA),
    owner: generateToken(ownerA),
    superadmin: generateToken(superAdmin),
  };

  // 4. Server
  const { app, server } = require('../server.js');
  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }
  const actualPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${actualPort}`;
  console.log(`Testing against server listening on ${baseUrl}\n`);

  async function makeRequest({ method, path, token, workspaceId, body }) {
    return new Promise((resolve) => {
      const u = new URL(path, baseUrl);
      const req = http.request(
        u.href,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(workspaceId ? { 'x-workspace-id': String(workspaceId) } : {}),
          },
          timeout: 2500,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            resolve({ status: res.statusCode, body: data });
          });
        }
      );
      req.on('timeout', () => {
        req.destroy(new Error('timeout'));
        resolve({ status: 408, error: 'timeout' });
      });
      req.on('error', (err) => resolve({ status: 500, error: err.message }));
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // 5. Matrix Test Route Catalog
  // Dynamic Route Introspection
  function getRegisteredRoutesCount(stack) {
    let count = 0;
    stack.forEach(layer => {
      if (layer.route) {
        count += Object.keys(layer.route.methods).length;
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        count += getRegisteredRoutesCount(layer.handle.stack);
      }
    });
    return count;
  }
  const totalRouterRoutes = getRegisteredRoutesCount(app._router.stack);

  const routesToTest = [
    // SuperAdmin routes
    { method: 'GET', path: '/api/super-admin/overview', superadminOnly: true },
    { method: 'GET', path: '/api/super-admin/organisations', superadminOnly: true },
    { method: 'GET', path: '/api/super-admin/users', superadminOnly: true },
    { method: 'GET', path: '/api/super-admin/health', superadminOnly: true },
    { method: 'GET', path: '/api/super-admin/plans', superadminOnly: true },
    { method: 'GET', path: '/api/super-admin/coupons', superadminOnly: true },
    { method: 'GET', path: '/api/super-admin/broadcasts', superadminOnly: true },
    { method: 'GET', path: '/api/superadmin/notifications/reminder-health', superadminOnly: true },
    { method: 'GET', path: '/api/admin/users', superadminOnly: true },
    { method: 'GET', path: '/api/admin/system-health', superadminOnly: true },

    // Admin & Management routes
    { method: 'GET', path: '/api/admin/overview', ownerOnly: true },
    { method: 'GET', path: '/api/admin/agents', managerOrAdmin: true },

    // Workspace Administration
    { method: 'GET', path: '/api/workspace/current', memberOnly: true },
    { method: 'GET', path: '/api/workspace/members', managerOrAdmin: true },
    { method: 'GET', path: '/api/workspace/invitations', managerOrAdmin: true },
    { method: 'PUT', path: `/api/workspace/members/${ownerB._id}/role`, crossTenantCheck: true, body: { role: 'counsellor' } },

    // Leads & Cross-Tenant
    { method: 'GET', path: '/api/leads', memberOnly: true },
    { method: 'GET', path: `/api/leads/${leadB._id}`, crossTenantCheck: true }, // Foreign Lead
    { method: 'PUT', path: `/api/leads/${leadB._id}`, crossTenantCheck: true, body: { status: 'hacked' } },
    { method: 'DELETE', path: `/api/leads/${leadB._id}`, crossTenantCheck: true },
    { method: 'POST', path: `/api/leads/${leadB._id}/notes`, crossTenantCheck: true, body: { text: 'Cross-tenant note attempt' } },
    { method: 'POST', path: `/api/leads/${leadB._id}/unmask-phone`, crossTenantCheck: true },

    // Deals & Cross-Tenant
    { method: 'GET', path: '/api/deals', memberOnly: true },
    { method: 'GET', path: `/api/deals/${dealB._id}`, crossTenantCheck: true }, // Foreign Deal
    { method: 'PUT', path: `/api/deals/${dealB._id}`, crossTenantCheck: true, body: { title: 'hacked deal' } },

    // Campaigns & Cross-Tenant
    { method: 'GET', path: '/api/campaigns', memberOnly: true },
    { method: 'GET', path: `/api/campaigns/${campaignB._id}`, crossTenantCheck: true }, // Foreign Campaign
    { method: 'GET', path: `/api/campaigns/${campaignB._id}/leads`, crossTenantCheck: true }, // Foreign Campaign Leads

    // Automations & Cross-Tenant
    { method: 'GET', path: '/api/automations', memberOnly: true },
    { method: 'GET', path: `/api/automations/${ruleB._id}`, crossTenantCheck: true }, // Foreign Automation Rule
    { method: 'DELETE', path: `/api/automations/${ruleB._id}`, crossTenantCheck: true },

    // Analytics
    { method: 'GET', path: '/api/analytics', managerOrAdmin: true },

    // Catalogue
    { method: 'GET', path: '/api/catalogue', memberOnly: true },
    { method: 'GET', path: '/api/catalogue/my-catalogue', memberOnly: true },

    // Notifications
    { method: 'GET', path: '/api/notifications/unread-count', memberOnly: true },
    { method: 'GET', path: '/api/notifications/unacknowledged-count', memberOnly: true },
    { method: 'GET', path: '/api/notifications/push/health', memberOnly: true },
  ];

  console.log(`Express Router Total Registered Handlers: ${totalRouterRoutes}`);
  console.log(`Evaluating ${routesToTest.length} critical unique routes (${Math.round((routesToTest.length / totalRouterRoutes) * 100)}% structural core) across 6 roles + cross-tenant boundary...\n`);

  const results = [];
  let violations = 0;

  for (const r of routesToTest) {
    // 1. Unauthenticated test
    const unauthRes = await makeRequest({ method: r.method, path: r.path, token: null });
    const unauthExpected = [401, 403];
    const unauthPass = unauthExpected.includes(unauthRes.status);
    results.push({
      route: `${r.method} ${r.path}`,
      role: 'unauthenticated',
      expected: '401/403',
      actual: unauthRes.status,
      pass: unauthPass,
    });
    if (!unauthPass) violations++;

    // 2. Counselor test
    const counselorRes = await makeRequest({ method: r.method, path: r.path, token: tokens.counselor, workspaceId: wsA._id, body: r.body });
    let counselorExpected;
    if (r.superadminOnly || r.ownerOnly || r.managerOrAdmin || r.crossTenantCheck) {
      counselorExpected = [403, 404];
    } else {
      counselorExpected = [200, 201, 204];
    }
    const counselorPass = counselorExpected.includes(counselorRes.status);
    results.push({
      route: `${r.method} ${r.path}`,
      role: 'counselor',
      expected: counselorExpected.join('/'),
      actual: counselorRes.status,
      pass: counselorPass,
    });
    if (!counselorPass) violations++;

    // 3. Manager test
    const managerRes = await makeRequest({ method: r.method, path: r.path, token: tokens.manager, workspaceId: wsA._id, body: r.body });
    let managerExpected;
    if (r.superadminOnly || r.ownerOnly || r.crossTenantCheck) {
      managerExpected = [403, 404];
    } else {
      managerExpected = [200, 201, 204];
    }
    const managerPass = managerExpected.includes(managerRes.status);
    results.push({
      route: `${r.method} ${r.path}`,
      role: 'manager',
      expected: managerExpected.join('/'),
      actual: managerRes.status,
      pass: managerPass,
    });
    if (!managerPass) violations++;

    // 4. Admin test
    const adminRes = await makeRequest({ method: r.method, path: r.path, token: tokens.admin, workspaceId: wsA._id, body: r.body });
    let adminExpected;
    if (r.superadminOnly || r.crossTenantCheck) {
      adminExpected = [403, 404];
    } else {
      adminExpected = [200, 201, 204];
    }
    const adminPass = adminExpected.includes(adminRes.status);
    results.push({
      route: `${r.method} ${r.path}`,
      role: 'admin',
      expected: adminExpected.join('/'),
      actual: adminRes.status,
      pass: adminPass,
    });
    if (!adminPass) violations++;

    // 5. Owner test
    const ownerRes = await makeRequest({ method: r.method, path: r.path, token: tokens.owner, workspaceId: wsA._id, body: r.body });
    let ownerExpected;
    if (r.superadminOnly || r.crossTenantCheck) {
      ownerExpected = [403, 404];
    } else {
      ownerExpected = [200, 201, 204];
    }
    const ownerPass = ownerExpected.includes(ownerRes.status);
    results.push({
      route: `${r.method} ${r.path}`,
      role: 'owner',
      expected: ownerExpected.join('/'),
      actual: ownerRes.status,
      pass: ownerPass,
    });
    if (!ownerPass) violations++;

    // 6. SuperAdmin test
    const saRes = await makeRequest({ method: r.method, path: r.path, token: tokens.superadmin, workspaceId: wsA._id, body: r.body });
    // SuperAdmin should access superadmin routes with 200
    if (r.superadminOnly) {
      const saPass = [200, 201].includes(saRes.status);
      results.push({
        route: `${r.method} ${r.path}`,
        role: 'superadmin',
        expected: '200',
        actual: saRes.status,
        pass: saPass,
      });
      if (!saPass) violations++;
    }
  }

  // Print Summary Table
  console.log('| Route | Role | Expected | Actual | Pass? |');
  console.log('|---|---|---|---|---|');
  results.forEach((r) => {
    console.log(`| \`${r.route}\` | ${r.role} | ${r.expected} | ${r.actual} | ${r.pass ? '✅ PASS' : '❌ FAIL'} |`);
  });

  console.log(`\nTotal checks: ${results.length}. Violations (2xx where 403/404 required): ${violations}`);

  try {
    const apiPerformance = require('../src/middleware/apiPerformance');
    if (apiPerformance && typeof apiPerformance.flush === 'function') {
      await apiPerformance.flush();
    }
  } catch (_) {}

  server.close();
  await mongoose.disconnect();
  await mongod.stop();

  if (violations > 0) {
    console.error(`\n❌ Matrix check failed with ${violations} security violations!`);
    process.exit(1);
  } else {
    console.log('\n🛡️ ALL CROSS-TENANT & AUTHORIZATION CHECKS PASSED WITH ZERO VIOLATIONS!');
    process.exit(0);
  }
}

runMatrix().catch((err) => {
  console.error('Fatal error running matrix:', err);
  process.exit(1);
});
