const axios = require('axios');
const crypto = require('crypto');

const META_AUTH_URL =
  'https://www.facebook.com/vXX.X/dialog/oauth';

function generateState(payload) {
  const json = JSON.stringify(payload);

  return crypto
    .createHmac(
      'sha256',
      process.env.META_APP_SECRET
    )
    .update(json)
    .digest('hex');
}

function buildMetaOAuthUrl({
  userId,
  mode,
}) {
  const state = Buffer.from(
    JSON.stringify({
      userId,
      mode,
      nonce: crypto.randomUUID(),
    })
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,

    redirect_uri:
      process.env.META_REDIRECT_URI,

    state,

    response_type: 'code',

    // Keep only permissions actually required
    scope: [
      'public_profile',
      // Add currently approved lead/ad permissions here
      // after Meta app configuration/review.
    ].join(','),
  });

  return `${META_AUTH_URL}?${params.toString()}`;
}

module.exports = {
  buildMetaOAuthUrl,
};