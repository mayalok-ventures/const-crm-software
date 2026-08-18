const crypto = require('crypto');
const axios = require('axios');

const Integration =
  require('../../models/Integration');

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID;

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI;

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/adwords',
].join(' ');


/**
 * GET /api/integrations/google/oauth
 */
exports.startOAuth = async (
  req,
  res
) => {

  try {

    if (!req.user?._id) {

      return res.status(401).json({
        success: false,
        message:
          'Authentication required',
      });
    }

    const statePayload = {

      userId:
        req.user._id.toString(),

      nonce:
        crypto.randomBytes(24)
          .toString('hex'),

      createdAt:
        Date.now(),
    };

    const state =
      Buffer
        .from(
          JSON.stringify(
            statePayload
          )
        )
        .toString('base64url');

    const params =
      new URLSearchParams({

        client_id:
          GOOGLE_CLIENT_ID,

        redirect_uri:
          GOOGLE_REDIRECT_URI,

        response_type:
          'code',

        access_type:
          'offline',

        prompt:
          'consent',

        scope:
          GOOGLE_SCOPES,

        state,
      });

    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    return res.redirect(url);

  } catch (error) {

    console.error(
      'Google OAuth start:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to start Google OAuth',
    });
  }
};


/**
 * GET /api/integrations/google/oauth/callback
 */
exports.callback = async (
  req,
  res
) => {

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
          'Google authorization failed',
      });
    }

    if (!code || !state) {

      return res.status(400).json({
        success: false,
        message:
          'Missing OAuth code or state',
      });
    }

    let stateData;

    try {

      stateData =
        JSON.parse(
          Buffer
            .from(
              state,
              'base64url'
            )
            .toString('utf8')
        );

    } catch {

      return res.status(400).json({
        success: false,
        message:
          'Invalid OAuth state',
      });
    }

    if (
      Date.now() -
      Number(stateData.createdAt) >
      10 * 60 * 1000
    ) {

      return res.status(400).json({
        success: false,
        message:
          'OAuth state expired',
      });
    }

    // ---------------------------------------------------------
    // Exchange code
    // ---------------------------------------------------------

    const tokenResponse =
      await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({

          code,

          client_id:
            GOOGLE_CLIENT_ID,

          client_secret:
            GOOGLE_CLIENT_SECRET,

          redirect_uri:
            GOOGLE_REDIRECT_URI,

          grant_type:
            'authorization_code',

        }).toString(),
        {
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },
        }
      );

    const {
      access_token,
      refresh_token,
      expires_in,
    } =
      tokenResponse.data;

    if (!access_token) {

      throw new Error(
        'Google did not return access token'
      );
    }

    // ---------------------------------------------------------
    // Get Google user
    // ---------------------------------------------------------

    const userResponse =
      await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization:
              `Bearer ${access_token}`,
          },
        }
      );

    const googleUser =
      userResponse.data;

    // ---------------------------------------------------------
    // Save integration
    // ---------------------------------------------------------

    await Integration.findOneAndUpdate(
      {
        userId:
          stateData.userId,

        provider:
          'google',

        accountId:
          googleUser.id,
      },
      {
        $set: {

          userId:
            stateData.userId,

          provider:
            'google',

          accountId:
            googleUser.id,

          accountName:
            googleUser.name ||
            googleUser.email ||
            '',

          accessToken:
            access_token,

          expiresAt:
            expires_in
              ? new Date(
                  Date.now() +
                  expires_in * 1000
                )
              : null,

          isActive:
            true,

          metadata: {

            googleUserId:
              googleUser.id,

            email:
              googleUser.email,

            name:
              googleUser.name ||
              '',
          },

          connectedAt:
            new Date(),
        },

        ...(refresh_token
          ? {
              $set: {
                refreshToken:
                  refresh_token,
              },
            }
          : {}),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    const frontendUrl =
      process.env.FRONTEND_URL ||
      'http://localhost:5173';

    return res.redirect(
      `${frontendUrl}/settings/integrations?google=connected`
    );

  } catch (error) {

    console.error(
      'Google OAuth callback:',
      error.response?.data ||
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Google OAuth connection failed',
    });
  }
};