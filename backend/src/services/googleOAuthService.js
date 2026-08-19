const { google } = require('googleapis');
const crypto = require('crypto');

function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function buildGoogleOAuthUrl({
  userId,
  mode,
}) {
  const oauth2Client =
    getGoogleOAuthClient();

  const state = Buffer.from(
    JSON.stringify({
      userId,
      mode,
      nonce: crypto.randomUUID(),
    })
  ).toString('base64url');

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',

    scope: [
      'openid',
      'email',
      'profile',
    ],

    state,
  });
}

module.exports = {
  getGoogleOAuthClient,
  buildGoogleOAuthUrl,
};