const mongoose = require('mongoose');
const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
const Integration = require('../../models/Integration');
const Campaign = require('../../models/Campaign');
const { getTenantFilter } = require('../inboundCampaignController');

/**
 * Helper to get clean tenant query for subscriptions
 */
function getSubscriptionTenantFilter(req) {
  const user = req.user;
  if (!user) return { _id: null };
  if (user.role === 'superadmin' || user.isAdmin) return {};

  const wsId = req.workspaceId || user.workspaceId;
  const companyId = user.companyId || (user.companyRole === 'owner' || user.workStatus === 'company_owner' ? user._id : null);

  const conditions = [];
  if (wsId) conditions.push({ workspaceId: wsId });
  if (companyId) conditions.push({ companyId });
  conditions.push({ userId: user._id });

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

/**
 * GET /api/integrations/subscriptions
 * List all configured lead source subscriptions for the authenticated tenant
 */
exports.getSubscriptions = async (req, res) => {
  try {
    const tenantFilter = getSubscriptionTenantFilter(req);
    const { provider, integrationId, campaignGroupId, status, search } = req.query;

    const query = { ...tenantFilter };

    if (provider && provider !== 'all') {
      query.provider = provider.toLowerCase().trim();
    }
    if (integrationId && mongoose.Types.ObjectId.isValid(integrationId)) {
      query.integrationId = integrationId;
    }
    if (campaignGroupId && mongoose.Types.ObjectId.isValid(campaignGroupId)) {
      query.campaignGroupId = campaignGroupId;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { sourceName: { $regex: term, $options: 'i' } },
        { externalFormName: { $regex: term, $options: 'i' } },
        { externalFormId: { $regex: term, $options: 'i' } },
        { externalAccountName: { $regex: term, $options: 'i' } },
      ];
    }

    const subscriptions = await LeadSourceSubscription.find(query)
      .populate('integrationId', 'accountName pageName provider status connectedAt lastError')
      .populate('campaignGroupId', 'name campaignName displayName platform status leadCount')
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
      .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
      .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: subscriptions.length,
      subscriptions,
    });
  } catch (error) {
    console.error('[SubscriptionRoutingController] getSubscriptions error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/integrations/subscriptions/:id
 * Retrieve a single lead source subscription with tenant verification
 */
exports.getSubscription = async (req, res) => {
  try {
    const tenantFilter = getSubscriptionTenantFilter(req);
    const subscription = await LeadSourceSubscription.findOne({
      _id: req.params.id,
      ...tenantFilter,
    })
      .populate('integrationId', 'accountName pageName provider status connectedAt')
      .populate('campaignGroupId', 'name campaignName displayName platform status leadCount')
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
      .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
      .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
      .lean();

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    return res.json({ success: true, subscription });
  } catch (error) {
    console.error('[SubscriptionRoutingController] getSubscription error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/subscriptions
 * Create or configure a new lead source subscription linking a provider form to a campaign group
 */
exports.createSubscription = async (req, res) => {
  try {
    const tenantFilter = getSubscriptionTenantFilter(req);
    const {
      integrationId,
      provider,
      sourceName,
      externalAccountId,
      externalAccountName,
      externalFormId,
      externalFormName,
      campaignGroupId,
      fieldMapping,
      assignmentRule,
      metadata,
    } = req.body;

    if (!integrationId || !provider || !externalFormId || !campaignGroupId) {
      return res.status(400).json({
        success: false,
        message: 'integrationId, provider, externalFormId, and campaignGroupId are required',
      });
    }

    // 1. Verify parent integration belongs to tenant
    const integration = await Integration.findOne({
      _id: integrationId,
      ...tenantFilter,
    });
    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration connection not found or unauthorized',
      });
    }

    // 2. Verify target campaign group belongs to tenant
    const campaignTenantFilter = getTenantFilter(req);
    const targetCampaign = await Campaign.findOne({
      _id: campaignGroupId,
      ...campaignTenantFilter,
    });
    if (!targetCampaign) {
      return res.status(404).json({
        success: false,
        message: 'Destination Campaign Group not found or unauthorized',
      });
    }

    const wsId = req.workspaceId || req.user.workspaceId || null;
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

    // 3. Upsert subscription to ensure idempotent configuration
    const query = {
      ...(companyId ? { companyId } : { userId: req.user._id }),
      provider: provider.toLowerCase().trim(),
      externalFormId: String(externalFormId).trim(),
    };

    const updateData = {
      workspaceId: wsId,
      companyId,
      userId: req.user._id,
      integrationId: integration._id,
      provider: provider.toLowerCase().trim(),
      sourceName: (sourceName || externalFormName || `${provider} Form ${externalFormId}`).trim(),
      externalAccountId: externalAccountId ? String(externalAccountId).trim() : (integration.accountId || integration.pageId || ''),
      externalAccountName: externalAccountName ? String(externalAccountName).trim() : (integration.accountName || integration.pageName || ''),
      externalFormId: String(externalFormId).trim(),
      externalFormName: externalFormName ? String(externalFormName).trim() : '',
      campaignGroupId: targetCampaign._id,
      fieldMapping: Array.isArray(fieldMapping) ? fieldMapping : (integration.fieldMapping || []),
      assignmentRule: assignmentRule || { type: 'inherit_campaign' },
      status: 'active',
      healthStatus: 'healthy',
      lastError: '',
      metadata: metadata || {},
    };

    const subscription = await LeadSourceSubscription.findOneAndUpdate(
      query,
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate('integrationId', 'accountName pageName provider status')
      .populate('campaignGroupId', 'name campaignName displayName platform status')
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone');

    // Also sync the form ID into Campaign routingRules if helpful for dual compatibility
    try {
      const formIdStr = String(externalFormId).trim();
      if (provider.toLowerCase() === 'meta') {
        await Campaign.findByIdAndUpdate(targetCampaign._id, {
          $addToSet: { 'routingRules.metaFormIds': formIdStr },
        });
      } else if (provider.toLowerCase() === 'google' && externalAccountId) {
        await Campaign.findByIdAndUpdate(targetCampaign._id, {
          $addToSet: { 'routingRules.googleAccountIds': String(externalAccountId).trim() },
        });
      }
    } catch (syncErr) {
      console.warn('[SubscriptionRoutingController] Campaign routingRules sync notice:', syncErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Lead source subscription successfully configured and linked to Campaign Group',
      subscription,
    });
  } catch (error) {
    console.error('[SubscriptionRoutingController] createSubscription error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/integrations/subscriptions/:id
 * Update an existing subscription (field mapping, assignment rules, destination campaign)
 */
exports.updateSubscription = async (req, res) => {
  try {
    const tenantFilter = getSubscriptionTenantFilter(req);
    const subscription = await LeadSourceSubscription.findOne({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const {
      sourceName,
      campaignGroupId,
      fieldMapping,
      assignmentRule,
      status,
    } = req.body;

    if (sourceName) subscription.sourceName = sourceName.trim();
    if (fieldMapping && Array.isArray(fieldMapping)) subscription.fieldMapping = fieldMapping;
    if (assignmentRule) subscription.assignmentRule = assignmentRule;
    if (status && ['active', 'paused', 'error'].includes(status)) subscription.status = status;

    if (campaignGroupId && campaignGroupId !== String(subscription.campaignGroupId)) {
      const campaignTenantFilter = getTenantFilter(req);
      const newCampaign = await Campaign.findOne({
        _id: campaignGroupId,
        ...campaignTenantFilter,
      });
      if (!newCampaign) {
        return res.status(404).json({
          success: false,
          message: 'Target Campaign Group not found or unauthorized',
        });
      }
      subscription.campaignGroupId = newCampaign._id;
    }

    await subscription.save();

    const updated = await LeadSourceSubscription.findById(subscription._id)
      .populate('integrationId', 'accountName pageName provider status')
      .populate('campaignGroupId', 'name campaignName displayName platform status')
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone');

    return res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: updated,
    });
  } catch (error) {
    console.error('[SubscriptionRoutingController] updateSubscription error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH or PUT /api/integrations/subscriptions/:id/toggle
 * Toggle active/paused state of a subscription
 */
exports.toggleSubscription = async (req, res) => {
  try {
    const tenantFilter = getSubscriptionTenantFilter(req);
    const subscription = await LeadSourceSubscription.findOne({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    subscription.status = subscription.status === 'active' ? 'paused' : 'active';
    await subscription.save();

    return res.json({
      success: true,
      message: `Subscription ${subscription.status === 'active' ? 'activated' : 'paused'} successfully`,
      status: subscription.status,
      subscription,
    });
  } catch (error) {
    console.error('[SubscriptionRoutingController] toggleSubscription error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/integrations/subscriptions/:id
 * Delete a lead source subscription
 */
exports.deleteSubscription = async (req, res) => {
  try {
    const tenantFilter = getSubscriptionTenantFilter(req);
    const subscription = await LeadSourceSubscription.findOneAndDelete({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    return res.json({
      success: true,
      message: 'Lead source subscription removed successfully',
    });
  } catch (error) {
    console.error('[SubscriptionRoutingController] deleteSubscription error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
