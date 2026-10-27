const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Integration = require('../models/Integration');
const Lead = require('../models/Lead');
const User = require('../models/User');

function getTenantFilter(req) {
  const user = req.user;
  if (!user) return { _id: null };
  if (user.role === 'superadmin' || user.isAdmin) {
    return {};
  }
  const wsId = req.workspaceId || user.workspaceId;
  const companyId = user.companyId || (user.companyRole === 'owner' || user.workStatus === 'company_owner' ? user._id : null);
  
  const conditions = [];
  if (wsId) conditions.push({ workspaceId: wsId });
  if (companyId) conditions.push({ companyId });
  conditions.push({ userId: user._id });

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

exports.getTenantFilter = getTenantFilter;

/**
 * GET /api/campaigns or /api/campaigns/inbound
 * List all advertising and inbound lead-capture campaigns with live performance metrics
 */
exports.getInboundCampaigns = async (req, res) => {
  try {
    const filter = getTenantFilter(req);
    const { platform, status, search, type } = req.query;

    const query = {
      ...filter,
    };

    if (type === 'broadcast') {
      query.platform = 'broadcast';
    } else if (type === 'inbound') {
      query.platform = { $ne: 'broadcast' };
    }

    if (platform && platform !== 'all') {
      query.platform = platform.toLowerCase();
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { campaignName: { $regex: term, $options: 'i' } },
        { displayName: { $regex: term, $options: 'i' } },
        { 'routingRules.metaFormNames': { $regex: term, $options: 'i' } },
        { 'routingRules.googleAccountIds': { $regex: term, $options: 'i' } },
      ];
    }

    const campaigns = await Campaign.find(query)
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
      .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
      .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
      .populate('integrationId', 'accountName provider pageName sheetsConfig')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    // Enrich with live lead statistics and counselor distributions
    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        const leadMatchFilter = {
          $or: [
            { campaignId: c._id },
            { 'leadSource.campaignId': String(c._id) },
            { 'leadSource.campaignId': c.externalCampaignId || c.campaignId },
            { 'leadSource.campaignName': c.campaignName || c.name || c.displayName },
          ],
        };

        const [leadCount, assignedCount, convertedCount] = await Promise.all([
          Lead.countDocuments(leadMatchFilter),
          Lead.countDocuments({ ...leadMatchFilter, assignedTo: { $ne: null } }),
          Lead.countDocuments({
            ...leadMatchFilter,
            $or: [
              { status: { $in: ['closed', 'admitted', 'enrolled', 'deal_closed'] } },
              { pipelineStage: { $in: ['Admitted', 'Enrolled', 'Fee Paid', 'Admission Confirmed'] } },
            ],
          }),
        ]);

        // Build human-friendly routing summary
        const routes = [];
        if (c.routingRules?.metaFormNames?.length) {
          routes.push(`Meta Forms: ${c.routingRules.metaFormNames.join(', ')}`);
        } else if (c.routingRules?.metaFormIds?.length) {
          routes.push(`Meta Form IDs: ${c.routingRules.metaFormIds.join(', ')}`);
        }
        if (c.routingRules?.googleAccountIds?.length) {
          routes.push(`Google Accounts: ${c.routingRules.googleAccountIds.join(', ')}`);
        }
        if (c.routingRules?.websiteFormKeys?.length) {
          routes.push(`Website Forms: ${c.routingRules.websiteFormKeys.join(', ')}`);
        }
        if (c.routingRules?.sheetIds?.length) {
          routes.push(`Google Sheets: ${c.routingRules.sheetIds.length} connected`);
        }
        if (c.routingRules?.utmCampaigns?.length) {
          routes.push(`UTM: ${c.routingRules.utmCampaigns.join(', ')}`);
        }
        if (routes.length === 0 && c.connectionName) {
          routes.push(`${c.connectionName}`);
        }

        // Counselor pool summary
        const counselorNames = (c.assignmentRule?.counselorPool || [])
          .map((p) => p.userId?.name)
          .filter(Boolean);
        if (c.assignmentRule?.specificCounselorId?.name) {
          counselorNames.unshift(c.assignmentRule.specificCounselorId.name);
        }

        return {
          ...c,
          leadCount: leadCount || c.leadCount || 0,
          assignedCount: assignedCount || 0,
          convertedCount: convertedCount || 0,
          conversionRate: leadCount > 0 ? Math.round((convertedCount / leadCount) * 100) : 0,
          routingSummary: routes.length > 0 ? routes.join(' • ') : 'Standard Inbound Mapping',
          counselorNames,
        };
      })
    );

    return res.json({
      success: true,
      campaigns: enriched,
    });
  } catch (error) {
    console.error('[InboundCampaignController] getInboundCampaigns error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/campaigns
 * Create a new user-configured marketing campaign with designated routing & assignment rules
 */
exports.createInboundCampaign = async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      platform = 'multi',
      campaignType = 'inbound_ad',
      routingRules = {},
      assignmentRule = { type: 'round_robin' },
      budget = 0,
      startDate,
      endDate,
      status = 'active',
      integrationId,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Campaign name is required' });
    }

    const companyId = req.user.companyId || (req.user.role === 'owner' || req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);
    const workspaceId = req.workspaceId || req.user.workspaceId;

    // Sanitize routing rules
    const sanitizedRoutingRules = {
      metaFormIds: Array.isArray(routingRules.metaFormIds) ? routingRules.metaFormIds.map(String).map(s => s.trim()).filter(Boolean) : [],
      metaFormNames: Array.isArray(routingRules.metaFormNames) ? routingRules.metaFormNames.map(String).map(s => s.trim()).filter(Boolean) : [],
      metaPageIds: Array.isArray(routingRules.metaPageIds) ? routingRules.metaPageIds.map(String).map(s => s.trim()).filter(Boolean) : [],
      googleAccountIds: Array.isArray(routingRules.googleAccountIds) ? routingRules.googleAccountIds.map(String).map(s => s.trim()).filter(Boolean) : [],
      googleCampaignIds: Array.isArray(routingRules.googleCampaignIds) ? routingRules.googleCampaignIds.map(String).map(s => s.trim()).filter(Boolean) : [],
      websiteFormKeys: Array.isArray(routingRules.websiteFormKeys) ? routingRules.websiteFormKeys.map(String).map(s => s.trim()).filter(Boolean) : [],
      sheetIds: Array.isArray(routingRules.sheetIds) ? routingRules.sheetIds.map(String).map(s => s.trim()).filter(Boolean) : [],
      utmCampaigns: Array.isArray(routingRules.utmCampaigns) ? routingRules.utmCampaigns.map(String).map(s => s.trim().toLowerCase()).filter(Boolean) : [],
    };

    // Sanitize assignment rule
    const sanitizedAssignment = {
      type: assignmentRule.type || 'round_robin',
      specificCounselorId: assignmentRule.specificCounselorId || null,
      fallbackUserId: assignmentRule.fallbackUserId || req.user._id,
      skipInactive: assignmentRule.skipInactive !== false,
      counselorPool: Array.isArray(assignmentRule.counselorPool)
        ? assignmentRule.counselorPool.map((c) => ({
            userId: c.userId || c,
            weight: Number(c.weight) || 1,
            maxActiveLeads: c.maxActiveLeads ? Number(c.maxActiveLeads) : null,
          })).filter(c => Boolean(c.userId))
        : [],
    };

    const campaign = await Campaign.create({
      workspaceId,
      companyId,
      userId: req.user._id,
      name: name.trim(),
      displayName: (displayName || name).trim(),
      campaignName: name.trim(),
      description: (description || '').trim(),
      platform: String(platform).toLowerCase().trim(),
      campaignType,
      routingRules: sanitizedRoutingRules,
      assignmentRule: sanitizedAssignment,
      budget: Number(budget) || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'active',
      integrationId: integrationId || null,
      leadCount: 0,
      leadsGenerated: 0,
    });

    const populated = await Campaign.findById(campaign._id)
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
      .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
      .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
      .populate('integrationId', 'accountName provider pageName sheetsConfig');

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully with designated routing & assignment',
      campaign: populated,
    });
  } catch (error) {
    console.error('[InboundCampaignController] createInboundCampaign error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/campaigns/:id
 * Fetch single campaign details with full population and live metrics
 */
exports.getCampaignDetails = async (req, res) => {
  try {
    const filter = getTenantFilter(req);
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      ...filter,
    })
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
      .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
      .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
      .populate('integrationId', 'accountName provider pageName sheetsConfig')
      .lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const leadMatchFilter = {
      $or: [
        { campaignId: campaign._id },
        { 'leadSource.campaignId': String(campaign._id) },
        { 'leadSource.campaignId': campaign.externalCampaignId || campaign.campaignId },
        { 'leadSource.campaignName': campaign.campaignName || campaign.name || campaign.displayName },
      ],
    };

    const [leadCount, assignedCount, convertedCount] = await Promise.all([
      Lead.countDocuments(leadMatchFilter),
      Lead.countDocuments({ ...leadMatchFilter, assignedTo: { $ne: null } }),
      Lead.countDocuments({
        ...leadMatchFilter,
        $or: [
          { status: { $in: ['closed', 'admitted', 'enrolled', 'deal_closed'] } },
          { pipelineStage: { $in: ['Admitted', 'Enrolled', 'Fee Paid', 'Admission Confirmed'] } },
        ],
      }),
    ]);

    return res.json({
      success: true,
      campaign: {
        ...campaign,
        leadCount,
        assignedCount,
        convertedCount,
        conversionRate: leadCount > 0 ? Math.round((convertedCount / leadCount) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('[InboundCampaignController] getCampaignDetails error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT or PATCH /api/campaigns/:id
 * Update campaign attributes, routing rules, or assignment logic
 */
exports.updateCampaign = async (req, res) => {
  try {
    const filter = getTenantFilter(req);
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      ...filter,
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const {
      name,
      displayName,
      description,
      platform,
      routingRules,
      assignmentRule,
      budget,
      startDate,
      endDate,
      status,
      fieldMapping,
    } = req.body;

    if (name) {
      campaign.name = name.trim();
      campaign.campaignName = name.trim();
    }
    if (displayName) campaign.displayName = displayName.trim();
    if (description !== undefined) campaign.description = description.trim();
    if (platform) campaign.platform = platform.toLowerCase().trim();
    if (budget !== undefined) campaign.budget = Number(budget) || 0;
    if (startDate) campaign.startDate = new Date(startDate);
    if (endDate !== undefined) campaign.endDate = endDate ? new Date(endDate) : null;
    if (status) campaign.status = status;
    if (fieldMapping) campaign.fieldMapping = fieldMapping;

    if (routingRules) {
      campaign.routingRules = {
        metaFormIds: Array.isArray(routingRules.metaFormIds) ? routingRules.metaFormIds.map(String).map(s => s.trim()).filter(Boolean) : (campaign.routingRules?.metaFormIds || []),
        metaFormNames: Array.isArray(routingRules.metaFormNames) ? routingRules.metaFormNames.map(String).map(s => s.trim()).filter(Boolean) : (campaign.routingRules?.metaFormNames || []),
        metaPageIds: Array.isArray(routingRules.metaPageIds) ? routingRules.metaPageIds.map(String).map(s => s.trim()).filter(Boolean) : (campaign.routingRules?.metaPageIds || []),
        googleAccountIds: Array.isArray(routingRules.googleAccountIds) ? routingRules.googleAccountIds.map(String).map(s => s.trim()).filter(Boolean) : (campaign.routingRules?.googleAccountIds || []),
        googleCampaignIds: Array.isArray(routingRules.googleCampaignIds) ? routingRules.googleCampaignIds.map(String).map(s => s.trim()).filter(Boolean) : (campaign.routingRules?.googleCampaignIds || []),
        websiteFormKeys: Array.isArray(routingRules.websiteFormKeys) ? routingRules.websiteFormKeys.map(String).map(s => s.trim()).filter(Boolean) : (campaign.routingRules?.websiteFormKeys || []),
        sheetIds: Array.isArray(routingRules.sheetIds) ? routingRules.sheetIds.map(String).map(s => s.trim()).filter(Boolean) : (campaign.routingRules?.sheetIds || []),
        utmCampaigns: Array.isArray(routingRules.utmCampaigns) ? routingRules.utmCampaigns.map(String).map(s => s.trim().toLowerCase()).filter(Boolean) : (campaign.routingRules?.utmCampaigns || []),
      };
    }

    if (assignmentRule) {
      campaign.assignmentRule = {
        type: assignmentRule.type || campaign.assignmentRule?.type || 'round_robin',
        specificCounselorId: assignmentRule.specificCounselorId !== undefined ? assignmentRule.specificCounselorId : campaign.assignmentRule?.specificCounselorId,
        fallbackUserId: assignmentRule.fallbackUserId !== undefined ? assignmentRule.fallbackUserId : campaign.assignmentRule?.fallbackUserId,
        skipInactive: assignmentRule.skipInactive !== undefined ? assignmentRule.skipInactive : campaign.assignmentRule?.skipInactive,
        counselorPool: Array.isArray(assignmentRule.counselorPool)
          ? assignmentRule.counselorPool.map((c) => ({
              userId: c.userId || c,
              weight: Number(c.weight) || 1,
              maxActiveLeads: c.maxActiveLeads ? Number(c.maxActiveLeads) : null,
            })).filter(c => Boolean(c.userId))
          : (campaign.assignmentRule?.counselorPool || []),
      };
    }

    await campaign.save();

    const populated = await Campaign.findById(campaign._id)
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
      .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
      .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
      .populate('integrationId', 'accountName provider pageName sheetsConfig');

    return res.json({
      success: true,
      message: 'Campaign updated successfully',
      campaign: populated,
    });
  } catch (error) {
    console.error('[InboundCampaignController] updateCampaign error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/campaigns/:id/toggle
 * Toggle campaign active/paused status
 */
exports.toggleCampaignStatus = async (req, res) => {
  try {
    const filter = getTenantFilter(req);
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      ...filter,
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    campaign.status = campaign.status === 'active' ? 'paused' : 'active';
    await campaign.save();

    return res.json({
      success: true,
      message: `Campaign is now ${campaign.status}`,
      campaign,
    });
  } catch (error) {
    console.error('[InboundCampaignController] toggleCampaignStatus error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/campaigns/:id
 * Delete or archive campaign
 */
exports.deleteCampaign = async (req, res) => {
  try {
    const filter = getTenantFilter(req);
    const campaign = await Campaign.findOneAndDelete({
      _id: req.params.id,
      ...filter,
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    return res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    console.error('[InboundCampaignController] deleteCampaign error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/campaigns/:id/leads
 * Comprehensive Lead Tracking & Attribution endpoint:
 * Fetches all leads that originated from this campaign, with origin form/ad details and counselor attribution
 */
exports.getCampaignLeads = async (req, res) => {
  try {
    const filter = getTenantFilter(req);
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      ...filter,
    }).lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const { page = 1, limit = 25, search, status, counselorId } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (parsedPage - 1) * parsedLimit;

    const baseCampaignQuery = {
      $or: [
        { campaignId: campaign._id },
        { 'leadSource.campaignId': String(campaign._id) },
        { 'leadSource.campaignId': campaign.externalCampaignId || campaign.campaignId },
        { 'leadSource.campaignName': campaign.campaignName || campaign.name || campaign.displayName },
      ],
    };

    const leadQuery = {
      ...baseCampaignQuery,
    };

    if (status && status !== 'all') {
      leadQuery.status = status;
    }
    if (counselorId && counselorId !== 'all') {
      leadQuery.assignedTo = counselorId;
    }
    if (search && search.trim()) {
      const term = search.trim();
      leadQuery.$and = [
        {
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { phone: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
            { assignedToName: { $regex: term, $options: 'i' } },
            { 'leadSource.formName': { $regex: term, $options: 'i' } },
            { 'leadSource.adName': { $regex: term, $options: 'i' } },
          ],
        },
      ];
    }

    const [leads, total, allCampaignLeads] = await Promise.all([
      Lead.find(leadQuery)
        .populate('assignedTo', 'name email phone usercode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Lead.countDocuments(leadQuery),
      Lead.find(baseCampaignQuery).select('assignedTo assignedToName leadSource status pipelineStage createdAt').lean(),
    ]);

    // Compute live breakdowns across all leads in this campaign
    const counselorMap = {};
    const sourceMap = {};
    const stageMap = {};
    let assignedCount = 0;
    let unassignedCount = 0;

    for (const l of allCampaignLeads) {
      if (l.assignedTo) {
        assignedCount++;
        const cName = l.assignedToName || 'Assigned Counselor';
        counselorMap[cName] = (counselorMap[cName] || 0) + 1;
      } else {
        unassignedCount++;
      }

      const formLabel = l.leadSource?.formName || l.leadSource?.platform || 'Direct Form';
      sourceMap[formLabel] = (sourceMap[formLabel] || 0) + 1;

      const stage = l.pipelineStage || l.status || 'New Lead';
      stageMap[stage] = (stageMap[stage] || 0) + 1;
    }

    return res.json({
      success: true,
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        displayName: campaign.displayName,
        platform: campaign.platform,
        status: campaign.status,
        routingSummary: campaign.routingRules,
        assignmentRule: campaign.assignmentRule,
      },
      leads,
      pagination: {
        total,
        page: parsedPage,
        pages: Math.ceil(total / parsedLimit),
        limit: parsedLimit,
      },
      totalLeads: allCampaignLeads.length,
      assignedCount,
      unassignedCount,
      counselorBreakdown: Object.entries(counselorMap).map(([name, count]) => ({ name, count })),
      sourceBreakdown: Object.entries(sourceMap).map(([source, count]) => ({ source, count })),
      stageBreakdown: Object.entries(stageMap).map(([stage, count]) => ({ stage, count })),
      stats: {
        totalLeads: allCampaignLeads.length,
        assignedCount,
        unassignedCount,
        counselorBreakdown: Object.entries(counselorMap).map(([name, count]) => ({ name, count })),
        sourceBreakdown: Object.entries(sourceMap).map(([source, count]) => ({ source, count })),
        stageBreakdown: Object.entries(stageMap).map(([stage, count]) => ({ stage, count })),
      },
    });
  } catch (error) {
    console.error('[InboundCampaignController] getCampaignLeads error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/campaigns/integrations/available-sources
 * Returns active connected Meta Forms, Google Accounts, Website Forms, Google Sheets,
 * and Workspace Counselors to populate dropdowns in the Campaign creation/edit modal.
 */
exports.getAvailableSources = async (req, res) => {
  try {
    const filter = getTenantFilter(req);
    const user = req.user;
    const companyId = user.companyId || (user.companyRole === 'owner' || user.workStatus === 'company_owner' ? user._id : null);

    // 1. Fetch connected integrations
    const integrations = await Integration.find({
      ...filter,
      status: { $in: ['connected', 'active'] },
    }).lean();

    const metaForms = [];
    const metaPages = [];
    const googleAccounts = [];
    const websiteForms = [];
    const googleSheets = [];

    for (const integ of integrations) {
      const prov = String(integ.provider || '').toLowerCase();
      if (prov === 'meta') {
        if (integ.pageId) {
          metaPages.push({ id: integ.pageId, name: integ.pageName || `Meta Page (${integ.pageId})` });
        }
        if (Array.isArray(integ.formIds)) {
          integ.formIds.forEach((fId, idx) => {
            const fName = integ.formNames?.[idx] || `Lead Form ${fId}`;
            metaForms.push({ id: fId, name: fName, pageId: integ.pageId });
          });
        }
      } else if (prov === 'google') {
        const custId = integ.customerId || integ.accountId;
        if (custId) {
          googleAccounts.push({
            id: custId,
            name: integ.accountName || `Google Ads Account (${custId})`,
          });
        }
      } else if (prov === 'website') {
        const fKey = integ.websiteFormConfig?.formKey || integ.connectionId || integ._id;
        websiteForms.push({
          id: String(fKey),
          name: integ.websiteFormConfig?.label || integ.name || 'Website Inbound Form',
        });
      } else if (prov === 'sheets') {
        const sId = integ.sheetsConfig?.sheetId || integ.connectionId || integ._id;
        googleSheets.push({
          id: String(sId),
          name: integ.sheetsConfig?.sheetName || integ.name || 'Synced Google Sheet',
        });
      }
    }

    // 2. Fetch eligible workspace counselors
    const counselorQuery = companyId
      ? { $or: [{ companyId }, { _id: companyId }], isActive: { $ne: false } }
      : { isActive: { $ne: false } };

    const counselors = await User.find(counselorQuery)
      .select('_id name email role phone avatar')
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      sources: {
        metaForms,
        metaPages,
        googleAccounts,
        websiteForms,
        googleSheets,
        counselors,
      },
    });
  } catch (error) {
    console.error('[InboundCampaignController] getAvailableSources error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateInboundCampaign = exports.updateCampaign;
