const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Lead = require('../models/Lead');
const Plan = require('../models/Plan');
const User = require('../models/User');
const Broadcast = require('../models/Broadcast');
const Notification = require('../models/Notification');
const adminController = require('../controllers/adminController');

async function runTests() {
  console.log('--- STARTING ADMIN LEAD LIFECYCLE & MULTI-SCOPE BROADCAST TEST ---');
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    // 1. Test Lead Schema validation with custom plan codes and activities
    console.log('\n1. Testing Lead Schema flexible service_required and expanded activity enum...');
    const adminUser = (await User.findOne({ role: { $in: ['admin', 'superadmin'] } })) || (await User.findOne());
    
    const testLead = new Lead({
      userId: adminUser._id,
      name: 'Test Enterprise Lead',
      phone: '+919876543210',
      email: 'enterprise@test.com',
      service_required: 'ind_starter_monthly_v1',
      source: 'ads',
      leadActivities: [
        {
          action: 'deal_closed',
          details: 'Deal closed with ind_starter_monthly_v1',
          timestamp: new Date(),
        },
        {
          action: 'plan_assigned',
          details: 'Plan assigned',
          timestamp: new Date(),
        },
        {
          action: 'free_plan_assigned',
          details: 'Complimentary access granted',
          timestamp: new Date(),
        },
        {
          action: 'followup_cancelled',
          details: 'Follow-up cancelled with mandatory note',
          timestamp: new Date(),
        }
      ]
    });

    await testLead.validate();
    console.log('✅ Lead validation PASSED with 0 schema errors!');

    // 2. Test Broadcast Multi-Scope Targets
    console.log('\n2. Testing Multi-Scope Broadcast Dispatcher...');
    const targetsToTest = ['ALL_USERS', 'PLATFORM_MANAGERS_AGENTS', 'PLATFORM_MANAGERS_ONLY', 'PLATFORM_AGENTS_ONLY', 'SOLO_USERS_ONLY', 'ORGANISATIONS_ONLY', 'MY_TEAM_ONLY'];
    for (const target of targetsToTest) {
      const mockReq = {
        user: adminUser,
        body: {
          title: `Test ${target} Announcement`,
          message: `This is a targeted broadcast test for ${target}`,
          priority: 'HIGH',
          targetAudience: target,
          deliveryChannels: ['IN_APP'],
        },
        ip: '127.0.0.1',
      };
      const mockRes = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) {
          if (!data.success) throw new Error(data.message);
          console.log(`  ✅ Scope [${target}] delivered to ${data.recipientCount} recipient(s)`);
        }
      };
      await adminController.sendBroadcast(mockReq, mockRes);
    }

    // 3. Test Deal Closure and Commission Calculation
    console.log('\n3. Testing Deal Closure with Commission...');
    await testLead.save();
    const mockPlan = await Plan.findOne({ isActive: true });
    
    const closeReq = {
      user: adminUser,
      params: { id: testLead._id },
      body: {
        planId: mockPlan ? mockPlan._id : 'custom_enterprise',
        closingAmount: 15000,
        closingReason: 'Signed annual SaaS contract with priority onboarding',
      }
    };
    const closeRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(data) {
        if (!data.success) throw new Error(data.message);
        console.log(`  ✅ Deal closed at ₹${data.lead.closedDealAmount}. Status: ${data.lead.status}`);
      }
    };
    await adminController.closeLeadWithCommission(closeReq, closeRes);

    // 4. Clean up test lead
    await Lead.findByIdAndDelete(testLead._id);
    console.log('✅ Test lead cleaned up successfully.');

    console.log('\n🎉 ALL ADMIN CONTROLLER & SCHEMA TESTS PASSED WITH ZERO ERRORS!\n');
  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
