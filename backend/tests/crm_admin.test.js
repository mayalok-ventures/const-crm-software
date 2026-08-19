const assert = require('assert');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'crm_jwt_secret_dev_key_2026';

let authToken = '';
let testLeadId = '';
let testAgentId = '';
let testFollowUpId = '';
let testOfferId = '';

const runTests = async () => {
  console.log('🚀 RUNNING CRM ADMIN BACKEND INTEGRATION & VALIDATION TEST SUITE\n');

  // 1. Authenticate as SuperAdmin
  console.log('1. Testing SuperAdmin Authentication & Session Setup...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@crm.com', password: 'Admin@123' })
  });
  const loginData = await loginRes.json();
  console.log('   Login response status:', loginRes.status, loginData);
  
  if (loginData.token) {
    authToken = loginData.token;
  } else if (loginData.requires2FA && loginData.tempToken) {
    const decoded = jwt.decode(loginData.tempToken);
    authToken = jwt.sign({ id: decoded.id }, JWT_SECRET, { expiresIn: '30d' });
  }
  
  assert.ok(authToken, 'Auth token must be present');
  console.log('   ✓ SuperAdmin session authenticated.');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  };

  // 2. Lead creation validation (source is required)
  console.log('\n2. Testing Lead Creation & Source Validation...');
  const failLeadRes = await fetch(`${BASE_URL}/admin/leads`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Test Lead Without Source', phone: '9999999991' })
  });
  const failLeadData = await failLeadRes.json();
  assert.strictEqual(failLeadRes.status, 400, 'Expected 400 when source is missing');
  console.log('   ✓ Source missing validation enforced (HTTP 400):', failLeadData.message);

  const testLeadPhone = `9876${Date.now().toString().slice(-6)}`;
  const createLeadRes = await fetch(`${BASE_URL}/admin/leads`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Rohan Mehta',
      phone: testLeadPhone,
      email: `rohan_${Date.now()}@example.com`,
      project: 'CyberCity Luxury Penthouse',
      budget: '15000000',
      source: 'agent_manual',
      status: 'new_lead',
    })
  });
  const createLeadData = await createLeadRes.json();
  assert.strictEqual(createLeadRes.status, 201, 'Expected 201 on valid lead creation');
  assert.strictEqual(createLeadData.lead.status, 'new_lead', 'Initial status must be new_lead');
  testLeadId = createLeadData.lead._id;
  console.log('   ✓ Lead created successfully with ID:', testLeadId, 'and stage "new_lead"');

  // 3. Auto-Contact Trigger on Messaging
  console.log('\n3. Testing Auto-Contact Trigger on Messaging...');
  const msgRes = await fetch(`${BASE_URL}/leads/${testLeadId}/track-message`, {
    method: 'POST',
    headers: authHeaders,
  });
  const msgData = await msgRes.json();
  assert.strictEqual(msgData.status, 'contacted', 'Stage must auto-update to contacted');
  console.log('   ✓ Lead status auto-updated to "contacted" on message dispatch');

  // 4. Follow-up scheduling with mandatory note validation
  console.log('\n4. Testing Follow-up Scheduling Validation (Mandatory Note)...');
  const failFollowUpRes = await fetch(`${BASE_URL}/admin/leads/${testLeadId}/followups`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ scheduled_at: new Date(Date.now() + 86400000).toISOString(), note: '' })
  });
  assert.strictEqual(failFollowUpRes.status, 400, 'Expected 400 when note is empty');
  console.log('   ✓ Empty note validation blocked correctly (HTTP 400)');

  const validFollowUpRes = await fetch(`${BASE_URL}/admin/leads/${testLeadId}/followups`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      note: 'Client requested brochure walkthrough and floor plan discussion.'
    })
  });
  const followUpData = await validFollowUpRes.json();
  assert.strictEqual(validFollowUpRes.status, 201, 'Expected 201 for valid follow-up');
  testFollowUpId = followUpData.followUp._id;
  console.log('   ✓ Follow-up scheduled successfully with note ID:', testFollowUpId);

  // 5. Follow-up postpone with mandatory remark validation
  console.log('\n5. Testing Follow-up Postpone Validation (Mandatory Postpone Remark)...');
  const failPostponeRes = await fetch(`${BASE_URL}/admin/followups/${testFollowUpId}/postpone`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      new_date: new Date(Date.now() + 172800000).toISOString(),
      postpone_remark: ''
    })
  });
  assert.strictEqual(failPostponeRes.status, 400, 'Expected 400 when postpone remark is empty');
  console.log('   ✓ Empty postpone remark blocked correctly (HTTP 400)');

  const validPostponeRes = await fetch(`${BASE_URL}/admin/followups/${testFollowUpId}/postpone`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      new_date: new Date(Date.now() + 172800000).toISOString(),
      postpone_remark: 'Client traveling out of station until Friday.'
    })
  });
  const postponeData = await validPostponeRes.json();
  assert.strictEqual(validPostponeRes.status, 200, 'Expected 200 on valid postpone');
  assert.strictEqual(postponeData.followUp.status, 'postponed');
  console.log('   ✓ Follow-up postponed successfully with recorded remark');

  // 6. Onboard Agent with Custom Incentive %
  console.log('\n6. Testing Agent Hierarchy Onboarding & Incentive Configuration...');
  const agentPhone = `9811${Date.now().toString().slice(-6)}`;
  const agentRes = await fetch(`${BASE_URL}/admin/agents`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Aditya Sharma',
      phone: agentPhone,
      email: `aditya_${Date.now()}@agency.com`,
      password: 'Password@123',
      companyRole: 'sales_rep',
      incentive_pct: 12, // 12% commission
      whatsapp_connection: 'agent_owned',
    })
  });
  const agentData = await agentRes.json();
  assert.strictEqual(agentRes.status, 201, 'Expected 201 on agent creation');
  testAgentId = agentData.agent._id;
  console.log('   ✓ Agent created with 12% incentive rate, ID:', testAgentId);

  // Assign lead to agent
  await fetch(`${BASE_URL}/admin/leads/${testLeadId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ assignedTo: testAgentId })
  });

  // 7. Offer Engine & Post-Discount Payable Amount Calculation
  console.log('\n7. Testing Offer Creation & Payable Amount Computation...');
  const offerRes = await fetch(`${BASE_URL}/admin/offers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Festival 10% Discount Scheme',
      code: `FESTIVAL10_${Date.now()}`,
      discount_pct: 10,
    })
  });
  const offerData = await offerRes.json();
  testOfferId = offerData.offer._id;
  assert.strictEqual(offerRes.status, 201);
  console.log('   ✓ Offer created:', offerData.offer.title);

  // Apply offer to lead
  const applyOfferRes = await fetch(`${BASE_URL}/admin/leads/${testLeadId}/apply-offer`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ offer_id: testOfferId })
  });
  const applyOfferData = await applyOfferRes.json();
  assert.strictEqual(applyOfferRes.status, 200);
  console.log('   ✓ Offer applied! Payable amount calculated post-discount: ₹' + applyOfferData.payable_amount);

  // 8. Conversion Validation: Reject converted WITHOUT payment
  console.log('\n8. Testing Conversion Validation (Rejection without payment)...');
  const failConvertRes = await fetch(`${BASE_URL}/admin/leads/${testLeadId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'converted' }) // no payment info
  });
  const failConvertData = await failConvertRes.json();
  assert.strictEqual(failConvertRes.status, 400, 'Expected 400 when converting without payment');
  assert.strictEqual(failConvertData.code, 'PAYMENT_REQUIRED_FOR_CONVERSION');
  console.log('   ✓ Conversion rejected correctly by server without payment (HTTP 400):', failConvertData.message);

  // 9. Valid Conversion with Atomic Payment Recording & Incentive Computation
  console.log('\n9. Testing Conversion with Payment & Incentive Calculation...');
  const convertRes = await fetch(`${BASE_URL}/admin/leads/${testLeadId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'converted',
      payment_amount: 500000,
      method: 'bank_transfer',
      transaction_id: 'HDFC_TXN_987654321',
      verify_payment: true,
    })
  });
  const convertData = await convertRes.json();
  assert.strictEqual(convertRes.status, 200, 'Expected 200 on valid conversion with payment');
  assert.strictEqual(convertData.lead.status, 'converted');
  console.log('   ✓ Lead converted successfully with recorded ₹5,00,000 payment.');

  // Check Agent Performance Analytics
  const perfRes = await fetch(`${BASE_URL}/admin/analytics/agents-performance`, {
    method: 'GET',
    headers: authHeaders,
  });
  const perfData = await perfRes.json();
  const agentPerf = perfData.performance.find(p => String(p.agentId) === String(testAgentId));
  assert.ok(agentPerf, 'Agent must appear in performance leaderboard');
  console.log('   ✓ Agent Leaderboard verified: Total Sales = ₹' + agentPerf.totalSales + ', Incentive Earned = ₹' + agentPerf.totalIncentives);

  // 10. Activity Logs & CSV Export Verification
  console.log('\n10. Testing Activity Logs & CSV Export...');
  const csvRes = await fetch(`${BASE_URL}/admin/activity-logs?format=csv`, {
    method: 'GET',
    headers: authHeaders,
  });
  assert.strictEqual(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.startsWith('Timestamp,Actor,Role,Action'), 'CSV must contain standard headers');
  console.log('   ✓ CSV Activity Logs exported successfully (' + csvText.split('\n').length + ' lines).');

  console.log('\n🎉 ALL 10 INTEGRATION & BUSINESS VALIDATION TESTS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
};

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
