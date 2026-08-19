/**
 * Automated Test Suite: Phase 1 (6 Subscription Plans Dropdown) & Phase 2 (Common Pool & First-Touch Assignment)
 */

const axios = require('axios');
const crypto = require('crypto');
const BASE_URL = 'http://localhost:5000';
const { RAZORPAY_WEBHOOK_SECRET } = require('../src/config/razorpay');

const runFirstTouchTests = async () => {
  console.log('\n🧪 ========================================================');
  console.log('   PHASE 1 & PHASE 2 ACCEPTANCE: 6 PLANS & FIRST-TOUCH ENGINE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, extra = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${extra}`);
      failed++;
    }
  };

  try {
    // 1. Authenticate SuperAdmin
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: 'admin@crm.com',
      password: 'Admin@123'
    });
    const adminToken = adminLogin.data.token;
    const adminApi = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(!!adminToken, 'Auth: SuperAdmin Login');

    const uniqueId = Math.floor(10000000 + Math.random() * 90000000);

    // 2. Onboard Agent 1 (Kavita Sharma)
    const agent1Res = await adminApi.post('/api/admin/agents', {
      name: 'Kavita Sharma',
      email: `kavita_${uniqueId}@crm.com`,
      phone: `98${uniqueId}`,
      password: 'Password@123',
      companyRole: 'sales_rep',
      incentive_pct: 12,
    });
    const agent1 = agent1Res.data.agent;
    assert(!!agent1?._id, 'Setup: Onboard Agent 1 (Kavita Sharma)');

    // 3. Onboard Agent 2 (Arjun Kapoor)
    const agent2Res = await adminApi.post('/api/admin/agents', {
      name: 'Arjun Kapoor',
      email: `arjun_${uniqueId}@crm.com`,
      phone: `97${uniqueId}`,
      password: 'Password@123',
      companyRole: 'sales_rep',
      incentive_pct: 15,
    });
    const agent2 = agent2Res.data.agent;
    assert(!!agent2?._id, 'Setup: Onboard Agent 2 (Arjun Kapoor)');

    // 4. Log in as Agent 1
    const agent1Login = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: `kavita_${uniqueId}@crm.com`,
      password: 'Password@123'
    });
    const agent1Token = agent1Login.data.token;
    const agent1Api = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${agent1Token}` }
    });
    assert(!!agent1Token, 'Auth: Agent 1 Login');

    // 5. Log in as Agent 2
    const agent2Login = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: `arjun_${uniqueId}@crm.com`,
      password: 'Password@123'
    });
    const agent2Token = agent2Login.data.token;
    const agent2Api = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${agent2Token}` }
    });
    assert(!!agent2Token, 'Auth: Agent 2 Login');

    // ── PHASE 1 TESTS: 6 SUBSCRIPTION PLANS ──

    // 6. Create Lead with Individual Plan (smart_solo)
    const lead1Phone = `91${uniqueId}`;
    const lead1Res = await adminApi.post('/api/admin/leads', {
      name: 'Nexus Technologies',
      phone: lead1Phone,
      company: 'Nexus Tech',
      service_required: 'smart_solo',
      monthly_spend: 799,
      goal_timeline: 'immediate',
    });
    const lead1 = lead1Res.data.lead;
    assert(lead1?.service_required === 'smart_solo', 'Phase 1.1: Lead created with Individual Plan "smart_solo"');

    // 7. Create Lead with Organization Plan (business) in Common Pool (assignedTo: null)
    const lead2Phone = `92${uniqueId}`;
    const lead2Res = await adminApi.post('/api/admin/leads', {
      name: 'Skyline Enterprises',
      phone: lead2Phone,
      company: 'Skyline Global',
      service_required: 'business',
      monthly_spend: 2499,
      goal_timeline: '1_to_3_months',
    });
    const lead2 = lead2Res.data.lead;
    assert(lead2?.service_required === 'business' && !lead2.assignedTo, 'Phase 1.2: Lead created with Org Plan "business" in Common Pool (assignedTo: null)');

    // ── PHASE 2 TESTS: FIRST-TOUCH AUTO-ASSIGNMENT & COMMON POOL ──

    // 8. First-Touch via Call: Agent 1 calls unassigned Lead 1
    const callRes = await agent1Api.post(`/api/leads/${lead1._id}/track-call`);
    assert(
      callRes.data.status === 'contacted' && String(callRes.data.assignedTo) === String(agent1._id),
      'Phase 2.1: First-Touch Call claims lead for Agent 1 and auto-transitions to "contacted"'
    );

    // 9. First-Touch via WhatsApp: Agent 2 messages unassigned Lead 2
    const waRes = await agent2Api.post(`/api/leads/${lead2._id}/track-message`);
    assert(
      waRes.data.status === 'contacted' && String(waRes.data.assignedTo) === String(agent2._id),
      'Phase 2.2: First-Touch WhatsApp claims lead for Agent 2 and auto-transitions to "contacted"'
    );

    // 10. First-Touch via Note: Agent 1 creates Lead 3 and adds note
    const lead3Phone = `93${uniqueId}`;
    const lead3Res = await adminApi.post('/api/admin/leads', {
      name: 'Zenith Global Solutions',
      phone: lead3Phone,
      service_required: 'team_starter',
      monthly_spend: 1499,
    });
    const lead3 = lead3Res.data.lead;
    const noteRes = await agent1Api.post(`/api/leads/${lead3._id}/notes`, {
      text: 'Client requested presentation on team starter automation features.',
    });
    assert(
      String(noteRes.data.assignedTo) === String(agent1._id),
      'Phase 2.3: First-Touch Note claims lead for Agent 1'
    );

    // 11. Lead Re-assignment: Agent 1 re-assigns Lead 3 to Agent 2
    const reassignRes = await agent1Api.put(`/api/leads/${lead3._id}/reassign`, {
      toAgentId: agent2._id,
      reason: 'Specialized enterprise team requirements. Transferred to Arjun.',
    });
    assert(
      reassignRes.status === 200 &&
      String(reassignRes.data.lead?.assignedTo) === String(agent2._id) &&
      reassignRes.data.lead?.assignedToName === agent2.name,
      'Phase 2.4: Agent-to-Agent Lead Reassignment succeeds with audit remarks'
    );

    // 12. Phase 1.3: Webhook Plan Purchase auto-updates lead.service_required and user.plan
    const webhookTxnId = `pay_wh_${uniqueId}`;
    const webhookBody = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: webhookTxnId,
            amount: 149900, // ₹1,499 in paise (team_starter)
            method: 'upi',
            notes: {
              leadId: lead3._id,
              planId: 'team_starter',
            }
          }
        }
      }
    };
    const validSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(webhookBody))
      .digest('hex');

    await axios.post(`${BASE_URL}/api/payments/webhook`, webhookBody, {
      headers: { 'x-razorpay-signature': validSignature }
    });

    const refreshedLead3 = (await adminApi.get(`/api/admin/leads?search=${lead3Phone}`)).data.leads?.[0];
    assert(
      refreshedLead3 &&
      refreshedLead3.status === 'converted' &&
      refreshedLead3.service_required === 'team_starter' &&
      refreshedLead3.paid_amount === 1499,
      'Phase 1.3: Razorpay webhook automatically updates lead.service_required to "team_starter" and marks converted'
    );

  } catch (error) {
    console.error('Test Execution Error:', error.response?.data || error.message);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`🏁 ACCEPTANCE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runFirstTouchTests();
