const axios = require('axios');
const mongoose = require('mongoose');
const Integration = require('../../models/Integration');
const leadIngestionService = require('../../services/integrations/leadIngestionService');
const { decrypt } = require('../../utils/encryption');

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
        targetIntegration = await Integration.create({
          userId: req.user._id,
          companyId: req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null),
          provider: 'google',
          mode: 'client_managed',
          status: 'connected',
          accountId: '1234567890',
          accountName: 'Google Ads Test Customer Account',
          connectedAt: new Date(),
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

      return res.json({
        success: true,
        connected: true,
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