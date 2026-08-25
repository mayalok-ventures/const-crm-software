/**
 * End-to-End Acceptance Test Suite: Complete Lead Lifecycle Journey
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const BASE_URL = 'http://localhost:5000';

const runE2ETests = async () => {
  console.log('\n🌟 ========================================================');
  console.log('   E2E ACCEPTANCE: FULL LEAD LIFECYCLE & AGENT COMMISSIONS');
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
    // 1. SuperAdmin Login
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: process.env.ADMIN_EMAIL || 'admin@yourapp.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456'
    });
    const adminToken = loginRes.data.token;
    assert(!!adminToken, 'Step 1: SuperAdmin authenticates');

    const adminAxios = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // 2. Create Field Agent
    const uniqueNum = Math.floor(10000000 + Math.random() * 90000000);
    const agentRes = await adminAxios.post('/api/admin/agents', {
      name: 'Vikram Malhotra',
      email: `vikram_${uniqueNum}@crm.com`,
      phone: `98${uniqueNum}`,
      password: 'Agent@123',
      companyRole: 'sales_rep',
      incentive_pct: 12.5, // 12.5% commission
    });
    const agentId = agentRes.data.agent?._id;
    assert(!!agentId, 'Step 2: Onboard Agent "Vikram Malhotra" (12.5% Commission)');

    // 3. Create Inbound Lead under CRM Automation
    const leadPhone = `97${uniqueNum}`;
    const leadRes = await adminAxios.post('/api/admin/leads', {
      name: 'Zenith Logistics Ltd',
      phone: `+91 ${leadPhone.slice(0, 5)} ${leadPhone.slice(5)}`,
      email: `contact@zenithlogistics_${uniqueNum}.in`,
      company: 'Zenith Logistics',
      service_required: 'crm_automation',
      monthly_spend: 150000,
      goal_timeline: 'immediate',
      source: 'website',
      assignedTo: agentId,
      notes: 'High-value enterprise lead requesting automated WhatsApp & Lead routing.'
    });
    const leadId = leadRes.data.lead?._id;
    assert(leadRes.status === 201 && leadRes.data.lead?.status === 'new_lead', 'Step 3: Create Lead "Zenith Logistics" under CRM Automation');

    // 4. Schedule Initial Follow-Up
    const fu1Res = await adminAxios.post(`/api/admin/leads/${leadId}/followups`, {
      scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      note: 'Deliver product demo and architecture proposal.',
    });
    const fu1Id = fu1Res.data.followUp?._id;
    assert(fu1Res.status === 201 && fu1Res.data.followUp?.status === 'open', 'Step 4: Schedule Initial Discovery Follow-Up (Status: open)');

    // 5. Verify Pipeline Lead Enriched Data
    const pipelineLead = (await adminAxios.get(`/api/admin/leads?search=${leadPhone}`)).data.leads?.[0];
    assert(
      pipelineLead &&
      pipelineLead.service_required === 'crm_automation' &&
      pipelineLead.nextFollowUp?._id === fu1Id,
      'Step 5: Lead appears in Pipeline with active Follow-Up schedule'
    );

    // 6. Complete Follow-Up with Mandatory Outcome Note
    const completeFuRes = await adminAxios.patch(`/api/admin/followups/${fu1Id}/complete`, {
      note: 'Architecture proposal accepted by CTO. Contract ready for signature.',
    });
    assert(completeFuRes.status === 200 && completeFuRes.data.followUp?.status === 'done', 'Step 6: Complete Follow-Up with Outcome Note');

    // 7. Schedule Subsequent Follow-Up
    const fu2Res = await adminAxios.post(`/api/admin/leads/${leadId}/followups`, {
      scheduled_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      note: 'Payment collection and onboarding session.',
    });
    const fu2Id = fu2Res.data.followUp?._id;
    assert(fu2Res.status === 201, 'Step 7: Schedule Subsequent Follow-Up for Contract Signing');

    // 8. Postpone Follow-Up with Mandatory Reason
    const postponeRes = await adminAxios.patch(`/api/admin/followups/${fu2Id}/postpone`, {
      new_date: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      postpone_remark: 'Finance department required 1 additional day for bank transfer clearance.',
    });
    assert(postponeRes.status === 200 && postponeRes.data.followUp?.status === 'postponed', 'Step 8: Postpone Follow-Up with Explanatory Reason');

    // 9. Convert Deal with Custom Price & Reason
    const convertRes = await adminAxios.post(`/api/admin/leads/${leadId}/convert`, {
      custom_payment_amount: 80000,
      custom_price_reason: 'Enterprise volume discount approved for 2-year prepayment contract.',
      payment_method: 'bank_transfer',
      transaction_id: `NEFT-ZENITH-${uniqueNum}`,
      verify_payment: true,
    });
    assert(
      convertRes.status === 200 &&
      convertRes.data.lead?.status === 'converted' &&
      convertRes.data.lead?.paid_amount === 80000 &&
      convertRes.data.adminFlagged === true &&
      convertRes.data.incentive?.incentive_amount === 10000, // 12.5% of 80,000 = 10,000
      'Step 9: Convert Deal (₹80,000) -> Lead converted & Agent 12.5% Commission (₹10,000) credited'
    );

    // 10. Verify Admin Review Alerts Queue
    const alertsRes = await adminAxios.get('/api/admin/alerts-queue');
    const flaggedLead = alertsRes.data.flaggedLeads?.find(l => String(l._id) === String(leadId));
    assert(
      !!flaggedLead &&
      flaggedLead.metadata?.admin_flag === true &&
      flaggedLead.metadata?.custom_price_reason?.includes('Enterprise volume discount'),
      'Step 10: Admin Alerts Queue displays flagged deal with reason for audit'
    );

  } catch (error) {
    console.error('Fatal E2E Error:', error.response?.data || error.message);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`🏁 E2E RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runE2ETests();
