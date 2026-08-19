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

const { protect } = require('../middleware/auth');

// ============================================================
// GOOGLE ACCOUNT MANAGEMENT
// ============================================================

router.get(
  '/',
  protect,
  googleIntegrationController.getIntegrations
);

router.get(
  '/accounts',
  protect,
  googleIntegrationController.getAccounts
);

router.post(
  '/configure',
  protect,
  googleIntegrationController.configure
);

router.post(
  '/test',
  protect,
  googleIntegrationController.testConnection
);

router.delete(
  '/:integrationId',
  protect,
  googleIntegrationController.disconnect
);

module.exports = router;