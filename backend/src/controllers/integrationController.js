const mongoose = require('mongoose');
const Integration = require('../models/Integration');
const Lead = require('../models/Lead');
const { encrypt } = require('../utils/encryption');

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getCompanyId(user) {
  if (!user) return null;
  const isOwner =
    user.workStatus === 'company_owner' ||
    user.companyRole === 'owner';

  return user.companyId || (isOwner ? user._id : user._id);
}

function isCompanyOwner(user) {
  return (
    user?.workStatus === 'company_owner' ||
    user?.companyRole === 'owner' ||
    user?.role === 'superadmin' ||
    !user?.companyId // Solo users manage their own integrations
  );
}

function requireOwner(req, res) {
  if (!isCompanyOwner(req.user)) {
    res.status(403).json({
      success: false,
      message: 'Only the company owner can manage integrations.',
      code: 'INTEGRATION_OWNER_REQUIRED',
    });
    return false;
  }
  return true;
}

function sanitizeIntegration(integration) {
  if (!integration) return null;

  const obj =
    typeof integration.toObject === 'function'
      ? integration.toObject()
      : { ...integration };

  delete obj.accessTokenEncrypted;
  delete obj.refreshTokenEncrypted;
  delete obj.encryptedAccessToken;
  delete obj.encryptedRefreshToken;
  delete obj.accessToken;
  delete obj.refreshToken;
  delete obj.clientSecret;

  return obj;
}

function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getTenantFilter(user) {
  const companyId = user.companyId || (user.companyRole === 'owner' || user.workStatus === 'company_owner' ? user._id : null);
  if (companyId) {
    return { companyId };
  }
  return { userId: user._id, companyId: null };
}

/**
 * ============================================================
 * GET ALL INTEGRATIONS
 * ============================================================
 * GET /api/integrations
 */
exports.getIntegrations = async (req, res) => {
  try {
    const filter = getTenantFilter(req.user);

    const integrations = await Integration.find({
      ...filter,
      status: { $ne: 'disconnected' },
    })
      .select('-accessTokenEncrypted -refreshTokenEncrypted -encryptedAccessToken -encryptedRefreshToken')
      .sort({ createdAt: -1 })
      .lean();

    // Query unique custom webhook/API sources from Leads collection
    const leadSources = await Lead.aggregate([
      {
        $match: {
          ...filter,
          source: {
            $nin: ['meta', 'google', 'facebook', 'instagram', 'manual', 'agent_manual', 'other', '']
          }
        }
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          lastIngestedAt: { $max: '$createdAt' }
        }
      }
    ]);

    const universalWebhooks = leadSources.map(s => ({
      name: s._id ? (String(s._id).charAt(0).toUpperCase() + String(s._id).slice(1)) : 'Custom API',
      count: s.count,
      lastIngestedAt: s.lastIngestedAt,
    }));

    return res.json({
      success: true,
      integrations: integrations.map(sanitizeIntegration),
      universalWebhooks,
    });
  } catch (error) {
    console.error('[Integration] getIntegrations:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch integrations.',
      code: 'INTEGRATIONS_FETCH_FAILED',
    });
  }
};

/**
 * ============================================================
 * GET SINGLE INTEGRATION
 * ============================================================
 * GET /api/integrations/:id
 */
exports.getIntegration = async (req, res) => {
  try {
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration ID.',
      });
    }

    const filter = getTenantFilter(req.user);

    const integration = await Integration.findOne({
      _id: req.params.id,
      ...filter,
    })
      .select('-accessTokenEncrypted -refreshTokenEncrypted -encryptedAccessToken -encryptedRefreshToken')
      .lean();

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found.',
        code: 'INTEGRATION_NOT_FOUND',
      });
    }

    return res.json({
      success: true,
      integration: sanitizeIntegration(integration),
    });
  } catch (error) {
    console.error('[Integration] getIntegration:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch integration.',
      code: 'INTEGRATION_FETCH_FAILED',
    });
  }
};

/**
 * ============================================================
 * CREATE INTEGRATION
 * ============================================================
 * POST /api/integrations
 */
exports.createIntegration = async (req, res) => {
  try {
    if (!requireOwner(req, res)) {
      return;
    }

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);

    const {
      provider,
      accountId,
      externalAccountId,
      accountName = '',
      externalAccountName = '',
      pageId = null,
      pageName = '',
      formIds = [],
      formId = null,
      customerId = null,
      managerCustomerId = null,
      accessToken,
      refreshToken = null,
      tokenExpiresAt = null,
      scopes = [],
      metadata = {},
    } = req.body;

    if (!['meta', 'google'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration provider. Supported: meta, google',
        code: 'INVALID_PROVIDER',
      });
    }

    const targetAccountId = accountId || externalAccountId;
    if (!targetAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Account ID is required.',
        code: 'ACCOUNT_ID_REQUIRED',
      });
    }

    const targetFormIds = formIds.length > 0 ? formIds : (formId ? [String(formId)] : []);
    const filter = companyId
      ? { companyId, provider, accountId: String(targetAccountId) }
      : { userId: req.user._id, provider, accountId: String(targetAccountId) };

    let existing = await Integration.findOne(filter);

    if (existing) {
      existing.status = 'connected';
      existing.accountName = accountName || externalAccountName || existing.accountName;
      if (accessToken) existing.accessTokenEncrypted = encrypt(accessToken);
      if (refreshToken) existing.refreshTokenEncrypted = encrypt(refreshToken);
      if (tokenExpiresAt) existing.tokenExpiresAt = new Date(tokenExpiresAt);
      existing.pageId = pageId || existing.pageId;
      existing.pageName = pageName || existing.pageName;
      existing.formIds = targetFormIds.length > 0 ? targetFormIds : existing.formIds;
      existing.customerId = customerId || existing.customerId;
      existing.managerCustomerId = managerCustomerId || existing.managerCustomerId;
      existing.scopes = scopes.length > 0 ? scopes : existing.scopes;
      existing.metadata = { ...(existing.metadata || {}), ...metadata };
      existing.lastError = '';

      await existing.save();

      return res.status(200).json({
        success: true,
        message: 'Integration reconnected successfully.',
        integration: sanitizeIntegration(existing),
      });
    }

    const integration = await Integration.create({
      userId: req.user._id,
      companyId: companyId || null,
      provider,
      mode: 'client_managed',
      status: 'connected',
      accountId: String(targetAccountId),
      accountName: accountName || externalAccountName || '',
      pageId,
      pageName,
      formIds: targetFormIds,
      customerId,
      managerCustomerId,
      accessTokenEncrypted: accessToken ? encrypt(accessToken) : null,
      refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
      scopes,
      metadata,
      connectedAt: new Date(),
      lastError: '',
    });

    return res.status(201).json({
      success: true,
      message: 'Integration connected successfully.',
      integration: sanitizeIntegration(integration),
    });
  } catch (error) {
    console.error('[Integration] createIntegration:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create integration.',
      code: 'INTEGRATION_CREATE_FAILED',
    });
  }
};

/**
 * ============================================================
 * UPDATE INTEGRATION
 * ============================================================
 * PATCH /api/integrations/:id
 */
exports.updateIntegration = async (req, res) => {
  try {
    if (!requireOwner(req, res)) {
      return;
    }

    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration ID.',
      });
    }

    const filter = getTenantFilter(req.user);

    const integration = await Integration.findOne({
      _id: req.params.id,
      ...filter,
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found.',
        code: 'INTEGRATION_NOT_FOUND',
      });
    }

    const { pageId, pageName, formIds, accountName, status } = req.body;
    if (pageId !== undefined) integration.pageId = pageId;
    if (pageName !== undefined) integration.pageName = pageName;
    if (formIds !== undefined) integration.formIds = formIds;
    if (accountName !== undefined) integration.accountName = accountName;
    if (status !== undefined) integration.status = status;

    await integration.save();

    return res.json({
      success: true,
      message: 'Integration updated successfully.',
      integration: sanitizeIntegration(integration),
    });
  } catch (error) {
    console.error('[Integration] updateIntegration:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update integration.',
      code: 'INTEGRATION_UPDATE_FAILED',
    });
  }
};

/**
 * ============================================================
 * DISCONNECT INTEGRATION
 * ============================================================
 * DELETE /api/integrations/:id
 */
exports.deleteIntegration = async (req, res) => {
  try {
    if (!requireOwner(req, res)) {
      return;
    }

    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration ID.',
      });
    }

    const filter = getTenantFilter(req.user);

    const integration = await Integration.findOneAndUpdate(
      {
        _id: req.params.id,
        ...filter,
      },
      {
        $set: {
          status: 'disconnected',
          webhookSubscribed: false,
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          tokenExpiresAt: null,
          lastError: 'Disconnected by tenant owner',
        },
      },
      {
        new: true,
      }
    );

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found.',
        code: 'INTEGRATION_NOT_FOUND',
      });
    }

    return res.json({
      success: true,
      message: 'Integration disconnected successfully.',
      integrationId: integration._id,
    });
  } catch (error) {
    console.error('[Integration] deleteIntegration:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect integration.',
      code: 'INTEGRATION_DISCONNECT_FAILED',
    });
  }
};

exports.disconnectIntegration = exports.deleteIntegration;