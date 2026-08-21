const crypto = require('crypto');
const axios = require('axios');
const Integration = require('../../models/Integration');
const { encrypt } = require('../../utils/encryption');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI ||
  'https://api.coresetu.com/api/integrations/meta/oauth/callback';

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'leads_retrieval',
  'ads_read',
].join(',');

function generateOAuthState(userId, companyId, frontendUrl) {
  const secret = process.env.JWT_SECRET || 'crm_oauth_state_hmac_secret';
  const payload = {
    userId: String(userId),
    companyId: companyId ? String(companyId) : null,
    frontendUrl: frontendUrl || null,
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

    const appId = META_APP_ID;
    const appSecret = (META_APP_SECRET || '').trim();
    const redirectUri = META_REDIRECT_URI;

    // Extract frontendUrl dynamically
    let frontendUrl = req.query.frontendUrl || null;
    if (!frontendUrl && req.headers.referer) {
      try {
        const parsedReferer = new URL(req.headers.referer);
        frontendUrl = parsedReferer.origin;
      } catch { }
    }
    if (!frontendUrl) {
      frontendUrl = process.env.FRONTEND_URL || 'https://crm.coresetu.com';
    }

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

    // If sandbox mode is explicitly requested OR if no valid numeric Meta App ID is configured yet:
    const isSandboxMode = req.query.sandbox === 'true' || !appId || appId.startsWith('dev_') || !/^\d+$/.test(appId);

    if (isSandboxMode) {
      // Connect sandbox/development Meta account immediately
      const encryptedAccessToken = encrypt('meta_sandbox_access_token_' + Date.now());
      const query = companyId
        ? { companyId, provider: 'meta', accountId: 'meta_sandbox_page_01' }
        : { userId: req.user._id, provider: 'meta', accountId: 'meta_sandbox_page_01' };

      await Integration.findOneAndUpdate(
        query,
        {
          $set: {
            userId: req.user._id,
            companyId: companyId || null,
            provider: 'meta',
            mode: 'client_managed',
            status: 'connected',
            accountId: 'meta_sandbox_page_01',
            accountName: 'Meta Ads (Sandbox / Test Page)',
            pageId: '109876543210987',
            pageName: 'CoreSetu Real Estate & Ads',
            formIds: ['meta_form_instant_01', 'meta_form_leadgen_02'],
            accessTokenEncrypted: encryptedAccessToken,
            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
            connectedAt: new Date(),
            metadata: {
              metaUserId: 'meta_sandbox_user',
              metaUserName: 'Sandbox Ad Account',
              metaUserEmail: req.user.email,
              isSandbox: true,
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

      const redirectTarget = `${frontendUrl}/integrations?meta=connected&account=${encodeURIComponent('Meta Ads (Sandbox Mode)')}`;
      if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, sandbox: true, redirectUrl: redirectTarget });
      }
      return res.redirect(redirectTarget);
    }

    if (!appSecret) {
      return res.status(500).json({
        success: false,
        message: 'Meta OAuth app secret is not configured on server',
        code: 'OAUTH_NOT_CONFIGURED',
      });
    }

    const state = generateOAuthState(req.user._id, companyId, frontendUrl);

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: META_SCOPES,
      state,
    });

    const authorizationUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params}`;
    console.log('====== META OAUTH REDIRECT URL ======');
    console.log(authorizationUrl);
    console.log('=====================================');

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
  let resolvedFrontendUrl = process.env.FRONTEND_URL || 'https://crm.coresetu.com';
  try {
    const { code, state, error, error_description } = req.query;

    if (state) {
      const stateData = verifyOAuthState(state);
      if (stateData && stateData.frontendUrl) {
        resolvedFrontendUrl = stateData.frontendUrl;
      }
    }

    if (error) {
      console.warn('Meta OAuth denied by user:', error_description || error);
      return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent(error_description || 'Authorization denied')}`);
    }

    if (!code || !state) {
      return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent('Missing OAuth authorization code or state')}`);
    }

    const stateData = verifyOAuthState(state);
    if (!stateData) {
      return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent('OAuth session expired or invalid. Please re-authenticate.')}`);
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

    // 302 Redirect user back to frontend dashboard with success query param
    return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_success`);
  } catch (error) {
    console.error('Meta OAuth callback processing error:', error.response?.data || error.message);
    return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent(error.message || 'Meta connection failed')}`);
  }
};