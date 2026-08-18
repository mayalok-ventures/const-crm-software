const express = require('express');

const router = express.Router();

const googleOAuthController = require('../controllers/integrations/googleOAuthController');
const googleWebhookController = require('../controllers/integrations/googleWebhookController');
const googleIntegrationController = require('../controllers/integrations/googleIntegrationController');

// ============================================================
// GOOGLE OAUTH
// ============================================================

router.get(
  '/oauth',
  googleOAuthController.startOAuth
);

router.get(
  '/oauth/callback',
  googleOAuthController.callback
);

// ============================================================
// GOOGLE WEBHOOK
// ============================================================

// Google lead notification endpoint
//
// IMPORTANT:
// Do NOT put normal JWT authentication here.

router.post(
  '/webhook',
  express.json({
    type: 'application/json',
  }),
  googleWebhookController.receive
);

// ============================================================
// GOOGLE ACCOUNT MANAGEMENT
// ============================================================

router.get(
  '/',
  googleIntegrationController.getIntegrations
);

router.get(
  '/accounts',
  googleIntegrationController.getAccounts
);

router.post(
  '/configure',
  googleIntegrationController.configure
);

router.post(
  '/test',
  googleIntegrationController.testConnection
);

router.delete(
  '/:integrationId',
  googleIntegrationController.disconnect
);

module.exports = router;