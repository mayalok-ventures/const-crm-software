const crypto = require('crypto');
const axios = require('axios');

const Integration = require('../../models/Integration');

const META_GRAPH_VERSION =
  process.env.META_GRAPH_VERSION || 'v23.0';

const META_APP_ID =
  process.env.META_APP_ID;

const META_APP_SECRET =
  process.env.META_APP_SECRET;

const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI;

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'leads_retrieval',
  'ads_read',
].join(',');

/**
 * GET /api/integrations/meta/oauth
 */
exports.startOAuth = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (
      !META_APP_ID ||
      !META_REDIRECT_URI
    ) {
      return res.status(500).json({
        success: false,
        message: 'Meta OAuth is not configured',
      });
    }

    const statePayload = {
      userId: req.user._id.toString(),
      nonce: crypto.randomBytes(24).toString('hex'),
      createdAt: Date.now(),
    };

    const state = Buffer
      .from(JSON.stringify(statePayload))
      .toString('base64url');

    // Better: save state in Redis/session/database.
    // Do NOT trust userId directly from frontend.

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: META_REDIRECT_URI,
      response_type: 'code',
      scope: META_SCOPES,
      state,
    });

    const authorizationUrl =
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params}`;

    return res.redirect(authorizationUrl);

  } catch (error) {
    console.error(
      'Meta OAuth start error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to start Meta OAuth',
    });
  }
};


/**
 * GET /api/integrations/meta/oauth/callback
 */
exports.callback = async (req, res) => {
  try {
    const {
      code,
      state,
      error,
      error_description,
    } = req.query;

    if (error) {
      return res.status(400).json({
        success: false,
        message:
          error_description ||
          'Meta authorization failed',
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing OAuth code or state',
      });
    }

    // ---------------------------------------------------------
    // Decode state
    // ---------------------------------------------------------

    let stateData;

    try {
      stateData = JSON.parse(
        Buffer
          .from(state, 'base64url')
          .toString('utf8')
      );
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth state',
      });
    }

    if (
      !stateData.userId ||
      !stateData.createdAt
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth state',
      });
    }

    // State expiration: 10 minutes

    if (
      Date.now() -
        Number(stateData.createdAt) >
      10 * 60 * 1000
    ) {
      return res.status(400).json({
        success: false,
        message: 'OAuth state expired',
      });
    }

    // ---------------------------------------------------------
    // Exchange code for short-lived access token
    // ---------------------------------------------------------

    const tokenResponse =
      await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
        {
          params: {
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            redirect_uri: META_REDIRECT_URI,
            code,
          },
        }
      );

    const shortLivedToken =
      tokenResponse.data.access_token;

    if (!shortLivedToken) {
      throw new Error(
        'Meta did not return access token'
      );
    }

    // ---------------------------------------------------------
    // Exchange for long-lived token
    // ---------------------------------------------------------

    const longTokenResponse =
      await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
        {
          params: {
            grant_type:
              'fb_exchange_token',

            client_id:
              META_APP_ID,

            client_secret:
              META_APP_SECRET,

            fb_exchange_token:
              shortLivedToken,
          },
        }
      );

    const accessToken =
      longTokenResponse.data.access_token ||
      shortLivedToken;

    // ---------------------------------------------------------
    // Get current Meta user
    // ---------------------------------------------------------

    const meResponse =
      await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
        {
          params: {
            fields: 'id,name',
            access_token: accessToken,
          },
        }
      );

    const metaUser =
      meResponse.data;

    // ---------------------------------------------------------
    // Save integration
    // ---------------------------------------------------------

    await Integration.findOneAndUpdate(
      {
        userId: stateData.userId,
        provider: 'meta',
        accountId: metaUser.id,
      },
      {
        $set: {
          userId: stateData.userId,

          provider: 'meta',

          accountId:
            metaUser.id,

          accountName:
            metaUser.name || '',

          accessToken,

          isActive: true,

          connectedAt:
            new Date(),

          metadata: {
            metaUserId:
              metaUser.id,

            metaUserName:
              metaUser.name || '',
          },
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // ---------------------------------------------------------
    // Redirect frontend
    // ---------------------------------------------------------

    const frontendUrl =
      process.env.FRONTEND_URL ||
      'http://localhost:5173';

    return res.redirect(
      `${frontendUrl}/settings/integrations?meta=connected`
    );

  } catch (error) {
    console.error(
      'Meta OAuth callback error:',
      error.response?.data ||
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Meta OAuth connection failed',
    });
  }
};