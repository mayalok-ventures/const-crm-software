const Campaign = require('../models/Campaign');
const CampaignLog = require('../models/CampaignLog');
const Group = require('../models/Group');
const Lead = require('../models/Lead');
const { PLAN_LIMITS } = require('../utils/planLimits');
const waSession = require('../services/waSession');

// @desc  Create and queue a new campaign
// @route POST /api/campaigns
// @access Private
exports.createCampaign = async (req, res) => {
  try {
    const { groupId, template, name, channel = 'baileys', templateName, languageCode = 'en' } = req.body;

    // If no groupId provided, delegate to Inbound Advertising Campaign creation
    if (!groupId) {
      const inbound = require('./inboundCampaignController');
      return inbound.createInboundCampaign(req, res);
    }

    if ((!template?.trim() && !templateName?.trim()) || !name?.trim()) {
      return res.status(400).json({ message: 'groupId, name, and template (or templateName) are required' });
    }

    const plan = req.user.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    if (req.user.role !== 'superadmin' && !req.user.isAdmin) {
      try {
        const { assertFeature, assertLimit } = require('../services/entitlementService');
        const targetSubject = req.user.companyId || req.user._id;
        await assertFeature(targetSubject, 'whatsappBroadcast');
        await assertLimit(targetSubject, 'monthlyBroadcasts', 1);
      } catch (campErr) {
        return res.status(campErr.statusCode || 403).json({
          success: false,
          code: campErr.code || 'FEATURE_NOT_AVAILABLE',
          message: campErr.message,
          upgradeRequired: true,
        });
      }
    }

    // Check connection based on selected channel
    if (channel === 'meta_cloud') {
      const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
      const waba = await WhatsAppBusinessAccount.findOne({
        workspaceId: req.workspaceId || req.user.workspaceId,
        status: 'CONNECTED',
      });
      if (!waba) {
        return res.status(400).json({
          message: 'No official Meta WhatsApp Business Account connected for this workspace.',
        });
      }
    } else {
      // Baileys phone connection
      const waStatus = waSession.getStatus(req.user._id);
      if (waStatus.status !== 'connected') {
        return res.status(400).json({
          message: 'WhatsApp phone is not linked. Please connect WhatsApp before starting a campaign.',
        });
      }
    }

    const group = await Group.findOne({ _id: groupId, userId: req.user._id }).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Resolve lead count
    let totalLeads;
    if (group.type === 'tag_based' && group.tags.length > 0) {
      totalLeads = await Lead.countDocuments({
        userId: req.user._id,
        tags: { $in: group.tags },
        status: { $ne: 'closed' },
      });
    } else {
      totalLeads = await Lead.countDocuments({
        _id: { $in: group.leadIds },
        userId: req.user._id,
      });
    }

    if (totalLeads === 0) {
      return res.status(400).json({ message: 'No leads found in this group.' });
    }

    // Enforce recipient limit per campaign
    const maxRecipients = limits.maxRecipientsPerCampaign || 500;
    if (totalLeads > maxRecipients) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: `Your ${plan} plan allows max ${maxRecipients} recipients per campaign. This group has ${totalLeads} leads.`,
      });
    }

    // Enforce concurrent campaign limit
    const activeCount = await Campaign.countDocuments({
      userId: req.user._id,
      status: { $in: ['queued', 'running'] },
    });
    const maxConcurrent = limits.maxConcurrentCampaigns || 3;
    if (activeCount >= maxConcurrent) {
      return res.status(403).json({
        code: 'PLAN_LIMIT',
        message: `Your ${plan} plan allows max ${maxConcurrent} concurrent campaign(s). Please pause or wait for existing campaigns to finish.`,
      });
    }

    const campaign = await Campaign.create({
      userId: req.user._id,
      workspaceId: req.workspaceId || req.user.workspaceId,
      groupId,
      name: name.trim(),
      campaignName: name.trim(),
      platform: 'broadcast',
      template: (template || templateName || '').trim(),
      templateName: (templateName || '').trim(),
      languageCode: languageCode || 'en',
      channel: channel || 'baileys',
      totalLeads,
      status: 'queued',
      lastSentIndex: -1,
    });

    res.status(201).json(campaign);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  List campaigns
// @route GET /api/campaigns
// @access Private
exports.getCampaigns = async (req, res) => {
  try {
    if (req.query.type !== 'broadcast') {
      const inbound = require('./inboundCampaignController');
      return inbound.getInboundCampaigns(req, res);
    }
    const campaigns = await Campaign.find({ userId: req.user._id, platform: 'broadcast' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get single campaign with progress
// @route GET /api/campaigns/:id
// @access Private
exports.getCampaign = async (req, res) => {
  try {
    const inbound = require('./inboundCampaignController');
    const tenantFilter = inbound.getTenantFilter(req);

    // Prevent IDOR by strictly enforcing tenant boundary
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      ...tenantFilter,
    })
      .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
      .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
      .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
      .populate('integrationId', 'accountName provider pageName sheetsConfig')
      .lean();

    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // If inbound marketing campaign, return full metrics and attribution details
    if (campaign.platform !== 'broadcast') {
      return inbound.getCampaignDetails(req, res);
    }

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Pause a running/queued campaign
// @route POST /api/campaigns/:id/pause
// @access Private
exports.pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: { $in: ['queued', 'running'] },
      },
      { status: 'paused', pausedAt: new Date() },
      { new: true }
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or already paused/completed' });
    }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Resume a paused campaign
// @route POST /api/campaigns/:id/resume
// @access Private
exports.resumeCampaign = async (req, res) => {
  try {
    const campaignToResume = await Campaign.findOne({ _id: req.params.id, userId: req.user._id, status: 'paused' });
    if (!campaignToResume) {
      return res.status(404).json({ message: 'Campaign not found or not in paused state' });
    }

    if (campaignToResume.channel === 'meta_cloud') {
      const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
      const waba = await WhatsAppBusinessAccount.findOne({
        workspaceId: req.workspaceId || req.user.workspaceId,
        status: 'CONNECTED',
      });
      if (!waba) {
        return res.status(400).json({
          message: 'No official Meta WhatsApp Business Account connected for this workspace.',
        });
      }
    } else {
      const waStatus = waSession.getStatus(req.user._id);
      if (waStatus.status !== 'connected') {
        return res.status(400).json({
          message: 'WhatsApp is not connected. Please reconnect before resuming.',
        });
      }
    }

    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: 'paused' },
      { status: 'queued' },
      { new: true }
    );
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Cancel a broadcast campaign or delete an inbound marketing campaign
// @route DELETE /api/campaigns/:id
// @access Private
exports.cancelCampaign = async (req, res) => {
  try {
    const inbound = require('./inboundCampaignController');
    const tenantFilter = inbound.getTenantFilter(req);

    const existing = await Campaign.findOne({ _id: req.params.id, ...tenantFilter });
    if (!existing) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Inbound marketing campaigns use inbound deletion
    if (existing.platform !== 'broadcast') {
      return inbound.deleteCampaign(req, res);
    }

    // Broadcast campaigns are cancelled
    const campaign = await Campaign.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        status: { $in: ['queued', 'running', 'paused'] },
      },
      { status: 'cancelled' },
      { new: true }
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or already completed/cancelled' });
    }
    res.json({ message: 'Campaign cancelled', campaign });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get campaign delivery logs
// @route GET /api/campaigns/:id/logs
// @access Private
exports.getCampaignLogs = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const { limit = 100, page = 1 } = req.query;
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 100));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const logs = await CampaignLog.find({ campaignId: req.params.id })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await CampaignLog.countDocuments({ campaignId: req.params.id });

    res.json({ logs, total, page: parsedPage, pages: Math.ceil(total / parsedLimit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
