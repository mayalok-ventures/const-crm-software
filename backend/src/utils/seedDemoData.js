const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const { seedPlans } = require('./seedPlans');

/**
 * Demo Data Seeder for Local Development & SuperAdmin Observability
 * Creates realistic multi-tenant Admission Consultants organisations,
 * commercial subscriptions, student admission candidate leads, and transaction ledger records.
 */
async function seedDemoData() {
  try {
    // 1. Ensure Plans are seeded first
    await seedPlans();

    // Check if demo tenants already exist
    const existingOrg = await User.findOne({ email: 'owner@apexadmissions.com' });
    if (existingOrg) {
      console.log('[Demo Seeder] Admission Consultants demo data already populated. Skipping.');
      return;
    }

    console.log('[Demo Seeder] Seeding Admission Consultants demonstration data for SuperAdmin...');

    const proMonthlyPlan = await Plan.findOne({ code: 'ORG_GROWTH_MONTHLY_V1' }) || await Plan.findOne({ tier: 2 });
    const entYearlyPlan = await Plan.findOne({ code: 'ORG_SCALE_YEARLY_V1' }) || await Plan.findOne({ tier: 3 });
    const starterPlan = await Plan.findOne({ code: 'IND_STARTER_MONTHLY_V1' }) || await Plan.findOne({ tier: 1 });

    // 2. Create Multi-Tenant Admission Consulting Organisations
    const orgApex = await User.create({
      name: 'Vikram Malhotra',
      email: 'owner@apexadmissions.com',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543210',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      usercode: 'CMP-APEX-001',
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
      lifecycleStatus: 'ACTIVE',
      plan: 'enterprise',
      companyInfo: {
        companyName: 'Apex Admission Consultants & Career Guidance',
        companyEmail: 'info@apexadmissions.com',
        companyPhone: '9876543210',
        companyAddress: 'Suite 402, Nariman Point, Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
    });

    const orgEduGuide = await User.create({
      name: 'Priya Sharma',
      email: 'owner@eduguide.in',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543211',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      usercode: 'CMP-EDUG-002',
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
      lifecycleStatus: 'ACTIVE',
      plan: 'pro',
      companyInfo: {
        companyName: 'EduGuide Higher Education Advisors',
        companyEmail: 'admissions@eduguide.in',
        companyPhone: '9876543211',
        companyAddress: 'Koramangala 5th Block, Bengaluru',
        city: 'Bengaluru',
        state: 'Karnataka',
      },
    });

    const orgPathfinder = await User.create({
      name: 'Rohan Gupta',
      email: 'owner@pathfinderadmissions.com',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543212',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      usercode: 'CMP-PATH-003',
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
      lifecycleStatus: 'TRIAL',
      plan: 'free',
      companyInfo: {
        companyName: 'Pathfinder Domestic & Overseas Admissions',
        companyEmail: 'hello@pathfinderadmissions.com',
        companyPhone: '9876543212',
        companyAddress: 'Sector 62, Noida, Delhi NCR',
        city: 'Delhi NCR',
        state: 'Delhi',
      },
    });

    // 3. Create Senior Counsellors (Agents) for Organisations
    const counsellor1 = await User.create({
      name: 'Amit Verma',
      email: 'amit@apexadmissions.com',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543213',
      role: 'agent',
      companyRole: 'agent',
      workStatus: 'independent_agent',
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
      companyId: orgApex._id,
      usercode: 'CNS-APEX-001',
    });

    const counsellor2 = await User.create({
      name: 'Neha Kapoor',
      email: 'neha@eduguide.in',
      password: '$2a$10$YourHashedPasswordOrMockPassword123',
      phone: '9876543214',
      role: 'agent',
      companyRole: 'agent',
      workStatus: 'independent_agent',
      industryType: 'Education',
      educationSubProfile: 'admission_consultants',
      companyId: orgEduGuide._id,
      usercode: 'CNS-EDUG-001',
    });

    // 4. Create Active Subscriptions with Recurring MRR
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await Subscription.create([
      {
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
      },
      {
        userId: orgEduGuide._id,
        companyId: orgEduGuide._id,
        accountType: 'ORGANIZATION',
        planId: proMonthlyPlan?._id || new mongoose.Types.ObjectId(),
        razorpaySubscriptionId: 'sub_eduguide_live_4999',
        status: 'ACTIVE',
        amount: 4999,
        amountInPaise: 499900,
        billingCycle: 'monthly',
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        lastPaymentStatus: 'captured',
        lastPaymentDate: now,
        reconciliationStatus: 'MATCHED',
      }
    ]);

    // 5. Create Transactions Ledger
    await Transaction.create([
      {
        userId: orgApex._id,
        companyId: orgApex._id,
        amount: 4999,
        amountInPaise: 499900,
        netAmountInPaise: 499900,
        currency: 'INR',
        razorpay_order_id: 'order_apex_edu_001',
        razorpay_payment_id: 'pay_apex_edu_rec_001',
        planName: 'Admission Agency Enterprise Growth (Monthly)',
        status: 'captured',
        paymentMethod: 'emandate',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: orgEduGuide._id,
        companyId: orgEduGuide._id,
        amount: 4999,
        amountInPaise: 499900,
        netAmountInPaise: 499900,
        currency: 'INR',
        razorpay_order_id: 'order_edug_002',
        razorpay_payment_id: 'pay_edug_rec_002',
        planName: 'Admission Agency Growth (Monthly)',
        status: 'captured',
        paymentMethod: 'card',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ]);

    // 6. Create Realistic Admission Consultant Student Candidate Leads
    await Lead.create([
      {
        userId: orgApex._id,
        companyId: orgApex._id,
        assignedTo: counsellor1._id,
        assignedToName: counsellor1.name,
        name: 'Aarav Sharma',
        phone: '9811122233',
        email: 'aarav.sharma2026@gmail.com',
        targetStream: 'Engineering & Technology',
        targetCourse: 'B.Tech Computer Science & AI',
        targetState: 'Karnataka',
        targetCity: 'Bengaluru',
        academicScore10th: 92,
        academicScore12th: 88,
        entranceExam: 'JEE Main',
        entranceRank: 'AIR 42,500',
        quotaPreference: 'Management Quota',
        budget: '₹14 Lakh - ₹18 Lakh',
        budgetMin: 1400000,
        budgetMax: 1800000,
        status: 'College Options Shortlisted',
        pipelineStage: 'College Options Shortlisted',
        temperature: 'HOT',
        score: 85,
        shortlistedColleges: [
          { collegeName: 'RV College of Engineering', courseName: 'B.Tech CSE', feeQuote: 1600000, quota: 'Management' },
          { collegeName: 'BMS College of Engineering', courseName: 'B.Tech AI & ML', feeQuote: 1400000, quota: 'Management' },
        ],
      },
      {
        userId: orgEduGuide._id,
        companyId: orgEduGuide._id,
        assignedTo: counsellor2._id,
        assignedToName: counsellor2.name,
        name: 'Ananya Iyer',
        phone: '9822233344',
        email: 'ananya.iyer@yahoo.com',
        targetStream: 'Medical & Dental Sciences',
        targetCourse: 'MBBS',
        targetState: 'Maharashtra',
        targetCity: 'Pune',
        academicScore10th: 95,
        academicScore12th: 91,
        entranceExam: 'NEET UG',
        entranceRank: 'NEET Score: 520',
        quotaPreference: 'Management Quota',
        budget: '₹60 Lakh - ₹75 Lakh',
        budgetMin: 6000000,
        budgetMax: 7500000,
        status: 'Seat Block / Token Advance',
        pipelineStage: 'Seat Block / Token Advance',
        tokenAdvancePaid: 200000,
        temperature: 'HOT',
        score: 95,
      },
      {
        userId: orgApex._id,
        companyId: orgApex._id,
        assignedTo: counsellor1._id,
        assignedToName: counsellor1.name,
        name: 'Rohan Verma',
        phone: '9833344455',
        email: 'rohan.v@outlook.com',
        targetStream: 'Management & Business',
        targetCourse: 'MBA Global Finance & Marketing',
        targetState: 'Delhi NCR',
        targetCity: 'Gurugram',
        academicScore10th: 85,
        academicScore12th: 82,
        academicScoreGrad: 78,
        entranceExam: 'CAT / CMAT',
        entranceRank: 'Percentile: 84%',
        quotaPreference: 'Merit Quota',
        budget: '₹12 Lakh - ₹15 Lakh',
        budgetMin: 1200000,
        budgetMax: 1500000,
        status: 'Admission Finalized & Invoiced',
        pipelineStage: 'Admission Finalized & Invoiced',
        admissionFinalFee: 1350000,
        tokenAdvancePaid: 100000,
        temperature: 'WARM',
        score: 100,
      },
      {
        userId: orgPathfinder._id,
        companyId: orgPathfinder._id,
        name: 'Kavita Nair',
        phone: '9844455566',
        email: 'kavita.nair@gmail.com',
        targetStream: 'Pharmacy & Biotechnology',
        targetCourse: 'B.Pharm',
        targetState: 'Tamil Nadu',
        targetCity: 'Chennai',
        academicScore10th: 89,
        academicScore12th: 84,
        quotaPreference: 'Merit Quota',
        budget: '₹6 Lakh - ₹8 Lakh',
        budgetMin: 600000,
        budgetMax: 800000,
        status: 'Tele-Counselling / Discovery',
        pipelineStage: 'Tele-Counselling / Discovery',
        temperature: 'WARM',
        score: 60,
      },
    ]);

    console.log('[Demo Seeder] Successfully seeded Admission Consultants organisations, subscriptions, transactions, and student leads. ✅');
  } catch (err) {
    console.error('[Demo Seeder] Error seeding demo data:', err.message);
  }
}

module.exports = { seedDemoData };
