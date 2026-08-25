const crypto = require('crypto');
const axios = require('axios');
const Integration = require('../../models/Integration');
const { encrypt } = require('../../utils/encryption');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getGoogleRedirectUri(req) {
  if (req && req.query && req.query.redirect_uri) return req.query.redirect_uri;
  if (process.env.GOOGLE_REDIRECT_URI && !process.env.GOOGLE_REDIRECT_URI.includes('localhost')) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  if (process.env.BACKEND_URL && !process.env.BACKEND_URL.includes('localhost')) {
    return `${process.env.BACKEND_URL}/api/integrations/google/oauth/callback`;
  }
  return 'https://api.sahyak.com/api/integrations/google/oauth/callback';
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

function generateOAuthState(userId, companyId, frontendUrl) {
  const secret = process.env.JWT_SECRET || 'crm_oauth_state_hmac_secret';
  const payload = {
    userId: String(userId),
    companyId: companyId ? String(companyId) : null,
    frontendUrl: frontendUrl || process.env.FRONTEND_URL || 'https://crm.sahyak.com',
    timestamp: Date.now(),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyOAuthState(state) {
  if (!state || typeof state !== 'string') return null;
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const secret = process.env.JWT_SECRET || 'crm_oauth_state_hmac_secret';
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() - payload.timestamp > 15 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * GET /api/integrations/google/oauth
 */
exports.startOAuth = exports.start = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to connect Google Ads',
        code: 'AUTH_REQUIRED',
      });
    }

    const clientId = GOOGLE_CLIENT_ID || (req.query && req.query.client_id) || null;
    const clientSecret = GOOGLE_CLIENT_SECRET || null;
    const redirectUri = getGoogleRedirectUri(req);

    // Extract frontendUrl dynamically
    let frontendUrl = req.query.frontendUrl || null;
    if (!frontendUrl && req.headers.referer) {
      try {
        const parsedReferer = new URL(req.headers.referer);
        frontendUrl = parsedReferer.origin;
      } catch {}
    }
    if (!frontendUrl) {
      const isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || (req && req.headers && req.headers.host && req.headers.host.includes('localhost'));
      frontendUrl = isLocal ? 'http://localhost:3000' : (process.env.FRONTEND_URL || 'https://crm.sahyak.com');
    }

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? req.user._id : null);

    // Sandbox check
    const isSandboxMode = req.query.sandbox === 'true' || !clientId || clientId.startsWith('dev_') || !clientId.includes('.apps.googleusercontent.com');

    if (isSandboxMode) {
      const encryptedRefreshToken = encrypt('google_sandbox_refresh_token_' + Date.now());
      const query = companyId
        ? { companyId, provider: 'google', accountId: 'google_sandbox_acc_01' }
        : { userId: req.user._id, provider: 'google', accountId: 'google_sandbox_acc_01' };

      await Integration.findOneAndUpdate(
        query,
        {
          $set: {
            userId: req.user._id,
            companyId: companyId || null,
            provider: 'google',
            mode: 'client_managed',
            status: 'connected',
            accountId: 'google_sandbox_acc_01',
            accountName: 'Google Ads (Sandbox / Test Account)',
            customerId: '987-654-3210',
            refreshTokenEncrypted: encryptedRefreshToken,
            tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            connectedAt: new Date(),
            metadata: {
              googleUserId: 'google_sandbox_user',
              googleUserName: 'Sandbox Google Marketer',
              googleUserEmail: req.user.email,
              isSandbox: true,
            },
            lastError: '',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const redirectTarget = `${frontendUrl}/integrations?google=connected&account=${encodeURIComponent('Google Ads (Sandbox Mode)')}`;
      if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, sandbox: true, redirectUrl: redirectTarget });
      }
      return res.redirect(redirectTarget);
    }

    if (!clientSecret) {
      return res.status(500).json({
        success: false,
        message: 'Google OAuth client secret is not configured on server',
        code: 'OAUTH_NOT_CONFIGURED',
      });
    }

    const state = generateOAuthState(req.user._id, companyId, frontendUrl);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        authorizationUrl: url,
      });
    }

    return res.redirect(url);
  } catch (error) {
    console.error('Google OAuth start error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to start Google OAuth',
    });
  }
};

/**
 * GET /api/integrations/google/oauth/callback
 */
exports.callback = async (req, res) => {
  const isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || (req && req.headers && req.headers.host && req.headers.host.includes('localhost'));
  let resolvedFrontendUrl = isLocal ? 'http://localhost:3000' : (process.env.FRONTEND_URL || 'https://crm.sahyak.com');
  const redirectUri = getGoogleRedirectUri(req);
  try {
    const { code, state, error, error_description } = req.query;

    if (state) {
      const stateData = verifyOAuthState(state);
      if (stateData && stateData.frontendUrl) {
        resolvedFrontendUrl = stateData.frontendUrl;
      }
    }

    if (error) {
      console.warn('Google OAuth authorization error:', error_description || error);
      return res.redirect(`${resolvedFrontendUrl}/integrations?google=error&message=${encodeURIComponent(error_description || 'Authorization denied')}`);
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing OAuth code or state',
        code: 'INVALID_CALLBACK_PARAMS',
      });
    }

    const stateData = verifyOAuthState(state);
    if (!stateData) {
      return res.status(400).json({
        success: false,
        message: 'OAuth state signature is invalid or expired',
        code: 'INVALID_OAUTH_STATE',
      });
    }

    // 1. Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      throw new Error('Google did not return an access token');
    }

    // 2. Fetch Google profile
    let googleUser = { id: `google_act_${Date.now()}`, name: 'Google Ads User' };
    try {
      const userResponse = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
      googleUser = userResponse.data;
    } catch (e) {
      console.warn('Could not fetch userinfo profile, using token metadata:', e.message);
    }

    // 3. Save Integration with encrypted credentials
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    const query = stateData.companyId
      ? { companyId: stateData.companyId, provider: 'google', accountId: String(googleUser.id) }
      : { userId: stateData.userId, provider: 'google', accountId: String(googleUser.id) };

    const updateDoc = {
      $set: {
        userId: stateData.userId,
        companyId: stateData.companyId || null,
        provider: 'google',
        mode: 'client_managed',
        status: 'connected',
        accountId: String(googleUser.id),
        accountName: googleUser.name || googleUser.email || 'Google Ads Account',
        accessTokenEncrypted: encryptedAccessToken,
        tokenExpiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
        connectedAt: new Date(),
        metadata: {
          googleUserId: googleUser.id,
          email: googleUser.email || '',
          name: googleUser.name || '',
        },
        lastError: '',
      },
    };

    if (encryptedRefreshToken) {
      updateDoc.$set.refreshTokenEncrypted = encryptedRefreshToken;
    }

    await Integration.findOneAndUpdate(query, updateDoc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    return res.redirect(`${resolvedFrontendUrl}/integrations?google=connected&account=${encodeURIComponent(googleUser.name || googleUser.id)}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error.response?.data || error.message);
    return res.redirect(`${resolvedFrontendUrl}/integrations?google=error&message=${encodeURIComponent(error.message || 'Google connection failed')}`);
  }
};