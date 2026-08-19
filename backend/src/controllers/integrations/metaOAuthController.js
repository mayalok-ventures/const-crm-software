const crypto = require('crypto');
const axios = require('axios');
const Integration = require('../../models/Integration');
const { encrypt } = require('../../utils/encryption');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI ||
  'http://localhost:5000/api/integrations/meta/oauth/callback';

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'leads_retrieval',
  'ads_read',
].join(',');

function generateOAuthState(userId, companyId) {
  const secret = process.env.JWT_SECRET || 'crm_oauth_state_hmac_secret';
  const payload = {
    userId: String(userId),
    companyId: companyId ? String(companyId) : null,
    nonce: crypto.randomBytes(16).toString('hex'),
    createdAt: Date.now(),
  };
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(dataStr)
    .digest('base64url');

  return `${dataStr}.${sig}`;
}

function verifyOAuthState(state) {
  if (!state || typeof state !== 'string') return null;
  const parts = state.split('.');
  if (parts.length !== 2) return null;

  const [dataStr, sig] = parts;
  const secret = process.env.JWT_SECRET || 'crm_oauth_state_hmac_secret';
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(dataStr)
    .digest('base64url');

  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(dataStr, 'base64url').toString('utf8')
    );
    if (!payload.userId || !payload.createdAt) return null;

    // 15 minutes validity
    if (Date.now() - Number(payload.createdAt) > 15 * 60 * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * GET /api/integrations/meta/oauth
 */
exports.startOAuth = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to connect Meta Ads',
        code: 'AUTH_REQUIRED',
      });
    }

    const appId = process.env.META_APP_ID || 'dev_meta_app_id_2026';
    const appSecret = process.env.META_APP_SECRET || 'dev_meta_app_secret_2026';
    const redirectUri = process.env.META_REDIRECT_URI || 'http://localhost:5000/api/integrations/meta/oauth/callback';

    if (!appId || !appSecret) {
      return res.status(500).json({
        success: false,
        message: 'Meta OAuth credentials are not configured on server',
        code: 'OAUTH_NOT_CONFIGURED',
      });
    }

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);
    const state = generateOAuthState(req.user._id, companyId);

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: META_SCOPES,
      state,
    });

    const authorizationUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params}`;

    // If client requested JSON URL or frontend redirect
    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        authorizationUrl,
      });
    }

    return res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Meta OAuth start error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to initialize Meta OAuth session',
    });
  }
};

/**
 * GET /api/integrations/meta/oauth/callback
 */
exports.callback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (error) {
      console.warn('Meta OAuth denied by user:', error_description || error);
      return res.redirect(`${frontendUrl}/integrations?meta=error&message=${encodeURIComponent(error_description || 'Authorization denied')}`);
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing OAuth authorization code or state',
        code: 'INVALID_CALLBACK_PARAMS',
      });
    }

    const stateData = verifyOAuthState(state);
    if (!stateData) {
      return res.status(400).json({
        success: false,
        message: 'OAuth state signature is invalid or expired. Please re-authenticate.',
        code: 'INVALID_OAUTH_STATE',
      });
    }

    // 1. Exchange authorization code for short-lived access token
    const tokenResponse = await axios.get(
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

    const shortLivedToken = tokenResponse.data.access_token;
    if (!shortLivedToken) {
      throw new Error('Meta did not return an access token');
    }

    // 2. Exchange short-lived token for long-lived (60 days) access token
    let accessToken = shortLivedToken;
    try {
      const longTokenResponse = await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            fb_exchange_token: shortLivedToken,
          },
        }
      );
      if (longTokenResponse.data.access_token) {
        accessToken = longTokenResponse.data.access_token;
      }
    } catch (e) {
      console.warn('Meta long-lived token exchange warning, falling back to short token:', e.message);
    }

    // 3. Fetch current Meta user profile
    const meResponse = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      {
        params: {
          fields: 'id,name,email',
          access_token: accessToken,
        },
      }
    );

    const metaUser = meResponse.data;

    // 4. Securely store integration in MongoDB with token encryption
    const encryptedAccessToken = encrypt(accessToken);

    const query = stateData.companyId
      ? { companyId: stateData.companyId, provider: 'meta', accountId: metaUser.id }
      : { userId: stateData.userId, provider: 'meta', accountId: metaUser.id };

    await Integration.findOneAndUpdate(
      query,
      {
        $set: {
          userId: stateData.userId,
          companyId: stateData.companyId || null,
          provider: 'meta',
          mode: 'client_managed',
          status: 'connected',
          accountId: metaUser.id,
          accountName: metaUser.name || 'Meta Ad Account',
          accessTokenEncrypted: encryptedAccessToken,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          connectedAt: new Date(),
          metadata: {
            metaUserId: metaUser.id,
            metaUserName: metaUser.name || '',
            metaUserEmail: metaUser.email || '',
          },
          lastError: '',
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.redirect(`${frontendUrl}/integrations?meta=connected&account=${encodeURIComponent(metaUser.name || metaUser.id)}`);
  } catch (error) {
    console.error('Meta OAuth callback processing error:', error.response?.data || error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/integrations?meta=error&message=${encodeURIComponent(error.message || 'Meta connection failed')}`);
  }
};