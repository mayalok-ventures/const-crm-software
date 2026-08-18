const axios = require('axios');

const Integration =
  require('../../models/Integration');


/**
 * GET /api/integrations/google
 */
exports.getIntegrations = async (
  req,
  res
) => {

  try {

    const integrations =
      await Integration.find({
        userId:
          req.user._id,

        provider:
          'google',

        isActive:
          true,
      })
        .select(
          '-accessToken -refreshToken'
        )
        .lean();

    return res.json({

      success: true,

      data:
        integrations,
    });

  } catch (error) {

    console.error(
      'Google integrations:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to get Google integrations',
    });
  }
};


/**
 * GET /api/integrations/google/accounts
 */
exports.getAccounts = async (
  req,
  res
) => {

  try {

    const integration =
      await Integration.findOne({

        _id:
          req.query.integrationId,

        userId:
          req.user._id,

        provider:
          'google',

        isActive:
          true,
      });

    if (!integration) {

      return res.status(404).json({
        success: false,
        message:
          'Google integration not found',
      });
    }

    /*
     * Google Ads API requires:
     *
     * Authorization: Bearer ACCESS_TOKEN
     * developer-token: YOUR_DEVELOPER_TOKEN
     */

    const response =
      await axios.get(
        'https://googleads.googleapis.com/v24/customers:listAccessibleCustomers',
        {
          headers: {

            Authorization:
              `Bearer ${integration.accessToken}`,

            'developer-token':
              process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          },
        }
      );

    const resourceNames =
      response.data.resourceNames || [];

    const accounts =
      resourceNames.map(
        resourceName => ({
          resourceName,

          customerId:
            resourceName
              .split('/')
              .pop(),
        })
      );

    return res.json({

      success: true,

      data:
        accounts,
    });

  } catch (error) {

    console.error(
      'Google accounts error:',
      error.response?.data ||
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to load Google Ads accounts',
    });
  }
};


/**
 * POST /api/integrations/google/configure
 */
exports.configure = async (
  req,
  res
) => {

  try {

    const {
      integrationId,
      accountId,
      accountName,
      managerCustomerId,
    } = req.body;

    if (
      !integrationId ||
      !accountId
    ) {

      return res.status(400).json({
        success: false,
        message:
          'integrationId and accountId are required',
      });
    }

    const integration =
      await Integration.findOne({

        _id:
          integrationId,

        userId:
          req.user._id,

        provider:
          'google',

        isActive:
          true,
      });

    if (!integration) {

      return res.status(404).json({
        success: false,
        message:
          'Google integration not found',
      });
    }

    integration.accountId =
      accountId;

    integration.accountName =
      accountName || '';

    integration.managerCustomerId =
      managerCustomerId || null;

    await integration.save();

    return res.json({

      success: true,

      message:
        'Google Ads account configured',

      data: {

        id:
          integration._id,

        accountId:
          integration.accountId,

        accountName:
          integration.accountName,

      },
    });

  } catch (error) {

    console.error(
      'Google configure:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to configure Google Ads',
    });
  }
};


/**
 * POST /api/integrations/google/test
 */
exports.testConnection = async (
  req,
  res
) => {

  try {

    const integration =
      await Integration.findOne({

        _id:
          req.body.integrationId,

        userId:
          req.user._id,

        provider:
          'google',

        isActive:
          true,
      });

    if (!integration) {

      return res.status(404).json({
        success: false,
        message:
          'Google integration not found',
      });
    }

    const response =
      await axios.get(
        'https://googleads.googleapis.com/v24/customers:listAccessibleCustomers',
        {
          headers: {

            Authorization:
              `Bearer ${integration.accessToken}`,

            'developer-token':
              process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          },
        }
      );

    return res.json({

      success: true,

      connected: true,

      data:
        response.data,
    });

  } catch (error) {

    console.error(
      'Google test:',
      error.response?.data ||
      error
    );

    return res.status(401).json({

      success: false,

      connected: false,

      message:
        'Google Ads connection failed',
    });
  }
};


/**
 * DELETE /api/integrations/google/:integrationId
 */
exports.disconnect = async (
  req,
  res
) => {

  try {

    const integration =
      await Integration.findOne({

        _id:
          req.params.integrationId,

        userId:
          req.user._id,

        provider:
          'google',
      });

    if (!integration) {

      return res.status(404).json({
        success: false,
        message:
          'Google integration not found',
      });
    }

    integration.isActive =
      false;

    integration.accessToken =
      undefined;

    integration.refreshToken =
      undefined;

    await integration.save();

    return res.json({

      success: true,

      message:
        'Google integration disconnected',
    });

  } catch (error) {

    console.error(
      'Google disconnect:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to disconnect Google',
    });
  }
};