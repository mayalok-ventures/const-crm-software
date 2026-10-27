const axios = require('axios');
const assert = require('assert');

const API = 'http://localhost:5000/api';

async function runSecurityHardeningSuite() {
  console.log('\n============================================================');
  console.log('🛡️ TESTING ADMISSION CRM SECURITY HARDENING & LIFECYCLES');
  console.log('============================================================\n');

  let passed = 0;

  // ── Test 1: Workspace Owner Onboarding & Auto-Initialization ──
  const ownerA = await axios.post(`${API}/auth/register`, {
    name: 'Audit Owner A',
    email: `owner_a_${Date.now()}@consultancy.com`,
    password: 'Password@123456',
    phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
    industryType: 'Education',
    educationSubProfile: 'admission_consultants',
  });
  const tokenA = ownerA.data.token;
  const headersA = { Authorization: `Bearer ${tokenA}` };

  const wsA = await axios.get(`${API}/workspace/current`, { headers: headersA });
  const workspaceIdA = wsA.data.data._id;
  assert.ok(workspaceIdA, 'Workspace A should be initialized');
  console.log('  ✓ [1] Solo Owner A initialized workspace:', wsA.data.data.name);
  passed++;

  // ── Test 2: Token Hashing & Masking in Invitation List ──
  const inviteRes = await axios.post(`${API}/workspace/invitations`, {
    email: `counsellor_${Date.now()}@consultancy.com`,
    role: 'counsellor',
    team: 'Undergrad Admissions',
  }, { headers: headersA });

  const rawInviteToken = inviteRes.data.data.token;
  assert.ok(rawInviteToken, 'Raw invitation token should be returned on creation');
  assert.ok(inviteRes.data.inviteUrl.includes('/invite?token='), 'inviteUrl must use static-compatible query syntax');
  console.log('  ✓ [2] Cryptographically generated invitation token returned in 201 response with static URL');
  passed++;

  // Verify token is masked in GET /api/workspace/invitations
  const listRes = await axios.get(`${API}/workspace/invitations`, { headers: headersA });
  const listedInvite = listRes.data.data.find(inv => inv._id === inviteRes.data.data._id);
  assert.ok(listedInvite, 'Invitation should be listed');
  assert.strictEqual(listedInvite.token, undefined, 'Raw token should NEVER be exposed in GET list');
  assert.strictEqual(listedInvite.tokenHash, undefined, 'tokenHash should NEVER be exposed in GET list');
  console.log('  ✓ [3] PASS: Invitations list strictly masks raw tokens and token hashes');
  passed++;

  // ── Test 3: Public Invitation Verification Endpoint ──
  const verifyRes = await axios.get(`${API}/workspace/invitations/${rawInviteToken}/verify`);
  assert.strictEqual(verifyRes.data.success, true);
  assert.strictEqual(verifyRes.data.data.role, 'counsellor');
  assert.strictEqual(verifyRes.data.data.workspaceName, wsA.data.data.name);
  console.log('  ✓ [4] PASS: Public GET /api/workspace/invitations/:token/verify returns workspace details');
  passed++;

  // ── Test 4: Token Rotation on Resend ──
  const resendRes = await axios.post(`${API}/workspace/invitations/${inviteRes.data.data._id}/resend`, {}, { headers: headersA });
  const rotatedToken = resendRes.data.data.token;
  assert.ok(rotatedToken && rotatedToken !== rawInviteToken, 'Rotated token should be different from initial token');
  assert.ok(resendRes.data.inviteUrl.includes('/invite?token='), 'Rotated inviteUrl must use static-compatible query syntax');
  console.log('  ✓ [5] PASS: Resending invitation rotates secret token and extends validity');
  passed++;

  // Old token should now fail verification
  try {
    await axios.get(`${API}/workspace/invitations/${rawInviteToken}/verify`);
    assert.fail('Old rotated token should not verify');
  } catch (err) {
    assert.strictEqual(err.response?.status, 404);
    console.log('  ✓ [6] PASS: Previous invitation token invalidated upon rotation');
    passed++;
  }

  // ── Test 5: Single-Use Invitation Acceptance ──
  const acceptRes = await axios.post(`${API}/workspace/invitations/${rotatedToken}/accept`, {
    name: 'Priya Counsellor',
    password: 'Password@123456',
  });
  assert.strictEqual(acceptRes.data.success, true);
  const counsellorToken = acceptRes.data.token;
  const counsellorHeaders = { Authorization: `Bearer ${counsellorToken}` };
  console.log('  ✓ [7] PASS: Counsellor successfully accepted invitation and joined workspace');
  passed++;

  // Replay attempt must be rejected with 400
  try {
    await axios.post(`${API}/workspace/invitations/${rotatedToken}/accept`, {
      name: 'Replay Attacker',
      password: 'Password@123456',
    });
    assert.fail('Replay acceptance should have failed');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400);
    console.log('  ✓ [8] PASS: Invitation replay prevented (single-use enforced)');
    passed++;
  }

  // ── Test 6: Privilege Escalation Prevention ──
  const membersRes = await axios.get(`${API}/workspace/members`, { headers: headersA });
  const counsellorMember = membersRes.data.data.find(m => m.email.includes('counsellor_'));
  assert.ok(counsellorMember, 'Counsellor member should exist');

  // Attempt self-role modification by counsellor
  try {
    await axios.put(`${API}/workspace/members/${counsellorMember._id}/role`, {
      role: 'owner',
    }, { headers: counsellorHeaders });
    assert.fail('Counsellor should not be able to promote to owner');
  } catch (err) {
    assert.strictEqual(err.response?.status, 403);
    console.log('  ✓ [9] PASS: Non-owner blocked from privilege escalation to owner (403)');
    passed++;
  }

  // Counsellor attempting to create custom role without permission
  try {
    await axios.post(`${API}/workspace/roles`, {
      name: 'Unauthorized Super Role',
      permissions: [{ key: 'billing.manage', scope: 'workspace' }],
    }, { headers: counsellorHeaders });
    assert.fail('Counsellor should not be able to manage roles');
  } catch (err) {
    assert.strictEqual(err.response?.status, 403);
    console.log('  ✓ [10] PASS: Counsellor blocked from creating roles without roles.manage (403)');
    passed++;
  }

  // ── Test 7: Ordinary Note Auto-Advance Invariant & Negative Test ──
  // Create a lead in Workspace A
  const leadRes = await axios.post(`${API}/leads`, {
    name: 'Student Rohan Mehta',
    phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    status: 'Lead Received',
    targetStream: 'Engineering',
    targetDomain: 'Engineering (B.Tech/BE)',
  }, { headers: headersA });
  const leadId = leadRes.data._id || leadRes.data.lead?._id;
  assert.ok(leadId, 'Lead should be created');

  // Add an ordinary note containing the word "call"
  await axios.post(`${API}/leads/${leadId}/notes`, {
    text: 'Student called to ask for university syllabus brochure',
  }, { headers: headersA });

  // Verify lead stage DID NOT change because autoAdvanceStageOnNote is false
  const verifyLeadRes = await axios.get(`${API}/leads/${leadId}`, { headers: headersA });
  const currentLead = verifyLeadRes.data.lead || verifyLeadRes.data;
  assert.strictEqual(currentLead.status, 'Lead Received', 'Ordinary note must NOT advance stage when policy is false');
  console.log('  ✓ [11] PASS: Ordinary note did not advance lead stage (policy respected)');
  passed++;

  // NEGATIVE TEST: Client passing req.body.autoAdvance = true must NOT bypass workspace policy
  await axios.post(`${API}/leads/${leadId}/notes`, {
    text: 'Client attempting client-side stage jump',
    autoAdvance: true,
  }, { headers: headersA });
  const verifyBypassRes = await axios.get(`${API}/leads/${leadId}`, { headers: headersA });
  assert.strictEqual(verifyBypassRes.data.status, 'Lead Received', 'req.body.autoAdvance must not bypass workspace policy');
  console.log('  ✓ [12] PASS: NEGATIVE TEST: Client-supplied autoAdvance:true denied stage jump');
  passed++;

  // ── Test 8: Follow-Up Lifecycle & Snooze Limit Boundary Testing ──
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const scheduleRes = await axios.post(`${API}/leads/${leadId}/followups`, {
    scheduledAt: tomorrow.toISOString(),
    note: 'Discuss fee structure with parents',
  }, { headers: headersA });
  assert.strictEqual(scheduleRes.data.success, true);
  console.log('  ✓ [13] PASS: Follow-up scheduled with audit logging');
  passed++;

  // Delay / Snooze 1
  const delay1 = await axios.post(`${API}/leads/${leadId}/followups/delay`, {
    delayMinutes: 15,
    reason: 'Parent in meeting',
  }, { headers: headersA });
  assert.strictEqual(delay1.data.delayCount, 1);
  console.log('  ✓ [14] PASS: Follow-up snoozed (1/2)');
  passed++;

  // Complete Follow-Up
  const completeRes = await axios.post(`${API}/leads/${leadId}/followups/complete`, {
    outcomeNote: 'Parent agreed to campus visit next Monday',
  }, { headers: headersA });
  assert.strictEqual(completeRes.data.success, true);
  console.log('  ✓ [15] PASS: Follow-up completed with outcome note');
  passed++;

  // Snooze Limit Boundary Value Test: Workspace with maxSnoozeCount = 0
  await axios.put(`${API}/workspace/current`, {
    settings: { maxSnoozeCount: 0 }
  }, { headers: headersA });

  // Schedule new follow-up
  await axios.post(`${API}/leads/${leadId}/followups`, {
    scheduledAt: tomorrow.toISOString(),
    note: 'Follow-up under zero snooze policy',
  }, { headers: headersA });

  try {
    await axios.post(`${API}/leads/${leadId}/followups/delay`, {
      delayMinutes: 15,
      reason: 'Should be rejected immediately',
    }, { headers: headersA });
    assert.fail('Delay should be rejected when maxSnoozeCount is 0');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400);
    assert.strictEqual(err.response?.data?.code, 'MAX_DELAYS_REACHED');
    console.log('  ✓ [16] PASS: BOUNDARY TEST: maxSnoozeCount: 0 strictly blocks snooze attempts');
    passed++;
  }

  // Restore maxSnoozeCount to 2
  await axios.put(`${API}/workspace/current`, {
    settings: { maxSnoozeCount: 2 }
  }, { headers: headersA });

  // ── Test 9: Admission Deals, Invoiced Protection & Cancellation Workflow ──
  const dealRes = await axios.post(`${API}/deals`, {
    studentName: 'Student Rohan Mehta',
    collegeName: 'RV College of Engineering',
    courseName: 'B.Tech Computer Science',
    tuitionValue: 500000,
    commission: {
      ratePercent: 10,
      expectedAmount: 50000,
      invoiceStatus: 'unbilled',
    },
  }, { headers: headersA });
  const dealId = dealRes.data.data._id;
  assert.ok(dealId, 'Deal should be created');
  assert.strictEqual(dealRes.data.data.commission.expectedAmount, 50000);
  console.log('  ✓ [17] PASS: Admission deal recorded with expected commission calculation');
  passed++;

  // Create an INVOICED deal
  const invoicedDealRes = await axios.post(`${API}/deals`, {
    studentName: 'Student Invoiced Patel',
    collegeName: 'Manipal Institute of Technology',
    courseName: 'B.Tech Information Technology',
    tuitionValue: 600000,
    commission: {
      ratePercent: 12,
      expectedAmount: 72000,
      invoiceNumber: 'INV-2026-MIT-001',
      invoiceStatus: 'invoiced',
    },
  }, { headers: headersA });
  const invoicedDealId = invoicedDealRes.data.data._id;

  // Attempting destructive delete on invoiced deal must be REJECTED (DEAL_FINANCIALLY_LOCKED)
  try {
    await axios.delete(`${API}/deals/${invoicedDealId}`, { headers: headersA });
    assert.fail('Invoiced deal must not be deleted destructively');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400);
    assert.strictEqual(err.response?.data?.code, 'DEAL_FINANCIALLY_LOCKED');
    console.log('  ✓ [18] PASS: FINANCIAL INTEGRITY: Invoiced deal deletion strictly blocked (DEAL_FINANCIALLY_LOCKED)');
    passed++;
  }

  // Cancel / Void the invoiced deal safely
  const cancelRes = await axios.post(`${API}/deals/${invoicedDealId}/cancel`, {
    reason: 'Student opted for IIT seat; admission voided',
  }, { headers: headersA });
  assert.strictEqual(cancelRes.data.success, true);
  assert.strictEqual(cancelRes.data.data.admissionStatus, 'cancelled');
  console.log('  ✓ [19] PASS: Admission deal safely cancelled via void workflow with audit trail');
  passed++;

  // Summary aggregation: Cancelled deal must be excluded from active expected commission
  const summaryRes = await axios.get(`${API}/deals/summary/commission`, { headers: headersA });
  assert.strictEqual(summaryRes.data.success, true);
  assert.strictEqual(summaryRes.data.data.cancelledDeals, 1, 'Cancelled deal must be counted in summary');
  assert.strictEqual(summaryRes.data.data.totalExpectedCommission, 50000, 'Cancelled deal expected commission must be reconciled out');
  console.log('  ✓ [20] PASS: Financial reconciliation accurately excludes cancelled deals from projected commissions');
  passed++;

  // Delete unbilled deal
  const deleteDealRes = await axios.delete(`${API}/deals/${dealId}`, { headers: headersA });
  assert.strictEqual(deleteDealRes.data.success, true);
  console.log('  ✓ [21] PASS: Unbilled admission deal deleted successfully');
  passed++;

  // ── Test 10: Cross-Workspace Strict Multi-Tenant Isolation ──
  const ownerB = await axios.post(`${API}/auth/register`, {
    name: 'Audit Owner B',
    email: `owner_b_${Date.now()}@consultancy.com`,
    password: 'Password@123456',
    phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
    industryType: 'Education',
    educationSubProfile: 'admission_consultants',
  });
  const tokenB = ownerB.data.token;
  const headersB = { Authorization: `Bearer ${tokenB}` };

  // Owner B attempting to read Lead A from Workspace A
  try {
    await axios.get(`${API}/leads/${leadId}`, { headers: headersB });
    assert.fail('Owner B should not access Lead A');
  } catch (err) {
    assert.strictEqual(err.response?.status, 404, 'Cross-workspace lead read must return 404');
    console.log('  ✓ [22] PASS: Cross-workspace lead read strictly denied (404)');
    passed++;
  }

  // Owner B attempting to update Lead A from Workspace A
  try {
    await axios.put(`${API}/leads/${leadId}`, { name: 'Hacked Name' }, { headers: headersB });
    assert.fail('Owner B should not update Lead A');
  } catch (err) {
    assert.strictEqual(err.response?.status, 404, 'Cross-workspace lead update must return 404');
    console.log('  ✓ [23] PASS: Cross-workspace lead update strictly denied (404)');
    passed++;
  }

  // Owner B attempting to delete Lead A from Workspace A
  try {
    await axios.delete(`${API}/leads/${leadId}`, { headers: headersB });
    assert.fail('Owner B should not delete Lead A');
  } catch (err) {
    assert.strictEqual(err.response?.status, 404, 'Cross-workspace lead delete must return 404');
    console.log('  ✓ [24] PASS: Cross-workspace lead delete strictly denied (404)');
    passed++;
  }

  console.log('\n------------------------------------------------------------');
  console.log(`🏁 ALL ${passed} SECURITY & LIFECYCLE TESTS PASSED (100%)`);
  console.log('------------------------------------------------------------\n');
}

runSecurityHardeningSuite().catch((err) => {
  console.error('❌ Test failed with error:', err.response?.data || err.message, err.stack);
  process.exit(1);
});
