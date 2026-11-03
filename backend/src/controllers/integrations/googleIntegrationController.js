const axios = require('axios');
const mongoose = require('mongoose');
const Integration = require('../../models/Integration');
const leadIngestionService = require('../../services/integrations/leadIngestionService');
const crypto = require('crypto');
const Campaign = require('../../models/Campaign');
const LeadSourceSubscription = require('../../models/LeadSourceSubscription');
const { decrypt } = require('../../utils/encryption');
const { notifyIntegrationDisconnected } = require('../../utils/integrationNotifier');

function getPublicWebhookUrl(req) {
  if (process.env.BACKEND_URL) return `${process.env.BACKEND_URL.replace(/\/+$/, '')}/api/integrations/google/webhook`;
  const host = req?.get ? req.get('host') : (req?.headers?.host || 'localhost:5000');
  const proto = req?.secure || (req?.get && req.get('x-forwarded-proto') === 'https') ? 'https' : 'http';
  return `${proto}://${host}/api/integrations/google/webhook`;
}

function getTenantQuery(user) {
  const isOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
  const companyId = user?.companyId || (isOwner ? user._id : null);
  if (companyId) {
    return { companyId };
  }
  return { userId: user._id, companyId: null };
}

/**
 * GET /api/integrations/google
 */
exports.getIntegrations = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integrations = await Integration.find({
      ...tenantQuery,
      provider: 'google',
      status: { $ne: 'disconnected' },
    })
      .select('-accessTokenEncrypted -refreshTokenEncrypted')
      .lean();

    return res.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('Get Google integrations error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get Google integrations',
    });
  }
};

/**
 * POST /api/integrations/google/generate-webhook
 * Generates unique webhook URL and secret key for Google Ads Lead Form asset configuration.
 */
exports.generateWebhook = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);
    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);
    const userId = req.user._id;

    let integration = await Integration.findOne({
      ...tenantQuery,
      provider: 'google',
      status: { $ne: 'disconnected' },
    }).select('+inboundSecretEncrypted +googleKeyHash');

    let plaintextSecretOnce = null;

    if (!integration) {
      plaintextSecretOnce = `gads_sec_${crypto.randomBytes(24).toString('hex')}`;
      const googleKeyHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
      const googleKeyPrefix = plaintextSecretOnce.substring(0, 12) + '...';

      integration = new Integration({
        userId,
        companyId,
        provider: 'google',
        status: 'awaiting_test_lead',
        accountName: req.body.accountName || 'Google Ads Lead Forms',
        googleKeyHash,
        googleKeyPrefix,
        inboundSecret: plaintextSecretOnce,
        metadata: {
          defaultCampaignLabel: req.body.defaultCampaignLabel || 'Google Search Leads',
        },
      });
      await integration.save();
    } else {
      plaintextSecretOnce = integration.inboundSecret;
      if (!plaintextSecretOnce || req.body.regenerate) {
        plaintextSecretOnce = `gads_sec_${crypto.randomBytes(24).toString('hex')}`;
        integration.inboundSecret = plaintextSecretOnce;
        integration.googleKeyHash = crypto.createHash('sha256').update(plaintextSecretOnce).digest('hex');
        integration.googleKeyPrefix = plaintextSecretOnce.substring(0, 12) + '...';
        await integration.save();
      }
    }

    const webhookUrl = getPublicWebhookUrl(req);

    return res.json({
      success: true,
      integration,
      webhookUrl,
      webhookKey: plaintextSecretOnce,
    });
  } catch (error) {
    console.error('generateWebhook error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to generate webhook credentials' });
  }
};

/**
 * POST /api/integrations/google/complete-mapping
 * Saves mapped fields, links designated campaign, and officially connects the integration.
 */
exports.completeMapping = async (req, res) => {
  try {
    const { integrationId, campaignId, campaignName, fieldMapping = [] } = req.body;
    const tenantQuery = getTenantQuery(req.user);

    let integration = null;
    if (integrationId && mongoose.Types.ObjectId.isValid(integrationId)) {
      integration = await Integration.findOne({
        _id: integrationId,
        ...tenantQuery,
        provider: 'google',
      });
    }

    if (!integration) {
      integration = await Integration.findOne({
        ...tenantQuery,
        provider: 'google',
        status: { $ne: 'disconnected' },
      });
    }

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Google Ads integration not found' });
    }

    integration.fieldMapping = fieldMapping;
    integration.status = 'connected';
    integration.connectedAt = new Date();
    integration.metadata = {
      ...(integration.metadata || {}),
      targetCampaignId: campaignId || integration.metadata?.targetCampaignId,
      defaultCampaignLabel: campaignName || integration.metadata?.defaultCampaignLabel || 'Google Search Leads',
    };

    await integration.save();

    // Link with Campaign and LeadSourceSubscription
    if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
      await Campaign.updateOne(
        { _id: campaignId },
        {
          $addToSet: { 'routingRules.googleAccountIds': String(integration._id) },
        }
      ).catch(() => null);

      await LeadSourceSubscription.findOneAndUpdate(
        {
          integrationId: integration._id,
          provider: 'google',
          externalFormId: String(integration._id),
        },
        {
          workspaceId: req.workspaceId || req.user.workspaceId,
          companyId: req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null),
          userId: req.user._id,
          integrationId: integration._id,
          provider: 'google',
          sourceName: `Google Ads - ${campaignName || 'Lead Forms'}`,
          externalAccountId: String(integration._id),
          externalAccountName: integration.accountName || 'Google Ads Account',
          externalFormId: String(integration._id),
          externalFormName: 'Google Ads Lead Form Asset',
          campaignGroupId: campaignId,
          fieldMapping,
          status: 'active',
        },
        { upsert: true, new: true }
      ).catch((e) => console.warn('[Google] Subscription upsert notice:', e.message));
    }

    return res.json({
      success: true,
      message: 'Google Ads integration successfully connected!',
      data: integration,
    });
  } catch (error) {
    console.error('Google completeMapping error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to complete field mapping and connect' });
  }
};

/**
 * GET /api/integrations/google/accounts
 */
exports.getAccounts = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: req.query.integrationId,
      ...tenantQuery,
      provider: 'google',
      status: 'connected',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Google integration not found or disconnected',
      });
    }

    const accessToken = integration.accessTokenEncrypted
      ? decrypt(integration.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return res.json({
        success: true,
        data: [],
        message: 'No active access token stored',
      });
    }

    const response = await axios.get(
      'https://googleads.googleapis.com/v24/customers:listAccessibleCustomers',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'mock_dev_token',
        },
        timeout: 15000,
      }
    );

    return res.json({
      success: true,
      data: response.data?.resourceNames || [],
    });
  } catch (error) {
    console.error('Google getAccounts error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve Google Ads accounts',
    });
  }
};

/**
 * POST /api/integrations/google/configure
 */
exports.configure = async (req, res) => {
  try {
    const { integrationId, accountId, accountName, managerCustomerId } = req.body;
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: integrationId,
      ...tenantQuery,
      provider: 'google',
      status: 'connected',
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Google integration not found',
      });
    }

    integration.accountId = String(accountId).replace(/\D/g, '');
    integration.customerId = String(accountId).replace(/\D/g, '');
    integration.accountName = accountName || '';
    integration.managerCustomerId = managerCustomerId || null;
    integration.webhookSubscribed = true;
    integration.lastSyncAt = new Date();

    await integration.save();

    return res.json({
      success: true,
      message: 'Google Ads customer account configured successfully',
      data: {
        id: integration._id,
        accountId: integration.accountId,
        accountName: integration.accountName,
      },
    });
  } catch (error) {
    console.error('Google configure error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to configure Google Ads integration',
    });
  }
};

/**
 * POST /api/integrations/google/test
 */
exports.testConnection = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    // If simulating a test lead injection
    if (req.body.name || req.body.phone || req.body.campaignName || req.body.simulate) {
      let targetIntegration = null;
      if (req.body.integrationId && mongoose.Types.ObjectId.isValid(req.body.integrationId)) {
        targetIntegration = await Integration.findOne({
          _id: req.body.integrationId,
          ...tenantQuery,
        });
      }

      if (!targetIntegration) {
        targetIntegration = await Integration.findOne({
          ...tenantQuery,
          provider: 'google',
        });
      }

      if (!targetIntegration) {
        return res.status(404).json({
          success: false,
          connected: false,
          message: 'No active Google Ads integration found. Please configure Google Ads first.',
        });
      }

      const result = await leadIngestionService.ingest({
        provider: 'google',
        integrationId: targetIntegration._id,
        externalLeadId: `google_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: req.body.name || 'Alex Mercer (Google Test Lead)',
        phone: req.body.phone || '919812345678',
        email: req.body.email || 'alex.mercer@google-ads-test.com',
        formName: req.body.formName || 'Google Search Extension Form',
        campaignName: req.body.campaignName || 'Google Search High-Intent 2026',
        adGroupName: req.body.adGroupName || 'Enterprise Software Keywords',
        adName: req.body.adName || 'Ad Variation A',
      });

      targetIntegration.metadata = {
        ...(targetIntegration.metadata || {}),
        lastTestReceivedAt: new Date(),
        sampleFields: targetIntegration.metadata?.sampleFields?.length ? targetIntegration.metadata.sampleFields : [
          { key: 'FULL_NAME', label: 'Full Name', sampleValue: req.body.name || 'Alex Mercer' },
          { key: 'PHONE_NUMBER', label: 'Phone Number', sampleValue: req.body.phone || '919812345678' },
          { key: 'EMAIL', label: 'Email', sampleValue: req.body.email || 'alex.mercer@google-ads-test.com' },
          { key: 'COURSE', label: 'Target Course', sampleValue: req.body.course || 'B.Tech Computer Science' },
          { key: 'CITY', label: 'City', sampleValue: req.body.city || 'Mumbai' },
        ],
      };
      if (targetIntegration.status === 'awaiting_test_lead' || targetIntegration.status === 'pending') {
        targetIntegration.status = 'needs_mapping';
      }
      await targetIntegration.save();

      return res.json({
        success: true,
        connected: true,
        status: targetIntegration.status,
        sampleFields: targetIntegration.metadata?.sampleFields || [],
        integration: targetIntegration,
        message: 'Test Google Lead injected into pipeline successfully!',
        lead: result.lead,
        created: result.created,
      });
    }

    // Live OAuth connection test
    const integration = await Integration.findOne({
      _id: req.body.integrationId,
      ...tenantQuery,
      provider: 'google',
      status: 'connected',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Google integration not found or disconnected',
      });
    }

    const accessToken = integration.accessTokenEncrypted
      ? decrypt(integration.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        connected: false,
        message: 'Google Ads access token missing or corrupted',
      });
    }

    const response = await axios.get(
      'https://googleads.googleapis.com/v24/customers:listAccessibleCustomers',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'mock_token',
        },
      }
    );

    return res.json({
      success: true,
      connected: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Google test error:', error.response?.data || error.message);
    return res.status(401).json({
      success: false,
      connected: false,
      message: 'Google Ads connection failed',
    });
  }
};

/**
 * DELETE /api/integrations/google/:integrationId
 */
exports.disconnect = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: req.params.integrationId,
      ...tenantQuery,
      provider: 'google',
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Google integration not found',
      });
    }

    integration.status = 'disconnected';
    integration.accessTokenEncrypted = null;
    integration.refreshTokenEncrypted = null;
    integration.webhookSubscribed = false;
    integration.lastError = 'Disconnected by user';

    await notifyIntegrationDisconnected({
      userId: integration.userId,
      companyId: integration.companyId,
      provider: 'google',
      integrationName: integration.accountName || 'Google Ads Lead Forms',
      reason: req.body?.reason || `Explicitly disconnected by ${req.user.name || req.user.email || 'user'}`,
    });

    await integration.save();

    return res.json({
      success: true,
      message: 'Google integration disconnected successfully',
    });
  } catch (error) {
    console.error('Google disconnect error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect Google integration',
    });
  }
};