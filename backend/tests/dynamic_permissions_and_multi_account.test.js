/**
 * Dynamic Permissions & Centralized Multi-Account Test Suite
 * Validates:
 * 1. Dynamic editing of standard system roles (manager, counsellor, auditor) by Admin
 * 2. Instant cache eviction and enforcement across active user sessions
 * 3. Granular per-member permission overrides (+ Granted, ✕ Revoked)
 * 4. Centralized Multi-Account WhatsApp: Admin-only setup and strict counsellor line access
 * 5. Centralized Multi-Account Email: Admin-only setup and strict counsellor mailbox access
 * 6. Admin-only self-service integration management (Google Sheets, Webhooks)
 */

const axios = require('axios');
const assert = require('assert');
const mongoose = require('mongoose');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const WhatsAppAccount = require('../src/models/WhatsAppAccount');
const EmailAccount = require('../src/models/EmailAccount');
const Lead = require('../src/models/Lead');
const { DEFAULT_ROLE_PERMISSIONS } = require('../src/config/permissions');

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('🛡️  DYNAMIC PERMISSIONS & MULTI-ACCOUNT VERIFICATION SUITE');
  console.log('============================================================\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.response?.data) {
        console.error(`     Response:`, JSON.stringify(err.response.data));
      }
      failed++;
    }
  };

  const ts = Date.now();
  const ownerEmail = `owner_dyn_${ts}@testagency.com`;
  const counsellorAEmail = `counsellorA_${ts}@testagency.com`;
  const counsellorBEmail = `counsellorB_${ts}@testagency.com`;
  const password = 'Password@123456';

  let ownerToken, counsellorAToken, counsellorBToken;
  let ownerUser, counsellorAUser, counsellorBUser;
  let workspace;
  let memberADoc, memberBDoc;

  // ── SETUP WORKSPACE & USERS ───────────────────────────────────────────────
  await test('Bootstrap Workspace with Owner and 2 Counsellors via Invitations', async () => {
    // 1. Register Owner
    const regRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Owner Principal',
      email: ownerEmail,
      password,
      agencyName: `DynPerm Agency ${ts}`,
      phone: `9198${String(ts).slice(-8)}`,
      industryType: 'education',
      educationSubProfile: 'college_admissions',
    });
    assert.strictEqual(regRes.status, 201);
    ownerToken = regRes.data.token;
    ownerUser = regRes.data;

    // Upgrade owner to team-starter plan in DB so full plan feature entitlement is active
    await User.findByIdAndUpdate(ownerUser._id, {
      plan: 'team-starter',
      planEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    const wsRes = await axios.get(`${BASE_URL}/api/workspace/current`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(wsRes.status, 200);
    workspace = wsRes.data.workspace;
    assert.ok(workspace?._id, 'Workspace must exist for owner');

    // 2. Owner invites Counsellor A
    const invA = await axios.post(
      `${BASE_URL}/api/workspace/invitations`,
      { email: counsellorAEmail, role: 'counsellor' },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );
    assert.strictEqual(invA.status, 201);
    const tokenA = invA.data.data?.token || invA.data.invitation?.token;

    const acceptA = await axios.post(`${BASE_URL}/api/workspace/invitations/${tokenA}/accept`, {
      name: 'Counsellor Alice',
      password,
    });
    assert.strictEqual(acceptA.status, 200);
    counsellorAToken = acceptA.data.token;
    counsellorAUser = acceptA.data.user;

    // 3. Owner invites Counsellor B
    const invB = await axios.post(
      `${BASE_URL}/api/workspace/invitations`,
      { email: counsellorBEmail, role: 'counsellor' },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );
    assert.strictEqual(invB.status, 201);
    const tokenB = invB.data.data?.token || invB.data.invitation?.token;

    const acceptB = await axios.post(`${BASE_URL}/api/workspace/invitations/${tokenB}/accept`, {
      name: 'Counsellor Bob',
      password,
    });
    assert.strictEqual(acceptB.status, 200);
    counsellorBToken = acceptB.data.token;
    counsellorBUser = acceptB.data.user;

    // Fetch memberships
    memberADoc = await WorkspaceMembership.findOne({ workspaceId: workspace._id, userId: counsellorAUser._id });
    memberBDoc = await WorkspaceMembership.findOne({ workspaceId: workspace._id, userId: counsellorBUser._id });
    assert(memberADoc, 'Member A doc must exist');
    assert(memberBDoc, 'Member B doc must exist');

    // Seed 1 lead for testing
    await Lead.create({
      userId: counsellorAUser._id,
      assignedTo: counsellorAUser._id,
      companyId: ownerUser._id,
      name: 'Student Target',
      phone: '919999999999',
      stage: 'new',
      targetDomain: 'Engineering',
    });
  });

  // ── TEST 1: DYNAMIC SYSTEM ROLE PERMISSION EDITING ────────────────────────
  await test('Default Counsellor Role cannot export leads (403)', async () => {
    try {
      await axios.get(`${BASE_URL}/api/leads/export`, {
        headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) },
      });
      assert.fail('Should have been forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Counsellor without leads.export must be rejected with 403');
    }
  });

  await test('Admin dynamically grants leads.export to standard Counsellor role', async () => {
    const updatedCounsellorPerms = [
      ...DEFAULT_ROLE_PERMISSIONS.counsellor,
      { key: 'leads.export', scope: 'workspace' },
    ];

    const res = await axios.put(
      `${BASE_URL}/api/workspace/roles/system/counsellor`,
      { permissions: updatedCounsellorPerms },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  await test('Counsellor A can immediately export leads with zero cache lag (200 OK)', async () => {
    const res = await axios.get(`${BASE_URL}/api/leads/export`, {
      headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) },
    });
    assert.strictEqual(res.status, 200, 'Immediate export access granted');
  });

  await test('Admin dynamically revokes leads.export from standard Counsellor role', async () => {
    const revertedCounsellorPerms = DEFAULT_ROLE_PERMISSIONS.counsellor.filter(p => p.key !== 'leads.export');

    const res = await axios.put(
      `${BASE_URL}/api/workspace/roles/system/counsellor`,
      { permissions: revertedCounsellorPerms },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );

    assert.strictEqual(res.status, 200);
  });

  await test('Counsellor A is immediately blocked again from exporting leads (403 Forbidden)', async () => {
    try {
      await axios.get(`${BASE_URL}/api/leads/export`, {
        headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) },
      });
      assert.fail('Should have been forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Revocation must be enforced immediately');
    }
  });

  // ── TEST 2: PER-MEMBER GRANULAR OVERRIDES ──────────────────────────────────
  await test('Admin configures member-level override: grant leads.export to Counsellor A only', async () => {
    const res = await axios.put(
      `${BASE_URL}/api/workspace/members/${memberADoc._id}/permissions`,
      {
        permissionOverrides: [
          { key: 'leads.export', scope: 'workspace', granted: true },
        ],
      },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.hasCustomPermissions, true);
  });

  await test('Counsellor A with override can export leads (200 OK)', async () => {
    const res = await axios.get(`${BASE_URL}/api/leads/export`, {
      headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) },
    });
    assert.strictEqual(res.status, 200, 'Counsellor A must have export access via member override');
  });

  await test('Counsellor B without override remains forbidden from exporting (403 Forbidden)', async () => {
    try {
      await axios.get(`${BASE_URL}/api/leads/export`, {
        headers: { Authorization: `Bearer ${counsellorBToken}`, 'x-workspace-id': String(workspace._id) },
      });
      assert.fail('Should have been forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Counsellor B must NOT have export access');
    }
  });

  await test('Admin revokes leads.create specifically for Counsellor A via member override', async () => {
    await axios.put(
      `${BASE_URL}/api/workspace/members/${memberADoc._id}/permissions`,
      {
        permissionOverrides: [
          { key: 'leads.export', scope: 'workspace', granted: true },
          { key: 'leads.create', scope: 'workspace', granted: false }, // Explicit Revoke!
        ],
      },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );

    // Counsellor A tries to create a lead -> 403
    try {
      await axios.post(
        `${BASE_URL}/api/leads`,
        { name: 'Blocked Lead', phone: '919111111111', targetDomain: 'Engineering (B.Tech/BE)' },
        { headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) } }
      );
      assert.fail('Counsellor A should be forbidden from creating leads');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Explicit revoke must deny lead creation');
    }

    // Counsellor B still has default role permission -> allowed to create
    const createBRes = await axios.post(
      `${BASE_URL}/api/leads`,
      { name: 'Allowed Lead B', phone: '919222222222', targetDomain: 'Engineering (B.Tech/BE)' },
      { headers: { Authorization: `Bearer ${counsellorBToken}`, 'x-workspace-id': String(workspace._id) } }
    );
    assert.strictEqual(createBRes.status, 201, 'Counsellor B retains role default create access');
  });

  // ── TEST 3: CENTRALIZED MULTI-ACCOUNT WHATSAPP ─────────────────────────────
  let globalWaAccount, privateWaAccount;

  await test('Admin creates Global WhatsApp Line and Private WhatsApp Line for Counsellor A', async () => {
    // 1. Global line
    const globalRes = await axios.post(
      `${BASE_URL}/api/whatsapp/accounts`,
      {
        name: 'Main Agency WhatsApp Line',
        phoneNumber: '919900000001',
        type: 'baileys',
        sessionId: `session_global_${ts}`,
        isGlobal: true,
      },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );
    assert.strictEqual(globalRes.status, 201);
    globalWaAccount = globalRes.data.account;

    // 2. Private line assigned strictly to Counsellor A
    const privateRes = await axios.post(
      `${BASE_URL}/api/whatsapp/accounts`,
      {
        name: 'Alice Private WhatsApp Line',
        phoneNumber: '919900000002',
        type: 'baileys',
        sessionId: `session_private_a_${ts}`,
        isGlobal: false,
        assignedUserIds: [counsellorAUser._id],
      },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );
    assert.strictEqual(privateRes.status, 201);
    privateWaAccount = privateRes.data.account;
  });

  await test('Counsellor account list scoping: Counsellor A sees both lines; Counsellor B sees only global line', async () => {
    const resA = await axios.get(`${BASE_URL}/api/whatsapp/accounts`, {
      headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) },
    });
    const idsA = resA.data.accounts.map(a => a._id);
    assert(idsA.includes(globalWaAccount._id), 'Alice must see global line');
    assert(idsA.includes(privateWaAccount._id), 'Alice must see assigned private line');

    const resB = await axios.get(`${BASE_URL}/api/whatsapp/accounts`, {
      headers: { Authorization: `Bearer ${counsellorBToken}`, 'x-workspace-id': String(workspace._id) },
    });
    const idsB = resB.data.accounts.map(a => a._id);
    assert(idsB.includes(globalWaAccount._id), 'Bob must see global line');
    assert(!idsB.includes(privateWaAccount._id), 'Bob must NOT see Alice private line');
  });

  await test('Counsellor B is denied from sending from Alice private WhatsApp account (403)', async () => {
    try {
      await axios.post(
        `${BASE_URL}/api/whatsapp/send-text`,
        {
          to: '919999999999',
          text: 'Attempt by Bob',
          accountId: privateWaAccount._id,
        },
        { headers: { Authorization: `Bearer ${counsellorBToken}`, 'x-workspace-id': String(workspace._id) } }
      );
      assert.fail('Should have been denied');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert.strictEqual(err.response?.data?.code, 'ACCESS_DENIED');
    }
  });

  await test('Non-admin counsellor cannot create or assign WhatsApp accounts (403 Forbidden)', async () => {
    try {
      await axios.post(
        `${BASE_URL}/api/whatsapp/accounts`,
        { name: 'Rogue Line', phoneNumber: '919900000099', type: 'baileys' },
        { headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) } }
      );
      assert.fail('Should have been forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  // ── TEST 4: CENTRALIZED MULTI-ACCOUNT EMAIL (GOOGLE WORKSPACE) ─────────────
  let assignedEmailAccount;

  await test('Admin configures and assigns email account strictly to Counsellor A', async () => {
    // Seed an EmailAccount
    const emailDoc = await EmailAccount.create({
      workspaceId: workspace._id,
      userId: ownerUser._id,
      email: `alice.admissions@agency${ts}.com`,
      name: 'Alice Executive Mailbox',
      provider: 'gmail',
      status: 'active',
      isGlobal: false,
      assignedUserIds: [counsellorAUser._id],
    });
    assignedEmailAccount = emailDoc;

    // Verify Admin assignment endpoint
    const assignRes = await axios.put(
      `${BASE_URL}/api/email/accounts/${emailDoc._id}/assign`,
      {
        isGlobal: false,
        assignedUserIds: [counsellorAUser._id],
      },
      { headers: { Authorization: `Bearer ${ownerToken}`, 'x-workspace-id': String(workspace._id) } }
    );
    assert.strictEqual(assignRes.status, 200);
    assert.strictEqual(assignRes.data.success, true);
  });

  await test('Email account scoping: Counsellor A sees mailbox; Counsellor B sees none', async () => {
    const resA = await axios.get(`${BASE_URL}/api/email/accounts`, {
      headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) },
    });
    const accountsA = resA.data.accounts || resA.data.data || [];
    const idsA = accountsA.map(a => a._id);
    assert(idsA.includes(assignedEmailAccount._id.toString()), 'Alice must see assigned mailbox');

    const resB = await axios.get(`${BASE_URL}/api/email/accounts`, {
      headers: { Authorization: `Bearer ${counsellorBToken}`, 'x-workspace-id': String(workspace._id) },
    });
    const accountsB = resB.data.accounts || resB.data.data || [];
    const idsB = accountsB.map(a => a._id);
    assert(!idsB.includes(assignedEmailAccount._id.toString()), 'Bob must NOT see Alice mailbox');
  });

  await test('Counsellor B is denied from sending from Alice email account (403 Forbidden)', async () => {
    try {
      await axios.post(
        `${BASE_URL}/api/email/send`,
        {
          accountId: assignedEmailAccount._id,
          to: ['student@example.com'],
          subject: 'Unassigned Send Attempt',
          text: 'This should fail',
        },
        { headers: { Authorization: `Bearer ${counsellorBToken}`, 'x-workspace-id': String(workspace._id) } }
      );
      assert.fail('Should have been denied');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert(err.response?.data?.message?.includes('not assigned'));
    }
  });

  await test('Non-admin counsellor cannot initiate Google OAuth mailbox connection (403 Forbidden)', async () => {
    try {
      await axios.get(`${BASE_URL}/api/email/oauth/google/url`, {
        headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) },
      });
      assert.fail('Should have been forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  // ── TEST 5: INTEGRATIONS RBAC ENFORCEMENT ─────────────────────────────────
  await test('Counsellor cannot manage integrations (Google Sheets connect) (403)', async () => {
    try {
      await axios.post(
        `${BASE_URL}/api/integrations/sheets/connect`,
        { spreadsheetId: 'test-sheet-id' },
        { headers: { Authorization: `Bearer ${counsellorAToken}`, 'x-workspace-id': String(workspace._id) } }
      );
      assert.fail('Should have been forbidden');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  // ── CLEANUP & FINAL RESULTS ───────────────────────────────────────────────
  await Lead.deleteMany({ companyId: ownerUser._id });
  await WhatsAppAccount.deleteMany({ workspaceId: workspace._id });
  await EmailAccount.deleteMany({ workspaceId: workspace._id });
  await WorkspaceMembership.deleteMany({ workspaceId: workspace._id });
  await Workspace.deleteOne({ _id: workspace._id });
  await User.deleteMany({ _id: { $in: [ownerUser._id, counsellorAUser._id, counsellorBUser._id] } });

  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
