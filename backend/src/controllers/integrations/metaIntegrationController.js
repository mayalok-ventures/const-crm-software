const axios = require('axios');

const Integration = require('../../models/Integration');

const META_GRAPH_VERSION =
  process.env.META_GRAPH_VERSION || 'v23.0';


/**
 * GET /api/integrations/meta
 */
exports.getIntegrations = async (req, res) => {
  try {
    const integrations =
      await Integration.find({
        userId: req.user._id,
        provider: 'meta',
        isActive: true,
      })
        .select(
          '-accessToken -refreshToken'
        )
        .lean();

    return res.json({
      success: true,
      data: integrations,
    });

  } catch (error) {
    console.error(
      'Get Meta integrations:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to get Meta integrations',
    });
  }
};


/**
 * GET /api/integrations/meta/assets
 */
exports.getAssets = async (req, res) => {
  try {
    const integration =
      await Integration.findOne({
        _id: req.query.integrationId,
        userId: req.user._id,
        provider: 'meta',
        isActive: true,
      });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message:
          'Meta integration not found',
      });
    }

    const accessToken =
      integration.accessToken;

    // ---------------------------------------------------------
    // Pages
    // ---------------------------------------------------------

    const pagesResponse =
      await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`,
        {
          params: {
            fields:
              'id,name,access_token,tasks',
            access_token:
              accessToken,
          },
        }
      );

    const pages =
      pagesResponse.data.data || [];

    // ---------------------------------------------------------
    // Forms per page
    // ---------------------------------------------------------

    const assets = [];

    for (const page of pages) {

      let forms = [];

      try {
        const formsResponse =
          await axios.get(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}/leadgen_forms`,
            {
              params: {
                fields:
                  'id,name,status,page_id',
                access_token:
                  page.access_token ||
                  accessToken,
              },
            }
          );

        forms =
          formsResponse.data.data || [];

      } catch (error) {
        console.warn(
          `Unable to fetch forms for page ${page.id}`,
          error.response?.data
        );
      }

      assets.push({
        page: {
          id: page.id,
          name: page.name,
        },

        forms,
      });
    }

    return res.json({
      success: true,
      data: assets,
    });

  } catch (error) {
    console.error(
      'Meta assets error:',
      error.response?.data ||
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to load Meta assets',
    });
  }
};


/**
 * POST /api/integrations/meta/configure
 */
exports.configure = async (req, res) => {
  try {
    const {
      integrationId,
      pageId,
      pageName,
      formId,
      formName,
      accountId,
      accountName,
    } = req.body;

    if (!integrationId || !pageId) {
      return res.status(400).json({
        success: false,
        message:
          'integrationId and pageId are required',
      });
    }

    const integration =
      await Integration.findOne({
        _id: integrationId,
        userId: req.user._id,
        provider: 'meta',
        isActive: true,
      });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message:
          'Meta integration not found',
      });
    }

    integration.pageId =
      pageId;

    integration.pageName =
      pageName || '';

    integration.formId =
      formId || null;

    integration.formName =
      formName || '';

    integration.accountId =
      accountId ||
      integration.accountId;

    integration.accountName =
      accountName ||
      integration.accountName;

    await integration.save();

    return res.json({
      success: true,
      message:
        'Meta integration configured',
      data: {
        id: integration._id,
        pageId: integration.pageId,
        formId: integration.formId,
      },
    });

  } catch (error) {
    console.error(
      'Meta configure error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to configure Meta',
    });
  }
};


/**
 * POST /api/integrations/meta/test
 */
exports.testConnection = async (req, res) => {
  try {
    const integration =
      await Integration.findOne({
        _id: req.body.integrationId,
        userId: req.user._id,
        provider: 'meta',
        isActive: true,
      });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message:
          'Meta integration not found',
      });
    }

    const response =
      await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
        {
          params: {
            fields: 'id,name',
            access_token:
              integration.accessToken,
          },
        }
      );

    return res.json({
      success: true,
      connected: true,
      data: response.data,
    });

  } catch (error) {
    console.error(
      'Meta test error:',
      error.response?.data ||
      error
    );

    return res.status(401).json({
      success: false,
      connected: false,
      message:
        'Meta connection is invalid or expired',
    });
  }
};


/**
 * DELETE /api/integrations/meta/:integrationId
 */
exports.disconnect = async (req, res) => {
  try {
    const integration =
      await Integration.findOne({
        _id: req.params.integrationId,
        userId: req.user._id,
        provider: 'meta',
      });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message:
          'Meta integration not found',
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
        'Meta integration disconnected',
    });

  } catch (error) {
    console.error(
      'Meta disconnect error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to disconnect Meta',
    });
  }
};