const axios = require('axios');
const assert = require('assert');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function runWorkspaceSecurityAndIsolationSuite() {
  console.log('\n============================================================');
  console.log('🛡️  RUNNING WORKSPACE RBAC & CROSS-TENANT ISOLATION SUITE');
  console.log('============================================================\n');

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
        console.error(`     Response data:`, JSON.stringify(err.response.data));
      }
      failed++;
    }
  };

  const timestamp = Date.now();
  const tenantAEmail = `owner_a_${timestamp}@consultant.com`;
  const tenantBEmail = `owner_b_${timestamp}@consultant.com`;
  const counsellorEmail = `counsellor_${timestamp}@consultant.com`;
  const password = 'Password@123456';

  let tokenA = '';
  let tokenB = '';
  let tokenCounsellor = '';
  let workspaceAId = '';
  let workspaceBId = '';
  let leadAId = '';
  let dealAId = '';
  let inviteToken = '';

  const apiA = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiB = axios.create({ baseURL: BASE_URL, timeout: 10000 });
  const apiCounsellor = axios.create({ baseURL: BASE_URL, timeout: 10000 });

  // 1. Frictionless Solo User Sign-Up & Automatic Workspace Provisioning
  await test('Solo User A Signup & Auto-Workspace Provisioning', async () => {
    const signupRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Consultant A Solo',
      email: tenantAEmail,
      password: password,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      industryType: 'education',
      educationSubProfile: 'college_admissions',
    });

    assert(signupRes.status === 201 || signupRes.status === 200, 'Signup should succeed');
    tokenA = signupRes.data.token;
    apiA.defaults.headers.common['Authorization'] = `Bearer ${tokenA}`;

    // Verify workspace was auto-provisioned
    const wsRes = await apiA.get('/api/workspace/current');
    assert(wsRes.status === 200, 'Current workspace endpoint should return 200');
    assert(wsRes.data.success, 'Workspace fetch should be successful');
    const ws = wsRes.data.data || wsRes.data.workspace;
    assert(ws?._id, 'Workspace should have valid _id');
    workspaceAId = ws._id;
  });

  // 2. Solo User B Signup & Independent Workspace Creation
  await test('Solo User B Signup & Independent Workspace Creation', async () => {
    const signupRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Consultant B Competitor',
      email: tenantBEmail,
      password: password,
      phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
      industryType: 'education',
      educationSubProfile: 'college_admissions',
    });

    assert(signupRes.status === 201 || signupRes.status === 200, 'Signup B should succeed');
    tokenB = signupRes.data.token;
    apiB.defaults.headers.common['Authorization'] = `Bearer ${tokenB}`;

    const wsRes = await apiB.get('/api/workspace/current');
    assert(wsRes.status === 200);
    const ws = wsRes.data.data || wsRes.data.workspace;
    workspaceBId = ws._id;
    assert(String(workspaceBId) !== String(workspaceAId), 'Workspace B must be distinct from Workspace A');
  });

  // 3. Tenant A Creates Private Lead
  await test('Tenant A Creates Private Candidate Lead', async () => {
    const leadPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const leadRes = await apiA.post('/api/leads', {
      name: 'Aditya Verma',
      phone: leadPhone,
      email: 'aditya.verma@example.com',
      budget: 650000,
      targetDomain: 'Engineering (B.Tech/BE)',
      targetCourse: 'B.Tech AI & Data Science',
      status: 'new_lead',
    });

    assert(leadRes.status === 201 || leadRes.status === 200, 'Lead creation should succeed');
    const lead = leadRes.data.lead || leadRes.data;
    assert(lead?._id, 'Lead should have an _id');
    leadAId = lead._id;
  });

  // 4. NEGATIVE SECURITY TEST: Cross-Tenant Read Isolation
  await test('NEGATIVE TEST: Tenant B Cannot Read Tenant A Lead by ID', async () => {
    assert(leadAId, 'leadAId must be valid');
    try {
      await apiB.get(`/api/leads/${leadAId}`);
      assert.fail('Tenant B should NOT be able to read Tenant A lead');
    } catch (err) {
      assert(err.response?.status === 404 || err.response?.status === 403,
        `Expected 404 or 403 but got ${err.response?.status}`);
    }
  });

  // 5. NEGATIVE SECURITY TEST: Cross-Tenant Update Isolation
  await test('NEGATIVE TEST: Tenant B Cannot Update Tenant A Lead', async () => {
    assert(leadAId, 'leadAId must be valid');
    try {
      await apiB.put(`/api/leads/${leadAId}`, {
        name: 'Hacked By Tenant B',
        budget: 999999,
      });
      assert.fail('Tenant B should NOT be able to update Tenant A lead');
    } catch (err) {
      assert(err.response?.status === 404 || err.response?.status === 403,
        `Expected 404 or 403 but got ${err.response?.status}`);
    }
  });

  // 6. NEGATIVE SECURITY TEST: Cross-Tenant Delete Isolation
  await test('NEGATIVE TEST: Tenant B Cannot Delete Tenant A Lead', async () => {
    assert(leadAId, 'leadAId must be valid');
    try {
      await apiB.delete(`/api/leads/${leadAId}`);
      assert.fail('Tenant B should NOT be able to delete Tenant A lead');
    } catch (err) {
      assert(err.response?.status === 404 || err.response?.status === 403,
        `Expected 404 or 403 but got ${err.response?.status}`);
    }
  });

  // 7. NEGATIVE SECURITY TEST: Cross-Tenant Export Isolation
  await test('NEGATIVE TEST: Tenant B Export Does Not Contain Tenant A Leads', async () => {
    try {
      const exportRes = await apiB.get('/api/leads/export?format=csv');
      const csvData = String(exportRes.data);
      assert(!csvData.includes('Aditya Verma'), 'Tenant B CSV export must NOT contain Tenant A student name');
      assert(!csvData.includes('aditya.verma@example.com'), 'Tenant B CSV export must NOT contain Tenant A email');
    } catch (err) {
      // If plan restricts export, it proves least privilege export gating
      assert(err.response?.status === 403, `Expected 403 feature gate if not allowed`);
    }
  });

  // 8. NEGATIVE SECURITY TEST: Header-based Workspace Spoofing Prevention
  await test('NEGATIVE TEST: Tenant B Cannot Access Tenant A Workspace via x-workspace-id Header', async () => {
    assert(workspaceAId, 'workspaceAId must be valid');
    try {
      await apiB.get('/api/workspace/current', {
        headers: { 'x-workspace-id': workspaceAId },
      });
      assert.fail('Spoofed workspace request should be rejected');
    } catch (err) {
      assert(err.response?.status === 403, `Expected 403 Forbidden but got ${err.response?.status}`);
    }
  });

  // 9. Teammate Invitation Lifecycle
  await test('Tenant A Invites Counsellor to Workspace', async () => {
    const invRes = await apiA.post('/api/workspace/invitations', {
      email: counsellorEmail,
      role: 'counsellor',
      team: 'Engineering Admissions',
    });

    assert(invRes.status === 201 || invRes.status === 200, 'Invite should succeed');
    assert(invRes.data.success, 'Invite response should be successful');
    const token = invRes.data.data?.token || invRes.data.invitation?.token;
    assert(token, 'Invite should return an invitation token');
    inviteToken = token;
  });

  // 10. Invitee Accepts Invitation & Joins Workspace
  await test('Invitee Accepts Invitation & Joins Workspace with Counsellor Role', async () => {
    assert(inviteToken, 'inviteToken must be valid');
    // Register invitee account
    const registerRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Rohan Counsellor',
      email: counsellorEmail,
      password: password,
      phone: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
      industryType: 'education',
    });

    tokenCounsellor = registerRes.data.token;
    apiCounsellor.defaults.headers.common['Authorization'] = `Bearer ${tokenCounsellor}`;

    // Accept invitation
    const acceptRes = await apiCounsellor.post(`/api/workspace/invitations/${inviteToken}/accept`);
    assert(acceptRes.status === 200, 'Invitation acceptance should succeed');
    assert(acceptRes.data.success, 'Acceptance response should be success');

    // Verify counsellor's workspace context
    const wsRes = await apiCounsellor.get('/api/workspace/current');
    const ws = wsRes.data.data || wsRes.data.workspace;
    assert(String(ws._id) === String(workspaceAId), 'Counsellor must be in Workspace A');
  });

  // 11. RBAC Least-Privilege Guard: Counsellor Cannot Modify Workspace Policies
  await test('NEGATIVE TEST: Counsellor Forbidden From Updating Workspace Policies', async () => {
    try {
      await apiCounsellor.put('/api/workspace/current', {
        name: 'Hacked Workspace Name',
      });
      assert.fail('Counsellor should NOT have permission to edit workspace settings');
    } catch (err) {
      assert(err.response?.status === 403, `Expected 403 PERMISSION_DENIED but got ${err.response?.status}`);
    }
  });

  // 12. Last Owner Protection Invariant
  await test('INVARIANT: Demoting the Sole Owner is Rejected (LAST_OWNER_PROTECTION)', async () => {
    const membersRes = await apiA.get('/api/workspace/members');
    const memberList = membersRes.data.data || membersRes.data.members;
    assert(Array.isArray(memberList), 'memberList should be an array');
    const ownerMember = memberList.find(m => m.role === 'owner');
    assert(ownerMember, 'Owner member must exist');

    try {
      await apiA.put(`/api/workspace/members/${ownerMember._id}/role`, {
        role: 'counsellor',
      });
      assert.fail('Demoting the sole owner should be strictly blocked');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400 Bad Request but got ${err.response?.status}`);
      assert(err.response?.data?.code === 'LAST_OWNER_PROTECTION', 'Expected LAST_OWNER_PROTECTION error code');
    }
  });

  // 13. Multiple Pipelines: Create & Switch Custom Pipeline
  await test('Multiple Pipelines: Create Custom Pipeline with Configurable Stages', async () => {
    // Ensure default pipeline is seeded first
    await apiA.get('/api/pipelines');

    const pipeRes = await apiA.post('/api/pipelines', {
      name: 'Study Abroad Pipeline',
      description: 'Foreign university applications & visa filing',
      stages: [
        { stageId: 'inquiry', name: 'Country Selected', category: 'open', order: 0, probability: 10 },
        { stageId: 'ielts_prep', name: 'IELTS / GRE Coaching', category: 'open', order: 1, probability: 30 },
        { stageId: 'sop_review', name: 'SOP & LOR Drafted', category: 'open', order: 2, probability: 50 },
        { stageId: 'offer_received', name: 'I-20 / Offer Received', category: 'open', order: 3, probability: 80 },
        { stageId: 'visa_approved', name: 'Visa Approved', category: 'won', order: 4, probability: 100 },
        { stageId: 'visa_rejected', name: 'Visa Rejected', category: 'lost', order: 5, probability: 0 },
      ],
    });

    assert(pipeRes.status === 201 || pipeRes.status === 200, 'Pipeline creation should succeed');
    assert(pipeRes.data.data?.stages?.length === 6, 'Pipeline should have 6 configured stages');

    // List pipelines
    const listRes = await apiA.get('/api/pipelines');
    assert(listRes.data.data?.length >= 2, 'Workspace should now have at least 2 pipelines');
  });

  // 14. Follow-Up Behavior: Differentiating Snooze vs Reschedule
  await test('Follow-Up Lifecycle: Snooze Delay Limit & Appointment Reschedule', async () => {
    assert(leadAId, 'leadAId must be valid');
    const initialDate = new Date(Date.now() + 3600 * 1000);
    // Schedule initial follow-up
    const schedRes = await apiA.post(`/api/leads/${leadAId}/follow-up`, {
      scheduledAt: initialDate.toISOString(),
      note: 'Initial counselling call discussion on B.Tech options',
      type: 'call',
    });
    assert(schedRes.status === 201 || schedRes.status === 200);

    // 1st Snooze (delay by 15 mins)
    const delay1 = await apiA.post(`/api/leads/${leadAId}/follow-up/delay`, {
      delayMinutes: 15,
      reason: 'Student in class',
    });
    assert(delay1.data.delayCount === 1, 'First delay should increment delayCount to 1');
    assert(delay1.data.remainingDelays === 1, '1 delay remaining');

    // 2nd Snooze (delay by 20 mins)
    const delay2 = await apiA.post(`/api/leads/${leadAId}/follow-up/delay`, {
      delayMinutes: 20,
      reason: 'Parent attending meeting',
    });
    assert(delay2.data.delayCount === 2, 'Second delay should increment delayCount to 2');
    assert(delay2.data.remainingDelays === 0, '0 delays remaining');

    // 3rd Snooze attempt -> MUST FAIL with MAX_DELAYS_REACHED
    try {
      await apiA.post(`/api/leads/${leadAId}/follow-up/delay`, {
        delayMinutes: 10,
        reason: 'Attempting 3rd delay',
      });
      assert.fail('Third delay should be strictly rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Expected 400 Bad Request on 3rd delay');
      assert(err.response?.data?.code === 'MAX_DELAYS_REACHED', 'Expected MAX_DELAYS_REACHED');
    }

    // Reschedule appointment with agreed new date/time -> Resets snooze counter
    const newAppointment = new Date(Date.now() + 86400 * 1000); // Tomorrow
    const reschedRes = await apiA.post(`/api/leads/${leadAId}/follow-up/reschedule`, {
      scheduledAt: newAppointment.toISOString(),
      reason: 'Student agreed to Saturday 4 PM counselling slot after exams',
    });
    assert(reschedRes.status === 200, 'Reschedule should succeed');
    assert(reschedRes.data.lead?.followUpDelayCount === 0, 'Reschedule must reset delay counter to 0');
    assert(reschedRes.data.lead?.activeFollowUp?.delayCount === 0, 'Active follow-up delayCount must be 0');
  });

  // 15. Admission Deal vs Commission Lifecycle Separation
  await test('Admission Deal & Commission Financial Lifecycle Separation', async () => {
    assert(leadAId, 'leadAId must be valid');
    const dealRes = await apiA.post('/api/deals', {
      leadId: leadAId,
      studentName: 'Aditya Verma',
      studentPhone: '919876543210',
      studentEmail: 'aditya.verma@example.com',
      collegeName: 'Vellore Institute of Technology',
      courseName: 'B.Tech Computer Science Engineering',
      academicYear: '2026-2027',
      quota: 'Merit',
      tuitionValue: 780000,
      tokenFeePaid: 50000,
      admissionStatus: 'confirmed',
      commission: {
        ratePercent: 12,
        expectedAmount: 93600,
        invoiceNumber: 'INV-VIT-2026-001',
        invoiceStatus: 'invoiced',
      },
    });

    assert(dealRes.status === 201 || dealRes.status === 200, 'Deal creation should succeed');
    assert(dealRes.data.data?._id, 'Deal must have _id');
    dealAId = dealRes.data.data._id;
    assert(dealRes.data.data.admissionStatus === 'confirmed', 'Admission status must be confirmed');
    assert(dealRes.data.data.commission?.invoiceStatus === 'invoiced', 'Commission status is invoiced');
    assert(dealRes.data.data.commission?.payoutStatus === 'pending', 'Payout status is pending');

    // Commission summary aggregation
    const summaryRes = await apiA.get('/api/deals/summary/commission');
    assert(summaryRes.status === 200, 'Commission summary should return 200');
    assert(summaryRes.data.data?.totalDeals >= 1, 'Summary should aggregate at least 1 deal');
    assert(summaryRes.data.data?.totalTuition >= 780000, 'Tuition volume should be aggregated');
    assert(summaryRes.data.data?.totalExpectedCommission >= 93600, 'Expected commission should be aggregated');
  });

  // 16. NEGATIVE SECURITY TEST: Tenant B Cannot View Tenant A Admission Deals
  await test('NEGATIVE TEST: Tenant B Cannot Read Tenant A Deals or Financial Summary', async () => {
    assert(dealAId, 'dealAId must be valid');
    try {
      await apiB.get(`/api/deals/${dealAId}`);
      assert.fail('Tenant B should NOT be able to view Tenant A admission deal');
    } catch (err) {
      assert(err.response?.status === 404 || err.response?.status === 403,
        `Expected 404 or 403 but got ${err.response?.status}`);
    }

    const summaryB = await apiB.get('/api/deals/summary/commission');
    assert(summaryB.data.data?.totalDeals === 0, 'Tenant B commission summary should be 0');
    assert(summaryB.data.data?.totalTuition === 0, 'Tenant B tuition should be 0');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`🏁 SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkspaceSecurityAndIsolationSuite().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
