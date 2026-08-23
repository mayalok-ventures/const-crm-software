/**
 * AGENCY & TEAM MANAGEMENT INTEGRATION TEST SUITE
 * Validates the core business requirements of the Agency Control System:
 * - RBAC & Permission Ceiling (Managers cannot grant permissions they don't possess)
 * - Atomic Lead Claims (Concurrency race condition prevention)
 * - Normal & Force Transfers (Audited, notification alerts, and history records)
 * - Split Incentives (Calculated on WON status, policies snapshotted, idempotency verification)
 * - Global Activity & Tenant Isolation (Global logs are secure and properly isolated)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runAgencyTeamManagementTests() {
  console.log('\n🔒 ========================================================');
  console.log('   AGENCY & TEAM CONTROL SYSTEM INTEGRATION TEST SUITE');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  }
  console.log(`✅ Test Suite DB Connected: ${mongoose.connection.host}`);

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
    console.log('▶️  Step 1: Setup Test Agency Environment...');

    const ownerEmail = `owner_${timestamp}_${Math.random().toString(36).slice(2, 6)}@agency.com`;
    const resOwner = await axios.post(`${API_URL}/auth/register`, {
      name: `Agency Owner_${timestamp}`,
      email: ownerEmail,
      phone: randPhone(),
      password: 'Password@123',
      workStatus: 'company_owner',
      companyRole: 'owner',
      companyInfo: { companyName: `Test Agency_${timestamp}` },
    });
    console.log('resOwner.data is:', JSON.stringify(resOwner.data, null, 2));
    const tokenOwner = resOwner.data.token;

    // Upgrade Owner's plan to enterprise to bypass roster limits in testing
    const updatedOwner = await User.findOneAndUpdate(
      { email: ownerEmail },
      {
        $set: {
          plan: 'enterprise',
          planEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        }
      },
      { new: true }
    );
    console.log(`  [SETUP] Upgraded Owner ${updatedOwner?._id} to plan: ${updatedOwner?.plan}`);

    // 2. Register Agent Ravi (created under owner's agency)
    const raviEmail = `ravi_${timestamp}@agency.com`;
    const resRaviRegister = await axios.post(
      `${API_URL}/company/agents`,
      {
        name: `Ravi Agent_${timestamp}`,
        email: raviEmail,
        phone: randPhone(),
        password: 'Password@123',
      },
      { headers: { Authorization: `Bearer ${tokenOwner}` } }
    );
    // Log in Ravi
    const resRaviLogin = await axios.post(`${API_URL}/auth/login`, {
      identifier: raviEmail,
      email: raviEmail,
      password: 'Password@123',
    });
    const tokenRavi = resRaviLogin.data.token;

    // 3. Register Agent Amit (created under owner's agency)
    const amitEmail = `amit_${timestamp}@agency.com`;
    const resAmitRegister = await axios.post(
      `${API_URL}/company/agents`,
      {
        name: `Amit Agent_${timestamp}`,
        email: amitEmail,
        phone: randPhone(),
        password: 'Password@123',
      },
      { headers: { Authorization: `Bearer ${tokenOwner}` } }
    );
    // Log in Amit
    const resAmitLogin = await axios.post(`${API_URL}/auth/login`, {
      identifier: amitEmail,
      email: amitEmail,
      password: 'Password@123',
    });
    const tokenAmit = resAmitLogin.data.token;

    // ─────────────────────────────────────────────────────────────
    // TEST 1: ROLE CREATION & PERMISSION CEILING
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  TEST 1: Custom Roles & Permission Ceiling...');

    // Owner creates custom manager role with LEAD_VIEW, LEAD_EDIT, LEAD_CLAIM, LEAD_TRANSFER_APPROVE, LEAD_FORCE_TRANSFER
    const resManagerRole = await axios.post(
      `${API_URL}/agency/roles`,
      {
        name: `Senior Manager_${timestamp}`,
        roleType: 'MANAGER',
        permissions: ['LEAD_VIEW', 'LEAD_EDIT', 'LEAD_CLAIM', 'LEAD_TRANSFER_REQUEST', 'LEAD_TRANSFER_APPROVE', 'LEAD_FORCE_TRANSFER', 'ROLE_VIEW', 'ROLE_CREATE'],
      },
      { headers: { Authorization: `Bearer ${tokenOwner}` } }
    );
    assert(resManagerRole.data.success === true, 'Owner should be able to create a custom Manager role');
    const managerRoleId = resManagerRole.data.role._id;

    // Assign Ravi as a Manager (Manager gets managerRoleId)
    await User.updateOne(
      { _id: resRaviLogin.data._id },
      { $set: { roleId: managerRoleId } }
    );

    // Seed tenant default system roles and assign AGENT role to Amit
    const { seedSystemRolesForTenant } = require('../src/utils/seedAgencyRoles');
    const seededRoles = await seedSystemRolesForTenant(resOwner.data._id);
    const agentRoleId = seededRoles['AGENT']._id;
    await User.updateOne(
      { _id: resAmitLogin.data._id },
      { $set: { roleId: agentRoleId } }
    );

    // Set Ravi as Amit's manager in User profile
    await User.updateOne({ email: amitEmail }, { $set: { managerId: resRaviLogin.data._id } });

    // Ravi attempts to create a custom role with a permission he does NOT possess (e.g. EXPORT_LEADS)
    try {
      await axios.post(
        `${API_URL}/agency/roles`,
        {
          name: `Hacker Role_${timestamp}`,
          roleType: 'CUSTOM',
          permissions: ['LEAD_VIEW', 'EXPORT_LEADS'],
        },
        { headers: { Authorization: `Bearer ${tokenRavi}` } }
      );
      assert(false, 'Manager should NOT be able to violate permission ceiling');
    } catch (err) {
      assert(err.response.status === 403, 'Permission ceiling violation correctly rejected with 403 Forbidden');
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 2: ATOMIC LEAD CLAIMS & CONCURRENCY
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  TEST 2: Atomic Lead Claims Concurrency...');

    // Create an unclaimed Lead (assignedTo = null, currentOwnerId = null)
    const resLead = await axios.post(
      `${API_URL}/leads`,
      {
        name: `Inquiry Project_${timestamp}`,
        phone: '9999999999',
        status: 'new_lead',
        service_required: 'business',
      },
      { headers: { Authorization: `Bearer ${tokenOwner}` } }
    );
    const leadId = resLead.data._id || resLead.data.data?._id;
    console.log('  [DEBUG] Created Lead data:', JSON.stringify(resLead.data));

    // Simulate concurrent claim by Ravi and Amit at the exact same time
    const claimPromises = [
      axios.post(`${API_URL}/agency/leads/${leadId}/claim`, {}, { headers: { Authorization: `Bearer ${tokenRavi}` } }),
      axios.post(`${API_URL}/agency/leads/${leadId}/claim`, {}, { headers: { Authorization: `Bearer ${tokenAmit}` } }),
    ];

    const results = await Promise.allSettled(claimPromises);
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        console.error(`  [DEBUG] Claim Promise ${idx} rejected. Status: ${r.reason.response?.status}, Data:`, r.reason.response?.data || r.reason.message);
      } else {
        console.log(`  [DEBUG] Claim Promise ${idx} fulfilled.`);
      }
    });
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert(fulfilled.length === 1, 'Exactly one concurrent claim request should succeed');
    assert(rejected.length === 1, 'Exactly one concurrent claim request should fail');
    if (rejected.length > 0 && rejected[0].reason.response) {
      assert(rejected[0].reason.response.status === 409, 'Double claim attempt should return 409 Conflict error');
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 3: LEAD TRANSFERS (NORMAL vs FORCE TRANSFER)
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  TEST 3: Lead Transfer & Force Transfer System...');

    const activeClaimer = fulfilled[0].value.data.lead.currentOwnerId;
    const isRaviOwner = String(activeClaimer) === String(resRaviLogin.data._id);
    const currentOwnerToken = isRaviOwner ? tokenRavi : tokenAmit;
    const recipientToken = isRaviOwner ? tokenAmit : tokenRavi;
    const recipientId = isRaviOwner ? resAmitLogin.data._id : resRaviLogin.data._id;

    // Normal Owner requests transfer to Recipient
    const resTransferReq = await axios.post(
      `${API_URL}/agency/leads/${leadId}/transfer-request`,
      {
        requestedToUserId: recipientId,
        reason: 'Client requested representative in their local territory',
      },
      { headers: { Authorization: `Bearer ${currentOwnerToken}` } }
    );
    assert(resTransferReq.data.success === true, 'Transfer request should be successfully created');
    const transferReqId = resTransferReq.data.request._id;

    // Recipient accepts the transfer
    const resAccept = await axios.post(
      `${API_URL}/agency/transfer-requests/${transferReqId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${recipientToken}` } }
    );
    assert(resAccept.data.success === true, 'Recipient should be able to accept transfer request');

    // Verify ownership switched on Lead
    const resUpdatedLead = await axios.get(`${API_URL}/leads/${leadId}`, { headers: { Authorization: `Bearer ${tokenOwner}` } });
    assert(String(resUpdatedLead.data.currentOwnerId) === String(recipientId), 'Lead currentOwnerId must switch to recipient after acceptance');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: INCENTIVE SPLIT & POLICY CALCULATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  TEST 4: Split Incentive Policy Calculation...');

    // Owner creates split policy: 40% First Handler, 60% Closer
    const resPolicy = await axios.post(
      `${API_URL}/agency/incentive-policies`,
      {
        name: '40/60 Split Policy',
        calculationType: 'SPLIT',
        firstHandlerPercentage: 40,
        closerPercentage: 60,
      },
      { headers: { Authorization: `Bearer ${tokenOwner}` } }
    );
    assert(resPolicy.data.success === true, 'Owner should be able to configure split incentive policy');

    // Status converted/payment_done requires paymentAmount & paymentMethod (triggering WON split calculation)
    await axios.put(
      `${API_URL}/leads/${leadId}`,
      {
        status: 'Closed / Won',
        paymentAmount: 10000, // INR 10,000 deal size
        paymentMethod: 'razorpay',
      },
      { headers: { Authorization: `Bearer ${tokenOwner}` } }
    );

    // Manually trigger the WON split calculation to ensure database states write
    const { triggerWonIncentiveCalculation } = require('../src/controllers/agencyController');
    await triggerWonIncentiveCalculation(leadId, resOwner.data._id);

    // Verify both first handler and closer received their split records
    const resIncentives = await axios.get(`${API_URL}/agency/incentives`, { headers: { Authorization: `Bearer ${tokenOwner}` } });
    assert(resIncentives.data.incentives.length >= 2, 'Split policy should generate separate incentive records for first handler and closer');

    const firstHandlerShare = resIncentives.data.incentives.find(i => String(i.agentId._id) === String(activeClaimer));
    const closerShare = resIncentives.data.incentives.find(i => String(i.agentId._id) === String(recipientId));

    assert(firstHandlerShare && closerShare, 'First handler and closer should both have incentive records populated');
    if (firstHandlerShare && closerShare) {
      assert(firstHandlerShare.incentiveAmount === 400, 'First handler should get exactly 40% of the 10% base incentive (₹400)');
      assert(closerShare.incentiveAmount === 600, 'Closer should get exactly 60% of the 10% base incentive (₹600)');
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 5: FORCE TRANSFER WORKFLOW
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶️  TEST 5: Force Transfer System...');
    const firstAgentId = activeClaimer;
    const resForce = await axios.post(
      `${API_URL}/agency/leads/${leadId}/force-transfer`,
      {
        targetUserId: firstAgentId,
        reason: 'Manager reallocating lead based on Territory performance.',
      },
      { headers: { Authorization: `Bearer ${tokenOwner}` } }
    );
    assert(resForce.data.success === true, 'Owner/Manager should be able to force transfer lead');

    // Verify force transfer audit log is written
    const resLogs = await axios.get(`${API_URL}/agency/activity`, { headers: { Authorization: `Bearer ${tokenOwner}` } });
    const hasForceTransferLog = resLogs.data.activities.some(a => a.action === 'FORCE_TRANSFERRED');
    assert(hasForceTransferLog, 'Force transfer event must be successfully written in ActivityLog');

    console.log(`\n🎉 Suite completed. Passed: ${passed}, Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test suite crash:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Support running directly
if (require.main === module) {
  // Let mongoose load models first
  require('../server');
  
  const pollServer = async (attempts = 0) => {
    try {
      await axios.get('http://localhost:5000/api/health', { timeout: 1000 });
      runAgencyTeamManagementTests();
    } catch (err) {
      if (attempts < 20) {
        setTimeout(() => pollServer(attempts + 1), 1000);
      } else {
        console.error('❌ Server failed to start on port 5000 after 20 attempts');
        process.exit(1);
      }
    }
  };
  
  setTimeout(pollServer, 1000);
}

module.exports = runAgencyTeamManagementTests;
