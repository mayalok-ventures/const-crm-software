const mongoose = require('mongoose');
const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Pipeline = require('../../models/Pipeline');
const FormSchema = require('../../models/FormSchema');
const Campaign = require('../../models/Campaign');
const Subscription = require('../../models/Subscription');
const Integration = require('../../models/Integration');
const AuditLog = require('../../models/AuditLog');
const { getOrganisationsAggregation } = require('../queries/tenantQueries');

const {
  TENANT_LIFECYCLE_STATES,
  ALLOWED_TRANSITIONS,
  resolveCurrentLifecycleState,
  transitionTenantState,
  getTenantLifecycleDetails,
} = require('./tenantLifecycleService');

/**
 * List all organisations with pagination and search
 */
async function listOrganisations(params) {
  return await getOrganisationsAggregation(params);
}

/**
 * Deep inspection of a single tenant
 */
async function getTenantDetails(tenantId) {
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new Error('Invalid Organisation ID');
  }

  const orgId = new mongoose.Types.ObjectId(tenantId);

  const orgOwner = await User.findById(orgId)
    .select('-password')
    .lean();

  if (!orgOwner) {
    throw new Error('Organisation not found');
  }

  // Fetch all related entities in parallel
  const [
    users,
    leads,
    pipelines,
    forms,
    campaigns,
    subscription,
    integrations,
    auditTrail,
  ] = await Promise.all([
    User.find({ companyId: orgId }).select('-password').sort({ createdAt: -1 }).lean(),
    Lead.find({ companyId: orgId }).sort({ createdAt: -1 }).limit(50).lean(),
    Pipeline.find({ companyId: orgId }).lean(),
    FormSchema.find({ companyId: orgId }).lean(),
    Campaign.find({ companyId: orgId }).lean(),
    Subscription.findOne({ companyId: orgId }).populate('planId').lean(),
    Integration.find({ companyId: orgId }).select('-accessToken -appSecret').lean(),
    AuditLog.find({ organizationId: orgId }).sort({ timestamp: -1 }).limit(50).lean(),
  ]);

  const agents = users.filter((u) => u.role === 'agent');
  const managers = users.filter((u) => u.role === 'manager');

  // Group leads by canonical stages
  const stageCounts = {
    new_lead: 0,
    contacted: 0,
    not_interested: 0,
    converted: 0,
    payment_done: 0,
  };

  leads.forEach((l) => {
    const s = String(l.status || '').toLowerCase();
    if (['payment_done', 'won', 'advance paid', 'closed won', 'closed / won', 'closed'].includes(s)) stageCounts.payment_done++;
    else if (['converted', 'qualified', 'documents uploaded'].includes(s)) stageCounts.converted++;
    else if (['not_interested', 'not interested', 'lost', 'rejected', 'dropped'].includes(s)) stageCounts.not_interested++;
    else if (['contacted', 'inquiry', 'demo class', 'floor plan shared'].includes(s)) stageCounts.contacted++;
    else stageCounts.new_lead++;
  });

  const effectiveLifecycleStatus = resolveCurrentLifecycleState(orgOwner, subscription);

  return {
    organisation: {
      _id: orgOwner._id,
      name: orgOwner.companyInfo?.companyName || orgOwner.name,
      owner: orgOwner,
      companyInfo: orgOwner.companyInfo,
      status: orgOwner.isActive ? (orgOwner.userStatus === 'active' ? 'ACTIVE' : 'SUSPENDED') : 'BLOCKED',
      lifecycleStatus: effectiveLifecycleStatus,
      lifecycleTimestamps: orgOwner.lifecycleTimestamps || {},
      allowedTransitions: ALLOWED_TRANSITIONS[effectiveLifecycleStatus] || [],
      cancellationReason: orgOwner.cancellationReason || null,
      suspensionReason: orgOwner.suspensionReason || null,
      archivedReason: orgOwner.archivedReason || null,
      lifecycleVersion: orgOwner.lifecycleVersion || 1,
      createdAt: orgOwner.createdAt,
    },
    users: {
      total: users.length + 1,
      agents,
      managers,
      all: [orgOwner, ...users],
    },
    leads: {
      total: leads.length,
      stageCounts,
      recent: leads,
    },
    pipelines,
    forms,
    campaigns,
    subscription,
    integrations,
    auditTrail,
  };
}

/**
 * Update tenant account status (BLOCK, UNBLOCK, SUSPEND, ACTIVATE, CANCEL, ARCHIVE)
 * Seamlessly mapped through centralized tenantLifecycleService
 */
async function updateTenantStatus(tenantId, { status, reason = '' }, adminUser) {
  const normalized = String(status || '').toUpperCase().trim();
  let targetState = TENANT_LIFECYCLE_STATES.ACTIVE;

  if (normalized === 'BLOCKED' || normalized === 'SUSPENDED') {
    targetState = TENANT_LIFECYCLE_STATES.SUSPENDED;
  } else if (normalized === 'CANCELLED') {
    targetState = TENANT_LIFECYCLE_STATES.CANCELLED;
  } else if (normalized === 'ARCHIVED') {
    targetState = TENANT_LIFECYCLE_STATES.ARCHIVED;
  } else if (normalized === 'ACTIVE' || normalized === 'UNBLOCKED') {
    targetState = TENANT_LIFECYCLE_STATES.ACTIVE;
  } else if (Object.values(TENANT_LIFECYCLE_STATES).includes(normalized)) {
    targetState = normalized;
  }

  const result = await transitionTenantState(tenantId, targetState, adminUser, { reason });
  return result.tenant;
}

/**
 * Update tenant subscription plan
 */
async function updateTenantPlan(tenantId, { planCode, billingCycle, durationDays, planEndDate, isCustomPlan, reason = '' }, adminUser) {
  const user = await User.findById(tenantId);
  if (!user) throw new Error('Tenant not found');

  const prevPlan = user.plan;
  const prevBillingCycle = user.billingCycle;
  const prevEndDate = user.planEndDate;

  user.plan = planCode;
  if (billingCycle) {
    user.billingCycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  }
  user.planStartDate = new Date();

  if (planEndDate) {
    user.planEndDate = new Date(planEndDate);
  } else if (durationDays) {
    const d = new Date();
    d.setDate(d.getDate() + Number(durationDays));
    user.planEndDate = d;
  } else if (billingCycle === 'yearly') {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    user.planEndDate = d;
  } else if (billingCycle === 'monthly') {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    user.planEndDate = d;
  } else if (planCode === 'free') {
    user.planEndDate = null;
  }

  if (typeof isCustomPlan === 'boolean') {
    user.isCustomPlan = isCustomPlan;
  }

  user.isActive = true;
  user.userStatus = 'active';

  await user.save();

  // Also update or sync Subscription record if present or create one
  try {
    const PlanModel = mongoose.models.Plan || require('../../models/Plan');
    const dbPlan = await PlanModel.findOne({ code: planCode });
    if (dbPlan) {
      await Subscription.findOneAndUpdate(
        { companyId: user._id },
        {
          userId: user._id,
          companyId: user._id,
          accountType: user.workStatus === 'company_owner' ? 'ORGANIZATION' : 'INDIVIDUAL',
          planId: dbPlan._id,
          status: 'ACTIVE',
          currentPeriodStart: user.planStartDate,
          currentPeriodEnd: user.planEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        { upsert: true, new: true }
      );
    }
  } catch (subErr) {
    console.warn('[updateTenantPlan] Subscription sync warning:', subErr.message);
  }

  await AuditLog.create({
    actorId: adminUser._id,
    actorName: adminUser.name,
    actorEmail: adminUser.email,
    actorRole: 'superadmin',
    organizationId: user._id,
    action: 'PLAN_CHANGE',
    resourceType: 'User',
    resourceId: user._id.toString(),
    resourceName: user.companyInfo?.companyName || user.name,
    before: { plan: prevPlan, billingCycle: prevBillingCycle, planEndDate: prevEndDate },
    after: { plan: user.plan, billingCycle: user.billingCycle, planEndDate: user.planEndDate },
    metadata: { reason: reason || 'Manual subscription override by SuperAdmin', updatedBy: 'superadmin' },
    timestamp: new Date(),
  });

  return user;
}

module.exports = {
  listOrganisations,
  getTenantDetails,
  updateTenantStatus,
  updateTenantPlan,
  transitionTenantState,
  getTenantLifecycleDetails,
  TENANT_LIFECYCLE_STATES,
};
