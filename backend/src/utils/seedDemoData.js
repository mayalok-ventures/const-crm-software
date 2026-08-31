const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const PaymentAttempt = require('../models/PaymentAttempt');
const { seedPlans } = require('./seedPlans');

/**
 * Demo Data Seeder for Local Development & SuperAdmin Observability
 * Creates realistic multi-tenant organisations, commercial subscriptions,
 * leads, and transaction ledger records.
 */
async function seedDemoData() {
  try {
    // 1. Ensure Plans are seeded first
    await seedPlans();

    // Check if demo tenants already exist
    const existingOrg = await User.findOne({ email: 'owner@apexrealty.com' });
    if (existingOrg) {
      console.log('[Demo Seeder] Demo data already populated. Skipping.');
      return;
    }

    console.log('[Demo Seeder] Seeding rich demonstration data for SuperAdmin...');

    const proMonthlyPlan = await Plan.findOne({ code: 'ORG_GROWTH_MONTHLY_V1' }) || await Plan.findOne({ tier: 2 });
    const entYearlyPlan = await Plan.findOne({ code: 'ORG_SCALE_YEARLY_V1' }) || await Plan.findOne({ tier: 3 });
    const starterPlan = await Plan.findOne({ code: 'IND_STARTER_MONTHLY_V1' }) || await Plan.findOne({ tier: 1 });

    // 2. Create Multi-Tenant Organisations
    const orgApex = await User.create({
      name: 'Vikram Malhotra',
      email: 'owner@apexrealty.com',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543210',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      usercode: 'ORG-APEX-001',
      lifecycleStatus: 'ACTIVE',
      plan: 'enterprise',
      companyInfo: {
        companyName: 'Apex Realty Group',
        industry: 'Real Estate',
        companySize: '25-50',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
    });

    const orgPrime = await User.create({
      name: 'Priya Sharma',
      email: 'owner@primehousing.in',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543211',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      usercode: 'ORG-PRIME-002',
      lifecycleStatus: 'ACTIVE',
      plan: 'pro',
      companyInfo: {
        companyName: 'Prime Housing Solutions',
        industry: 'Real Estate',
        companySize: '10-25',
        city: 'Bengaluru',
        state: 'Karnataka',
      },
    });

    const orgSkylight = await User.create({
      name: 'Rohan Gupta',
      email: 'rohan@skylightinfra.com',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543212',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      usercode: 'ORG-SKY-003',
      lifecycleStatus: 'TRIAL',
      plan: 'free',
      companyInfo: {
        companyName: 'Skylight Properties',
        industry: 'Real Estate',
        companySize: '1-10',
        city: 'Delhi NCR',
        state: 'Delhi',
      },
    });

    // 3. Create Agents for Organisations
    const agent1 = await User.create({
      name: 'Amit Verma',
      email: 'amit@apexrealty.com',
      phone: '9876543213',
      role: 'agent',
      companyId: orgApex._id,
      usercode: 'AGT-APEX-001',
    });

    const agent2 = await User.create({
      name: 'Neha Kapoor',
      email: 'neha@primehousing.in',
      phone: '9876543214',
      role: 'agent',
      companyId: orgPrime._id,
      usercode: 'AGT-PRIME-001',
    });

    // 4. Create Active Subscriptions with Recurring MRR
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subApex = await Subscription.create({
      userId: orgApex._id,
      companyId: orgApex._id,
      accountType: 'ORGANIZATION',
      planId: proMonthlyPlan?._id || new mongoose.Types.ObjectId(),
      razorpaySubscriptionId: 'sub_apex_live_4999',
      status: 'ACTIVE',
      amount: 4999,
      amountInPaise: 499900,
      billingCycle: 'monthly',
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      lastPaymentStatus: 'captured',
      lastPaymentDate: now,
      reconciliationStatus: 'MATCHED',
    });

    const subPrime = await Subscription.create({
      userId: orgPrime._id,
      companyId: orgPrime._id,
      accountType: 'ORGANIZATION',
      planId: proMonthlyPlan?._id || new mongoose.Types.ObjectId(),
      razorpaySubscriptionId: 'sub_prime_live_4999',
      status: 'ACTIVE',
      amount: 4999,
      amountInPaise: 499900,
      billingCycle: 'monthly',
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      lastPaymentStatus: 'captured',
      lastPaymentDate: now,
      reconciliationStatus: 'MATCHED',
    });

    // 5. Create Transactions Ledger
    await Transaction.create([
      {
        userId: orgApex._id,
        companyId: orgApex._id,
        amount: 4999,
        amountInPaise: 499900,
        netAmountInPaise: 499900,
        currency: 'INR',
        razorpay_order_id: 'order_apex_001',
        razorpay_payment_id: 'pay_apex_rec_001',
        planName: 'Organization Agency Growth (Monthly)',
        status: 'captured',
        paymentMethod: 'emandate',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: orgPrime._id,
        companyId: orgPrime._id,
        amount: 4999,
        amountInPaise: 499900,
        netAmountInPaise: 499900,
        currency: 'INR',
        razorpay_order_id: 'order_prime_002',
        razorpay_payment_id: 'pay_prime_rec_002',
        planName: 'Organization Agency Growth (Monthly)',
        status: 'captured',
        paymentMethod: 'card',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId: orgApex._id,
        companyId: orgApex._id,
        amount: 4999,
        amountInPaise: 499900,
        netAmountInPaise: 499900,
        currency: 'INR',
        razorpay_order_id: 'order_apex_prev',
        razorpay_payment_id: 'pay_apex_rec_prev',
        planName: 'Organization Agency Growth (Monthly)',
        status: 'captured',
        paymentMethod: 'upi',
        createdAt: new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000),
      },
    ]);

    // 6. Create Realistic CRM Leads
    await Lead.create([
      {
        name: 'Rahul Oberoi',
        phone: '9811122233',
        email: 'rahul.oberoi@gmail.com',
        city: 'Mumbai',
        propertyType: '3 BHK Luxury Apartment',
        budget: '₹2.5 Cr - ₹3 Cr',
        status: 'converted',
        stage: 'Deal Closed',
        dealValue: 27500000,
        companyId: orgApex._id,
        assignedTo: agent1._id,
      },
      {
        name: 'Sunita Menon',
        phone: '9822233344',
        email: 'sunita.menon@yahoo.com',
        city: 'Bengaluru',
        propertyType: 'Villa in Whitefield',
        budget: '₹4 Cr - ₹5 Cr',
        status: 'converted',
        stage: 'Deal Closed',
        dealValue: 45000000,
        companyId: orgPrime._id,
        assignedTo: agent2._id,
      },
      {
        name: 'Karan Mehra',
        phone: '9833344455',
        email: 'karan.m@outlook.com',
        city: 'Gurugram',
        propertyType: 'Commercial Office Space',
        budget: '₹1.8 Cr',
        status: 'in_progress',
        stage: 'Site Visit Completed',
        companyId: orgSkylight._id,
      },
      {
        name: 'Deepika Joshi',
        phone: '9844455566',
        email: 'deepika.j@gmail.com',
        city: 'Mumbai',
        propertyType: '2 BHK Sea View',
        budget: '₹1.75 Cr',
        status: 'new',
        stage: 'Discovery Call',
        companyId: orgApex._id,
        assignedTo: agent1._id,
      },
    ]);

    console.log('[Demo Seeder] Successfully seeded organisations, subscriptions, transactions, and CRM leads. ✅');
  } catch (err) {
    console.error('[Demo Seeder] Error seeding demo data:', err.message);
  }
}

module.exports = { seedDemoData };
