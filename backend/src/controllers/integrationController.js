const mongoose = require('mongoose');
const Integration = require('../models/Integration');
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

  return user.companyId || (isOwner ? user._id : null);
}

function isCompanyOwner(user) {
  return (
    user?.workStatus === 'company_owner' ||
    user?.companyRole === 'owner'
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

  delete obj.encryptedAccessToken;
  delete obj.encryptedRefreshToken;

  // Never expose sensitive OAuth information.
  delete obj.accessToken;
  delete obj.refreshToken;
  delete obj.clientSecret;

  return obj;
}

function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * ============================================================
 * GET ALL INTEGRATIONS
 * ============================================================
 *
 * GET /api/integrations
 *
 * Returns only integrations belonging to the
 * authenticated user's company.
 */
exports.getIntegrations = async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    if (!companyId) {
      return res.json({
        success: true,
        integrations: [],
      });
    }

    const integrations = await Integration.find({
      companyId,
    })
      .select(
        '-encryptedAccessToken -encryptedRefreshToken'
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.json({
      success: true,
      integrations,
    });
  } catch (error) {
    console.error(
      '[Integration] getIntegrations:',
      error
    );

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
 *
 * GET /api/integrations/:id
 */
exports.getIntegration = async (req, res) => {
  try {
    const companyId = getCompanyId(req.user);

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company access required.',
      });
    }

    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration ID.',
      });
    }

    const integration = await Integration.findOne({
      _id: req.params.id,
      companyId,
    })
      .select(
        '-encryptedAccessToken -encryptedRefreshToken'
      )
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
      integration,
    });
  } catch (error) {
    console.error(
      '[Integration] getIntegration:',
      error
    );

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
 *
 * IMPORTANT:
 *
 * This endpoint should NOT normally be called directly
 * by the frontend with raw OAuth tokens.
 *
 * Recommended flow:
 *
 * Frontend
 *    ↓
 * GET /meta/oauth
 *    ↓
 * Meta OAuth
 *    ↓
 * metaOAuthController.callback
 *    ↓
 * createIntegration()
 *
 * Same for Google.
 *
 * Therefore raw tokens should ideally be supplied internally
 * by OAuth controllers/services.
 */
exports.createIntegration = async (req, res) => {
  try {
    if (!requireOwner(req, res)) {
      return;
    }

    const companyId = getCompanyId(req.user);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company could not be determined.',
        code: 'COMPANY_REQUIRED',
      });
    }

    const {
      provider,
      externalAccountId,
      externalAccountName = '',

      pageId = null,
      pageName = '',

      formId = null,
      formName = '',

      customerId = null,
      managerCustomerId = null,

      accessToken,
      refreshToken = null,
      tokenExpiresAt = null,

      scopes = [],
      settings = {},
      metadata = {},
    } = req.body;

    /**
     * --------------------------------------------------------
     * VALIDATION
     * --------------------------------------------------------
     */

    if (!['meta', 'google'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration provider.',
        code: 'INVALID_PROVIDER',
      });
    }

    if (!externalAccountId) {
      return res.status(400).json({
        success: false,
        message: 'externalAccountId is required.',
        code: 'EXTERNAL_ACCOUNT_REQUIRED',
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'accessToken is required.',
        code: 'ACCESS_TOKEN_REQUIRED',
      });
    }

    if (!Array.isArray(scopes)) {
      return res.status(400).json({
        success: false,
        message: 'scopes must be an array.',
        code: 'INVALID_SCOPES',
      });
    }

    /**
     * --------------------------------------------------------
     * CHECK EXISTING CONNECTION
     * --------------------------------------------------------
     */

    const existing = await Integration.findOne({
      companyId,
      provider,
      externalAccountId,
    });

    /**
     * --------------------------------------------------------
     * UPDATE EXISTING CONNECTION
     *
     * OAuth may be run again to refresh permissions.
     * Therefore returning 409 is not ideal.
     *
     * We update the existing integration instead.
     * --------------------------------------------------------
     */

    if (existing) {
      existing.status = 'connected';

      existing.externalAccountName =
        externalAccountName || existing.externalAccountName;

      existing.encryptedAccessToken =
        encrypt(accessToken);

      existing.encryptedRefreshToken =
        refreshToken
          ? encrypt(refreshToken)
          : existing.encryptedRefreshToken;

      existing.tokenExpiresAt =
        tokenExpiresAt
          ? new Date(tokenExpiresAt)
          : existing.tokenExpiresAt;

      existing.scopes = scopes;

      existing.pageId =
        pageId !== undefined
          ? pageId
          : existing.pageId;

      existing.pageName =
        pageName || existing.pageName;

      existing.formId =
        formId !== undefined
          ? formId
          : existing.formId;

      existing.formName =
        formName || existing.formName;

      existing.customerId =
        customerId !== undefined
          ? customerId
          : existing.customerId;

      existing.managerCustomerId =
        managerCustomerId !== undefined
          ? managerCustomerId
          : existing.managerCustomerId;

      existing.settings = {
        ...(existing.settings || {}),
        ...(settings || {}),
      };

      existing.metadata = {
        ...(existing.metadata || {}),
        ...(metadata || {}),
      };

      existing.lastError = '';

      await existing.save();

      return res.status(200).json({
        success: true,
        message: 'Integration reconnected successfully.',
        integration: sanitizeIntegration(existing),
      });
    }

    /**
     * --------------------------------------------------------
     * CREATE NEW CONNECTION
     * --------------------------------------------------------
     */

    const integration = await Integration.create({
      companyId,

      createdBy: req.user._id,

      provider,

      status: 'connected',

      externalAccountId,
      externalAccountName,

      pageId,
      pageName,

      formId,
      formName,

      customerId,
      managerCustomerId,

      encryptedAccessToken: encrypt(accessToken),

      encryptedRefreshToken:
        refreshToken
          ? encrypt(refreshToken)
          : null,

      tokenExpiresAt:
        tokenExpiresAt
          ? new Date(tokenExpiresAt)
          : null,

      scopes,

      settings,

      metadata,

      webhookSubscribed: false,

      lastError: '',
    });

    return res.status(201).json({
      success: true,
      message: 'Integration connected successfully.',
      integration: sanitizeIntegration(integration),
    });
  } catch (error) {
    console.error(
      '[Integration] createIntegration:',
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This provider account is already connected.',
        code: 'INTEGRATION_ALREADY_EXISTS',
      });
    }

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
 *
 * PATCH /api/integrations/:id
 *
 * Used for configuration only.
 *
 * OAuth tokens are NOT accepted here.
 */
exports.updateIntegration = async (req, res) => {
  try {
    if (!requireOwner(req, res)) {
      return;
    }

    const companyId = getCompanyId(req.user);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company could not be determined.',
      });
    }

    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration ID.',
      });
    }

    /**
     * Only configuration fields are allowed.
     *
     * NEVER allow frontend to modify:
     *
     * encryptedAccessToken
     * encryptedRefreshToken
     * provider
     * externalAccountId
     * companyId
     * createdBy
     */
    const allowedFields = [
      'pageId',
      'pageName',
      'formId',
      'formName',

      'customerId',
      'managerCustomerId',

      'settings',
      'metadata',

      'status',
    ];

    const update = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update.',
        code: 'NO_UPDATE_FIELDS',
      });
    }

    const integration =
      await Integration.findOneAndUpdate(
        {
          _id: req.params.id,
          companyId,
        },
        {
          $set: update,
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .select(
          '-encryptedAccessToken -encryptedRefreshToken'
        )
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
      message: 'Integration updated successfully.',
      integration,
    });
  } catch (error) {
    console.error(
      '[Integration] updateIntegration:',
      error
    );

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
 *
 * DELETE /api/integrations/:id
 *
 * We soft-disconnect instead of deleting the document.
 *
 * Why?
 *
 * - audit history
 * - webhook mapping
 * - external account history
 * - reconnect support
 */
exports.deleteIntegration = async (req, res) => {
  try {
    if (!requireOwner(req, res)) {
      return;
    }

    const companyId = getCompanyId(req.user);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company could not be determined.',
      });
    }

    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid integration ID.',
      });
    }

    const integration =
      await Integration.findOneAndUpdate(
        {
          _id: req.params.id,
          companyId,
        },
        {
          $set: {
            status: 'disconnected',

            webhookSubscribed: false,

            encryptedAccessToken: null,
            encryptedRefreshToken: null,

            tokenExpiresAt: null,

            lastError: '',
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
    console.error(
      '[Integration] deleteIntegration:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect integration.',
      code: 'INTEGRATION_DISCONNECT_FAILED',
    });
  }
};