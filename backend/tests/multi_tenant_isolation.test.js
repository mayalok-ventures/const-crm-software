/**
 * MULTI-TENANT DATA ISOLATION TEST SUITE
 * Mathematically validates the 4 definitive visibility rules:
 * - RULE 1: Independent/Single Users can ONLY see their own leads.
 * - RULE 2: Organizations & Their Agents see all leads generated within their organization.
 * - RULE 3: SuperAdmin only sees internal team leads, but can inspect platform user profiles with org tags.
 * - RULE 4: Single User to Organization Collaboration allows explicit shared leads with distinct tags.
 */

const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runMultiTenantIsolationTests() {
  console.log('\n🔒 ========================================================');
  console.log('   MULTI-TENANT SECURITY & DATA ISOLATION TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  };

  const timestamp = Date.now();
  const randPhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000);

  try {
    // ─────────────────────────────────────────────────────────────
    // SETUP USERS FOR 4 TENANCY SCENARIOS
    // ─────────────────────────────────────────────────────────────
    console.log('▶️  Step 1: Registering Test Tenancies...');

    // 1. Single User Alice
    const resAlice = await axios.post(`${API_URL}/auth/register`, {
      name: `Alice Solo_${timestamp}`,
      email: `alice_${timestamp}_${Math.random().toString(36).slice(2, 6)}@solo.com`,
      phone: randPhone(),
      password: 'Password@123',
      workStatus: 'independent_agent',
      companyRole: 'solo',
    });
    const tokenAlice = resAlice.data.token;
    const userAlice = resAlice.data;

    // 2. Single User Bob
    const resBob = await axios.post(`${API_URL}/auth/register`, {
      name: `Bob Solo_${timestamp}`,
      email: `bob_${timestamp}_${Math.random().toString(36).slice(2, 6)}@solo.com`,
      phone: randPhone(),
      password: 'Password@123',
      workStatus: 'independent_agent',
      companyRole: 'solo',
    });
    const tokenBob = resBob.data.token;
    const userBob = resBob.data;

    // 3. Organization Owner (MegaCorp)
    const resMegaCorp = await axios.post(`${API_URL}/auth/register`, {
      name: `MegaCorp Owner_${timestamp}`,
      email: `owner_${timestamp}_${Math.random().toString(36).slice(2, 6)}@megacorp.com`,
      phone: randPhone(),
      password: 'Password@123',
      workStatus: 'company_owner',
      companyRole: 'owner',
      companyInfo: { companyName: `MegaCorp Real Estate_${timestamp}` },
    });
    const tokenMegaCorp = resMegaCorp.data.token;
    const userMegaCorp = resMegaCorp.data;

    // 4. Organization Agent (Dave under MegaCorp)
    const daveEmail = `dave_${timestamp}_${Math.random().toString(36).slice(2, 6)}@megacorp.com`;
    const resDave = await axios.post(
      `${API_URL}/company/agents`,
      {
        name: `Dave Agent_${timestamp}`,
        email: daveEmail,
        phone: randPhone(),
        password: 'Password@123',
      },
      { headers: { Authorization: `Bearer ${tokenMegaCorp}` } }
    );
    const resDaveLogin = await axios.post(`${API_URL}/auth/login`, {
      identifier: daveEmail,
      email: daveEmail,
      password: 'Password@123',
    });
    const tokenDave = resDaveLogin.data.token;
    const userDave = resDaveLogin.data;

    // 5. SuperAdmin Login
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@yourapp.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const resAdmin = await axios.post(`${API_URL}/auth/login`, {
      identifier: adminEmail,
      email: adminEmail,
      password: adminPassword,
    });
    const tokenAdmin = resAdmin.data.token;
    const userAdmin = resAdmin.data;

    assert(tokenAlice && tokenBob && tokenMegaCorp && tokenDave && tokenAdmin, 'All 5 tenant sessions successfully established');

    // ─────────────────────────────────────────────────────────────
    // RULE 1: INDEPENDENT / SINGLE USERS ISOLATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 2: Testing RULE 1 (Independent/Single Users Isolation)...');

    // Alice creates Lead A1 and A2
    const pA1 = randPhone();
    const pA2 = randPhone();
    const pB1 = randPhone();
    console.log(`  -> Creating Lead A1 with phone ${pA1}`);
    const resA1 = await axios.post(
      `${API_URL}/leads`,
      { name: `Lead A1 (${userAlice.name})`, phone: pA1, source: 'manual' },
      { headers: { Authorization: `Bearer ${tokenAlice}` } }
    );
    const leadA1 = resA1.data;

    console.log(`  -> Creating Lead A2 with phone ${pA2}`);
    const resA2 = await axios.post(
      `${API_URL}/leads`,
      { name: `Lead A2 (${userAlice.name})`, phone: pA2, source: 'manual' },
      { headers: { Authorization: `Bearer ${tokenAlice}` } }
    );
    const leadA2 = resA2.data;

    // Bob creates Lead B1
    console.log(`  -> Creating Lead B1 with phone ${pB1}`);
    const resB1 = await axios.post(
      `${API_URL}/leads`,
      { name: `Lead B1 (${userBob.name})`, phone: pB1, source: 'manual' },
      { headers: { Authorization: `Bearer ${tokenBob}` } }
    );
    const leadB1 = resB1.data;

    // Alice fetches leads
    const aliceLeadsRes = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    const aliceLeadIds = aliceLeadsRes.data.leads.map(l => l._id);

    // Bob fetches leads
    const bobLeadsRes = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${tokenBob}` } });
    const bobLeadIds = bobLeadsRes.data.leads.map(l => l._id);

    assert(aliceLeadIds.includes(leadA1._id) && aliceLeadIds.includes(leadA2._id), 'Alice can see her own leads A1 and A2');
    assert(!aliceLeadIds.includes(leadB1._id), 'Alice CANNOT see Bob\'s lead B1 (Zero cross-user leak)');
    assert(bobLeadIds.includes(leadB1._id) && !bobLeadIds.includes(leadA1._id) && !bobLeadIds.includes(leadA2._id), 'Bob sees only his lead B1 and CANNOT see Alice\'s leads A1/A2');

    // ─────────────────────────────────────────────────────────────
    // RULE 2: ORGANIZATIONS & THEIR AGENTS ISOLATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 3: Testing RULE 2 (Organization & Sub-Agent Collective Visibility)...');

    // MegaCorp Owner creates Lead Org1
    const resOrg1 = await axios.post(
      `${API_URL}/leads`,
      { name: `Org Lead 1 (${userMegaCorp.name})`, phone: randPhone(), source: 'manual' },
      { headers: { Authorization: `Bearer ${tokenMegaCorp}` } }
    );
    const leadOrg1 = resOrg1.data;

    // Sub-Agent Dave creates Lead Org2
    const resOrg2 = await axios.post(
      `${API_URL}/leads`,
      { name: `Org Lead 2 by Dave (${userDave.name})`, phone: randPhone(), source: 'manual' },
      { headers: { Authorization: `Bearer ${tokenDave}` } }
    );
    const leadOrg2 = resOrg2.data;

    // Sub-Agent Dave fetches leads
    const daveLeadsRes = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${tokenDave}` } });
    const daveLeadIds = daveLeadsRes.data.leads.map(l => l._id);

    // Org Owner MegaCorp fetches leads
    const ownerLeadsRes = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${tokenMegaCorp}` } });
    const ownerLeadIds = ownerLeadsRes.data.leads.map(l => l._id);

    assert(daveLeadIds.includes(leadOrg1._id) && daveLeadIds.includes(leadOrg2._id), 'Sub-agent Dave sees ALL leads generated within MegaCorp (Org1 and Org2)');
    assert(ownerLeadIds.includes(leadOrg1._id) && ownerLeadIds.includes(leadOrg2._id), 'MegaCorp Owner sees ALL leads created across the agency');
    assert(!daveLeadIds.includes(leadA1._id) && !daveLeadIds.includes(leadB1._id), 'Organization sub-agents CANNOT see independent Single User leads (Alice/Bob)');
    assert(!aliceLeadIds.includes(leadOrg1._id) && !aliceLeadIds.includes(leadOrg2._id), 'Single User Alice CANNOT see Organization leads');

    // ─────────────────────────────────────────────────────────────
    // RULE 3: SUPERADMIN PRIVACY ISOLATION & USER DIRECTORY TAGS
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 4: Testing RULE 3 (SuperAdmin Lead Privacy & Org Agent Tagging)...');

    // SuperAdmin creates internal lead Admin1
    const resAdmin1 = await axios.post(
      `${API_URL}/leads`,
      { name: `Internal Admin Lead_${timestamp}`, phone: randPhone(), source: 'manual' },
      { headers: { Authorization: `Bearer ${tokenAdmin}` } }
    );
    const leadAdmin1 = resAdmin1.data;

    // SuperAdmin queries /api/leads
    const adminLeadsRes = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    const adminLeadIds = adminLeadsRes.data.leads.map(l => l._id);

    assert(adminLeadIds.includes(leadAdmin1._id), 'SuperAdmin sees internal sales team lead Admin1');
    assert(!adminLeadIds.includes(leadA1._id) && !adminLeadIds.includes(leadB1._id) && !adminLeadIds.includes(leadOrg1._id), 'SuperAdmin CANNOT see private tenant leads of Alice, Bob, or MegaCorp');

    // SuperAdmin inspects User Directory (/api/admin/users)
    const adminUsersRes = await axios.get(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    const adminUsers = adminUsersRes.data.users;
    const inspectedDave = adminUsers.find(u => u._id === userDave._id);
    const inspectedAlice = adminUsers.find(u => u._id === userAlice._id);

    assert(Boolean(inspectedDave && inspectedDave.organizationTag), 'SuperAdmin User Directory displays organizationTag for Org Agent Dave');
    assert(inspectedDave.organizationTag.includes('MegaCorp'), `Dave's tag clearly references his Organization: "${inspectedDave.organizationTag}"`);
    assert(Boolean(inspectedAlice && inspectedAlice.isSingleUser), 'Alice is classified as Single / Independent User in Admin Directory');

    // ─────────────────────────────────────────────────────────────
    // RULE 4: SINGLE USER TO ORGANIZATION COLLABORATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  Step 5: Testing RULE 4 (Single User Explicit Org Collaboration & Tagging)...');

    // Alice explicitly shares Lead A1 with MegaCorp
    const shareRes = await axios.put(
      `${API_URL}/leads/${leadA1._id}/share-organization`,
      { targetCompanyId: userMegaCorp._id, share: true },
      { headers: { Authorization: `Bearer ${tokenAlice}` } }
    );

    assert(shareRes.data.success, 'Alice successfully shared Lead A1 with MegaCorp');

    // MegaCorp Sub-Agent Dave re-fetches leads
    const daveLeadsPostShare = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${tokenDave}` } });
    const daveLeadsPostShareIds = daveLeadsPostShare.data.leads.map(l => l._id);
    const sharedA1InDave = daveLeadsPostShare.data.leads.find(l => l._id === leadA1._id);

    assert(daveLeadsPostShareIds.includes(leadA1._id), 'MegaCorp Agent Dave can now see shared Lead A1 in the Organization pool');
    assert(!daveLeadsPostShareIds.includes(leadA2._id), 'Alice\'s unshared Lead A2 remains strictly private and invisible to MegaCorp');
    assert(
      sharedA1InDave && (sharedA1InDave.isSharedFromSingleUser || sharedA1InDave.tags.some(t => t.includes('Shared by'))),
      `Shared Lead A1 carries distinct Single User collaboration tag: "${sharedA1InDave?.tags?.join(', ')}"`
    );

    // Alice un-shares Lead A1
    const unshareRes = await axios.put(
      `${API_URL}/leads/${leadA1._id}/share-organization`,
      { share: false },
      { headers: { Authorization: `Bearer ${tokenAlice}` } }
    );
    assert(unshareRes.data.success, 'Alice removed Organization sharing for Lead A1');

    const daveLeadsPostUnshare = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${tokenDave}` } });
    const daveLeadsPostUnshareIds = daveLeadsPostUnshare.data.leads.map(l => l._id);
    assert(!daveLeadsPostUnshareIds.includes(leadA1._id), 'Lead A1 immediately disappeared from MegaCorp pool after unsharing');

    console.log('\n========================================================');
    console.log(`🏁 MULTI-TENANT SUITE: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal test error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runMultiTenantIsolationTests();
