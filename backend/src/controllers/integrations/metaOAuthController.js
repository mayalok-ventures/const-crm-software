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
        timeout: 10000,
      }
    );

    const metaUser = meResponse.data;
    console.log('[Meta OAuth] Connected Meta User:', { id: metaUser.id, name: metaUser.name });

    // 4. Fetch all Facebook Pages the user granted access to
    let userPages = [];
    try {
      const pagesResponse = await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`,
        {
          params: {
            fields: 'id,name,access_token,category,tasks',
            access_token: accessToken,
          },
          timeout: 10000,
        }
      );
      userPages = pagesResponse.data?.data || [];
      console.log(`[Meta OAuth] Retrieved ${userPages.length} Facebook Page(s) for user ${metaUser.name}:`,
        userPages.map((p) => ({ id: p.id, name: p.name }))
      );
    } catch (pageErr) {
      console.warn('[Meta OAuth] Could not fetch user pages from /me/accounts:', pageErr.response?.data || pageErr.message);
    }

    const encryptedUserToken = encrypt(accessToken);

    // 5. Save/Update integration per Page (or fallback if no pages found)
    if (userPages.length > 0) {
      for (const page of userPages) {
        const pageId = String(page.id);
        const pageName = page.name || 'Facebook Page';
        const pageAccessToken = page.access_token || accessToken;
        const encryptedPageToken = encrypt(pageAccessToken);

        // 5a. Automatically subscribe CRM app to leadgen webhooks for this page
        try {
          await axios.post(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/subscribed_apps`,
            null,
            {
              params: {
                subscribed_fields: 'leadgen',
                access_token: pageAccessToken,
              },
              timeout: 8000,
            }
          );
          console.log(`[Meta OAuth] Successfully subscribed App to Page: "${pageName}" (ID: ${pageId})`);
        } catch (subErr) {
          console.warn(`[Meta OAuth] Subscribed apps notice for Page ${pageId} (${pageName}):`, subErr.response?.data || subErr.message);
        }

        // 5b. Fetch instant leadgen forms for this page to pre-index form IDs
        let formIds = [];
        let formNames = [];
        try {
          const formsResponse = await axios.get(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/leadgen_forms`,
            {
              params: {
                fields: 'id,name,status',
                access_token: pageAccessToken,
              },
              timeout: 8000,
            }
          );
          const forms = formsResponse.data?.data || [];
          formIds = forms.map((f) => String(f.id));
          formNames = forms.map((f) => f.name || '');
        } catch (formErr) {
          console.warn(`[Meta OAuth] Forms fetch notice for Page ${pageId}:`, formErr.message);
        }

        // 5c. Upsert Integration document keyed by Page ID (preventing collision on unique compound index)
        const pageQuery = stateData.companyId
          ? { companyId: stateData.companyId, provider: 'meta', accountId: pageId }
          : { userId: stateData.userId, provider: 'meta', accountId: pageId };

        await Integration.findOneAndUpdate(
          pageQuery,
          {
            $set: {
              userId: stateData.userId,
              companyId: stateData.companyId || null,
              provider: 'meta',
              mode: 'client_managed',
              status: 'connected',
              accountId: pageId, // Set to actual Page ID to guarantee unique index compliance
              accountName: pageName, // Set to Page Name
              pageId,
              pageName,
              formIds,
              formNames,
              accessTokenEncrypted: encryptedPageToken,
              tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
              connectedAt: new Date(),
              metadata: {
                metaUserId: metaUser.id,
                metaUserName: metaUser.name || '',
                metaUserEmail: metaUser.email || '',
                category: page.category || '',
                tasks: page.tasks || [],
                userAccessTokenEncrypted: encryptedUserToken,
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
      }
    } else {
      // Fallback: Save User profile record if no pages were returned
      const userQuery = stateData.companyId
        ? { companyId: stateData.companyId, provider: 'meta', accountId: metaUser.id }
        : { userId: stateData.userId, provider: 'meta', accountId: metaUser.id };

      await Integration.findOneAndUpdate(
        userQuery,
        {
          $set: {
            userId: stateData.userId,
            companyId: stateData.companyId || null,
            provider: 'meta',
            mode: 'client_managed',
            status: 'connected',
            accountId: metaUser.id,
            accountName: metaUser.name || 'Meta Ad Account',
            pageId: null,
            pageName: null,
            formIds: [],
            formNames: [],
            accessTokenEncrypted: encryptedUserToken,
            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
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
    }

    // 302 Redirect user back to frontend dashboard with success query param
    return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_success`);
  } catch (error) {
    console.error('Meta OAuth callback processing error:', error.response?.data || error.message);
    return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent(error.message || 'Meta connection failed')}`);
  }
};