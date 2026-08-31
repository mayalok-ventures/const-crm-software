const Plan = require('../../models/Plan');
const Subscription = require('../../models/Subscription');

/**
 * SUPERADMIN DYNAMIC PLAN CATALOG CONTROLLER
 * Full administrative control over SaaS plans, pricing, limits, feature checkboxes, and versioning.
 */

// @desc  List all plans with real-time active subscriber counts
// @route GET /api/superadmin/plans
// @access Private (SuperAdmin only)
exports.listPlans = async (req, res) => {
  try {
    const plans = await Plan.find()
      .sort({ category: 1, displayOrder: 1, createdAt: -1 })
      .lean();

    // Aggregate subscriber counts efficiently without N+1 query overhead
    const subscriberCounts = await Subscription.aggregate([
      {
        $match: {
          status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'TRIAL', 'AUTHENTICATED'] },
        },
      },
      {
        $group: {
          _id: '$planId',
          activeCount: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map();
    subscriberCounts.forEach((s) => {
      if (s._id) {
        countMap.set(s._id.toString(), s.activeCount);
      }
    });

    const enrichedPlans = plans.map((p) => {
      const activeSubscribers = countMap.get(p._id.toString()) || 0;
      const monthlyAmount = p.pricing?.monthly?.amount || Math.round((p.priceInPaise || 0) / 100);
      const yearlyAmount = p.pricing?.yearly?.amount || (monthlyAmount * 10);

      return {
        ...p,
        activeSubscribers,
        monthlyPrice: monthlyAmount,
        yearlyPrice: yearlyAmount,
      };
    });

    res.json({
      success: true,
      count: enrichedPlans.length,
      plans: enrichedPlans,
    });
  } catch (error) {
    console.error('[PlanCatalogController] listPlans error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching plan catalog' });
  }
};

// @desc  Get single plan details
// @route GET /api/superadmin/plans/:id
// @access Private (SuperAdmin only)
exports.getPlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id).lean();
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const activeSubscribers = await Subscription.countDocuments({
      planId: plan._id,
      status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'TRIAL', 'AUTHENTICATED'] },
    });

    res.json({
      success: true,
      plan: {
        ...plan,
        activeSubscribers,
      },
    });
  } catch (error) {
    console.error('[PlanCatalogController] getPlan error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching plan details' });
  }
};

// @desc  Create new Plan (Draft / Active)
// @route POST /api/superadmin/plans
// @access Private (SuperAdmin only)
exports.createPlan = async (req, res) => {
  try {
    const {
      name,
      slug,
      category,
      badge,
      description,
      displayOrder,
      pricing,
      limits,
      features,
      whatsIncluded,
      status,
      visibility,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Plan name is required' });
    }

    const cleanCategory = ['INDIVIDUAL', 'ORGANIZATION'].includes(category) ? category : 'ORGANIZATION';
    const cleanSlug = (slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cleanCode = `${cleanCategory}_${cleanSlug.toUpperCase().replace(/-/g, '_')}_V1`;

    // Check slug / code uniqueness
    const existing = await Plan.findOne({
      $or: [{ slug: cleanSlug }, { code: cleanCode }],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A plan with slug "${cleanSlug}" or code "${cleanCode}" already exists.`,
      });
    }

    const monthlyAmount = Number(pricing?.monthly?.amount) || 0;
    const yearlyAmount = Number(pricing?.yearly?.amount) || (monthlyAmount * 10);

    const newPlan = await Plan.create({
      name: name.trim(),
      code: cleanCode,
      slug: cleanSlug,
      category: cleanCategory,
      accountType: cleanCategory,
      badge: badge ? badge.trim() : null,
      description: description ? description.trim() : '',
      displayOrder: Number(displayOrder) || 0,
      status: status || 'DRAFT',
      visibility: visibility || 'PUBLIC',
      pricing: {
        monthly: {
          enabled: pricing?.monthly?.enabled !== false,
          amount: monthlyAmount,
          priceInPaise: monthlyAmount * 100,
        },
        yearly: {
          enabled: pricing?.yearly?.enabled !== false,
          amount: yearlyAmount,
          priceInPaise: yearlyAmount * 100,
        },
        currency: 'INR',
      },
      priceInPaise: monthlyAmount * 100,
      price: monthlyAmount,
      monthlyPrice: monthlyAmount,
      yearlyPrice: yearlyAmount,
      limits: {
        seats: limits?.seats !== undefined && !isNaN(Number(limits.seats)) ? Number(limits.seats) : 1,
        leads: limits?.leads !== undefined && !isNaN(Number(limits.leads)) ? Number(limits.leads) : 1000,
        contacts: limits?.contacts !== undefined && !isNaN(Number(limits.contacts)) ? Number(limits.contacts) : 5000,
        contactGroups: limits?.contactGroups !== undefined && !isNaN(Number(limits.contactGroups)) ? Number(limits.contactGroups) : 10,
        branches: limits?.branches !== undefined && !isNaN(Number(limits.branches)) ? Number(limits.branches) : 1,
        pipelines: limits?.pipelines !== undefined && !isNaN(Number(limits.pipelines)) ? Number(limits.pipelines) : 3,
        storageGB: limits?.storageGB !== undefined && !isNaN(Number(limits.storageGB)) ? Number(limits.storageGB) : 5,
        monthlyWhatsAppMessages: limits?.monthlyWhatsAppMessages !== undefined && !isNaN(Number(limits.monthlyWhatsAppMessages)) ? Number(limits.monthlyWhatsAppMessages) : 1000,
        monthlyBroadcasts: limits?.monthlyBroadcasts !== undefined && !isNaN(Number(limits.monthlyBroadcasts)) ? Number(limits.monthlyBroadcasts) : 5,
        apiRequestsMonthly: limits?.apiRequestsMonthly !== undefined && !isNaN(Number(limits.apiRequestsMonthly)) ? Number(limits.apiRequestsMonthly) : 0,
      },
      features: {
        leadManagement: features?.leadManagement !== false,
        leadExport: Boolean(features?.leadExport),
        whatsapp: features?.whatsapp !== false,
        whatsappBroadcast: Boolean(features?.whatsappBroadcast),
        automation: Boolean(features?.automation),
        commonLeadPool: Boolean(features?.commonLeadPool),
        autoLeadDistribution: Boolean(features?.autoLeadDistribution),
        performanceTracking: Boolean(features?.performanceTracking),
        commissionTracking: Boolean(features?.commissionTracking),
        hierarchy: Boolean(features?.hierarchy),
        smartExitRules: Boolean(features?.smartExitRules),
        advancedAnalytics: Boolean(features?.advancedAnalytics),
        revenueAnalytics: Boolean(features?.revenueAnalytics),
        customWebhooks: Boolean(features?.customWebhooks),
        apiAccess: Boolean(features?.apiAccess),
        customDomain: Boolean(features?.customDomain),
      },
      whatsIncluded: Array.isArray(whatsIncluded) ? whatsIncluded.filter(Boolean) : [],
      version: 1,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: `Plan "${newPlan.name}" created successfully.`,
      plan: newPlan,
    });
  } catch (error) {
    console.error('[PlanCatalogController] createPlan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating plan' });
  }
};

// @desc  Update existing Plan (Increments version if active configuration changes)
// @route PUT /api/superadmin/plans/:id
// @access Private (SuperAdmin only)
exports.updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const {
      name,
      badge,
      description,
      displayOrder,
      pricing,
      limits,
      features,
      whatsIncluded,
      status,
      visibility,
    } = req.body;

    if (name) plan.name = name.trim();
    if (badge !== undefined) plan.badge = badge ? badge.trim() : null;
    if (description !== undefined) plan.description = description ? description.trim() : '';
    if (displayOrder !== undefined) plan.displayOrder = Number(displayOrder) || 0;
    if (status) plan.status = status;
    if (visibility) plan.visibility = visibility;

    let configurationChanged = false;

    // Check if pricing changed
    if (pricing) {
      const monthlyAmount = Number(pricing.monthly?.amount) || 0;
      const yearlyAmount = Number(pricing.yearly?.amount) || (monthlyAmount * 10);

      if (plan.pricing?.monthly?.amount !== monthlyAmount || plan.pricing?.yearly?.amount !== yearlyAmount) {
        configurationChanged = true;
      }

      plan.pricing = {
        monthly: {
          enabled: pricing.monthly?.enabled !== false,
          amount: monthlyAmount,
          priceInPaise: monthlyAmount * 100,
        },
        yearly: {
          enabled: pricing.yearly?.enabled !== false,
          amount: yearlyAmount,
          priceInPaise: yearlyAmount * 100,
        },
        currency: 'INR',
      };
      plan.priceInPaise = monthlyAmount * 100;
      plan.price = monthlyAmount;
      plan.monthlyPrice = monthlyAmount;
      plan.yearlyPrice = yearlyAmount;
    }

    // Check if limits changed
    if (limits) {
      configurationChanged = true;
      plan.limits = {
        ...plan.limits,
        ...limits,
      };
    }

    // Check if features changed
    if (features) {
      configurationChanged = true;
      plan.features = {
        ...plan.features,
        ...features,
      };
    }

    if (whatsIncluded !== undefined) {
      plan.whatsIncluded = Array.isArray(whatsIncluded) ? whatsIncluded.filter(Boolean) : [];
    }

    // Increment version if published active configuration changed
    if (configurationChanged && plan.status === 'ACTIVE') {
      plan.version = (plan.version || 1) + 1;
    }

    plan.updatedBy = req.user._id;
    await plan.save();

    res.json({
      success: true,
      message: `Plan "${plan.name}" updated successfully (v${plan.version}).`,
      plan,
    });
  } catch (error) {
    console.error('[PlanCatalogController] updatePlan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating plan' });
  }
};

// @desc  Publish plan to active state
// @route POST /api/superadmin/plans/:id/publish
// @access Private (SuperAdmin only)
exports.publishPlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    plan.status = 'ACTIVE';
    plan.visibility = 'PUBLIC';
    plan.isActive = true;
    plan.updatedBy = req.user._id;
    await plan.save();

    res.json({
      success: true,
      message: `Plan "${plan.name}" is now published and active on the pricing catalog.`,
      plan,
    });
  } catch (error) {
    console.error('[PlanCatalogController] publishPlan error:', error);
    res.status(500).json({ success: false, message: 'Server error publishing plan' });
  }
};

// @desc  Archive plan (Soft delete preserving historical subscriptions)
// @route POST /api/superadmin/plans/:id/archive
// @access Private (SuperAdmin only)
exports.archivePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    plan.status = 'ARCHIVED';
    plan.visibility = 'HIDDEN';
    plan.isActive = false;
    plan.updatedBy = req.user._id;
    await plan.save();

    res.json({
      success: true,
      message: `Plan "${plan.name}" has been archived. Existing subscribers are unaffected.`,
      plan,
    });
  } catch (error) {
    console.error('[PlanCatalogController] archivePlan error:', error);
    res.status(500).json({ success: false, message: 'Server error archiving plan' });
  }
};

// @desc  Duplicate plan as a new Draft
// @route POST /api/superadmin/plans/:id/duplicate
// @access Private (SuperAdmin only)
exports.duplicatePlan = async (req, res) => {
  try {
    const original = await Plan.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Original plan not found' });

    const timestamp = Date.now().toString().slice(-4);
    const newName = `${original.name} (Copy ${timestamp})`;
    const newSlug = `${original.slug || 'plan'}-copy-${timestamp}`;
    const newCode = `${original.code}_COPY_${timestamp}`;

    const clonedPlan = await Plan.create({
      name: newName,
      code: newCode,
      slug: newSlug,
      category: original.category || 'ORGANIZATION',
      accountType: original.accountType || 'ORGANIZATION',
      badge: original.badge,
      description: original.description,
      displayOrder: (original.displayOrder || 0) + 1,
      status: 'DRAFT',
      visibility: 'HIDDEN',
      pricing: original.pricing,
      priceInPaise: original.priceInPaise,
      price: original.price,
      monthlyPrice: original.monthlyPrice,
      yearlyPrice: original.yearlyPrice,
      limits: original.limits,
      features: original.features,
      whatsIncluded: original.whatsIncluded || [],
      version: 1,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: `Plan duplicated as "${clonedPlan.name}".`,
      plan: clonedPlan,
    });
  } catch (error) {
    console.error('[PlanCatalogController] duplicatePlan error:', error);
    res.status(500).json({ success: false, message: 'Server error duplicating plan' });
  }
};

// @desc  Get active public plans for customer pricing page
// @route GET /api/plans
// @access Public
exports.getPublicPlans = async (req, res) => {
  try {
    const plans = await Plan.find({
      status: 'ACTIVE',
      visibility: 'PUBLIC',
    })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    const individual = plans
      .filter((p) => (p.category || p.accountType) === 'INDIVIDUAL')
      .map(formatCustomerPlan);

    const organization = plans
      .filter((p) => (p.category || p.accountType) === 'ORGANIZATION')
      .map(formatCustomerPlan);

    res.json({
      success: true,
      plans: {
        individual,
        organization,
        all: plans.map(formatCustomerPlan),
      },
    });
  } catch (error) {
    console.error('[PlanCatalogController] getPublicPlans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active plans' });
  }
};

function formatCustomerPlan(p) {
  const monthlyAmount = p.pricing?.monthly?.amount || Math.round((p.priceInPaise || 0) / 100);
  const yearlyAmount = p.pricing?.yearly?.amount || (monthlyAmount * 10);

  return {
    id: p.slug || p.code.toLowerCase(),
    code: p.code,
    name: p.name,
    subtitle: p.description || '',
    badge: p.badge || null,
    popular: Boolean(p.badge?.toLowerCase().includes('popular')),
    category: p.category || p.accountType || 'ORGANIZATION',
    monthlyPrice: monthlyAmount,
    yearlyPrice: yearlyAmount,
    seats: p.limits?.seats || 1,
    limits: p.limits,
    features: p.whatsIncluded && p.whatsIncluded.length > 0 ? p.whatsIncluded : [
      `Up to ${(p.limits?.leads || 1000).toLocaleString()} active leads`,
      `Includes ${p.limits?.seats || 1} team seat(s)`,
      `${(p.limits?.monthlyWhatsAppMessages || 1000).toLocaleString()} WhatsApp messages/mo`,
      'CRM Pipeline & Follow-up Alarms',
    ],
    featureFlags: p.features,
    version: p.version || 1,
  };
}
