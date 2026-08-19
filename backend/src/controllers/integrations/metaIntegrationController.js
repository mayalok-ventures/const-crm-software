const axios = require('axios');
const mongoose = require('mongoose');
const Integration = require('../../models/Integration');
const Lead = require('../../models/Lead');
const leadIngestionService = require('../../services/integrations/leadIngestionService');
const { decrypt } = require('../../utils/encryption');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

function getTenantQuery(user) {
  const isOwner = user?.workStatus === 'company_owner' || user?.companyRole === 'owner';
  const companyId = user?.companyId || (isOwner ? user._id : null);
  if (companyId) {
    return { companyId };
  }
  return { userId: user._id, companyId: null };
}

/**
 * GET /api/integrations/meta
 */
exports.getIntegrations = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integrations = await Integration.find({
      ...tenantQuery,
      provider: 'meta',
      status: { $ne: 'disconnected' },
    })
      .select('-accessTokenEncrypted -refreshTokenEncrypted')
      .lean();

    return res.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('Get Meta integrations error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get Meta integrations',
    });
  }
};

/**
 * GET /api/integrations/meta/assets
 */
exports.getAssets = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: req.query.integrationId,
      ...tenantQuery,
      provider: 'meta',
      status: 'connected',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found or disconnected',
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

    // Fetch Pages
    const pagesResponse = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`,
      {
        params: {
          fields: 'id,name,access_token,tasks',
          access_token: accessToken,
        },
      }
    );

    const pages = pagesResponse.data.data || [];
    const assets = [];

    for (const page of pages) {
      let forms = [];
      try {
        const formsResponse = await axios.get(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}/leadgen_forms`,
          {
            params: {
              fields: 'id,name,status,leads_count',
              access_token: page.access_token || accessToken,
            },
          }
        );
        forms = formsResponse.data.data || [];
      } catch (e) {
        console.warn(`Forms fetch error for page ${page.id}:`, e.message);
      }

      assets.push({
        pageId: page.id,
        pageName: page.name,
        forms: forms.map((f) => ({
          formId: f.id,
          formName: f.name,
          status: f.status,
          leadsCount: f.leads_count,
        })),
      });
    }

    return res.json({
      success: true,
      data: assets,
    });
  } catch (error) {
    console.error('Meta getAssets error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve Meta assets',
    });
  }
};

/**
 * POST /api/integrations/meta/configure
 */
exports.configure = async (req, res) => {
  try {
    const { integrationId, pageId, pageName, formIds = [] } = req.body;
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: integrationId,
      ...tenantQuery,
      provider: 'meta',
      status: 'connected',
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found',
      });
    }

    integration.pageId = pageId;
    integration.pageName = pageName || '';
    integration.formIds = formIds;
    integration.webhookSubscribed = true;
    integration.lastSyncAt = new Date();

    await integration.save();

    return res.json({
      success: true,
      message: 'Meta page and lead forms configured successfully',
      data: {
        id: integration._id,
        pageId: integration.pageId,
        pageName: integration.pageName,
        formIds: integration.formIds,
      },
    });
  } catch (error) {
    console.error('Meta configure error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to configure Meta integration',
    });
  }
};

/**
 * POST /api/integrations/meta/test
 */
exports.testConnection = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    // If simulating a test lead injection
    if (req.body.name || req.body.phone || req.body.formName || req.body.simulate) {
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
          provider: 'meta',
        });
      }

      if (!targetIntegration) {
        // Create an active mock integration for tests/simulations if none exists
        targetIntegration = await Integration.create({
          userId: req.user._id,
          companyId: req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null),
          provider: 'meta',
          mode: 'client_managed',
          status: 'connected',
          accountId: 'act_simulated_meta_123',
          accountName: 'Meta Ads Test Account',
          pageId: 'page_simulated_456',
          pageName: 'Company Facebook Page',
          connectedAt: new Date(),
        });
      }

      const result = await leadIngestionService.ingest({
        provider: 'meta',
        integrationId: targetIntegration._id,
        externalLeadId: `meta_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: req.body.name || 'Sarah Connor (Meta Test Lead)',
        phone: req.body.phone || '919876543210',
        email: req.body.email || 'sarah.connor@meta-ads-test.com',
        formName: req.body.formName || 'Instagram Instant Lead Form',
        campaignName: req.body.campaignName || 'Summer Enterprise Promo 2026',
        adSetName: req.body.adSetName || 'High Net Worth Retargeting',
        adName: req.body.adName || 'Video Ad 01',
      });

      return res.json({
        success: true,
        connected: true,
        message: 'Test Meta Lead injected into pipeline successfully!',
        lead: result.lead,
        created: result.created,
      });
    }

    // Live OAuth connection test
    const integration = await Integration.findOne({
      _id: req.body.integrationId,
      ...tenantQuery,
      provider: 'meta',
      status: 'connected',
    }).select('+accessTokenEncrypted');

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found or disconnected',
      });
    }

    const accessToken = integration.accessTokenEncrypted
      ? decrypt(integration.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        connected: false,
        message: 'Meta access token is missing or corrupted',
      });
    }

    const response = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      {
        params: {
          fields: 'id,name',
          access_token: accessToken,
        },
      }
    );

    return res.json({
      success: true,
      connected: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Meta test error:', error.response?.data || error.message);
    return res.status(401).json({
      success: false,
      connected: false,
      message: 'Meta connection is invalid or expired',
    });
  }
};

/**
 * DELETE /api/integrations/meta/:integrationId
 */
exports.disconnect = async (req, res) => {
  try {
    const tenantQuery = getTenantQuery(req.user);

    const integration = await Integration.findOne({
      _id: req.params.integrationId,
      ...tenantQuery,
      provider: 'meta',
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Meta integration not found',
      });
    }

    integration.status = 'disconnected';
    integration.accessTokenEncrypted = null;
    integration.refreshTokenEncrypted = null;
    integration.webhookSubscribed = false;
    integration.lastError = 'Disconnected by user';

    await integration.save();

    return res.json({
      success: true,
      message: 'Meta integration disconnected successfully',
    });
  } catch (error) {
    console.error('Meta disconnect error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect Meta integration',
    });
  }
};