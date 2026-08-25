const crypto = require('crypto');
const axios = require('axios');
const Integration = require('../../models/Integration');
const { encrypt } = require('../../utils/encryption');

function getMetaApiVersion() {
  return process.env.META_API_VERSION || 'v26.0';
}

function getMetaAppId() {
  return process.env.META_APP_ID || '';
}

function getMetaAppSecret() {
  return (process.env.META_APP_SECRET || '').trim();
}

function getMetaRedirectUri(req) {
  if (req && req.query && req.query.redirect_uri) return req.query.redirect_uri;
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;

  if (process.env.BACKEND_URL) {
    return `${process.env.BACKEND_URL}/api/integrations/meta/oauth/callback`;
  }

  const isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || (req && req.headers && req.headers.host && req.headers.host.includes('localhost'));
  const port = process.env.PORT || 5000;
  return isLocal
    ? `http://localhost:${port}/api/integrations/meta/oauth/callback`
    : `https://${req?.headers?.host || 'localhost'}/api/integrations/meta/oauth/callback`;
}

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

    const appId = getMetaAppId();
    const appSecret = getMetaAppSecret();
    const apiVersion = getMetaApiVersion();
    const redirectUri = getMetaRedirectUri(req);

    // Extract frontendUrl dynamically
    let frontendUrl = req.query.frontendUrl || null;
    if (!frontendUrl && req.headers.referer) {
      try {
        const parsedReferer = new URL(req.headers.referer);
        frontendUrl = parsedReferer.origin;
      } catch { }
    }
    if (!frontendUrl) {
      const isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || (req && req.headers && req.headers.host && req.headers.host.includes('localhost'));
      frontendUrl = isLocal ? 'http://localhost:3000' : (process.env.FRONTEND_URL || 'https://crm.coresetu.com');
    }

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

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

    const authorizationUrl = `https://www.facebook.com/${apiVersion}/dialog/oauth?${params}`;
    console.log('====== META REAL OAUTH REDIRECT URL ======');
    console.log('Using redirect_uri:', redirectUri);
    console.log(authorizationUrl);
    console.log('==========================================');

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
  const isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || (req && req.headers && req.headers.host && req.headers.host.includes('localhost'));
  let resolvedFrontendUrl = isLocal ? 'http://localhost:3000' : (process.env.FRONTEND_URL || 'https://crm.coresetu.com');
  const redirectUri = getMetaRedirectUri(req);
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  const apiVersion = getMetaApiVersion();

  console.log('\n================== [META OAUTH CALLBACK DEBUG START] ==================');
  console.log('[DEBUG 1] Incoming Query Params:', JSON.stringify(req.query, null, 2));
  console.log('[DEBUG 1] redirectUri Resolved:', redirectUri);

  try {
    const { code, state, error, error_description } = req.query;

    if (state) {
      const stateData = verifyOAuthState(state);
      console.log('[DEBUG 2] Verified State Data:', JSON.stringify(stateData, null, 2));
      if (stateData && stateData.frontendUrl) {
        resolvedFrontendUrl = stateData.frontendUrl;
      }
    }

    if (error) {
      console.warn('❌ [DEBUG ERROR] Meta OAuth denied by user:', error_description || error);
      return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent(error_description || 'Authorization denied')}`);
    }

    if (!code || !state) {
      console.warn('❌ [DEBUG ERROR] Missing OAuth code or state');
      return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent('Missing OAuth authorization code or state')}`);
    }

    const stateData = verifyOAuthState(state);
    if (!stateData) {
      console.warn('❌ [DEBUG ERROR] OAuth state verification failed or expired');
      const wantsJson = req.query.json === 'true' || (req.headers && req.headers.accept && req.headers.accept.includes('application/json')) || process.env.NODE_ENV === 'test';
      if (wantsJson) {
        return res.status(400).json({ success: false, code: 'INVALID_OAUTH_STATE', message: 'OAuth session expired or invalid. Please re-authenticate.' });
      }
      return res.redirect(`${resolvedFrontendUrl}/dashboard?integration=meta_error&message=${encodeURIComponent('OAuth session expired or invalid. Please re-authenticate.')}`);
    }

    // 1. Exchange authorization code for short-lived access token
    console.log('[DEBUG 3] Requesting Access Token from Graph API with redirect_uri:', redirectUri);
    const tokenResponse = await axios.get(
      `https://graph.facebook.com/${apiVersion}/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      }
    );

    const shortLivedToken = tokenResponse.data.access_token;
    console.log('[DEBUG 3] Short-lived token received:', shortLivedToken ? `${shortLivedToken.slice(0, 15)}...` : 'NONE');
    if (!shortLivedToken) {
      throw new Error('Meta did not return an access token');
    }

    // 2. Exchange short-lived token for long-lived (60 days) access token
    let accessToken = shortLivedToken;
    try {
      const longTokenResponse = await axios.get(
        `https://graph.facebook.com/${apiVersion}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLivedToken,
          },
        }
      );
      if (longTokenResponse.data.access_token) {
        accessToken = longTokenResponse.data.access_token;
        console.log('[DEBUG 4] Long-lived token received:', `${accessToken.slice(0, 15)}...`);
      }
    } catch (e) {
      console.warn('⚠️ [DEBUG WARN] Meta long-lived token exchange warning, falling back to short token:', e.message);
    }

    // 3. Fetch current Meta user profile
    const meResponse = await axios.get(
      `https://graph.facebook.com/${apiVersion}/me`,
      {
        params: {
          fields: 'id,name,email',
          access_token: accessToken,
        },
        timeout: 10000,
      }
    );

    const metaUser = meResponse.data;
    console.log('[DEBUG 5] Connected Meta User (/me):', JSON.stringify(metaUser, null, 2));

    // 4. Fetch all Facebook Pages the user granted access to
    let userPages = [];
    try {
      const pagesResponse = await axios.get(
        `https://graph.facebook.com/${apiVersion}/me/accounts`,
        {
          params: {
            fields: 'id,name,access_token,category,tasks',
            access_token: accessToken,
          },
          timeout: 10000,
        }
      );
      userPages = pagesResponse.data?.data || [];
      console.log(`[DEBUG 6] Retrieved ${userPages.length} Facebook Page(s) from /me/accounts:`,
        JSON.stringify(userPages.map((p) => ({ id: p.id, name: p.name, category: p.category, hasToken: !!p.access_token })), null, 2)
      );

      // If no direct pages found, check for Business Portfolio pages (e.g. Admission-360)
      if (userPages.length === 0) {
        try {
          const bizResponse = await axios.get(
            `https://graph.facebook.com/${apiVersion}/me/businesses`,
            {
              params: {
                fields: 'id,name,owned_pages{id,name,access_token},client_pages{id,name,access_token}',
                access_token: accessToken,
              },
              timeout: 10000,
            }
          );
          const businesses = bizResponse.data?.data || [];
          for (const biz of businesses) {
            const owned = biz.owned_pages?.data || [];
            const client = biz.client_pages?.data || [];
            userPages.push(...owned, ...client);
          }
          if (userPages.length > 0) {
            console.log(`[DEBUG 6b] Retrieved ${userPages.length} Page(s) from Business Portfolio:`, userPages.map(p => p.name));
          }
        } catch (bizErr) {
          console.warn('⚠️ [DEBUG WARN] Business pages check notice:', bizErr.message);
        }
      }
    } catch (pageErr) {
      console.warn('⚠️ [DEBUG WARN] Could not fetch user pages from /me/accounts:', pageErr.response?.data || pageErr.message);
    }

    const encryptedUserToken = encrypt(accessToken);

    // 5. Save/Update integration per Page (or fallback if no pages found)
    if (userPages.length > 0) {
      console.log(`[DEBUG 7] Iterating through ${userPages.length} pages to save in MongoDB...`);
      for (const page of userPages) {
        const pageId = String(page.id);
        const pageName = page.name || 'Facebook Page';
        const pageAccessToken = page.access_token || accessToken;
        const encryptedPageToken = encrypt(pageAccessToken);

        console.log(`\n  --> [PAGE PROCESSING] ID: ${pageId} | Name: "${pageName}"`);

        // 5a. Automatically subscribe CRM app to leadgen webhooks for this page
        try {
          const subRes = await axios.post(
            `https://graph.facebook.com/${apiVersion}/${pageId}/subscribed_apps`,
            null,
            {
              params: {
                subscribed_fields: 'leadgen',
                access_token: pageAccessToken,
              },
              timeout: 8000,
            }
          );
          console.log(`      [WEBHOOK SUB] Subscribed App to Page "${pageName}" (${pageId}):`, subRes.data);
        } catch (subErr) {
          console.warn(`      ⚠️ [WEBHOOK SUB WARN] Subscribed apps for Page ${pageId}:`, subErr.response?.data || subErr.message);
        }

        // 5b. Fetch instant leadgen forms for this page to pre-index form IDs
        let formIds = [];
        let formNames = [];
        try {
          const formsResponse = await axios.get(
            `https://graph.facebook.com/${apiVersion}/${pageId}/leadgen_forms`,
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
          console.log(`      [FORMS] Found ${forms.length} leadgen form(s) for Page ${pageId}:`, formIds);
        } catch (formErr) {
          console.warn(`      ⚠️ [FORMS WARN] Forms fetch notice for Page ${pageId}:`, formErr.message);
        }

        // 5c. Upsert Integration document keyed by Page ID (preventing collision on unique compound index)
        const pageQuery = stateData.companyId
          ? { companyId: stateData.companyId, provider: 'meta', accountId: pageId }
          : { userId: stateData.userId, provider: 'meta', accountId: pageId };

        const updatePayload = {
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
        };

        console.log('      [MONGO UPSERT QUERY]:', JSON.stringify(pageQuery, null, 2));
        console.log('      [MONGO UPSERT SET]:', JSON.stringify({
          userId: updatePayload.userId,
          companyId: updatePayload.companyId,
          provider: updatePayload.provider,
          accountId: updatePayload.accountId,
          accountName: updatePayload.accountName,
          pageId: updatePayload.pageId,
          formIds: updatePayload.formIds,
        }, null, 2));

        const savedDoc = await Integration.findOneAndUpdate(
          pageQuery,
          { $set: updatePayload },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        console.log(`      ✅ [MONGO UPSERT SUCCESS] Doc ID: ${savedDoc._id} | AccountId: ${savedDoc.accountId} | PageId: ${savedDoc.pageId}`);
      }
    } else {
      console.log('[DEBUG 7] No pages found in /me/accounts, saving user fallback record...');
      const userQuery = stateData.companyId
        ? { companyId: stateData.companyId, provider: 'meta', accountId: metaUser.id }
        : { userId: stateData.userId, provider: 'meta', accountId: metaUser.id };

      const fallbackPayload = {
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
      };

      console.log('      [MONGO FALLBACK QUERY]:', JSON.stringify(userQuery, null, 2));
      const savedDoc = await Integration.findOneAndUpdate(
        userQuery,
        { $set: fallbackPayload },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
      console.log(`      ✅ [MONGO FALLBACK SUCCESS] Doc ID: ${savedDoc._id}`);
    }

    console.log('[DEBUG 8] OAuth flow completed successfully, redirecting to frontend dashboard...');
    console.log('================== [META OAUTH CALLBACK DEBUG END] ==================\n');

    // 302 Redirect user back to integrations page with success query param
    return res.redirect(`${resolvedFrontendUrl}/integrations?meta=connected`);
  } catch (error) {
    console.error('\n❌❌❌ [CRITICAL META OAUTH CALLBACK ERROR DETECTED] ❌❌❌');
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('Error Status:', error.response?.status);
    console.error('Error Response Data:', JSON.stringify(error.response?.data || {}, null, 2));
    console.error('Error Stack Trace:\n', error.stack);
    console.error('===================================================================\n');

    return res.redirect(`${resolvedFrontendUrl}/integrations?meta=error&message=${encodeURIComponent(error.message || 'Meta connection failed')}`);
  }
};