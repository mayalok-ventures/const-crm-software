const mongoose = require('mongoose');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Lead = require('../models/Lead');
const Group = require('../models/Group');
const Campaign = require('../models/Campaign');

/**
 * CENTRALIZED FEATURE ENTITLEMENT & RESOURCE LIMIT ENGINE
 * Authoritative single source of truth for:
 * 1. Subscription Entitlement Snapshots
 * 2. Dynamic Feature Permission Checks (Allow / 403 Forbidden)
 * 3. Resource Limit Checks (-1 = Unlimited, 0 = Disabled, >0 = Capped)
 * 4. Billing-Period Quota Consumption
 */

/**
 * Resolve canonical tenant / organization ID from actor
 */
async function resolveTenantId(subjectId) {
  if (!subjectId) return null;
  if (typeof subjectId === 'object' && subjectId._id) {
    subjectId = subjectId._id;
  }
  return new mongoose.Types.ObjectId(subjectId.toString());
}

/**
 * Create immutable entitlement snapshot from a Plan document
 */
function createPlanSnapshot(plan, billingInterval = 'monthly') {
  if (!plan) return null;

  const limits = {
    seats: plan.limits?.seats !== undefined ? plan.limits.seats : (plan.defaultEntitlements?.maxSeats || 1),
    leads: plan.limits?.leads !== undefined ? plan.limits.leads : (plan.defaultEntitlements?.maxLeads || 1000),
    contacts: plan.limits?.contacts !== undefined ? plan.limits.contacts : 5000,
    contactGroups: plan.limits?.contactGroups !== undefined ? plan.limits.contactGroups : (plan.defaultEntitlements?.maxGroups || 10),
    branches: plan.limits?.branches !== undefined ? plan.limits.branches : 1,
    pipelines: plan.limits?.pipelines !== undefined ? plan.limits.pipelines : 3,
    storageGB: plan.limits?.storageGB !== undefined ? plan.limits.storageGB : 5,
    monthlyWhatsAppMessages: plan.limits?.monthlyWhatsAppMessages !== undefined ? plan.limits.monthlyWhatsAppMessages : (plan.defaultEntitlements?.monthlyWAQuota || 1000),
    monthlyBroadcasts: plan.limits?.monthlyBroadcasts !== undefined ? plan.limits.monthlyBroadcasts : 5,
    apiRequestsMonthly: plan.limits?.apiRequestsMonthly !== undefined ? plan.limits.apiRequestsMonthly : 0,
  };

  const features = {
    leadManagement: plan.features?.leadManagement !== undefined ? plan.features.leadManagement : true,
    leadExport: plan.features?.leadExport !== undefined ? plan.features.leadExport : false,
    whatsapp: plan.features?.whatsapp !== undefined ? plan.features.whatsapp : true,
    whatsappBroadcast: plan.features?.whatsappBroadcast !== undefined ? plan.features.whatsappBroadcast : false,
    automation: plan.features?.automation !== undefined ? plan.features.automation : false,
    commonLeadPool: plan.features?.commonLeadPool !== undefined ? plan.features.commonLeadPool : false,
    autoLeadDistribution: plan.features?.autoLeadDistribution !== undefined ? plan.features.autoLeadDistribution : false,
    performanceTracking: plan.features?.performanceTracking !== undefined ? plan.features.performanceTracking : false,
    commissionTracking: plan.features?.commissionTracking !== undefined ? plan.features.commissionTracking : false,
    hierarchy: plan.features?.hierarchy !== undefined ? plan.features.hierarchy : false,
    smartExitRules: plan.features?.smartExitRules !== undefined ? plan.features.smartExitRules : false,
    advancedAnalytics: plan.features?.advancedAnalytics !== undefined ? plan.features.advancedAnalytics : (plan.defaultEntitlements?.features?.advancedAnalytics || false),
    revenueAnalytics: plan.features?.revenueAnalytics !== undefined ? plan.features.revenueAnalytics : false,
    customWebhooks: plan.features?.customWebhooks !== undefined ? plan.features.customWebhooks : (plan.defaultEntitlements?.features?.customWebhooks || false),
    apiAccess: plan.features?.apiAccess !== undefined ? plan.features.apiAccess : false,
    customDomain: plan.features?.customDomain !== undefined ? plan.features.customDomain : false,
    customFields: plan.features?.customFields !== undefined ? plan.features.customFields : true,
    prioritySupport: plan.features?.prioritySupport !== undefined ? plan.features.prioritySupport : false,
  };

  return {
    limits,
    features,
    whatsIncluded: Array.isArray(plan.whatsIncluded) ? [...plan.whatsIncluded] : [],
    snapshotCreatedAt: new Date(),
  };
}

/**
 * Get effective entitlements for a tenant / organization
 * Priority:
 * 1. Active subscription entitlement snapshot
 * 2. Populated Plan from database
 * 3. Fallback Plan from User.plan
 */
async function getEffectiveEntitlements(subjectId) {
  const tenantId = await resolveTenantId(subjectId);
  if (!tenantId) {
    return getDefaultFreeEntitlements();
  }

  // 1. Look up active subscription for tenant
  const subscription = await Subscription.findOne({
    $or: [{ userId: tenantId }, { companyId: tenantId }],
    status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'TRIAL', 'AUTHENTICATED'] },
  })
    .populate('planId')
    .sort({ createdAt: -1 })
    .lean();

  if (subscription) {
    // If valid entitlement snapshot exists in subscription, use it (version preservation)
    if (subscription.entitlementSnapshot?.limits && subscription.entitlementSnapshot?.features) {
      return {
        tenantId,
        subscriptionId: subscription._id,
        planName: subscription.planId?.name || 'Active Subscription',
        planCode: subscription.planId?.code || 'CUSTOM',
        planVersion: subscription.planVersion || 1,
        billingInterval: subscription.billingInterval || subscription.billingCycle || 'monthly',
        status: subscription.status,
        limits: subscription.entitlementSnapshot.limits,
        features: subscription.entitlementSnapshot.features,
        whatsIncluded: subscription.entitlementSnapshot.whatsIncluded || [],
        periodStart: subscription.currentPeriodStart || subscription.createdAt,
        periodEnd: subscription.currentPeriodEnd,
        isSnapshot: true,
      };
    }

    // If subscription has planId without snapshot, generate snapshot dynamically from Plan
    if (subscription.planId) {
      const snapshot = createPlanSnapshot(subscription.planId, subscription.billingCycle);
      return {
        tenantId,
        subscriptionId: subscription._id,
        planName: subscription.planId.name,
        planCode: subscription.planId.code,
        planVersion: subscription.planId.version || 1,
        billingInterval: subscription.billingCycle || 'monthly',
        status: subscription.status,
        limits: snapshot.limits,
        features: snapshot.features,
        whatsIncluded: snapshot.whatsIncluded,
        periodStart: subscription.currentPeriodStart || subscription.createdAt,
        periodEnd: subscription.currentPeriodEnd,
        isSnapshot: false,
      };
    }
  }

  // 2. Fallback: Lookup User record plan tag
  const user = await User.findById(tenantId).select('plan lifecycleStatus').lean();
  const userPlanCode = user?.plan || 'free';

  const dbPlan = await Plan.findOne({
    $or: [
      { slug: userPlanCode.toLowerCase().replace(/_/g, '-') },
      { code: userPlanCode.toUpperCase() },
      { name: new RegExp(`^${userPlanCode}$`, 'i') },
    ],
    status: 'ACTIVE',
  }).lean();

  if (dbPlan) {
    const snapshot = createPlanSnapshot(dbPlan, 'monthly');
    return {
      tenantId,
      subscriptionId: null,
      planName: dbPlan.name,
      planCode: dbPlan.code,
      planVersion: dbPlan.version || 1,
      billingInterval: 'monthly',
      status: user?.lifecycleStatus || 'TRIAL',
      limits: snapshot.limits,
      features: snapshot.features,
      whatsIncluded: snapshot.whatsIncluded,
      periodStart: new Date(),
      periodEnd: null,
      isSnapshot: false,
    };
  }

  return getDefaultFreeEntitlements(tenantId);
}

/**
 * Fallback free trial entitlements
 */
function getDefaultFreeEntitlements(tenantId = null) {
  return {
    tenantId,
    subscriptionId: null,
    planName: 'Free Trial',
    planCode: 'FREE_TRIAL_V1',
    planVersion: 1,
    billingInterval: 'monthly',
    status: 'TRIAL',
    limits: {
      seats: 3,
      leads: 1000,
      contacts: 500,
      contactGroups: 5,
      branches: 1,
      pipelines: 2,
      storageGB: 1,
      monthlyWhatsAppMessages: 100,
      monthlyBroadcasts: 2,
      apiRequestsMonthly: 0,
    },
    features: {
      leadManagement: true,
      leadExport: false,
      whatsapp: true,
      whatsappBroadcast: false,
      automation: false,
      commonLeadPool: false,
      autoLeadDistribution: false,
      performanceTracking: false,
      commissionTracking: false,
      hierarchy: false,
      smartExitRules: false,
      advancedAnalytics: false,
      revenueAnalytics: false,
      customWebhooks: false,
      apiAccess: false,
      customDomain: false,
      customFields: true,
      prioritySupport: false,
    },
    whatsIncluded: ['Up to 1,000 active leads', '3 team seats', 'Core pipeline workflow'],
    periodStart: new Date(),
    periodEnd: null,
    isSnapshot: false,
  };
}

/**
 * Check if a specific feature is enabled
 */
async function hasFeature(subjectId, featureKey) {
  const entitlements = await getEffectiveEntitlements(subjectId);
  return Boolean(entitlements.features?.[featureKey]);
}

/**
 * Assert that a feature is enabled; throws HTTP 403 if disabled
 */
async function assertFeature(subjectId, featureKey) {
  const isEnabled = await hasFeature(subjectId, featureKey);
  if (!isEnabled) {
    const error = new Error(`Feature "${featureKey}" is not included in your current subscription plan.`);
    error.statusCode = 403;
    error.code = 'FEATURE_NOT_AVAILABLE';
    error.feature = featureKey;
    error.upgradeRequired = true;
    throw error;
  }
  return true;
}

/**
 * Get configured numerical limit (-1 = unlimited)
 */
async function getLimit(subjectId, limitKey) {
  const entitlements = await getEffectiveEntitlements(subjectId);
  const limitValue = entitlements.limits?.[limitKey];
  return limitValue !== undefined ? Number(limitValue) : 0;
}

/**
 * Check if a resource limit is unlimited (-1)
 */
async function isUnlimited(subjectId, limitKey) {
  const limit = await getLimit(subjectId, limitKey);
  return limit === -1;
}

/**
 * Calculate current resource usage from MongoDB
 */
async function getUsage(subjectId, resourceKey) {
  const tenantId = await resolveTenantId(subjectId);
  if (!tenantId) return 0;

  switch (resourceKey) {
    case 'leads': {
      return await Lead.countDocuments({
        $or: [{ companyId: tenantId }, { userId: tenantId }],
      });
    }

    case 'seats': {
      // Active staff agent / manager seats under this organization
      const count = await User.countDocuments({
        companyId: tenantId,
        role: { $in: ['agent', 'manager'] },
        userStatus: { $ne: 'disabled' },
        isActive: { $ne: false },
      });
      return count + 1; // Count including the tenant owner
    }

    case 'contacts': {
      return await Lead.countDocuments({
        $or: [{ companyId: tenantId }, { userId: tenantId }],
      });
    }

    case 'contactGroups':
    case 'groups': {
      if (Group) {
        return await Group.countDocuments({
          $or: [{ companyId: tenantId }, { userId: tenantId }],
        });
      }
      return 0;
    }

    case 'monthlyBroadcasts': {
      const entitlements = await getEffectiveEntitlements(subjectId);
      const periodStart = entitlements.periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (Campaign) {
        return await Campaign.countDocuments({
          $or: [{ companyId: tenantId }, { userId: tenantId }],
          createdAt: { $gte: periodStart },
        });
      }
      return 0;
    }

    default:
      return 0;
  }
}

/**
 * Get remaining resource capacity
 */
async function getRemaining(subjectId, resourceKey) {
  const limit = await getLimit(subjectId, resourceKey);
  if (limit === -1) return Infinity;
  const currentUsage = await getUsage(subjectId, resourceKey);
  return Math.max(0, limit - currentUsage);
}

/**
 * Check if the tenant can use/allocate the requested amount
 */
async function canUse(subjectId, resourceKey, requestedAmount = 1) {
  const limit = await getLimit(subjectId, resourceKey);
  if (limit === -1) return true; // Unlimited
  if (limit === 0) return false; // Not allowed

  const currentUsage = await getUsage(subjectId, resourceKey);
  return (currentUsage + requestedAmount) <= limit;
}

/**
 * Assert resource limit; throws structured HTTP 403 if exceeded
 */
async function assertLimit(subjectId, resourceKey, requestedAmount = 1) {
  const limit = await getLimit(subjectId, resourceKey);
  if (limit === -1) return true; // Unlimited

  const currentUsage = await getUsage(subjectId, resourceKey);
  if ((currentUsage + requestedAmount) > limit) {
    const error = new Error(`Plan limit reached for ${resourceKey}. Limit: ${limit}, Current: ${currentUsage}, Requested: ${requestedAmount}`);
    error.statusCode = 403;
    error.code = 'PLAN_LIMIT_EXCEEDED';
    error.resource = resourceKey;
    error.limit = limit;
    error.currentUsage = currentUsage;
    error.requested = requestedAmount;
    error.upgradeRequired = true;
    throw error;
  }

  return true;
}

module.exports = {
  resolveTenantId,
  createPlanSnapshot,
  getEffectiveEntitlements,
  hasFeature,
  assertFeature,
  getLimit,
  isUnlimited,
  getUsage,
  getRemaining,
  canUse,
  assertLimit,
};
