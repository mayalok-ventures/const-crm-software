const mongoose = require('mongoose');
const crypto = require('crypto');
const Integration = require('../models/Integration');
const WebhookEvent = require('../models/WebhookEvent');
const Lead = require('../models/Lead');
const webhookQueueService = require('../services/integrations/webhookQueueService');
const { getAppsScriptCode } = require('./integrations/sheetsWebhookController');
const { getEmbedSnippet } = require('./integrations/websiteFormController');
const { encrypt } = require('../utils/encryption');

function getPublicBackendUrl(req) {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/+$/, '');
  const host = req?.get ? req.get('host') : (req?.headers?.host || 'localhost:5000');
  const proto = req?.secure || (req?.get && req.get('x-forwarded-proto') === 'https') ? 'https' : 'http';
  return `${proto}://${host}`;
}

function getTenantFilter(user) {
  if (!user) return { _id: null };
  if (user.role === 'superadmin' || user.isAdmin) {
    return {};
  }
  const companyId = user.companyId || (user.companyRole === 'owner' || user.workStatus === 'company_owner' ? user._id : null);
  if (companyId) {
    return { companyId };
  }
  return { userId: user._id, companyId: null };
}

function sanitizeIntegration(integration) {
  if (!integration) return null;
  const obj = typeof integration.toObject === 'function' ? integration.toObject() : { ...integration };
  delete obj.accessTokenEncrypted;
  delete obj.refreshTokenEncrypted;
  delete obj.encryptedCredentials;
  delete obj.inboundSecretEncrypted;
  delete obj.googleKeyHash;
  delete obj.sheetsSecretHash;
  return obj;
}

/**
 * GET /api/integrations
 * List all active/configured integrations for the tenant with health metrics
 */
exports.getIntegrations = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);

    const integrations = await Integration.find({
      ...filter,
      status: { $ne: 'disconnected' },
    })
      .select('-accessTokenEncrypted -refreshTokenEncrypted -encryptedCredentials -googleKeyHash -sheetsSecretHash')
      .sort({ createdAt: -1 })
      .lean();

    // Attach real-time lead counts and last lead timestamps
    const enriched = await Promise.all(
      integrations.map(async (intDoc) => {
        const leadCount = await Lead.countDocuments({
          'leadSource.integrationId': intDoc._id,
        });
        const lastLead = await Lead.findOne({
          'leadSource.integrationId': intDoc._id,
        })
          .sort({ createdAt: -1 })
          .select('createdAt');

        return {
          ...intDoc,
          totalLeadsCaptured: leadCount,
          lastLeadReceivedAt: lastLead ? lastLead.createdAt : null,
        };
      })
    );

    return res.json({
      success: true,
      integrations: enriched,
    });
  } catch (error) {
    console.error('[Integration] getIntegrations:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch integrations' });
  }
};

/**
 * GET /api/integrations/:id
 * Get single integration details with field mappings & assignment configuration
 */
exports.getIntegration = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOne({
      _id: req.params.id,
      ...filter,
    }).lean();

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    return res.json({
      success: true,
      integration: sanitizeIntegration(integration),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations
 * Create a new integration (Google, Meta, Sheets, Website Form)
 */
exports.createIntegration = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);
    const userId = req.user._id;

    const {
      provider,
      accountName = '',
      pageId = null,
      pageName = '',
      formIds = [],
      sheetsConfig = {},
      websiteFormConfig = {},
      fieldMapping = [],
      assignmentRule = {},
      duplicatePolicy = 'create_inquiry',
      reInquiryAssignmentPolicy = 'keep_existing_owner',
      defaultCampaignLabel = '',
      metadata = {},
    } = req.body;

    if (!['meta', 'google', 'sheets', 'website', 'custom'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Unsupported provider' });
    }

    let plaintextSecretOnce = null;
    let googleKeyHash = null;
    let googleKeyPrefix = '';
    let sheetsSecretHash = null;
    let sheetsSecretPrefix = '';

    // Provider-specific credentials initialization
    if (provider === 'google') {
      plaintextSecretOnce = `gads_sec_${crypto.randomBytes(24).toString('hex')}`;
      googleKeyHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
      googleKeyPrefix = plaintextSecretOnce.substring(0, 12) + '...';
    } else if (provider === 'sheets') {
      plaintextSecretOnce = `gsht_sec_${crypto.randomBytes(24).toString('hex')}`;
      sheetsSecretHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
      sheetsSecretPrefix = plaintextSecretOnce.substring(0, 12) + '...';
    } else if (provider === 'custom') {
      plaintextSecretOnce = `cwh_sec_${crypto.randomBytes(24).toString('hex')}`;
      sheetsSecretHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
      sheetsSecretPrefix = plaintextSecretOnce.substring(0, 12) + '...';
    }

    const newDoc = new Integration({
      userId,
      companyId,
      provider,
      status: 'connected',
      accountName: accountName || `${provider.toUpperCase()} Integration`,
      pageId,
      pageName,
      formIds,
      googleKeyHash,
      googleKeyPrefix,
      sheetsSecretHash,
      sheetsSecretPrefix,
      inboundSecret: (provider === 'sheets' || provider === 'custom' || provider === 'google') ? plaintextSecretOnce : null,
      sheetsConfig: {
        sheetId: sheetsConfig.sheetId || null,
        sheetName: sheetsConfig.sheetName || 'Sheet1',
        trackingColumnName: 'CRM_LEAD_ID',
      },
      websiteFormConfig: {
        formKey: provider === 'website' ? `form_${crypto.randomBytes(16).toString('hex')}` : null,
        allowedOrigins: Array.isArray(websiteFormConfig.allowedOrigins) ? websiteFormConfig.allowedOrigins.filter(Boolean) : [],
        honeypotField: '_crm_hp_trap',
      },
      metadata: {
        defaultCampaignLabel: defaultCampaignLabel || accountName || 'General Inbound Campaign',
        ...metadata,
      },
      fieldMapping,
      assignmentRule,
      duplicatePolicy,
      reInquiryAssignmentPolicy,
    });

    await newDoc.save();

    return res.status(201).json({
      success: true,
      integration: sanitizeIntegration(newDoc),
      plaintextSecretOnce, // Returned ONCE upon creation so user can copy into Google Ads or Apps Script
    });
  } catch (error) {
    console.error('[Integration] createIntegration:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/integrations/:id
 * Update configuration, assignment rules, or field mappings
 */
exports.updateIntegration = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOne({
      _id: req.params.id,
      ...filter,
    });

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const {
      accountName,
      status,
      formIds,
      fieldMapping,
      assignmentRule,
      duplicatePolicy,
      reInquiryAssignmentPolicy,
      campaignOverrides,
      sheetsConfig,
      websiteFormConfig,
    } = req.body;

    if (accountName !== undefined) integration.accountName = accountName;
    if (status !== undefined) integration.status = status;
    if (formIds !== undefined) integration.formIds = formIds;
    if (fieldMapping !== undefined) integration.fieldMapping = fieldMapping;
    if (assignmentRule !== undefined) integration.assignmentRule = assignmentRule;
    if (duplicatePolicy !== undefined) integration.duplicatePolicy = duplicatePolicy;
    if (reInquiryAssignmentPolicy !== undefined) integration.reInquiryAssignmentPolicy = reInquiryAssignmentPolicy;
    if (campaignOverrides !== undefined) integration.campaignOverrides = campaignOverrides;
    if (sheetsConfig !== undefined) integration.sheetsConfig = { ...(integration.sheetsConfig || {}), ...sheetsConfig };
    if (websiteFormConfig !== undefined) integration.websiteFormConfig = { ...(integration.websiteFormConfig || {}), ...websiteFormConfig };

    await integration.save();

    return res.json({
      success: true,
      message: 'Integration updated successfully',
      integration: sanitizeIntegration(integration),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/:id/regenerate-key
 * Revoke existing secret key and issue a new one
 */
exports.regenerateKey = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOne({
      _id: req.params.id,
      ...filter,
    });

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    let plaintextSecretOnce = null;
    if (integration.provider === 'google') {
      plaintextSecretOnce = `gads_sec_${crypto.randomBytes(24).toString('hex')}`;
      integration.inboundSecret = plaintextSecretOnce;
      integration.googleKeyHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
      integration.googleKeyPrefix = plaintextSecretOnce.substring(0, 12) + '...';
    } else if (integration.provider === 'sheets') {
      plaintextSecretOnce = `gsht_sec_${crypto.randomBytes(24).toString('hex')}`;
      integration.inboundSecret = plaintextSecretOnce;
      integration.sheetsSecretHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
      integration.sheetsSecretPrefix = plaintextSecretOnce.substring(0, 12) + '...';
    } else if (integration.provider === 'custom') {
      plaintextSecretOnce = `cwh_sec_${crypto.randomBytes(24).toString('hex')}`;
      integration.inboundSecret = plaintextSecretOnce;
      integration.sheetsSecretHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
      integration.sheetsSecretPrefix = plaintextSecretOnce.substring(0, 12) + '...';
    } else if (integration.provider === 'website') {
      integration.websiteFormConfig.formKey = `form_${crypto.randomBytes(16).toString('hex')}`;
      plaintextSecretOnce = integration.websiteFormConfig.formKey;
    }

    await integration.save();

    return res.json({
      success: true,
      message: 'Key successfully regenerated. Please update your external form or sheet.',
      plaintextSecretOnce, // Shown once
      integration: sanitizeIntegration(integration),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/integrations/:id/snippet
 * Get Apps Script code, Website Embed HTML code, or Custom Webhook instructions
 */
exports.getSnippet = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOne({
      _id: req.params.id,
      ...filter,
    }).select('+inboundSecretEncrypted');

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const backendUrl = getPublicBackendUrl(req);

    if (integration.provider === 'sheets') {
      const code = getAppsScriptCode(integration, integration.inboundSecret);
      return res.json({ success: true, snippet: code, type: 'google_apps_script' });
    } else if (integration.provider === 'website') {
      const formKey = integration.websiteFormConfig?.formKey;
      const code = getEmbedSnippet(formKey);
      return res.json({ success: true, snippet: code, type: 'html_form' });
    } else if (integration.provider === 'google') {
      const webhookUrl = `${backendUrl}/api/integrations/google/webhook`;
      const secretSnippet = integration.inboundSecret || '<REGENERATE_KEY_TO_VIEW>';
      const code = `// Google Ads Lead Form Webhook Configuration:
// ─────────────────────────────────────────────────────────────
// 1. In Google Ads, navigate to:
//    Campaigns > Assets > Lead form asset
// 2. Expand "Lead delivery options" and select "Manage your leads with a webhook"
// 3. Paste the following values:

Webhook URL:
${webhookUrl}

Key:
${secretSnippet}

// 4. Click "Send test data" in Google Ads.
//    CRM will automatically verify and update the connection status to Connected.`;
      return res.json({
        success: true,
        snippet: code,
        webhookUrl,
        key: secretSnippet,
        type: 'google_ads',
      });
    } else if (integration.provider === 'custom') {
      const webhookUrl = `${backendUrl}/api/integrations/custom/webhook/${integration._id}`;
      const secretSnippet = integration.inboundSecret || '<YOUR_SECRET_KEY>';
      const code = `// Custom Inbound Webhook Endpoint:
POST ${webhookUrl}
Headers:
  Content-Type: application/json
  x-crm-secret: ${secretSnippet}

Sample JSON Payload:
{
  "name": "Applicant Name",
  "phone": "+919876543210",
  "email": "applicant@example.com",
  "city": "Mumbai",
  "course": "B.Tech Computer Science",
  "campaign": "${integration.metadata?.defaultCampaignLabel || 'Custom Inbound'}",
  "notes": "Direct inquiry"
}`;
      return res.json({ success: true, snippet: code, webhookUrl, type: 'custom_webhook' });
    }

    return res.status(400).json({ success: false, message: 'No snippet available for this provider' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/integrations/:id
 * Disconnect an integration
 */
exports.disconnectIntegration = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOneAndUpdate(
      { _id: req.params.id, ...filter },
      {
        $set: {
          status: 'disconnected',
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          inboundSecretEncrypted: null,
          sheetsSecretHash: null,
          googleKeyHash: null,
          lastError: 'Disconnected by admin',
        },
      },
      { new: true }
    );

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    return res.json({ success: true, message: 'Integration disconnected' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/integrations/events
 * Paginated audit log of inbound WebhookEvent items
 */
exports.getWebhookEvents = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const { provider, status, page = 1, limit = 20 } = req.query;

    const query = { ...filter };
    if (provider) query.provider = provider;
    if (status) query.status = status;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [events, total] = await Promise.all([
      WebhookEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('integrationId', 'accountName provider pageName')
        .populate('processedLeadId', 'name phone email status')
        .lean(),
      WebhookEvent.countDocuments(query),
    ]);

    return res.json({
      success: true,
      events,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/events/:id/retry
 * Re-drive a failed or dead-letter webhook event
 */
exports.retryWebhookEvent = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const event = await WebhookEvent.findOne({
      _id: req.params.id,
      ...filter,
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    await webhookQueueService.retryEvent(event._id);

    return res.json({
      success: true,
      message: 'Event re-queued for immediate execution',
      eventId: event._id,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/integrations/:id/sheets-status
 * Per-sheet real-time status screen metrics: last sync time, rows synced, rows pending/failed with reasons
 */
exports.getSheetStatus = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const integration = await Integration.findOne({
      _id: req.params.id,
      ...filter,
    }).lean();

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const [totalSynced, totalNeedsReview, pendingCount, failedEvents] = await Promise.all([
      Lead.countDocuments({
        'leadSource.integrationId': integration._id,
        status: { $ne: 'needs_review' },
      }),
      Lead.countDocuments({
        'leadSource.integrationId': integration._id,
        status: 'needs_review',
      }),
      WebhookEvent.countDocuments({
        integrationId: integration._id,
        status: { $in: ['pending', 'processing'] },
      }),
      WebhookEvent.find({
        integrationId: integration._id,
        status: { $in: ['failed', 'dead_letter'] },
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('externalLeadId lastError status attempts createdAt updatedAt')
        .lean(),
    ]);

    return res.json({
      success: true,
      status: {
        integrationId: integration._id,
        sheetName: integration.sheetsConfig?.sheetName || integration.accountName || 'Google Sheet',
        lastSyncAt: integration.lastSyncAt,
        lastError: integration.lastError || (failedEvents.length > 0 ? failedEvents[0].lastError?.message : null),
        totalSynced,
        totalNeedsReview,
        pendingCount,
        failedCount: failedEvents.length,
        recentFailures: failedEvents.map((e) => ({
          leadId: e.externalLeadId,
          error: e.lastError?.message || 'Processing failed',
          attempts: e.attempts,
          timestamp: e.updatedAt || e.createdAt,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/integrations/reports/campaigns
 * Sources / Campaign report: counts per platform and per campaign
 * (received, assigned, unassigned, needs_review, converted), with date range filter
 */
exports.getSourcesReport = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);
    const { startDate, endDate } = req.query;

    const matchQuery = { ...filter };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const CONVERTED_STATUSES = ['closed', 'won', 'payment_done', 'enrolled', 'deal_closed', 'deal_won'];

    const leads = await Lead.find(matchQuery)
      .select('source leadSource status assignedTo createdAt')
      .lean();

    // Aggregates by Platform
    const platformMap = {};
    // Aggregates by Campaign
    const campaignMap = {};

    for (const lead of leads) {
      const p = lead.leadSource?.platform || lead.source || 'manual';
      const cName = lead.leadSource?.campaignName || 'General Inbound Campaign';
      const isAssigned = Boolean(lead.assignedTo);
      const isNeedsReview = lead.status === 'needs_review';
      const isConverted = CONVERTED_STATUSES.includes(String(lead.status).toLowerCase());

      // Platform stats
      if (!platformMap[p]) {
        platformMap[p] = { platform: p, received: 0, assigned: 0, unassigned: 0, needs_review: 0, converted: 0 };
      }
      platformMap[p].received++;
      if (isAssigned) platformMap[p].assigned++;
      else platformMap[p].unassigned++;
      if (isNeedsReview) platformMap[p].needs_review++;
      if (isConverted) platformMap[p].converted++;

      // Campaign stats
      const cKey = `${p}___${cName}`;
      if (!campaignMap[cKey]) {
        campaignMap[cKey] = {
          platform: p,
          campaignName: cName,
          connectionName: lead.leadSource?.connectionName || 'Default Connection',
          received: 0,
          assigned: 0,
          unassigned: 0,
          needs_review: 0,
          converted: 0,
        };
      }
      campaignMap[cKey].received++;
      if (isAssigned) campaignMap[cKey].assigned++;
      else campaignMap[cKey].unassigned++;
      if (isNeedsReview) campaignMap[cKey].needs_review++;
      if (isConverted) campaignMap[cKey].converted++;
    }

    const platformBreakdown = Object.values(platformMap).map((item) => ({
      ...item,
      conversionRate: item.received > 0 ? Number(((item.converted / item.received) * 100).toFixed(1)) : 0,
    }));

    const campaignBreakdown = Object.values(campaignMap).map((item) => ({
      ...item,
      conversionRate: item.received > 0 ? Number(((item.converted / item.received) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.received - a.received);

    const totals = {
      received: leads.length,
      assigned: leads.filter((l) => Boolean(l.assignedTo)).length,
      unassigned: leads.filter((l) => !l.assignedTo).length,
      needs_review: leads.filter((l) => l.status === 'needs_review').length,
      converted: leads.filter((l) => CONVERTED_STATUSES.includes(String(l.status).toLowerCase())).length,
    };
    totals.conversionRate = totals.received > 0 ? Number(((totals.converted / totals.received) * 100).toFixed(1)) : 0;

    return res.json({
      success: true,
      totals,
      platforms: platformBreakdown,
      campaigns: campaignBreakdown,
    });
  } catch (error) {
    console.error('getSourcesReport error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};