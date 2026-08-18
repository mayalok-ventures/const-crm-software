/**
 * Comprehensive Test Suite for Strict Admin Lead Flow & Full Lifecycle Engine
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000';
let adminToken = '';
let agentToken = '';
let agentId = '';
let testLeadId = '';
let testFollowUpId = '';
let testPaymentId = '';

const runTests = async () => {
  console.log('\n🧪 ========================================================');
  console.log('   STRICT ADMIN LEAD FLOW & LIFECYCLE ENGINE TEST SUITE');
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
    // 0. Authenticate as Super Admin
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: 'admin@crm.com',
      password: 'Admin@123'
    });
    adminToken = loginRes.data.token;
    assert(!!adminToken, 'SuperAdmin Authentication (Direct Password Login without 2FA)');

    const adminAxios = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // 0.1 Fetch Canonical Plans
    const plansRes = await adminAxios.get('/api/admin/plans');
    assert(plansRes.data.success && plansRes.data.plans?.length > 0, `Fetch Canonical Plans Catalog (${plansRes.data.plans?.length} plans available)`);

    // 0.2 Create a Test Agent with 10% Incentive
    const uniqueSuffix = Date.now().toString().slice(-6);
    const uniqueAgentEmail = `agent_${uniqueSuffix}@crm.com`;
    const uniqueAgentPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const agentRes = await adminAxios.post('/api/admin/agents', {
      name: 'Priya Sharma',
      email: uniqueAgentEmail,
      phone: uniqueAgentPhone,
      password: 'Agent@123',
      companyRole: 'sales_rep',
      incentive_pct: 10,
    });
    agentId = agentRes.data.agent?._id;
    assert(!!agentId && agentRes.data.agent?.incentive_pct === 10, 'Create Test Agent with 10% Incentive Commission');

    // 1. Lead Creation: Whitelist Validation (Reject Disallowed Properties)
    const testPhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
    try {
      await adminAxios.post('/api/admin/leads', {
        name: 'Rohan Mehta',
        phone: testPhone,
        service_required: 'digital_marketing',
        disallowedField: 'HACKED_VALUE',
        isSuperUser: true,
      });
      assert(false, 'Reject Disallowed Lead Properties (Whitelisting)');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.code === 'DISALLOWED_EXTRA_FIELDS', 'Reject Disallowed Lead Properties (Whitelisting)');
    }

    // 2. Lead Creation: 6-Service Standard Validation
    try {
      await adminAxios.post('/api/admin/leads', {
        name: 'Rohan Mehta',
        phone: testPhone,
        service_required: 'INVALID_SERVICE_NAME',
      });
      assert(false, 'Reject Invalid Service Required');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.code === 'INVALID_SERVICE', 'Reject Invalid Service Required (Strict 6 Services)');
    }

    // 3. Lead Creation: Successful Standard Lead Creation with Phone Normalization
    const validLeadRes = await adminAxios.post('/api/admin/leads', {
      name: 'Rohan Mehta',
      phone: `+91 ${testPhone.slice(0, 5)} ${testPhone.slice(5)}`,
      email: `rohan_${uniqueSuffix}@apexcorp.com`,
      company: 'Apex Corporation',
      service_required: 'digital_marketing',
      monthly_spend: 50000,
      goal_timeline: 'within_1_month',
      assignedTo: agentId,
      notes: 'Initial discovery call scheduled.'
    });
    testLeadId = validLeadRes.data.lead?._id;
    const normalizedPhone = validLeadRes.data.lead?.phone;
    assert(validLeadRes.status === 201 && normalizedPhone === `91${testPhone}`, `Create Lead & Phone Normalization (E.164: ${normalizedPhone})`);

    // 4. Lead Deduplication: Reject Duplicate Phone
    try {
      await adminAxios.post('/api/admin/leads', {
        name: 'Rohan Duplicate',
        phone: testPhone, // same 10 digits in raw format
        service_required: 'web_development',
      });
      assert(false, 'Phone Deduplication Check');
    } catch (err) {
      assert(err.response?.status === 409 && err.response?.data?.code === 'DUPLICATE_PHONE', 'Phone Deduplication Check (Duplicate Blocked)');
    }

    // 5. Follow-Up: Schedule without Note => Rejection
    try {
      await adminAxios.post(`/api/admin/leads/${testLeadId}/followups`, {
        scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        note: '',
      });
      assert(false, 'Follow-Up Scheduling Mandatory Note Check');
    } catch (err) {
      assert(err.response?.status === 400, 'Follow-Up Scheduling Mandatory Note Check (Empty Note Rejected)');
    }

    // 6. Follow-Up: Schedule with Note => Success
    const followupRes = await adminAxios.post(`/api/admin/leads/${testLeadId}/followups`, {
      scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      note: 'Demo presentation of CRM Automation features.',
    });
    testFollowUpId = followupRes.data.followUp?._id;
    assert(followupRes.status === 201 && followupRes.data.followUp?.status === 'open', 'Schedule Follow-Up with Note (Status: open)');

    // 7. Follow-Up: Postpone without Remark => Rejection
    try {
      await adminAxios.patch(`/api/admin/followups/${testFollowUpId}/postpone`, {
        new_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        postpone_remark: '',
      });
      assert(false, 'Follow-Up Postpone Mandatory Remark Check');
    } catch (err) {
      assert(err.response?.status === 400, 'Follow-Up Postpone Mandatory Remark Check (Empty Remark Rejected)');
    }

    // 8. Follow-Up: Postpone with Remark => Success
    const postponeRes = await adminAxios.patch(`/api/admin/followups/${testFollowUpId}/postpone`, {
      new_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      postpone_remark: 'Client requested postponement due to board meeting.',
    });
    assert(postponeRes.status === 200 && postponeRes.data.followUp?.status === 'postponed', 'Postpone Follow-Up with Remark (Status: postponed)');

    // 9. Follow-Up: Completion without Note => Rejection (Must remain open/incomplete)
    try {
      await adminAxios.patch(`/api/admin/followups/${testFollowUpId}/complete`, {
        note: '',
      });
      assert(false, 'Follow-Up Completion Mandatory Note Check');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.code === 'COMPLETION_NOTE_REQUIRED', 'Follow-Up Completion Mandatory Note Check (Outcome Note Required)');
    }

    // 10. Follow-Up: Completion with Note => Success (Status: done, timestamp recorded)
    const completeRes = await adminAxios.patch(`/api/admin/followups/${testFollowUpId}/complete`, {
      note: 'Demo completed successfully. Client requested custom Pro Growth annual proposal.',
    });
    assert(completeRes.status === 200 && completeRes.data.followUp?.status === 'done' && !!completeRes.data.followUp?.completed_at, 'Complete Follow-Up with Mandatory Outcome Note (Status: done)');

    // 11. Pipeline Stage Transition: Conversion without Payment => Rejected
    try {
      await adminAxios.patch(`/api/admin/leads/${testLeadId}/stage`, {
        stage: 'converted',
      });
      assert(false, 'Stage Transition to Converted Without Payment Check');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.code === 'PAYMENT_REQUIRED_FOR_CONVERSION', 'Stage Transition to Converted Without Payment Rejected');
    }

    // 12. Convert Lead with Custom Payment Amount: Missing Reason => Rejected
    try {
      await adminAxios.post(`/api/admin/leads/${testLeadId}/convert`, {
        custom_payment_amount: 15000,
        custom_price_reason: '',
      });
      assert(false, 'Custom Payment Amount Mandatory Reason Check');
    } catch (err) {
      assert(err.response?.status === 400 && err.response?.data?.code === 'CUSTOM_PRICE_REASON_REQUIRED', 'Custom Payment Amount Mandatory Reason Check');
    }

    // 13. Convert Lead with Custom Payment Amount & Reason => Admin Flagged & Incentive Calculated
    const customConvertRes = await adminAxios.post(`/api/admin/leads/${testLeadId}/convert`, {
      custom_payment_amount: 15000,
      custom_price_reason: 'Approved special startup accelerator discount by Director.',
      payment_method: 'bank_transfer',
      transaction_id: `TXN-CUSTOM-${Date.now()}`,
      verify_payment: true,
    });
    testPaymentId = customConvertRes.data.payment?._id;
    assert(
      customConvertRes.status === 200 &&
      customConvertRes.data.lead?.status === 'converted' &&
      customConvertRes.data.adminFlagged === true &&
      customConvertRes.data.incentive?.incentive_amount === 1500, // 10% of 15,000 = 1,500
      `Convert Lead with Custom Price (₹15,000) -> Admin Flagged & Agent 10% Incentive (₹1,500)`
    );

    // 14. Admin Alerts Queue: Verify Flagged Lead Appears for Audit
    const alertsRes = await adminAxios.get('/api/admin/alerts-queue');
    const isLeadInAlerts = alertsRes.data.flaggedLeads?.some(l => String(l._id) === String(testLeadId));
    assert(isLeadInAlerts, 'Admin Review Alerts Queue (Custom Price Lead Listed for Audit)');

    // 15. Payment Refund & Incentive Reversal
    const refundRes = await adminAxios.post(`/api/admin/payments/${testPaymentId}/refund`, {
      refund_reason: 'Client cancelled contract within 7-day guarantee.',
    });
    assert(
      refundRes.status === 200 &&
      refundRes.data.payment?.status === 'refunded' &&
      refundRes.data.lead?.paid_amount === 0,
      'Payment Refund & Lead Paid Amount Reversal'
    );

    // 16. Webhook Idempotency & Auto-Conversion Test
    const whPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const newLeadRes = await adminAxios.post('/api/admin/leads', {
      name: 'Anita Roy',
      phone: whPhone,
      service_required: 'crm_automation',
      assignedTo: agentId,
    });
    const webhookLeadId = newLeadRes.data.lead?._id;
    const webhookTxnId = `pay_razorpay_test_${Date.now()}`;

    // Simulate Razorpay Webhook Event 1 (First attempt)
    const webhookPayload1 = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: webhookTxnId,
            amount: 99900, // ₹999
            method: 'upi',
            notes: {
              leadId: webhookLeadId,
              planId: 'IND_STARTER_MONTHLY_V1',
            }
          }
        }
      }
    };

    // Calculate HMAC Signature
    const rawPayload1 = JSON.stringify(webhookPayload1);
    const signature1 = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_secure_2026')
      .update(rawPayload1)
      .digest('hex');

    const whRes1 = await axios.post(`${BASE_URL}/api/payments/webhook`, webhookPayload1, {
      headers: {
        'x-razorpay-signature': signature1,
        'Content-Type': 'application/json',
      }
    });
    assert(whRes1.status === 200, 'Gateway Webhook Ingestion & Signature Verification');

    // Verify Lead State after Webhook 1
    const leadAfterWh1 = (await adminAxios.get(`/api/admin/leads?search=${whPhone}`)).data.leads?.[0];
    assert(leadAfterWh1?.status === 'converted' && leadAfterWh1?.paid_amount === 999, 'Webhook Auto-Conversion (Lead marked converted with ₹999 paid)');

    // Simulate Duplicate Webhook Event 2 (Idempotency Replay Test)
    const whRes2 = await axios.post(`${BASE_URL}/api/payments/webhook`, webhookPayload1, {
      headers: {
        'x-razorpay-signature': signature1,
        'Content-Type': 'application/json',
      }
    });
    assert(whRes2.status === 200, 'Webhook Idempotency Replay Test (Handled Gracefully)');

    const leadAfterWh2 = (await adminAxios.get(`/api/admin/leads?search=${whPhone}`)).data.leads?.[0];
    assert(leadAfterWh2?.paid_amount === 999, 'Webhook Idempotency Verification (Paid Amount Not Doubled)');

  } catch (error) {
    console.error('Fatal Test Error:', error.response?.data || error.message);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runTests();
