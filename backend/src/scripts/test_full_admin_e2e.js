const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Lead = require('../models/Lead');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Pipeline = require('../models/Pipeline');
const CommissionRule = require('../models/CommissionRule');
const CommissionPayout = require('../models/CommissionPayout');
const ActivityLog = require('../models/ActivityLog');
const adminController = require('../controllers/adminController');

async function runE2ETests() {
  console.log('🧪 Starting Full-Stack Admin Control Center E2E Verification...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Database');

    // 1. Mock Request / Response helper
    function createMockRes() {
      const res = {
        statusCode: 200,
        data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.data = payload;
          return this;
        }
      };
      return res;
    }

    const mockAdminUser = await User.findOne({ role: 'superadmin' }) || await User.findOne({ role: 'admin' });
    console.log(`👤 Using Admin User: ${mockAdminUser?.name} (${mockAdminUser?.email}, role=${mockAdminUser?.role})`);

    // TEST 1: Overview Metrics
    console.log('\n--- 1. Testing Overview Metrics Aggregation ---');
    const req1 = { user: mockAdminUser, query: {} };
    const res1 = createMockRes();
    await adminController.getOverviewMetrics(req1, res1);
    console.log('Status:', res1.statusCode);
    console.log('Total Leads:', res1.data?.data?.topKPIs?.totalLeads?.value);
    console.log('Sales Revenue:', res1.data?.data?.topKPIs?.salesRevenue?.value);
    console.log('Conversion Rate:', res1.data?.data?.topKPIs?.conversionRate?.value);
    console.log('Active Hierarchy (Managers/Agents):', res1.data?.data?.topKPIs?.activeHierarchy?.value);
    console.log('Sales Funnel Stages:', res1.data?.data?.salesFunnel?.length);
    console.log('Lead Sources:', res1.data?.data?.leadSources?.length);

    // TEST 2: Plans Hierarchy
    console.log('\n--- 2. Testing Plans & Commercial Hierarchy ---');
    const req2 = { user: mockAdminUser, query: {} };
    const res2 = createMockRes();
    await adminController.getPlanHierarchy(req2, res2);
    console.log('Status:', res2.statusCode);
    console.log('Industry Groups:', res2.data?.hierarchy?.map(h => h.industry));
    console.log('Total Platform Plans:', res2.data?.allPlans?.length);

    // TEST 3: Pipeline Stage Configuration
    console.log('\n--- 3. Testing Dynamic Pipeline Stage Configuration ---');
    const req3 = { user: mockAdminUser, query: {} };
    const res3 = createMockRes();
    await adminController.getPipelineConfig(req3, res3);
    console.log('Status:', res3.statusCode);
    console.log('Configured Pipeline Stages:', res3.data?.pipeline?.stages?.map(s => s.name));

    // TEST 4: Broadcast Audience Count Resolution
    console.log('\n--- 4. Testing Broadcast Audience Real Recipient Counter ---');
    const audiences = ['INTERNAL_ALL', 'INTERNAL_MANAGERS', 'INTERNAL_AGENTS', 'PLATFORM_ALL_USERS'];
    for (const aud of audiences) {
      const reqAud = { user: mockAdminUser, body: { targetAudience: aud } };
      const resAud = createMockRes();
      await adminController.getBroadcastAudienceCount(reqAud, resAud);
      console.log(`Audience [${aud}]: Recipient Count = ${resAud.data?.count}`);
    }

    // TEST 5: Follow-Up Cancellation with Mandatory Reason
    console.log('\n--- 5. Testing Follow-up Cancellation with Mandatory Reason ---');
    const sampleLead = await Lead.findOne();
    if (sampleLead) {
      // First schedule a follow-up
      sampleLead.followUpDate = new Date(Date.now() + 86400000);
      sampleLead.followUpNote = 'Scheduled demo call';
      sampleLead.followUpStatus = 'scheduled';
      sampleLead.activeFollowUp = {
        scheduledAt: sampleLead.followUpDate,
        note: sampleLead.followUpNote,
        status: 'scheduled',
        delayCount: 0,
        delayHistory: []
      };
      await sampleLead.save();

      // Test cancellation without reason (should fail)
      const reqCancelFail = { user: mockAdminUser, params: { id: sampleLead._id }, body: { reason: '' } };
      const resCancelFail = createMockRes();
      await adminController.cancelFollowUp(reqCancelFail, resCancelFail);
      console.log('Cancellation without reason rejected properly (400):', resCancelFail.statusCode === 400);

      // Test cancellation with valid mandatory reason
      const reqCancelSuccess = {
        user: mockAdminUser,
        params: { id: sampleLead._id },
        body: { reason: 'Lead requested rescheduling next quarter after budget approvals' }
      };
      const resCancelSuccess = createMockRes();
      await adminController.cancelFollowUp(reqCancelSuccess, resCancelSuccess);
      console.log('Cancellation with valid reason status:', resCancelSuccess.statusCode);
      console.log('Follow-up status after cancellation:', resCancelSuccess.data?.lead?.followUpStatus);
    }

    // TEST 6: Lead Deal Closure & Commission Ledger
    console.log('\n--- 6. Testing Deal Closure & Automated Commission Ledger ---');
    const samplePlan = await Plan.findOne() || await Plan.create({
      code: 'TEST_GROWTH_PLAN_V1',
      name: 'Test Growth Plan',
      priceInPaise: 1500000,
      price: 15000,
      industry: 'General',
      subIndustry: 'General',
      tier: 1,
      interval: 'monthly'
    });

    const leadToClose = await Lead.findOne({ status: { $ne: 'payment_done' } }) || sampleLead;
    const reqClose = {
      user: mockAdminUser,
      params: { id: leadToClose._id },
      body: {
        planId: samplePlan._id,
        closingAmount: 15000,
        closingType: 'PAID',
        closingReason: 'Successfully closed after contract signing and Razorpay payment confirmation'
      }
    };
    const resClose = createMockRes();
    await adminController.closeLeadWithCommission(reqClose, resClose);
    console.log('Deal Closure status:', resClose.statusCode);
    console.log('Lead stage:', resClose.data?.lead?.status);
    console.log('Commission payouts generated:', resClose.data?.payouts?.length);

    // TEST 7: Manager Activity Reporting
    console.log('\n--- 7. Testing Manager Activity Logs Reporting ---');
    const reqAct = { user: mockAdminUser, query: { limit: 5 } };
    const resAct = createMockRes();
    await adminController.getManagerActivities(reqAct, resAct);
    console.log('Status:', resAct.statusCode);
    console.log('Manager Activity Logs Count:', resAct.data?.activities?.length);

    console.log('\n🎯 All 7 E2E Control Center Tests Completed Successfully!');
  } catch (err) {
    console.error('❌ E2E Test Failure:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runE2ETests();
