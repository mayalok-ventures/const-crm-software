const crypto = require('crypto');
const ConsumedToken = require('../models/ConsumedToken');

const getSigningSecret = () => {
  return process.env.QUICK_ACTION_SECRET || process.env.JWT_SECRET || 'crm_quick_action_secret_fallback_2026';
};

/**
 * Base64URL encode/decode helpers
 */
const base64UrlEncode = (str) => {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (str) => {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
};

/**
 * Generate a cryptographically signed, short-lived quick action token.
 */
const generateQuickActionToken = ({
  followUpId,
  leadId,
  userId,
  workspaceId,
  action = null,
  expiresInSeconds = 1800, // 30 minutes default
}) => {
  if (!followUpId || !userId) {
    throw new Error('followUpId and userId are required to generate quick action token');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const exp = now + Math.max(60, expiresInSeconds) * 1000;

  const payload = {
    fupId: String(followUpId),
    leadId: leadId ? String(leadId) : null,
    userId: String(userId),
    wsId: workspaceId ? String(workspaceId) : null,
    action: action || null,
    nonce,
    iat: now,
    exp,
  };

  const payloadString = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadString);

  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
};

/**
 * Verify cryptographic signature and expiration of quick-action token without consuming.
 */
const verifyQuickActionTokenReadOnly = async (tokenString) => {
  if (!tokenString || typeof tokenString !== 'string') {
    throw new Error('Missing or invalid quick-action token string');
  }

  const parts = tokenString.split('.');
  if (parts.length !== 2) {
    throw new Error('Malformed quick-action token structure');
  }

  const [payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid quick-action token signature');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (_) {
    throw new Error('Invalid quick-action token payload encoding');
  }

  if (Date.now() > payload.exp) {
    throw new Error('Quick-action token has expired');
  }

  return {
    followUpId: payload.fupId,
    leadId: payload.leadId,
    userId: payload.userId,
    workspaceId: payload.wsId,
    action: payload.action,
    nonce: payload.nonce,
    exp: payload.exp,
  };
};

/**
 * Verify cryptographic signature, expiration, AND atomically consume nonce (single-use replay prevention).
 */
const verifyAndConsumeQuickActionToken = async (tokenString) => {
  const verified = await verifyQuickActionTokenReadOnly(tokenString);

  try {
    await ConsumedToken.create({
      nonce: verified.nonce,
      tokenType: 'quick_action',
      userId: verified.userId,
      workspaceId: verified.workspaceId,
      expiresAt: new Date(verified.exp),
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new Error('Quick-action token has already been consumed (replay prevented)');
    }
    throw err;
  }

  return verified;
};

module.exports = {
  generateQuickActionToken,
  verifyQuickActionTokenReadOnly,
  verifyAndConsumeQuickActionToken,
};
