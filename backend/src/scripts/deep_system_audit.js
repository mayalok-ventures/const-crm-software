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
const FollowUp = require('../models/FollowUp');
const Coupon = require('../models/Coupon');
const Payment = require('../models/Payment');
const LeadDistributionRule = require('../models/LeadDistributionRule');

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 CORESETU OS DEEP DATABASE & ARCHITECTURE REALITY AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB URI:', process.env.MONGODB_URI?.split('@')[1] || 'Connected');

    // 1. COLLECTION COUNTS REALITY
    console.log('\n--- 1. DATABASE RECORD TOTALS ---');
    const [
      totalLeads,
      totalUsers,
      totalManagers,
      totalAgents,
      totalSoloUsers,
      totalOrgOwners,
      totalPlans,
      totalPayments,
      totalRules,
      totalPayouts,
      totalCoupons,
      totalPipelines,
      totalFollowUps,
      totalActivityLogs,
      totalDistRules,
    ] = await Promise.all([
      Lead.countDocuments({}),
      User.countDocuments({}),
      User.countDocuments({ role: 'manager' }),
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ workStatus: 'independent_agent' }),
      User.countDocuments({ workStatus: 'company_owner' }),
      Plan.countDocuments({}),
      Payment.countDocuments({}),
      CommissionRule.countDocuments({}),
      CommissionPayout.countDocuments({}),
      Coupon.countDocuments({}),
      Pipeline.countDocuments({}),
      FollowUp.countDocuments({}),
      ActivityLog.countDocuments({}),
      LeadDistributionRule.countDocuments({}),
    ]);

    console.log({
      totalLeads,
      totalUsers,
      totalManagers,
      totalAgents,
      totalSoloUsers,
      totalOrgOwners,
      totalPlans,
      totalPayments,
      totalRules,
      totalPayouts,
      totalCoupons,
      totalPipelines,
      totalFollowUps,
      totalActivityLogs,
      totalDistRules,
    });

    // 2. LEAD STATUSES & PRIMARY SOURCES REALITY
    console.log('\n--- 2. REAL LEAD STATUSES IN DATABASE ---');
    const leadStatuses = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Actual Lead Statuses:', leadStatuses);

    const leadSources = await Lead.aggregate([
      { $group: { _id: { primarySource: '$primarySource', source: '$source' }, count: { $sum: 1 } } }
    ]);
    console.log('Actual Lead Sources:', leadSources);

    // 3. SAMPLE LEADS INSPECTION
    console.log('\n--- 3. SAMPLE LEADS INSPECTION ---');
    const sampleSoloLead = await Lead.findOne({ company: { $in: [null, ''] } }).lean();
    const sampleOrgLead = await Lead.findOne({ company: { $nin: [null, ''] } }).lean();
    console.log('Sample Solo Lead Keys & Values:', {
      _id: sampleSoloLead?._id,
      name: sampleSoloLead?.name,
      phone: sampleSoloLead?.phone,
      company: sampleSoloLead?.company,
      status: sampleSoloLead?.status,
      primarySource: sampleSoloLead?.primarySource,
      source: sampleSoloLead?.source,
      assignedTo: sampleSoloLead?.assignedTo,
      assignedManager: sampleSoloLead?.assignedManager,
      service_required: sampleSoloLead?.service_required,
      selected_plan_id: sampleSoloLead?.selected_plan_id,
      payable_amount: sampleSoloLead?.payable_amount,
      paid_amount: sampleSoloLead?.paid_amount,
      followUpDate: sampleSoloLead?.followUpDate,
      followUpStatus: sampleSoloLead?.followUpStatus,
      activeFollowUp: sampleSoloLead?.activeFollowUp,
    });

    console.log('Sample Org Lead Keys & Values:', {
      _id: sampleOrgLead?._id,
      name: sampleOrgLead?.name,
      phone: sampleOrgLead?.phone,
      company: sampleOrgLead?.company,
      companyId: sampleOrgLead?.companyId,
      status: sampleOrgLead?.status,
      primarySource: sampleOrgLead?.primarySource,
      source: sampleOrgLead?.source,
      assignedTo: sampleOrgLead?.assignedTo,
      assignedManager: sampleOrgLead?.assignedManager,
      service_required: sampleOrgLead?.service_required,
      selected_plan_id: sampleOrgLead?.selected_plan_id,
    });

    // 4. PIPELINE DOCUMENTS INSPECTION
    console.log('\n--- 4. PIPELINE CONFIGURATION IN DATABASE ---');
    const pipelines = await Pipeline.find({}).lean();
    console.log('Pipelines found in DB:', pipelines.length);
    pipelines.forEach(p => {
      console.log(`Pipeline "${p.name}" (isDefault=${p.isDefault}):`, p.stages?.map(s => ({ name: s.name, order: s.order, probability: s.probability, slaHours: s.slaHours })));
    });

    // 5. PLANS & COMMERCIALS INSPECTION
    console.log('\n--- 5. PLANS IN DATABASE ---');
    const plans = await Plan.find({}).lean();
    console.log('Plans found:', plans.map(p => ({
      code: p.code,
      name: p.name,
      priceInPaise: p.priceInPaise,
      price: p.price,
      industry: p.industry,
      subIndustry: p.subIndustry,
      accountType: p.accountType,
      tier: p.tier
    })));

    // 6. COMMISSION RULES IN DATABASE
    console.log('\n--- 6. COMMISSION RULES IN DATABASE ---');
    const rules = await CommissionRule.find({}).lean();
    console.log('Commission Rules found:', rules.map(r => ({
      ruleName: r.ruleName,
      targetRole: r.targetRole,
      commissionType: r.commissionType,
      value: r.value,
      isActive: r.isActive,
      stageThreshold: r.stageThreshold
    })));

    // 7. USER ROLES BREAKDOWN
    console.log('\n--- 7. USER ROLES & PERMISSIONS BREAKDOWN ---');
    const userRoles = await User.aggregate([
      { $group: { _id: { role: '$role', workStatus: '$workStatus', companyRole: '$companyRole', isAdmin: '$isAdmin' }, count: { $sum: 1 } } }
    ]);
    console.log('User Roles Distribution:', userRoles);

  } catch (err) {
    console.error('❌ Audit Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runAudit();
