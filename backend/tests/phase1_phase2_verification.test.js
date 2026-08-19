/**
 * Automated Test Suite: Phase 1 (Smart Pipeline) & Phase 2 (Strict Follow-Up Engine)
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:5000';

const runPhase1And2Tests = async () => {
  console.log('\n🧪 ========================================================');
  console.log('   PHASE 1 & PHASE 2 VERIFICATION: PIPELINE & FOLLOW-UP ENGINE');
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
    // 1. Authenticate Admin
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: 'admin@crm.com',
      password: 'Admin@123'
    });
    const token = loginRes.data.token;
    assert(!!token, 'Auth: SuperAdmin Login');

    const api = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${token}` }
    });

    const uniqueId = Math.floor(10000000 + Math.random() * 90000000);

    // 2. Onboard Agent
    const agentRes = await api.post('/api/admin/agents', {
      name: 'Ravi Teja',
      email: `ravi_${uniqueId}@crm.com`,
      phone: `98${uniqueId}`,
      password: 'Password@123',
      companyRole: 'sales_rep',
      incentive_pct: 15,
    });
    const agentId = agentRes.data.agent?._id;
    assert(!!agentId, 'Phase 1: Onboard Sales Agent (15% Commission)');

    // 3. Create Lead -> Defaults to new_lead
    const leadPhone = `99${uniqueId}`;
    const leadRes = await api.post('/api/admin/leads', {
      name: 'Alpha Dynamics Pvt Ltd',
      phone: leadPhone,
      company: 'Alpha Dynamics',
      service_required: 'digital_marketing',
      monthly_spend: 75000,
      goal_timeline: 'immediate',
      assignedTo: agentId,
    });
    const leadId = leadRes.data.lead?._id;
    assert(leadRes.data.lead?.status === 'new_lead', 'Phase 1.1: Lead created with status "new_lead"');

    // 4. Auto-Transition: Call placed -> Transition to contacted
    const callRes = await api.post(`/api/leads/${leadId}/track-call`);
    assert(callRes.status === 200 && callRes.data.status === 'contacted', 'Phase 1.2: Calling lead auto-transitions status to "contacted"');

    // 5. Create 2nd Lead -> Test WhatsApp auto-transition
    const lead2Phone = `91${uniqueId}`;
    const lead2Res = await api.post('/api/admin/leads', {
      name: 'Beta Robotics Corp',
      phone: lead2Phone,
      service_required: 'web_development',
      monthly_spend: 120000,
      assignedTo: agentId,
    });
    const lead2Id = lead2Res.data.lead?._id;
    const waRes = await api.post(`/api/leads/${lead2Id}/track-message`);
    assert(waRes.status === 200 && waRes.data.status === 'contacted', 'Phase 1.2: WhatsApp message auto-transitions status to "contacted"');

    // 6. Manual Conversion Validation: Conversion without paymentAmount & paymentMethod rejected
    let convertFailedAsExpected = false;
    try {
      await api.patch(`/api/admin/leads/${leadId}/stage`, { stage: 'converted' });
    } catch (err) {
      convertFailedAsExpected = err.response?.status === 400;
    }
    assert(convertFailedAsExpected, 'Phase 1.3: Manual conversion without paymentAmount & paymentMethod rejected');

    // 7. Manual Conversion with mandatory paymentAmount & paymentMethod succeeds
    const manualConvertRes = await api.patch(`/api/admin/leads/${leadId}/stage`, {
      stage: 'converted',
      paymentAmount: 50000,
      paymentMethod: 'bank_transfer',
      transaction_id: `TXN-ALPHA-${uniqueId}`,
    });
    assert(
      manualConvertRes.status === 200 &&
      manualConvertRes.data.lead?.status === 'converted' &&
      manualConvertRes.data.lead?.paid_amount === 50000,
      'Phase 1.3: Manual conversion with paymentAmount (₹50,000) and paymentMethod succeeds'
    );

    // 8. Phase 2: Follow-Up Scheduling - Empty Note Rejected
    let emptyNoteFuFailed = false;
    try {
      await api.post(`/api/admin/leads/${lead2Id}/followups`, {
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        note: '',
      });
    } catch (err) {
      emptyNoteFuFailed = err.response?.status === 400;
    }
    assert(emptyNoteFuFailed, 'Phase 2.1: Scheduling follow-up without note is strictly rejected');

    // 9. Schedule Follow-Up with mandatory note succeeds
    const scheduleRes = await api.post(`/api/admin/leads/${lead2Id}/followups`, {
      scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      note: 'Requirement discovery session with CTO and lead designer.',
    });
    const fuId = scheduleRes.data.followUp?._id;
    assert(scheduleRes.status === 201 && scheduleRes.data.followUp?.status === 'open', 'Phase 2.1: Schedule follow-up with note succeeds (status: open)');

    // 10. Postponing Follow-Up - Empty Postpone Remark Rejected
    let emptyRemarkPostponeFailed = false;
    try {
      await api.patch(`/api/admin/followups/${fuId}/postpone`, {
        new_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        postpone_remark: '',
      });
    } catch (err) {
      emptyRemarkPostponeFailed = err.response?.status === 400;
    }
    assert(emptyRemarkPostponeFailed, 'Phase 2.2: Postponing follow-up without postponeRemark is strictly rejected');

    // 11. Postpone with mandatory remark succeeds
    const postponeRes = await api.patch(`/api/admin/followups/${fuId}/postpone`, {
      new_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      postpone_remark: 'Client travelling for conference; callback requested on Friday.',
    });
    assert(postponeRes.status === 200 && postponeRes.data.followUp?.status === 'postponed', 'Phase 2.2: Postpone with mandatory remark succeeds (status: postponed)');

    // 12. Completing Follow-Up - Empty Note Rejected
    let emptyCompleteFailed = false;
    try {
      await api.patch(`/api/admin/followups/${fuId}/complete`, { note: '' });
    } catch (err) {
      emptyCompleteFailed = err.response?.status === 400;
    }
    assert(emptyCompleteFailed, 'Phase 2: Completing follow-up without outcome note is strictly rejected');

    // 13. Completing Follow-Up with outcome note succeeds
    const completeRes = await api.patch(`/api/admin/followups/${fuId}/complete`, {
      note: 'Client agreed to proceed with Pro Tier. Proposal approved.',
    });
    assert(completeRes.status === 200 && completeRes.data.followUp?.status === 'done', 'Phase 2: Completing follow-up with outcome note succeeds (status: done, alarm cleared)');

    // 14. Webhook Auto-Conversion Test (Verified HMAC SHA-256 signature)
    const crypto = require('crypto');
    const { RAZORPAY_WEBHOOK_SECRET } = require('../src/config/razorpay');
    const webhookTxnId = `pay_wh_${uniqueId}`;
    const webhookBody = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: webhookTxnId,
            amount: 2500000, // ₹25,000 in paise
            method: 'upi',
            notes: {
              leadId: lead2Id,
              planId: 'IND_GROWTH_MONTHLY_V1',
            }
          }
        }
      }
    };
    const rawBodyStr = JSON.stringify(webhookBody);
    const validSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBodyStr)
      .digest('hex');

    await axios.post(`${BASE_URL}/api/payments/webhook`, webhookBody, {
      headers: {
        'x-razorpay-signature': validSignature,
        'Content-Type': 'application/json',
      }
    });

    const updatedLead2 = (await api.get(`/api/admin/leads?search=${lead2Phone}`)).data.leads?.[0];
    assert(
      updatedLead2 && updatedLead2.status === 'converted' && updatedLead2.paid_amount === 25000,
      'Phase 1.2: Razorpay webhook payment auto-converts lead with paid amount (₹25,000)'
    );

  } catch (error) {
    console.error('Test Execution Error:', error.response?.data || error.message);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`🏁 PHASE 1 & 2 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runPhase1And2Tests();
